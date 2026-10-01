const base = require('./app.json').expo;
module.exports = () => {
  const release = ['production', 'direct'].includes(process.env.EAS_BUILD_PROFILE) || process.env.MYTASKLISTS_LOCAL_RELEASE === 'true';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || (release ? 'https://mytasklists.online/api' : base.extra.apiUrl);
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || (release ? 'https://mytasklists.online' : base.extra.socketUrl);
  if (release && [apiUrl, socketUrl].some(value => { const url = new URL(value); return url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname); })) throw new Error('A release build requires public HTTPS API and socket URLs');
  return {...base, plugins:[...(base.plugins||[]),'expo-iap'], ...(process.env.MYTASKLISTS_LOCAL_RELEASE==='true'?{updates:{enabled:false}}:{}), extra:{...base.extra,apiUrl,socketUrl,billingChannel:process.env.EXPO_PUBLIC_BILLING_CHANNEL||(process.env.EAS_BUILD_PLATFORM==='ios'?'app_store':'play')}};
};
