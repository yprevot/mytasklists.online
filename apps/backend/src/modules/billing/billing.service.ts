import type { BillingPlans, BillingState } from '@lista/contracts';
import { ActivityLog } from '../../database/entities';
import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import Stripe from 'stripe';
import { createHash } from 'node:crypto';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null;
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {
    this.stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {timeout:10000,maxNetworkRetries:2}) : null;
  }
  plans(): BillingPlans {
    return { currency:'USD', price:500, interval:'month', enabled:this.enabled,
      benefits:{es:process.env.BILLING_BENEFITS_ES||'Suscripción disponible próximamente.',en:process.env.BILLING_BENEFITS_EN||'Subscription coming soon.'},
      limits:{freeLists:this.limit('FREE_MAX_LISTS'),freeItems:this.limit('FREE_MAX_ITEMS_PER_LIST'),premiumLists:this.limit('PREMIUM_MAX_LISTS'),premiumItems:this.limit('PREMIUM_MAX_ITEMS_PER_LIST')},
      stores:{ios:process.env.BILLING_COMMERCE_READY==='true'&&process.env.BILLING_APPLE_ENABLED==='true'&&!!process.env.APP_STORE_PRIVATE_KEY&&!!process.env.APPLE_ROOT_CERT_PATHS,android:process.env.BILLING_COMMERCE_READY==='true'&&process.env.BILLING_GOOGLE_ENABLED==='true'&&!!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,iosProduct:process.env.APPLE_SUBSCRIPTION_ID||null,androidProduct:process.env.GOOGLE_SUBSCRIPTION_ID||null,androidBasePlan:process.env.GOOGLE_BASE_PLAN_ID||'monthly'} };
  }
  private limit(key:string):number|null {const n=Number(process.env[key]);return Number.isInteger(n)&&n>0?n:null;}
  get enabled() {return Boolean(this.stripe && process.env.BILLING_ENABLED==='true' && process.env.BILLING_COMMERCE_READY==='true' && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET && process.env.BILLING_BENEFITS_ES && process.env.BILLING_BENEFITS_EN);}
  private client() {if(!this.enabled || !this.stripe)throw new ServiceUnavailableException('La suscripción de pago todavía no está disponible. Puedes continuar gratis.');return this.stripe;}
  async state(userId:string): Promise<BillingState> {
    const rows=await this.db.query('SELECT provider,status,period_end,cancel_at_period_end FROM billing_subscriptions WHERE user_id=$1 ORDER BY period_end DESC NULLS LAST',[userId]);
    const active=rows.find((r:any)=>['active','trialing','grace'].includes(r.status)&&r.period_end&&new Date(r.period_end).getTime()>Date.now());
    return {plan:active?'premium':'free',subscription:active||rows[0]||null,accountToken:userId,googleAccountId:createHash('sha256').update(userId).digest('hex')};
  }
  async assertCapacity(userId:string,kind:'lists'|'items',count:number) {
    const technical=kind==='lists'?100:2000;
    if(count>=technical)throw new ForbiddenException('Se alcanzó el límite técnico de capacidad. Reduce las listas o elementos antes de añadir más.');
    const premium=(await this.state(userId)).plan==='premium';const limit=this.limit(`${premium?'PREMIUM':'FREE'}_MAX_${kind==='lists'?'LISTS':'ITEMS_PER_LIST'}`);
    if(limit && count>=limit)throw new ForbiddenException('Has alcanzado el límite de tu plan. Conservas tus datos; revisa Mi plan para ampliar tu capacidad.');
  }
  private async price() {
    const p=await this.client().prices.retrieve(process.env.STRIPE_PRICE_ID!);
    if(p.livemode!==(process.env.BILLING_MODE==='live')||!p.active||p.currency!=='usd'||p.unit_amount!==500||p.recurring?.interval!=='month'||p.recurring.interval_count!==1)
      throw new ServiceUnavailableException('El precio de la suscripción no está disponible.');
    return p;
  }
  async promotion(code:string,userId:string) {
    const stripe=this.client();const price=await this.price();
    const [p]= (await stripe.promotionCodes.list({code:code.trim(),active:true,limit:1,expand:['data.promotion.coupon']})).data;
    if(!p)throw new BadRequestException('El código no es válido o ya expiró');
    const coupon=typeof p.promotion.coupon==='string'?await stripe.coupons.retrieve(p.promotion.coupon):p.promotion.coupon;
    if(!coupon)throw new BadRequestException('El código no tiene descuento disponible');
    const [account]=await this.db.query('SELECT customer_id FROM billing_accounts WHERE user_id=$1',[userId]);
    const customer=typeof p.customer==='string'?p.customer:p.customer?.id;
    const [everPaid]=await this.db.query('SELECT id FROM billing_subscriptions WHERE user_id=$1 LIMIT 1',[userId]);
    const now=Math.floor(Date.now()/1000);
    if(!coupon.valid || p.expires_at&&p.expires_at<=now || p.max_redemptions!==null&&p.times_redeemed>=p.max_redemptions ||
      customer&&customer!==account?.customer_id || p.restrictions.first_time_transaction&&everPaid ||
      p.restrictions.minimum_amount&&500<p.restrictions.minimum_amount || p.restrictions.minimum_amount_currency&&p.restrictions.minimum_amount_currency!=='usd' ||
      coupon.currency&&coupon.currency!=='usd' || coupon.applies_to?.products&&!coupon.applies_to.products.includes(String(price.product)))
      throw new BadRequestException('Este código no está disponible para tu cuenta o plan');
    const discount=coupon.percent_off!==null?Math.round(500*coupon.percent_off/100):Math.min(500,coupon.amount_off||0);
    return {code:p.code,promotionId:p.id,subtotal:500,discount,total:500-discount,currency:'USD',duration:coupon.duration,months:coupon.duration_in_months,expiresAt:p.expires_at};
  }
  async checkout(userId:string,code?:string,expectedTotal?:number) {
    const stripe=this.client();await this.price();
    return this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['billing:'+userId]);
      const state=await this.state(userId);
      if(state.plan==='premium')throw new BadRequestException('Ya tienes Premium. Administra tu suscripción actual.');
      const [pending]=await m.query('SELECT * FROM billing_checkouts WHERE user_id=$1 AND expires_at>now()',[userId]);
      if(pending) {const previous=await stripe.checkout.sessions.retrieve(pending.session_id);if(previous.status==='open'){const quote=code?await this.promotion(code,userId):null;if(expectedTotal!==undefined&&expectedTotal!==(quote?.total??500))throw new BadRequestException('El precio cambió. Revisa el importe y confirma de nuevo.');if(previous.metadata?.promotionId===(quote?.promotionId||'none'))return {url:previous.url};await stripe.checkout.sessions.expire(previous.id);}if(previous.status==='complete')throw new BadRequestException('Tu pago está procesándose. Actualiza Mi plan.');}
      let [account]=await m.query('SELECT customer_id FROM billing_accounts WHERE user_id=$1',[userId]);
      if(!account){const customer=await stripe.customers.create({metadata:{userId}},{idempotencyKey:'customer:'+userId});await m.query('INSERT INTO billing_accounts(user_id,customer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[userId,customer.id]);account={customer_id:customer.id};}
      const promo=code?await this.promotion(code,userId):null;
      if(expectedTotal!==undefined&&expectedTotal!==(promo?.total??500))throw new BadRequestException('El precio cambió. Revisa el importe y confirma de nuevo.');
      const base=this.config.get<string>('publicUrl')!;
      const session=await stripe.checkout.sessions.create({mode:'subscription',customer:account.customer_id,client_reference_id:userId,metadata:{promotionId:promo?.promotionId||'none'},
        automatic_tax:{enabled:process.env.STRIPE_AUTOMATIC_TAX==='true'},line_items:[{price:process.env.STRIPE_PRICE_ID!,quantity:1}],subscription_data:{metadata:{userId}},
        ...(promo?{discounts:[{promotion_code:promo.promotionId}]}:{}),
        success_url:`${base}/app/billing?checkout=returned`,cancel_url:`${base}/app/billing?checkout=cancelled`,expires_at:Math.floor(Date.now()/1000)+1800},
        {idempotencyKey:'checkout:'+userId+':'+Date.now()+':'+(promo?.promotionId||'none')});
      await m.query('INSERT INTO billing_checkouts(user_id,session_id,expires_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET session_id=$2,expires_at=$3',[userId,session.id,new Date(session.expires_at*1000)]);
      return {url:session.url};
    });
  }
  async portal(userId:string) {
    const [account]=await this.db.query('SELECT customer_id FROM billing_accounts WHERE user_id=$1',[userId]);
    if(!account)throw new BadRequestException('Administra la suscripción desde la tienda donde la contrataste.');
    const portal=await this.client().billingPortal.sessions.create({customer:account.customer_id,return_url:this.config.get<string>('publicUrl')+'/app/billing'});
    return {url:portal.url};
  }
  async syncStripe(id:string,m:EntityManager=this.db.manager) {
    if(!this.stripe)return;
    const s=await this.stripe.subscriptions.retrieve(id);
    if(s.livemode!==(process.env.BILLING_MODE==='live'))throw new BadRequestException('Entorno de pago incorrecto');
    const userId=s.metadata.userId;const [known]=await m.query('SELECT user_id FROM billing_subscriptions WHERE provider=\'stripe\' AND external_id=$1',[id]);
    if(!known && (!userId||! /^[0-9a-f-]{36}$/i.test(userId)))throw new BadRequestException('Cuenta de suscripción inválida');
    const period=Math.max(0,...s.items.data.map(i=>i.current_period_end));
    const productMatch=s.items.data.some(i=>i.price.id===process.env.STRIPE_PRICE_ID);
    await m.query(`INSERT INTO billing_subscriptions(user_id,provider,external_id,customer_id,status,period_end,cancel_at_period_end)
      VALUES($1,'stripe',$2,$3,$4,$5,$6) ON CONFLICT(provider,external_id) DO UPDATE SET status=$4,period_end=$5,cancel_at_period_end=$6,updated_at=now()`,
      [known?known.user_id:userId,id,typeof s.customer==='string'?s.customer:s.customer.id,productMatch?s.status:'invalid_product',period?new Date(period*1000):null,s.cancel_at_period_end]);
  }
  async webhook(raw:Buffer,signature:string) {
    if(!this.stripe||!process.env.STRIPE_WEBHOOK_SECRET)throw new ServiceUnavailableException();
    let event:Stripe.Event;
    try{event=this.stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);}catch{throw new BadRequestException('Firma de pago inválida');}
    if(event.livemode!==(process.env.BILLING_MODE==='live'))throw new BadRequestException('Entorno de pago incorrecto');
    await this.db.transaction(async m=>{
      const rows=await m.query('INSERT INTO billing_events(provider,event_id) VALUES(\'stripe\',$1) ON CONFLICT DO NOTHING RETURNING event_id',[event.id]);
      if(!rows.length)return;
      const obj=event.data.object as unknown as {id:string;subscription?:string|null;parent?:{subscription_details?:{subscription?:string}}};
      const id=event.type.startsWith('customer.subscription.')?obj.id:obj.subscription||obj.parent?.subscription_details?.subscription;
      if(id){await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['stripe:'+id]);await this.syncStripe(id,m);}
    });return {ok:true};
  }
  @Cron('0 */15 * * * *')
  async reconcile() {
    if(!this.stripe)return;
    const rows=await this.db.query("SELECT external_id FROM billing_subscriptions WHERE provider='stripe' AND status NOT IN ('canceled','incomplete_expired')");
    for(const row of rows)try{await this.db.transaction(async m=>{await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['stripe:'+row.external_id]);await this.syncStripe(row.external_id,m);});}catch{/* Next run retries; no secrets in logs. */}
  }
  async preventOrphanedBilling(userId:string) {
    const rows=await this.db.query("SELECT provider,status FROM billing_subscriptions WHERE user_id=$1 AND status NOT IN ('canceled','expired','revoked','incomplete_expired')",[userId]);
    const [pending]=await this.db.query('SELECT session_id FROM billing_checkouts WHERE user_id=$1 AND expires_at>now()',[userId]);
    if(rows.length||pending)throw new BadRequestException('Cancela tu suscripción y espera a que termine antes de eliminar la cuenta. Adminístrala desde Mi plan o la tienda correspondiente.');
  }
  async adminPromotions(){return this.db.query('SELECT code,stripe_id,active,created_at FROM billing_promotions ORDER BY created_at DESC');}
  async createPromotion(dto:{code:string;percent?:number;amount?:number;expiresAt?:string;months:number;maxUses:number},actorId:string) {
    if(Boolean(dto.percent)===Boolean(dto.amount))throw new BadRequestException('Elige descuento porcentual o fijo');
    if(dto.expiresAt&&Date.parse(dto.expiresAt)<=Date.now())throw new BadRequestException('La fecha de caducidad debe ser futura');
    const stripe=this.client();const code=dto.code.trim().toUpperCase();let createdPromotion:string|undefined;
    try{return await this.db.transaction(async m=>{
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['promotion:'+code]);
      if((await m.query('SELECT code FROM billing_promotions WHERE code=$1',[code])).length)throw new BadRequestException('El código ya existe');
      const coupon=await stripe.coupons.create({...(dto.percent?{percent_off:dto.percent}:{amount_off:dto.amount,currency:'usd'}),duration:'repeating',duration_in_months:dto.months,applies_to:{products:[String((await this.price()).product)]}});
      const p=await stripe.promotionCodes.create({promotion:{type:'coupon',coupon:coupon.id},code,max_redemptions:dto.maxUses,...(dto.expiresAt?{expires_at:Math.floor(Date.parse(dto.expiresAt)/1000)}:{}),restrictions:{first_time_transaction:true}});
      createdPromotion=p.id;
      await m.query('INSERT INTO billing_promotions(code,stripe_id) VALUES($1,$2)',[p.code,p.id]);
      await m.getRepository(ActivityLog).save({userId:actorId,action:'promotion.created',summary:p.code});return {code:p.code};
    });}catch(error){
      if(createdPromotion)await stripe.promotionCodes.update(createdPromotion,{active:false});
      throw error;
    }
  }

  async disablePromotion(code:string,actorId:string) {const [row]=await this.db.query('SELECT stripe_id FROM billing_promotions WHERE code=$1',[code]);if(!row)throw new BadRequestException('Código no encontrado');await this.client().promotionCodes.update(row.stripe_id,{active:false});await this.db.query('UPDATE billing_promotions SET active=false WHERE code=$1',[code]);await this.db.getRepository(ActivityLog).save({userId:actorId,action:'promotion.disabled',summary:code});return {ok:true};}
}
