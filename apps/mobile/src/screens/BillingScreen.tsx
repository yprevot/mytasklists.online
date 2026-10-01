import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, Text } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import type { BillingPlans, BillingState, PromotionQuote } from '@lista/contracts';
import type { Purchase, ProductSubscription } from 'expo-iap';
import { selectAndroidOffer } from '../billing/offers';
import { billingApi } from '../api/endpoints';
import { Button, Field } from '../components/ui';
import { colors, spacing } from '../theme';
const channel=process.env.EXPO_PUBLIC_BILLING_CHANNEL||Constants.expoConfig?.extra?.billingChannel||'direct';
export function BillingScreen(){
 const {i18n}=useTranslation();const en=i18n.language.startsWith('en');
 const [plans,setPlans]=useState<BillingPlans|null>(null);const [state,setState]=useState<BillingState|null>(null);
 const [product,setProduct]=useState<ProductSubscription|null>(null);const [code,setCode]=useState('');const [offerId,setOfferId]=useState('');
 const [quote,setQuote]=useState<PromotionQuote|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const native=Platform.OS!=='web'&&((Platform.OS==='ios'&&channel==='app_store')||(Platform.OS==='android'&&channel==='play'));
 async function refresh(){const p=await billingApi.plans();setPlans(p);setState(await billingApi.me());return p;}
 async function verify(p:Purchase){if(!p.purchaseToken&&Platform.OS==='android')throw new Error(en?'Missing purchase token':'Falta el token de compra');const store=await import('expo-iap');const token=Platform.OS==='ios'?await store.getTransactionJwsIOS(p.productId):p.purchaseToken!;await billingApi.verify({provider:Platform.OS==='ios'?'apple':'google',productId:p.productId,token:token||''});await store.finishTransaction({purchase:p,isConsumable:false});await refresh();}
 useEffect(()=>{let disposed=false;let subscription:{remove():void}|undefined;let errors:{remove():void}|undefined;
  void refresh().then(async p=>{if(!native||disposed||!(Platform.OS==='ios'?p.stores.ios:p.stores.android))return;const store=await import('expo-iap');await store.initConnection();
   if(disposed){await store.endConnection();return;}
   subscription=store.purchaseUpdatedListener(purchase=>{setBusy(true);void verify(purchase).catch(e=>setError(e.message)).finally(()=>setBusy(false));});
   errors=store.purchaseErrorListener(e=>{setError(e.message);setBusy(false);});
   const sku=Platform.OS==='ios'?p.stores.iosProduct:p.stores.androidProduct;if(sku){const products=await store.fetchProducts({skus:[sku],type:'subs'});if(!disposed)setProduct(products?.[0] as ProductSubscription||null);}
  }).catch(e=>setError(e.message));
  const listener=AppState.addEventListener('change',s=>{if(s==='active')void refresh().catch(e=>setError(e.message));});
  return ()=>{disposed=true;subscription?.remove();errors?.remove();listener.remove();if(native)void import('expo-iap').then(s=>s.endConnection()).catch(()=>{});};
 },[]);
 async function run(task:()=>Promise<unknown>){setBusy(true);setError('');try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function buy(){if(!state||!plans)return;
  if(!native){const r=quote?await billingApi.discountedCheckout(quote.code,quote.total):await billingApi.checkout();await Linking.openURL(r.url);return;}
  if(!product)throw new Error(en?'No store product is available.':'No hay un producto disponible en la tienda.');
  const store=await import('expo-iap');const offer=selectAndroidOffer(product.subscriptionOffers,plans.stores.androidBasePlan,offerId);
  if(Platform.OS==='android'&&(!offer?.offerTokenAndroid))throw new Error(en?'This offer is not available for your store account.':'Esta oferta no está disponible para tu cuenta de tienda.');
  await store.requestPurchase({type:'subs',request:{apple:{sku:product.id,appAccountToken:state.accountToken},google:{skus:[product.id],obfuscatedAccountId:state.googleAccountId,subscriptionOffers:offer?.offerTokenAndroid?[{sku:product.id,offerToken:offer.offerTokenAndroid}]:[]}}});
 }
 async function redeem(){if(native&&Platform.OS==='ios'){await (await import('expo-iap')).presentCodeRedemptionSheetIOS();return;}
  if(native){const r=await billingApi.nativePromotion(code);if(!selectAndroidOffer(product?.subscriptionOffers,plans?.stores.androidBasePlan||'monthly',r.offerId))throw new Error(en?'This code is unavailable for your store account.':'Este código no está disponible para tu cuenta de tienda.');setOfferId(r.offerId);}
  else setQuote(await billingApi.promotion(code));
 }
 async function restore(){const store=await import('expo-iap');const purchases=await store.getAvailablePurchases();for(const p of purchases)if(p.productId===product?.id)await verify(p);await refresh();}
 const selectedOffer=selectAndroidOffer(product?.subscriptionOffers,plans?.stores.androidBasePlan||'monthly',offerId);
 return <ScrollView contentContainerStyle={{padding:spacing.lg,gap:spacing.md}} testID="billing-screen">
  <Text style={{fontSize:28,fontWeight:'800',color:colors.ink}}>{en?'My plan':'Mi plan'}</Text>
  {error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}
  <Text style={{color:colors.ink,fontSize:20}}>{state?.plan==='premium'?'Premium':en?'Free':'Gratis'}</Text>
  {state?.plan==='premium'?<><Text style={{color:colors.inkSoft}}>{state.subscription?.period_end?new Date(state.subscription.period_end).toLocaleDateString():''}</Text><Button title={en?'Manage or cancel':'Administrar o cancelar'} loading={busy} onPress={()=>void run(async()=>{const provider=state.subscription?.provider;const url=provider==='stripe'?(await billingApi.portal()).url:provider==='apple'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions';await Linking.openURL(url);})}/></>:<>
   <Text style={{fontSize:23,fontWeight:'700',color:colors.ink}}>Premium · {selectedOffer?.displayPrice||product?.displayPrice||'5 USD'} / {en?'month':'mes'}</Text>
   <Text style={{color:colors.inkSoft}}>{en?plans?.benefits.en:plans?.benefits.es}</Text>
   {(native?!!product:plans?.enabled)?<>
    {!(native&&Platform.OS==='ios')&&<Field label={en?'Promotional code':'Código promocional'} value={code} onChangeText={v=>{setCode(v);setOfferId('');setQuote(null);}} testID="promo-code"/>}
    <Button title={native&&Platform.OS==='ios'?(en?'Redeem store offer code':'Canjear código de oferta en la tienda'):(en?'Apply code':'Aplicar código')} variant="ghost" disabled={busy||!(native&&Platform.OS==='ios')&&!code.trim()} onPress={()=>void run(redeem)}/>
    {quote&&<Text style={{color:colors.ink}}>USD {(quote.total/100).toFixed(2)} · {quote.duration==='repeating'?`${quote.months} ${en?'months':'meses'}`:quote.duration}</Text>}
    {selectedOffer&&<Text style={{color:colors.ink}}>{selectedOffer.displayPrice} · {selectedOffer.pricingPhasesAndroid?.pricingPhaseList.map(p=>`${p.formattedPrice} / ${en?'billing period':'período'}${p.billingCycleCount?` · ${p.billingCycleCount} ${en?'renewals':'renovaciones'}`:''}`).join(' → ')}</Text>}
    <Text style={{color:colors.inkSoft}}>{en?'Review the final amount and monthly renewal in the payment screen. Cancel from My plan or the store.':'Revisa el importe final y la renovación mensual en la pantalla de pago. Cancela desde Mi plan o la tienda.'}</Text>
    <Button title={en?'Continue to payment':'Continuar al pago'} loading={busy} disabled={!!code.trim()&&(native?!offerId:!quote)} onPress={()=>void run(buy)}/>
   </>:<Text style={{color:colors.inkSoft}}>{en?'Paid subscriptions are coming soon. Continue free.':'Las suscripciones de pago estarán disponibles próximamente. Continúa gratis.'}</Text>}
  </>}
  {native&&product&&<Button title={en?'Restore purchases':'Restaurar compras'} onPress={()=>void run(restore)} loading={busy} variant="ghost"/>}
 </ScrollView>;
}
