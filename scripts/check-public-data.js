#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const args=new Set(process.argv.slice(2));
const strict=args.has('--strict-freshness');
const STALE_HOURS=36;
function read(rel){return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}
function ageHours(v){const t=Date.parse(v||'');return Number.isFinite(t)?Math.max(0,(Date.now()-t)/3600000):null}
function fail(msg){console.error('PUBLIC_DATA_FAIL',msg);process.exit(1)}
const a=read('data/activities.json'),s=read('data/scholarships.json'),c=read('data/school-calendar.json'),cm=read('data/school-calendar-meta.json');
if(!Array.isArray(a.events)||!a.events.length)fail('activities empty or invalid');
if(!Array.isArray(s.scholarships)||!s.scholarships.length)fail('scholarships empty or invalid');
if(!Array.isArray(c)||!c.length)fail('school calendar empty or invalid');
if(!cm||typeof cm!=='object'||Number(cm.eventCount)!==c.length||!cm.academicYear)fail('school calendar meta invalid');
for(const [name,rows] of [['activities',a.events],['scholarships',s.scholarships]]){
  const ids=rows.map(x=>String(x?.id||''));
  if(ids.some(x=>!x)||new Set(ids).size!==ids.length)fail(`${name} IDs missing or duplicated`);
}
const am=a.meta||{},sm=s.meta||{};
const aa=ageHours(am.updatedAt),sa=ageHours(sm.updatedAt);
if(Number(am.totalSources??am.sources)>0 && Number(am.healthySources??Math.max(0,Number(am.sources||0)-Number(am.failed||0)))<=0)fail('no healthy activity source');
if(Number(sm.categories)>0 && Number(sm.healthyCategories)<=0)fail('no healthy scholarship category');
if(strict){
  if(aa===null||aa>STALE_HOURS)fail(`activity stale: ${aa===null?'unknown':aa.toFixed(1)+'h'}`);
  if(sa===null||sa>STALE_HOURS)fail(`scholarship stale: ${sa===null?'unknown':sa.toFixed(1)+'h'}`);
}
console.log('PUBLIC_DATA_OK',JSON.stringify({activities:a.events.length,activityAgeHours:aa&&Number(aa.toFixed(1)),scholarships:s.scholarships.length,scholarshipAgeHours:sa&&Number(sa.toFixed(1)),calendar:c.length,calendarAcademicYear:cm.academicYear,strict}));
