(function(root){
  'use strict';
  let registration=null;
  async function register(){
    if(!('serviceWorker' in navigator))return null;
    try{
      const v=encodeURIComponent(root.GMB_CONFIG?.version||'dev');
      registration=await navigator.serviceWorker.register('./sw.js?v='+v,{scope:'./',updateViaCache:'none'});
      return registration;
    }catch(err){console.warn('PWA registration failed',err);return null}
  }
  async function getRegistration(){
    if(registration)return registration;
    if(!('serviceWorker' in navigator))return null;
    try{registration=await navigator.serviceWorker.getRegistration('./');return registration}catch(_){return null}
  }
  async function workerVersion(timeoutMs=1200){
    if(!navigator.serviceWorker?.controller)return '';
    return await new Promise(resolve=>{
      const channel=new MessageChannel();
      const timer=setTimeout(()=>resolve(''),timeoutMs);
      channel.port1.onmessage=e=>{clearTimeout(timer);resolve(String(e.data?.version||''))};
      try{navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'},[channel.port2])}catch(_){clearTimeout(timer);resolve('')}
    });
  }
  async function releaseInfo(){
    try{const r=await fetch('./release.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}catch(err){return {error:String(err?.message||err)}}
  }
  async function check(){
    const reg=await getRegistration();
    try{await reg?.update()}catch(_){}
    const [worker,release]=await Promise.all([workerVersion(),releaseInfo()]);
    return {
      pageVersion:String(root.GMB_CONFIG?.version||''),
      workerVersion:worker,
      releaseVersion:String(release?.version||''),
      release,
      controlled:!!navigator.serviceWorker?.controller,
      waiting:!!reg?.waiting,
      installing:!!reg?.installing,
      online:navigator.onLine!==false
    };
  }
  async function activateWaiting(){
    const reg=await getRegistration();
    if(reg?.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});return true}
    return false;
  }
  root.GMBPWA={register,check,workerVersion,releaseInfo,activateWaiting};
})(typeof globalThis!=='undefined'?globalThis:this);
