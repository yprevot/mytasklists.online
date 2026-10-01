import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { encryptSecret, decryptSecret } from '../auth/totp';
import { StorePurchaseDto } from './billing.dto';

@Injectable()
export class StoreBillingService {
 constructor(private readonly db:DataSource,private readonly config:ConfigService){}
 private get environment(){return process.env.BILLING_MODE==='live'?Environment.PRODUCTION:Environment.SANDBOX;}
 private appleVerifier(){
  if(process.env.BILLING_APPLE_ENABLED!=='true')throw new ServiceUnavailableException('Las compras Apple no están disponibles todavía');
  const paths=(process.env.APPLE_ROOT_CERT_PATHS||'').split(',').filter(Boolean);
  if(!paths.length)throw new ServiceUnavailableException('La validación Apple no está configurada');
  return new SignedDataVerifier(paths.map(p=>readFileSync(p)),true,this.environment,process.env.APPLE_BUNDLE_ID||'online.mytasklists.app',process.env.APPLE_APP_ID?Number(process.env.APPLE_APP_ID):undefined);
 }
 private appleClient(){
  if(!process.env.APP_STORE_PRIVATE_KEY||!process.env.APP_STORE_KEY_ID||!process.env.APP_STORE_ISSUER_ID)throw new ServiceUnavailableException('La validación Apple no está configurada');
  return new AppStoreServerAPIClient(process.env.APP_STORE_PRIVATE_KEY.replace(/\\n/g,'\n'),process.env.APP_STORE_KEY_ID,process.env.APP_STORE_ISSUER_ID,process.env.APPLE_BUNDLE_ID||'online.mytasklists.app',this.environment);
 }
 async verify(userId:string,dto:StorePurchaseDto){
  if(dto.provider==='apple'){
   const verifier=this.appleVerifier();let transaction;try{transaction=await verifier.verifyAndDecodeTransaction(dto.token);}catch{throw new BadRequestException('La firma de la compra no es válida');}
   if(transaction.productId!==process.env.APPLE_SUBSCRIPTION_ID||transaction.appAccountToken!==userId||!transaction.originalTransactionId)throw new ForbiddenException('La compra no pertenece a esta cuenta o producto');
   await this.syncApple(transaction.originalTransactionId,userId);
  }else{if(dto.productId!==process.env.GOOGLE_SUBSCRIPTION_ID)throw new BadRequestException('Producto incorrecto');await this.syncGoogle(dto.token,userId);}
  return {ok:true};
 }
 private async persist(m:EntityManager,provider:string,externalId:string,userId:string,status:string,end:Date|null,cancel:boolean,token?:string){
  const [known]=await m.query('SELECT user_id FROM billing_subscriptions WHERE provider=$1 AND external_id=$2 FOR UPDATE',[provider,externalId]);
  if(known && known.user_id!==userId)throw new ForbiddenException('La compra está vinculada a otra cuenta');
  await m.query(`INSERT INTO billing_subscriptions(user_id,provider,external_id,status,period_end,cancel_at_period_end,provider_token)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,external_id) DO UPDATE SET status=$4,period_end=$5,cancel_at_period_end=$6,updated_at=now()`,[userId,provider,externalId,status,end,cancel,token||null]);
 }
 async syncApple(originalId:string,userId?:string){
  return this.db.transaction(async m=>{
   await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['apple:'+originalId]);
   const verifier=this.appleVerifier();const result=await this.appleClient().getAllSubscriptionStatuses(originalId);
   for(const group of result.data||[])for(const last of group.lastTransactions||[]){
    if(last.originalTransactionId!==originalId||!last.signedTransactionInfo)continue;
    const t=await verifier.verifyAndDecodeTransaction(last.signedTransactionInfo);
    if(!t.appAccountToken||t.productId!==process.env.APPLE_SUBSCRIPTION_ID||userId&&t.appAccountToken!==userId)throw new ForbiddenException('Compra de otra cuenta o producto');
    const [user]=await m.query('SELECT id FROM users WHERE id=$1',[t.appAccountToken]);if(!user)return;
    const renewal=last.signedRenewalInfo?await verifier.verifyAndDecodeRenewalInfo(last.signedRenewalInfo):null;
    const grace=last.status===4&&renewal?.gracePeriodExpiresDate;
    const status=t.revocationDate?'revoked':last.status===1?'active':grace?'grace':last.status===5?'revoked':'expired';
    await this.persist(m,'apple',originalId,t.appAccountToken,status,new Date(Number(grace||t.expiresDate||0)),renewal?.autoRenewStatus===0);return;
   }
   throw new BadRequestException('Suscripción no encontrada');
  });
 }
 private async googleClient(){
  if(process.env.BILLING_GOOGLE_ENABLED!=='true'||!process.env.GOOGLE_SERVICE_ACCOUNT_JSON)throw new ServiceUnavailableException('Las compras Google no están disponibles todavía');
  return new GoogleAuth({credentials:JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),scopes:['https://www.googleapis.com/auth/androidpublisher']}).getClient();
 }
 async syncGoogle(token:string,userId?:string){
  const externalId=createHash('sha256').update(token).digest('hex');
  return this.db.transaction(async m=>{
   await m.query('SELECT pg_advisory_xact_lock(hashtext($1))',['google:'+externalId]);
   const client=await this.googleClient();const pkg=process.env.GOOGLE_PACKAGE_NAME||'online.mytasklists.app';
   const {data:s}=await client.request<any>({url:`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`});
   if(Boolean(s.testPurchase)!==(process.env.BILLING_MODE!=='live'))throw new BadRequestException('Entorno de compra incorrecto');
   const account=s.externalAccountIdentifiers?.obfuscatedExternalAccountId;
   const [known]=await m.query("SELECT user_id FROM billing_subscriptions WHERE provider='google' AND external_id=$1",[externalId]);
   const owner=userId||known?.user_id;if(!owner||account!==createHash('sha256').update(owner).digest('hex'))throw new ForbiddenException('La compra no pertenece a esta cuenta');
   const line=s.lineItems?.find((i:any)=>i.productId===process.env.GOOGLE_SUBSCRIPTION_ID);if(!line||line.offerDetails?.basePlanId!==(process.env.GOOGLE_BASE_PLAN_ID||'monthly'))throw new BadRequestException('Producto incorrecto');
   const state=s.subscriptionState;const status=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED'].includes(state)?'active':state==='SUBSCRIPTION_STATE_IN_GRACE_PERIOD'?'grace':state==='SUBSCRIPTION_STATE_PENDING'?'pending':'expired';
   if(status==='pending')throw new BadRequestException('El pago está pendiente. Confírmalo en Google Play.');
   if(s.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING'&&['active','grace'].includes(status))await client.request({method:'POST',url:`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(line.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,data:{}});
   await this.persist(m,'google',externalId,owner,status,line.expiryTime?new Date(line.expiryTime):null,!line.autoRenewingPlan?.autoRenewEnabled,encryptSecret(token,this.config.get<string>('encryptionKey')!));
  });
 }
 async appleNotification(payload:string){
  if(typeof payload!=='string'||payload.length>60000)throw new BadRequestException('Notificación inválida');
  const verifier=this.appleVerifier();let notification;try{notification=await verifier.verifyAndDecodeNotification(payload);}catch{throw new BadRequestException('La firma de la notificación no es válida');}
  const signed=notification.data?.signedTransactionInfo;
  if(signed){const t=await this.appleVerifier().verifyAndDecodeTransaction(signed);if(t.originalTransactionId)await this.syncApple(t.originalTransactionId);}
  return {ok:true};
 }
 async googleNotification(authorization:string,body:any){
  if(!process.env.GOOGLE_RTDN_AUDIENCE||!process.env.GOOGLE_RTDN_SERVICE_EMAIL)throw new ServiceUnavailableException();
  const token=authorization.replace(/^Bearer /,'');let payload;
  try{payload=(await new OAuth2Client().verifyIdToken({idToken:token,audience:process.env.GOOGLE_RTDN_AUDIENCE})).getPayload();}catch{throw new ForbiddenException('Firma inválida');}
  if(!payload?.email_verified||payload.email!==process.env.GOOGLE_RTDN_SERVICE_EMAIL)throw new ForbiddenException('Emisor inválido');
  let message;try{message=JSON.parse(Buffer.from(body.message.data,'base64').toString());}catch{throw new BadRequestException('Notificación inválida');}
  if(message.packageName!==(process.env.GOOGLE_PACKAGE_NAME||'online.mytasklists.app'))throw new BadRequestException('Paquete incorrecto');
  const purchaseToken=message.subscriptionNotification?.purchaseToken;
  if(purchaseToken){const hash=createHash('sha256').update(purchaseToken).digest('hex');const [known]=await this.db.query("SELECT user_id FROM billing_subscriptions WHERE provider='google' AND external_id=$1",[hash]);if(known?.user_id)await this.syncGoogle(purchaseToken,known.user_id);}
  return {ok:true};
 }
 @Cron('0 */15 * * * *')
 async reconcile(){
  const rows=await this.db.query("SELECT provider,external_id,provider_token,user_id FROM billing_subscriptions WHERE provider IN ('apple','google') AND user_id IS NOT NULL AND status NOT IN ('revoked','expired')");
  for(const r of rows)try{if(r.provider==='apple')await this.syncApple(r.external_id,r.user_id);else if(r.provider_token)await this.syncGoogle(decryptSecret(r.provider_token,this.config.get<string>('encryptionKey')!),r.user_id);}catch{/* Retry on next run; never log receipts or keys. */}
 }
}
