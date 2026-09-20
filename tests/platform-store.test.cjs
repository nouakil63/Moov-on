'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function fixture(){
  const entries=new Map(),sessions=new Map();
  const storage={failWrites:false,get length(){return entries.size;},key:i=>[...entries.keys()][i],getItem:k=>entries.get(k)??null,setItem(k,v){if(this.failWrites)throw Error('Quota');entries.set(k,String(v));},removeItem:k=>entries.delete(k)};
  const context={localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)??null,setItem:(k,v)=>sessions.set(k,String(v)),removeItem:k=>sessions.delete(k)},crypto,URL,console,addEventListener(){}};context.window=context;vm.createContext(context);
  for(const name of ['demo-store.js','energy.js','platform-store.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
  const D=context.Demo,P=context.Platform;
  const login=(email='camille@corelis.fr',orgId='corelis')=>D.login({email,orgId});
  const operator=()=>login('hello@moovon.demo');
  const admin=()=>login('lea@corelis.fr');
  const date=()=>new Date(D.now()).toISOString().slice(0,10);
  function campaign(budget=10000){admin();return P.createCampaign({orgId:'corelis',associationId:'canopy',missionId:'trees',budgetEuros:budget,period:'monthly',startDate:date(),replaceActive:true});}
  function record(extra={}){return P.recordActivity({sport:'Course',distanceMeters:5000,durationSeconds:1800,title:'Sortie',publish:true,hideRoute:false,route:'demo',...extra});}
  return {context,D,P,entries,storage,login,operator,admin,date,campaign,record};
}
test('catalogue and conversion belong only to platform; company sees own campaigns',()=>{
 const f=fixture();f.login();assert.throws(()=>f.P.saveAssociation({name:'X'}),/CRM/);assert.throws(()=>f.P.updateRules(f.P.rules()),/CRM/);assert.throws(()=>f.P.createCampaign({}),/administrateur/);
 f.admin();assert.throws(()=>f.P.saveMission({}),/CRM/);assert.throws(()=>f.P.campaigns('nova'),/autre entreprise/);
 f.operator();const association=f.P.saveAssociation({name:'Association test',website:'https://example.org',contact:'Contact'});
 const mission=f.P.saveMission({associationId:association.id,name:'Arbres',unit:'arbres',unitCostEuros:5,goalEuros:50000});assert.equal(mission.unitCostCents,500);assert.equal(mission.goalCents,5000000);
 assert.throws(()=>f.P.saveAssociation({name:'X',website:'javascript:alert(1)'}),/site/);
});
test('a new campaign counts participants with activities, not registered accounts',()=>{
 const f=fixture(),c=f.campaign();f.login();assert.equal(f.P.campaignStats(c.id).activeParticipants,0);
 f.record({publish:false});assert.equal(f.P.campaignStats(c.id).activeParticipants,1);
 f.record();assert.equal(f.P.campaignStats(c.id).activeParticipants,1);
 f.login('sofiane@corelis.fr');f.record();assert.equal(f.P.campaignStats(c.id).activeParticipants,2);
 f.admin();f.D.advanceHours(28*24+1);assert.equal(f.P.campaignStats(c.id).activeParticipants,0);
});
test('credit is atomic, idempotent and never exceeds campaign budget',()=>{
 const f=fixture(),c=f.campaign(1);f.D.advanceHours((c.endAt-f.D.now()-60000)/3600000);f.login();const a=f.record({id:'idempotent'});assert.equal(a.energy,5000);assert.equal(a.contributionCents,100);
 const again=f.record({id:'idempotent'});assert.equal(again.id,a.id);assert.equal(f.P.campaignStats(c.id).activityCount,1);
 f.record();assert.equal(f.P.campaignStats(c.id).raisedCents,100);assert.equal(f.P.campaignStats(c.id).progressPct,100);
 const before=f.entries.get('moovon:platform:v1');f.storage.failWrites=true;assert.throws(()=>f.record({id:'quota-failure'}),/stockage/);assert.equal(f.entries.get('moovon:platform:v1'),before);
});
test('historical euros and impact survive rule and unit price changes',()=>{
 const f=fixture(),c=f.campaign();f.login();const a=f.record();const before=f.P.campaignStats(c.id);
 f.operator();const rules=f.P.rules();rules.forecast.maxEuroPerEnergy=.0001;f.P.updateRules(rules);
 f.P.saveMission({id:'trees',associationId:'canopy',name:'Arbres',unit:'arbres',unitCostEuros:99,goalEuros:50000});
 const after=f.P.campaignStats(c.id);assert.equal(after.raisedCents,before.raisedCents);assert.equal(after.financedImpact,before.financedImpact);assert.equal(after.campaign.unitCostCents,500);
 f.login();const next=f.record();assert.ok(next.contributionCents<a.contributionCents);assert.equal(f.P.activities().find(x=>x.id===a.id).contributionCents,a.contributionCents);
});
test('campaign replacement preserves ledger; future campaigns and expired campaigns do not credit',()=>{
 const f=fixture(),c=f.campaign();f.login();f.record();const raised=f.P.campaignStats(c.id).raisedCents;
 f.admin();assert.throws(()=>f.P.createCampaign({associationId:'canopy',missionId:'trees',budgetEuros:1000,period:'monthly',startDate:f.date()}),/campagne couvre/);
 const next=f.P.createCampaign({associationId:'canopy',missionId:'trees',budgetEuros:1000,period:'quarterly',startDate:f.date(),replaceActive:true});assert.equal(f.P.campaignStats(c.id).raisedCents,raised);assert.equal(f.P.campaignStats(c.id).campaign.status,'closed');
 f.D.advanceHours(24*95);f.login();const a=f.record();assert.equal(a.campaignId,null);assert.equal(a.contributionCents,0);assert.equal(f.P.campaignStats(next.id).forecast.ratioEuroPerEnergy,0);
});
test('route privacy applies to feed and linked stories without changing credit',()=>{
 const f=fixture();f.campaign();f.login();const a=f.record();const s=f.D.createStory({text:'Course terminée',activity:{phase:'after',activityId:a.id,sport:'Course',distanceMeters:5000,durationSeconds:1800,energy:5000,speedKmh:10,hideRoute:false,route:'demo'}});
 assert.ok(f.D.getStories().find(x=>x.id===s.id).activity.route);f.P.setActivityPrivacy(a.id,true);assert.equal(f.P.feed().find(x=>x.id===a.id).route,'');assert.equal(f.D.getStories().find(x=>x.id===s.id).activity.route,'');
 assert.equal(f.P.activities().find(x=>x.id===a.id).contributionCents,a.contributionCents);
 assert.ok(f.P.storySnapshot(a.id).route);
 f.login('lea@corelis.fr');assert.throws(()=>f.P.setActivityPrivacy(a.id,false),/uniquement/);assert.throws(()=>f.D.setStoryPrivacy(s.id,false),/uniquement/);
 assert.equal(f.P.storySnapshot(a.id),null);
 f.login('alex@nova-conseil.fr','nova');assert.ok(!f.P.feed().some(x=>x.id===a.id));assert.throws(()=>f.P.comment(a.id,'Hello'),/indisponible/);
});

test('a scheduled replacement keeps the current campaign crediting until the handover',()=>{
 const f=fixture(),first=f.campaign();
 const startDate=new Date(f.D.now()+5*86400000).toISOString().slice(0,10);
 const next=f.P.createCampaign({associationId:'canopy',missionId:'trees',budgetEuros:1000,period:'monthly',startDate,replaceActive:true});
 assert.equal(f.P.activeCampaign().id,first.id);f.login();const before=f.record();assert.equal(before.campaignId,first.id);assert.ok(before.contributionCents>0);
 f.D.advanceHours((next.startAt-f.D.now())/3600000+0.001);assert.equal(f.P.activeCampaign().id,next.id);const after=f.record();assert.equal(after.campaignId,next.id);assert.ok(after.contributionCents>0);assert.equal(f.P.campaignStats(first.id).raisedCents,before.contributionCents);
});
test('story snapshots never create an activity and before-run stats are zero',()=>{
 const f=fixture();f.campaign();f.login();const count=f.P.activities().length;
 const s=f.D.createStory({text:'Départ',activity:{phase:'before',sport:'Course',distanceMeters:5000,energy:9999,durationSeconds:10,hideRoute:true}});assert.equal(s.activity.distanceMeters,0);assert.equal(s.activity.energy,0);assert.equal(f.P.activities().length,count);
});
test('private invitations are enforced at listing, joining and capacity checks',()=>{
 const f=fixture();f.login();const tomorrow=new Date(f.D.now()+86400000).toISOString().slice(0,10);
 const e=f.P.createEvent({name:'Privé',description:'Invitation',startPoint:'A',endPoint:'B',date:tomorrow,time:'14:00',distanceMeters:5000,capacity:2,visibility:'private',invitedUserIds:['lea','sarah']});
 f.login('sofiane@corelis.fr');assert.ok(!f.P.events().some(x=>x.id===e.id));assert.throws(()=>f.P.joinEvent(e.id),/indisponible/);
 f.login('lea@corelis.fr');f.P.joinEvent(e.id);f.P.joinEvent(e.id);assert.equal(f.P.events().find(x=>x.id===e.id).participantIds.length,2);
 f.login('sarah@nova-conseil.fr','nova');assert.ok(f.P.events().some(x=>x.id===e.id));assert.throws(()=>f.P.joinEvent(e.id),/complet/);
 f.login('lea@corelis.fr');f.P.leaveEvent(e.id);f.login('sarah@nova-conseil.fr','nova');f.P.joinEvent(e.id);
});
test('company events are not exposed cross-company, public events are joinable',()=>{
 const f=fixture();f.login('alex@nova-conseil.fr','nova');assert.ok(!f.P.events().some(e=>e.id==='event-lunch'));assert.ok(f.P.events().some(e=>e.id==='event-open'));
 f.login();f.P.joinEvent('event-open');assert.ok(f.P.events().find(e=>e.id==='event-open').participantIds.includes('camille'));
 assert.throws(()=>f.P.createEvent({name:'Invalid',date:'2027-02-31',time:'12:00',startPoint:'A',endPoint:'B',distanceMeters:3,visibility:'public'}),/date/);
});
test('zero weekly history has no invented percentage and cycling counts metres',()=>{
 const f=fixture();f.operator();const {org}=f.D.createOrg({name:'Test',shortName:'Test',domain:'test.example',adminName:'Manager',adminEmail:'manager@test.example'});
 f.login('manager@test.example',org.id);const before=f.P.profileStats();assert.equal(before.totalDistanceMeters,0);assert.equal(before.evolutionPct,null);
 f.record({sport:'Vélo',distanceMeters:10000,durationSeconds:1800});const after=f.P.profileStats();assert.equal(after.distanceMeters,10000);assert.equal(after.energy,5000);assert.equal(after.totalDistanceMeters,10000);
});
test('reset clears shared data and old activity storage without deleting unrelated data',()=>{
 const f=fixture();f.login();f.P.rules();f.entries.set('unrelated','keep');f.entries.set('moovon:campaign-notice:test','seen');f.D.reset();assert.equal(f.entries.has('moovon:platform:v1'),false);assert.equal(f.entries.has('moovon:campaign-notice:test'),false);assert.equal(f.entries.get('unrelated'),'keep');
});
