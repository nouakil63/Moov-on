'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function fixture({at}={}){
  const entries=new Map(),sessions=new Map();
  const storage={failWrites:false,get length(){return entries.size;},key:i=>[...entries.keys()][i],getItem:k=>entries.get(k)??null,setItem(k,v){if(this.failWrites)throw Error('Quota');entries.set(k,String(v));},removeItem:k=>entries.delete(k)};
  const context={localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)??null,setItem:(k,v)=>sessions.set(k,String(v)),removeItem:k=>sessions.delete(k)},crypto,URL,console,addEventListener(){}};
  if(at!==undefined)context.Date=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
  context.window=context;vm.createContext(context);
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

const PLATFORM_KEY='moovon:platform:v1';
const todaySample=a=>a.id.startsWith('sample-today-v1-');
function legacyState(f,edit=()=>{}){
 f.P.rules();const data=JSON.parse(f.entries.get(PLATFORM_KEY));
 data.activities=data.activities.filter(a=>!todaySample(a));delete data.migration.todaySamplesV1;
 edit(data);f.entries.set(PLATFORM_KEY,JSON.stringify(data));return data;
}

test('fresh samples give each of the five personas 5000 energy today, even immediately after UTC midnight',()=>{
 const at=Date.parse('2026-09-20T00:00:00.001Z'),f=fixture({at});
 f.P.rules();assert.equal(f.D.current(),null); // Initial read does not require login.
 const data=JSON.parse(f.entries.get(PLATFORM_KEY)),samples=data.activities.filter(todaySample);
 assert.equal(samples.length,5);assert.equal(data.migration.todaySamplesV1,true);
 for(const a of samples){
  assert.equal(a.energy,5000);assert.equal(a.durationSeconds,1800);assert.equal(a.at,at);
  assert.equal(a.distanceMeters,{Course:5000,Marche:2500,'Vélo':10000}[a.sport]);
  assert.equal(a.demo,true);assert.equal(a.hideRoute,true);assert.match(a.title,/démo/);
  const email=a.userId+'@'+(a.orgId==='corelis'?'corelis.fr':'nova-conseil.fr');f.login(email,a.orgId);
  const own=f.P.activities().filter(row=>row.userId===a.userId&&new Date(row.at).toISOString().slice(0,10)===f.date());
  assert.equal(own.reduce((total,row)=>total+row.energy,0),5000);
 }
});

test('one-time migration retains existing ledger and avoids duplicates across reads, reloads and clock advances',()=>{
 const f=fixture({at:Date.parse('2026-09-20T12:00:00Z')}),old=legacyState(f);
 f.P.rules();const migrated=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.equal(migrated.activities.length,old.activities.length+5);
 assert.deepEqual(migrated.activities.filter(a=>!todaySample(a)),old.activities);
 const committed=f.entries.get(PLATFORM_KEY);f.P.rules();assert.equal(f.entries.get(PLATFORM_KEY),committed);
 vm.runInContext(fs.readFileSync(path.join(root,'platform-store.js'),'utf8'),f.context);
 f.context.Platform.rules();assert.equal(f.entries.get(PLATFORM_KEY),committed);
 f.login();f.D.advanceHours(24);f.context.Platform.rules();
 assert.equal(f.entries.get(PLATFORM_KEY),committed);
 assert.equal(f.context.Platform.activities().filter(a=>new Date(a.at).toISOString().slice(0,10)===f.date()).length,0);
});

test('migration respects a positive activity already recorded today, and fixed ids survive a missing marker',()=>{
 const f=fixture({at:Date.parse('2026-09-20T12:00:00Z')});
 const old=legacyState(f,data=>{const first=data.activities.find(a=>a.userId==='camille');data.activities.push({...first,id:'real-today',at:f.D.now(),demo:false,energy:1020,contributionCents:17});});
 f.P.rules();let data=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.equal(data.activities.filter(todaySample).length,4);
 assert.ok(!data.activities.some(a=>todaySample(a)&&a.userId==='camille'));
 assert.deepEqual(data.activities.find(a=>a.id==='real-today'),old.activities.find(a=>a.id==='real-today'));
 const count=data.activities.length;delete data.migration.todaySamplesV1;f.entries.set(PLATFORM_KEY,JSON.stringify(data));
 f.login();f.D.advanceHours(24);f.P.rules();data=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.equal(data.activities.length,count+1); // Only Camille lacked a fixed sample id.
 assert.equal(data.activities.filter(todaySample).length,5);
});

