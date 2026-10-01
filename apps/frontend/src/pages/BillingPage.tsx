import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { BillingPlans, BillingState, PromotionQuote } from '@lista/contracts';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { billingApi } from '../api/endpoints';
export function BillingPage(){
 const {user}=useAuth();const {i18n}=useTranslation();const en=i18n.language.startsWith('en');
 const [plans,setPlans]=useState<BillingPlans|null>(null);const [state,setState]=useState<BillingState|null>(null);
 const [code,setCode]=useState('');const [quote,setQuote]=useState<PromotionQuote|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setPlans(await billingApi.plans());if(user)setState(await billingApi.me());}catch(e){setError((e as Error).message);}},[user]);
 useEffect(()=>{sessionStorage.setItem('lc.plan','premium');void load();},[load]);
 useEffect(()=>{if(!user||!location.search.includes('checkout=returned'))return;let count=0;const timer=setInterval(()=>{void load();if(++count>=15)clearInterval(timer);},2000);return ()=>clearInterval(timer);},[user,load]);
 async function apply(){setBusy(true);setError('');try{setQuote(await billingApi.promotion(code.trim()));}catch(e){setQuote(null);setError((e as Error).message);}finally{setBusy(false);}}
 async function pay(){setBusy(true);setError('');try{const r=await billingApi.checkout({...(quote?{code:quote.code}:{}),expectedTotal:quote?.total??500});window.location.assign(r.url);}catch(e){setQuote(null);setError((e as Error).message);setBusy(false);}}
 async function manage(){setBusy(true);setError('');try{window.location.assign((await billingApi.portal()).url);}catch(e){setError((e as Error).message);setBusy(false);}}
 const money=(n:number)=>new Intl.NumberFormat(en?'en-US':'es-MX',{style:'currency',currency:'USD'}).format(n/100);
 return <AuthShell><div data-testid="billing-page"><h1>{en?'Your plan':'Mi plan'}</h1>
  {error&&<p className="alert alert-danger" role="alert">{error}</p>}
  {!plans?<p role="status">{en?'Loading…':'Cargando…'}</p>:<>
   <p className="fs-4 fw-bold">{state?.plan==='premium'?'Premium':en?'Free':'Gratis'}</p>
   {state?.subscription&&<p>{en?'Subscription':'Suscripción'}: {state.subscription.provider} · {state.subscription.status}<br/>{state.subscription.period_end&&(en?'Period ends: ':'El período termina: ')+new Date(state.subscription.period_end).toLocaleDateString(en?'en-US':'es-MX')}</p>}
   {state?.plan==='premium'?<>
     {state.subscription?.provider==='stripe'?<button className="btn btn-primary" onClick={manage} disabled={busy}>{en?'Manage or cancel subscription':'Administrar o cancelar suscripción'}</button>:<a className="btn btn-primary" href={state.subscription?.provider==='apple'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions'}>{en?'Manage in store':'Administrar en la tienda'}</a>}
   </>:<>
    <h2>Premium · 5 USD / {en?'month':'mes'}</h2><p>{en?plans.benefits.en:plans.benefits.es}</p>
    {!user?<p>{en?'Verify your account before subscribing.':'Valida tu cuenta antes de suscribirte.'} <Link to="/register">{en?'Create account':'Crear cuenta'}</Link> · <Link to="/login">{en?'Sign in':'Ingresar'}</Link></p>:plans.enabled?<>
      <label className="form-label" htmlFor="promo-code">{en?'Promotional code (optional)':'Código promocional (opcional)'}</label>
      <div className="d-flex gap-2 mb-3"><input id="promo-code" className="form-control" value={code} maxLength={64} onChange={e=>{setCode(e.target.value);setQuote(null);}} data-testid="promo-code"/><button className="btn btn-outline-secondary" disabled={busy||!code.trim()} onClick={apply}>{en?'Apply':'Aplicar'}</button></div>
      {quote&&<p role="status">{en?'Discount':'Descuento'}: {money(quote.discount)} · {quote.duration==='once'?(en?'First invoice only':'Solo primera factura'):quote.duration==='repeating'?`${quote.months} ${en?'months':'meses'}`:en?'Every renewal':'Cada renovación'} <button className="btn btn-link" onClick={()=>{setQuote(null);setCode('');}}>{en?'Remove':'Quitar'}</button></p>}
      <p className="fs-5 fw-bold">{en?'Subtotal today':'Subtotal de hoy'}: {money(quote?.total??500)} USD</p>
      <p>{en?'Applicable taxes and final total are shown in secure checkout. Monthly renewal at 5 USD after any promotional period.':'Los impuestos aplicables y el total final se muestran en el pago seguro. Renovación mensual de 5 USD al terminar el período promocional.'}</p>
      <button className="btn btn-primary w-100" onClick={pay} disabled={busy||!!code.trim()&&!quote} data-testid="billing-checkout">{busy?(en?'Processing…':'Procesando…'):(en?'Continue to secure payment':'Continuar al pago seguro')}</button>
    </>:<p role="status" className="alert alert-info">{en?'Paid subscriptions are coming soon. You can continue using the free plan.':'Las suscripciones de pago estarán disponibles próximamente. Puedes continuar con el plan Gratis.'}</p>}
   </>}
   <p className="mt-4"><Link to="/" onClick={()=>sessionStorage.removeItem('lc.plan')}>{en?'Return to lists':'Volver a mis listas'}</Link> · <a href={en?'/en/pricing/':'/precios/'}>{en?'Compare plans':'Comparar planes'}</a></p>
  </>}
 </div></AuthShell>;
}
