import type {SubscriptionOffer} from 'expo-iap';
// OpenIAP normalizes the base offer ID to the base plan ID, not an empty string.
export function selectAndroidOffer(offers:SubscriptionOffer[]|null|undefined,basePlan:string,offerId:string){
 return offers?.find(o=>o.basePlanIdAndroid===basePlan&&o.id===(offerId||basePlan));
}
