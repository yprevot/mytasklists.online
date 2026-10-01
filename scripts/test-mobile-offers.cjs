const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectAndroidOffer}=require('../apps/mobile/src/billing/offers.ts');
const offers=[{id:'yearly',basePlanIdAndroid:'yearly',offerTokenAndroid:'year'},{id:'monthly',basePlanIdAndroid:'monthly',offerTokenAndroid:'base'},{id:'sale',basePlanIdAndroid:'monthly',offerTokenAndroid:'promo'}];
test('Google monthly selection uses the base-plan ID and never the yearly token',()=>assert.equal(selectAndroidOffer(offers,'monthly','').offerTokenAndroid,'base'));
test('Google promotional selection requires an eligible offer within the monthly plan',()=>{assert.equal(selectAndroidOffer(offers,'monthly','sale').offerTokenAndroid,'promo');assert.equal(selectAndroidOffer(offers,'monthly','invalid'),undefined);assert.equal(selectAndroidOffer(offers,'yearly','sale'),undefined);});