test('migration quota failure preserves every prior byte and is safely retryable',()=>{
 const f=fixture({at:Date.parse('2026-09-20T12:00:00Z')});legacyState(f);
 const before=f.entries.get(PLATFORM_KEY);f.storage.failWrites=true;
 assert.throws(()=>f.P.rules(),/stockage/);assert.equal(f.entries.get(PLATFORM_KEY),before);
 f.storage.failWrites=false;f.P.rules();const after=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.equal(after.activities.filter(todaySample).length,5);assert.equal(after.migration.todaySamplesV1,true);
});

test('migrated samples use saved sport rules and conversion ceiling without exceeding the remaining budget',()=>{
 const f=fixture({at:Date.parse('2026-09-20T12:00:00Z')});
 const old=legacyState(f,data=>{
  data.rules.version=2;data.rules.sports.Course.pointsPerMeter=2;data.rules.forecast.maxEuroPerEnergy=.0001;
  const campaign=data.campaigns.find(c=>c.orgId==='corelis');
  campaign.budgetCents=data.activities.filter(a=>a.campaignId===campaign.id).reduce((sum,a)=>sum+a.contributionCents,0)+25;
  data.campaigns.filter(c=>c.orgId==='nova').forEach(c=>c.status='closed');
 });
 f.P.rules();const data=JSON.parse(f.entries.get(PLATFORM_KEY)),samples=data.activities.filter(todaySample);
 assert.deepEqual(data.activities.filter(a=>!todaySample(a)),old.activities);
 for(const a of samples){assert.equal(a.energy,a.sport==='Course'?10000:5000);assert.equal(a.rulesVersion,2);assert.ok(a.ratioEuroPerEnergy<=.0001);}
 const corelis=data.campaigns.find(c=>c.orgId==='corelis');
 assert.equal(data.activities.filter(a=>a.campaignId===corelis.id).reduce((sum,a)=>sum+a.contributionCents,0),corelis.budgetCents);
 for(const a of samples.filter(a=>a.orgId==='nova')){assert.equal(a.campaignId,null);assert.equal(a.contributionCents,0);}
});

test('new enterprises and invited people receive no sample activity; reset seeds the five personas again only once',()=>{
 const f=fixture({at:Date.parse('2026-09-20T12:00:00Z')});f.operator();
 const {org,user}=f.D.createOrg({name:'New',domain:'new.example',adminName:'New manager',adminEmail:'manager@new.example'});
 const {user:invited,invite}=f.D.invite('corelis',{name:'Invited',email:'new@corelis.fr',team:'Marketing',role:'employee'});
 legacyState(f);f.P.rules();let data=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.ok(!data.activities.some(a=>a.orgId===org.id||a.userId===user.id||a.userId===invited.id));
 f.D.acceptInvite(invite.token);f.login(invited.email,'corelis');assert.equal(f.P.activities().length,0);
 f.D.advanceHours(24);f.D.reset();f.P.rules();data=JSON.parse(f.entries.get(PLATFORM_KEY));
 assert.equal(data.activities.filter(todaySample).length,5);
 assert.ok(data.activities.filter(todaySample).every(a=>new Date(a.at).toISOString().slice(0,10)===f.date()));
 const after=f.entries.get(PLATFORM_KEY);f.P.rules();assert.equal(f.entries.get(PLATFORM_KEY),after);
});

