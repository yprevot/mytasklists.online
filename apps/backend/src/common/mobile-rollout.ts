import type { MobileConfig } from '../config/configuration';
export const REGISTRATION_MIN_VERSION = '2.0.0';
export function updateDestination(mobile: MobileConfig, platform?: string): string {
  const published = platform === 'ios' ? process.env.IOS_STORE_PUBLISHED === 'true' : process.env.ANDROID_STORE_PUBLISHED === 'true';
  const store = platform === 'ios' ? mobile.storeUrls.ios : platform === 'android' ? mobile.storeUrls.android : null;
  let validStore=false;try{const url=new URL(store||'');validStore=url.protocol==='https:'&&url.hostname===(platform==='ios'?'apps.apple.com':'play.google.com');}catch{}
  return published && validStore && store ? store : mobile.downloadUrl + (platform === 'ios' ? '#ios' : platform === 'android' ? '#android' : '');
}
