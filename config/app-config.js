(function(root){
  'use strict';
  const config=Object.freeze({
    productId:'gmb-law',
    name:'Basketball Goal Manager',
    shortName:'Court Goals',
    version:'0.6.1',
    schemaVersion:2,
    profile:Object.freeze({
      institution:'東海大學',
      department:'法律學系',
      departmentAliases:Object.freeze(['法律學系','法律系','法學系','法律學院','法學院'])
    }),
    storage:Object.freeze({
      key:'gmb-law:v1:state',
      timerKey:'gmb-law:v1:timer',
      backupKey:'gmb-law:v1:backup',
      idbName:'goal-manager-basketball-law-v1',
      idbStore:'snapshots'
    }),
    pwa:Object.freeze({
      cachePrefix:'gmb-law:pwa:',
      manifestId:'/goal-manager-basketball-law/'
    }),
    features:Object.freeze({
      schoolCalendar:true,
      activities:true,
      scholarships:true,
      activityRadar:true,
      scholarshipRadar:true,
      autoFetch:true,
      dataHealth:true,
      releaseHealth:true,
      manualBackfill:true,
      goalDates:true
    })
  });
  root.GMB_CONFIG=config;
  if(typeof module==='object'&&module.exports)module.exports=config;
})(typeof globalThis!=='undefined'?globalThis:this);
