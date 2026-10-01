export interface BillingPlans {
 currency:string; price:number; interval:string; enabled:boolean;
 benefits:{es:string;en:string};
 limits:{freeLists:number|null;freeItems:number|null;premiumLists:number|null;premiumItems:number|null};
 stores:{ios:boolean;android:boolean;iosProduct:string|null;androidProduct:string|null;androidBasePlan:string};
}
export interface BillingState {plan:'free'|'premium';subscription:{provider:string;status:string;period_end:string|null;cancel_at_period_end:boolean}|null;accountToken:string;googleAccountId:string;}
export interface PromotionQuote {code:string;promotionId:string;subtotal:number;discount:number;total:number;currency:string;duration:string;months:number|null;expiresAt:number|null;}
export interface CheckoutRequest {code?:string;expectedTotal?:number;}
export interface StorePurchaseRequest {provider:'apple'|'google';productId:string;token:string;}
