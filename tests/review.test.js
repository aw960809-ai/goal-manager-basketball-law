const assert=require('assert');
const Review=require('../js/domain/review.js');

let decisions={};
decisions=Review.set(decisions,{kind:'activity',id:'a1',action:'approve',title:'待複核活動'});
decisions=Review.set(decisions,{kind:'scholarship',id:'s1',action:'exclude',title:'待複核獎學金'});
assert.strictEqual(Review.stats(decisions).approve,1);
assert.strictEqual(Review.stats(decisions).exclude,1);

const activityCatalog={recommended:[],review:[{id:'a1',title:'待複核活動',fit:{score:75,reasons:['自動原因']}}],resources:[],archive:[],low:[]};
const appliedA=Review.applyActivity(activityCatalog,decisions);
assert.strictEqual(appliedA.review.length,0);
assert.strictEqual(appliedA.recommended.length,1);
assert.strictEqual(appliedA.recommended[0].manualReview.action,'approve');

const scholarshipCatalog={recommended:[],review:[{id:'s1',title:'待複核獎學金',fit:{score:70,reasons:[]},eligibility:{eligible:false,review:true,code:'UNVERIFIED'}}],excluded:[{id:'hard',title:'縣市限制',fit:{score:99},eligibility:{eligible:false,code:'REGION'}}],resources:[],archive:[]};
const appliedS=Review.applyScholarship(scholarshipCatalog,decisions);
assert.strictEqual(appliedS.review.length,0);
assert(appliedS.excluded.some(x=>x.id==='s1'));
assert(appliedS.excluded.some(x=>x.id==='hard'));
// A decision for a hard-excluded scholarship must not promote it because Review only acts on the auto-review bucket.
const withHardApprove=Review.set(decisions,{kind:'scholarship',id:'hard',action:'approve',title:'縣市限制'});
const appliedHard=Review.applyScholarship(scholarshipCatalog,withHardApprove);
assert(!appliedHard.recommended.some(x=>x.id==='hard'));
assert(appliedHard.excluded.some(x=>x.id==='hard'));

const exported=Review.exportPayload(decisions);
assert.deepStrictEqual(Review.importPayload(exported),Review.normalize(decisions));
console.log('review.test.js OK');
