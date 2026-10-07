(function(root){
  'use strict';
  const config=root.GMB_CONFIG;
  const stateApi=root.GMBState;

  function ls(){return root.localStorage}
  function parse(raw){try{return raw?JSON.parse(raw):null}catch(_){return null}}
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.keys(value).sort().reduce((o,k)=>(o[k]=stable(value[k]),o),{});
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}
  function dataOnly(state){const out=stateApi.clone(state);delete out.timer;return out}
  function candidateFrom(raw,timerRaw){
    const parsed=parse(raw);if(!parsed)return null;
    const timer=parse(timerRaw);
    const merged={...parsed,timer:timer||parsed.timer||stateApi.idleTimer()};
    const normalized=stateApi.normalize(merged);
    return stateApi.validate(normalized).length?null:normalized;
  }
  function primaryCandidate(){return candidateFrom(ls().getItem(config.storage.key),ls().getItem(config.storage.timerKey))}
  function backupCandidate(){const parsed=parse(ls().getItem(config.storage.backupKey));if(!parsed)return null;const normalized=stateApi.normalize(parsed);return stateApi.validate(normalized).length?null:normalized}
  function load(){return primaryCandidate()||backupCandidate()||stateApi.freshState()}

  function writeRaw(state){
    const normalized=stateApi.normalize(state);
    ls().setItem(config.storage.key,JSON.stringify(dataOnly(normalized)));
    ls().setItem(config.storage.timerKey,JSON.stringify(normalized.timer));
  }

  async function mirrorToIndexedDB(serialized){
    if(!('indexedDB' in root))return false;
    return new Promise(resolve=>{
      try{
        const req=root.indexedDB.open(config.storage.idbName,1);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(config.storage.idbStore))db.createObjectStore(config.storage.idbStore,{keyPath:'id'})};
        req.onerror=()=>resolve(false);
        req.onsuccess=()=>{
          const db=req.result,tx=db.transaction(config.storage.idbStore,'readwrite');
          tx.objectStore(config.storage.idbStore).put({id:'latest',updatedAt:new Date().toISOString(),payload:serialized});
          tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();resolve(false)};
        };
      }catch(_){resolve(false)}
    });
  }
  async function loadMirror(){
    if(!('indexedDB' in root))return null;
    return new Promise(resolve=>{
      try{
        const req=root.indexedDB.open(config.storage.idbName,1);
        req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(config.storage.idbStore))db.createObjectStore(config.storage.idbStore,{keyPath:'id'})};
        req.onerror=()=>resolve(null);
        req.onsuccess=()=>{
          const db=req.result,tx=db.transaction(config.storage.idbStore,'readonly'),get=tx.objectStore(config.storage.idbStore).get('latest');
          get.onsuccess=()=>{const parsed=parse(get.result?.payload);db.close();if(!parsed)return resolve(null);const n=stateApi.normalize(parsed);resolve(stateApi.validate(n).length?null:n)};
          get.onerror=()=>{db.close();resolve(null)};
        };
      }catch(_){resolve(null)}
    });
  }

  function save(next){
    const expected=stateApi.touch(next),errors=stateApi.validate(expected);if(errors.length)throw new Error('state validation failed: '+errors.join(','));
    const oldRaw=ls().getItem(config.storage.key),oldTimer=ls().getItem(config.storage.timerKey),oldCombined=primaryCandidate();
    try{
      if(oldCombined)ls().setItem(config.storage.backupKey,JSON.stringify(oldCombined));
      writeRaw(expected);
      const verify=primaryCandidate();
      if(!verify||!same(verify,expected))throw new Error('persistent readback mismatch');
      void mirrorToIndexedDB(JSON.stringify(expected));
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('gmb:state-saved',{detail:{updatedAt:expected.updatedAt}}));
      return verify;
    }catch(err){
      if(oldRaw==null)ls().removeItem(config.storage.key);else ls().setItem(config.storage.key,oldRaw);
      if(oldTimer==null)ls().removeItem(config.storage.timerKey);else ls().setItem(config.storage.timerKey,oldTimer);
      throw err;
    }
  }
  async function recoverIfNeeded(){
    if(primaryCandidate())return {recovered:false,source:'primary'};
    const mirror=await loadMirror();
    if(mirror){try{writeRaw(mirror);return {recovered:true,source:'indexeddb'}}catch(_){}}
    const backup=backupCandidate();
    if(backup){try{writeRaw(backup);return {recovered:true,source:'backup'}}catch(_){}}
    return {recovered:false,source:'fresh'};
  }
  function reset(){
    ls().removeItem(config.storage.key);ls().removeItem(config.storage.timerKey);ls().removeItem(config.storage.backupKey);
    return save(stateApi.freshState());
  }
  function namespaceReport(){return {key:config.storage.key,timerKey:config.storage.timerKey,backupKey:config.storage.backupKey,idbName:config.storage.idbName,isolated:true}}

  const api={load,save,reset,mirrorToIndexedDB,loadMirror,recoverIfNeeded,namespaceReport,_candidateFrom:candidateFrom};
  root.GMBStorage=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