function challengeRows(f,rows){
 f.P.rules();const data=JSON.parse(f.entries.get(PLATFORM_KEY)),sample=data.activities.find(a=>a.userId==='camille');
 data.activities=rows.map((row,index)=>({...sample,id:'challenge-fixture-'+index,at:f.D.now(),published:false,...row}));
 f.entries.set(PLATFORM_KEY,JSON.stringify(data));
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('challenge totals include private distances only as team aggregates and stay in the session organization',()=>{
 const f=fixture({at:Date.parse('2026-09-23T15:00:00Z')});
 assert.throws(()=>f.P.challengeStats(),/Connectez-vous/);
 challengeRows(f,[
  {userId:'camille',team:'Marketing',distanceMeters:1200,published:true},
  {userId:'sofiane',team:'Finance',distanceMeters:800,title:'Private finance route',route:'confidential'},
  {userId:'lea',team:'RH',distanceMeters:2000},
  {userId:'alex',orgId:'nova',team:'Conseil',distanceMeters:9000}
 ]);
 f.login();const stored=f.entries.get(PLATFORM_KEY),stats=plain(f.P.challengeStats());
 assert.deepEqual(stats.teams,[{team:'RH',distanceMeters:2000,me:false},{team:'Marketing',distanceMeters:1200,me:true},{team:'Finance',distanceMeters:800,me:false},{team:'IT & Data',distanceMeters:0,me:false}]);
 assert.equal(stats.own.weekDistanceMeters,1200);assert.equal(stats.own.weekActivities,1);
 assert.deepEqual(Object.keys(stats).sort(),['own','teams','weekEnd','weekStart']);
 assert.deepEqual(Object.keys(stats.own).sort(),['lunchDistanceMeters','weekActivities','weekDistanceMeters']);
 assert.ok(!JSON.stringify(stats).includes('confidential'));assert.equal(f.P.feed().some(a=>a.userId==='sofiane'),false);
 stats.teams[0].distanceMeters=99999;assert.equal(f.P.challengeStats().teams[0].distanceMeters,2000);
 assert.equal(f.entries.get(PLATFORM_KEY),stored);
 f.login('alex@nova-conseil.fr','nova');const nova=plain(f.P.challengeStats());
 assert.deepEqual(nova.teams,[{team:'Conseil',distanceMeters:9000,me:true},{team:'Audit',distanceMeters:0,me:false},{team:'RH',distanceMeters:0,me:false}]);
 assert.equal(nova.own.weekDistanceMeters,9000);
});

test('challenge week starts Monday UTC, excludes future rows and keeps configured order on ties',()=>{
 const at=Date.parse('2026-09-23T15:00:00Z'),start=Date.parse('2026-09-21T00:00:00Z'),end=start+7*86400000,f=fixture({at});
 challengeRows(f,[
  {at:start,distanceMeters:100},
  {at:start-1,distanceMeters:90000},
  {at,distanceMeters:200},
  {at:at+1,distanceMeters:90000},
  {at:end,distanceMeters:90000},
  {at,userId:'sofiane',team:'Finance',distanceMeters:300}
 ]);
 f.login();const stats=plain(f.P.challengeStats());
 assert.equal(stats.weekStart,start);assert.equal(stats.weekEnd,end);
 assert.equal(stats.own.weekDistanceMeters,300);assert.equal(stats.own.weekActivities,2);
 assert.deepEqual(stats.teams.map(t=>[t.team,t.distanceMeters]),[['Marketing',300],['Finance',300],['RH',0],['IT & Data',0]]);
});

test('lunch challenge counts full own activities completed today in local time from noon until before 14h',()=>{
 const local=(day,hour,minute=0,second=0,millis=0)=>new Date(2026,8,23+day,hour,minute,second,millis).getTime();
 const f=fixture({at:local(0,15)});
 challengeRows(f,[
  {at:local(0,12),distanceMeters:100,durationSeconds:7200},
  {at:local(0,13,59,59,999),distanceMeters:200},
  {at:local(0,11,59,59,999),distanceMeters:900},
  {at:local(0,14),distanceMeters:900},
  {at:local(-1,12),distanceMeters:900},
  {at:local(0,12),userId:'lea',team:'RH',distanceMeters:900},
  {at:local(0,12),orgId:'nova',distanceMeters:900}
 ]);
 f.login();assert.equal(f.P.challengeStats().own.lunchDistanceMeters,300);
});

test('empty accounts start at zero and recording a private activity updates challenges without extra credits',()=>{
 const at=new Date(2026,8,23,13,0,0).getTime(),f=fixture({at});f.operator();
 const {org}=f.D.createOrg({name:'Challenge test',domain:'challenge.example',adminName:'Manager',adminEmail:'manager@challenge.example',teams:['Nord','Sud']});
 f.login('manager@challenge.example',org.id);
 const empty=plain(f.P.challengeStats());assert.deepEqual(empty.own,{weekDistanceMeters:0,weekActivities:0,lunchDistanceMeters:0});
 assert.deepEqual(empty.teams,[{team:'Nord',distanceMeters:0,me:true},{team:'Sud',distanceMeters:0,me:false}]);
 const recorded=f.record({id:'private-challenge',publish:false});const stored=f.entries.get(PLATFORM_KEY);
 const after=plain(f.P.challengeStats());assert.deepEqual(after.own,{weekDistanceMeters:5000,weekActivities:1,lunchDistanceMeters:5000});
 assert.equal(after.teams[0].distanceMeters,5000);assert.equal(f.P.feed().length,0);assert.equal(recorded.contributionCents,0);
 assert.equal(f.entries.get(PLATFORM_KEY),stored);assert.equal(f.P.activities().length,1);
 f.D.logout();assert.throws(()=>f.P.challengeStats(),/Connectez-vous/);
});
