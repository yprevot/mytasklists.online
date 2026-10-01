(async()=>{
 const en=document.documentElement.lang==='en';
 const action=(parent,text,url)=>{const a=document.createElement('a');a.className='btn btn-ghost';a.textContent=text;a.href=url;parent.append(a);};
 try{
  const response=await fetch('/api/distribution');if(!response.ok)throw new Error();const data=await response.json();
  const parent=document.querySelector('#android-actions');const status=document.querySelector('#android-status');
  status.textContent=data.android.apk?(en?'Signed Android download available.':'Descarga Android firmada disponible.'):(en?'The Android file is not available yet. You can use the web app.':'El archivo Android todavía no está disponible. Puedes usar la app web.');
  if(data.android.storeUrl)action(parent,en?'Go to Google Play':'Ir a Google Play',data.android.storeUrl);
  if(data.android.apk){action(parent,en?'Download APK from server':'Descargar APK del servidor',data.android.apk.url);document.querySelector('#apk-info').textContent=`v${data.android.apk.version} · ${(data.android.apk.size/1048576).toFixed(1)} MB · SHA-256: ${data.android.apk.sha256}`;}
  action(parent,en?'Use web app':'Usar app web','/app/');
  if(data.ios.storeUrl)action(document.querySelector('#ios-actions'),en?'Go to App Store':'Ir a App Store',data.ios.storeUrl);
  if(data.ios.testflightUrl)action(document.querySelector('#ios-actions'),en?'Try TestFlight beta':'Probar beta TestFlight',data.ios.testflightUrl);
 }catch{document.querySelector('#android-status').textContent=en?'Could not check downloads. Use the web app or try again.':'No se pudieron consultar las descargas. Usa la app web o vuelve a intentarlo.';action(document.querySelector('#android-actions'),en?'Use web app':'Usar app web','/app/');}
})();
