'use strict';
// Regression tests exercise the shared store used by both interfaces.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
function fixture() {
 const entries=new Map(),sessions=new Map(),events={};
 const storage={failWrites:false,get length(){return entries.size;},key:i=>[...entries.keys()][i],getItem:k=>entries.get(k)??null,setItem(k,v){if(this.failWrites)throw Error('QuotaExceededError');entries.set(k,String(v));},removeItem:k=>entries.delete(k)};
 const c={localStorage:storage,sessionStorage:{getItem:k=>sessions.get(k)??null,setItem:(k,v)=>sessions.set(k,String(v)),removeItem:k=>sessions.delete(k)},crypto,URL,console:{warn(){}},addEventListener(type,fn){(events[type]||=[]).push(fn);}};c.window=c;vm.createContext(c);
 for(const name of ['demo-store.js','energy.js','platform-store.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c);
 const login=(email='camille@corelis.fr',orgId='corelis')=>c.Demo.login({email,orgId});login();
 return {D:c.Demo,P:c.Platform,entries,storage,login,events,record:(extra={})=>c.Platform.recordActivity({sport:'Course',distanceMeters:5000,durationSeconds:1800,title:'Nouvelle sortie',publish:true,...extra})};
}
test('comments and likes persist, remain in the company and require a published post',()=>{
 const f=fixture(),post=f.record(),privatePost=f.record({publish:false});
 const c=f.P.comment(post.id,' Bravo ! ');assert.equal(c.text,'Bravo !');assert.equal(c.userId,'camille');
 assert.equal(f.P.toggleLike(post.id).count,1);assert.equal(f.P.toggleLike(post.id).count,0);
 assert.throws(()=>f.P.comment(privatePost.id,'Test'),/indisponible/);
 f.login('lea@corelis.fr');assert.equal(f.P.comments(post.id)[0].id,c.id);assert.equal(f.P.toggleLike(post.id).count,1);
 f.login('alex@nova-conseil.fr','nova');assert.throws(()=>f.P.comments(post.id),/indisponible/);assert.throws(()=>f.P.toggleLike(post.id),/indisponible/);
});
test('failed or empty comments retain previous messages and do not announce a mutation',()=>{
 const f=fixture(),post=f.record();f.P.comment(post.id,'Premier');const before=f.entries.get('moovon:platform:v1');let events=0;f.P.onChange(()=>events++);
 assert.throws(()=>f.P.comment(post.id,'  '),/commentaire/);f.storage.failWrites=true;assert.throws(()=>f.P.comment(post.id,'Second'),/stockage/);
 assert.equal(f.entries.get('moovon:platform:v1'),before);assert.equal(f.P.comments(post.id).length,1);assert.equal(events,0);
});
test('private records stay out of feed and another employee profile while contributing',()=>{
 const f=fixture(),a=f.record({publish:false});assert.ok(a.contributionCents>0);assert.ok(!f.P.feed().some(p=>p.id===a.id));
 f.login('sofiane@corelis.fr');assert.ok(!f.P.activities().some(p=>p.id===a.id));assert.ok(!f.P.profileStats().activities.some(p=>p.id===a.id));
 f.login('alex@nova-conseil.fr','nova');assert.ok(!f.P.activities().some(p=>p.id===a.id));
});
test('signed-out and suspended sessions cannot append activities, comments or events',()=>{
 const f=fixture(),a=f.record();f.D.logout();const before=f.entries.get('moovon:platform:v1');assert.throws(()=>f.record(),/Connectez/);assert.throws(()=>f.P.comment(a.id,'Test'),/Connectez/);assert.throws(()=>f.P.createEvent({}),/Connectez/);assert.equal(f.entries.get('moovon:platform:v1'),before);
 f.login('lea@corelis.fr');f.D.setUserStatus('camille','suspended');assert.throws(()=>f.login());
});
test('invalid measurements never credit or publish; public feed is newest first',()=>{
 const f=fixture();const first=f.record();f.D.advanceHours(1);const second=f.record();assert.equal(f.P.feed()[0].id,second.id);assert.notEqual(first.id,second.id);
 const before=f.entries.get('moovon:platform:v1');
 for(const distanceMeters of [NaN,Infinity,-1,0])assert.throws(()=>f.record({distanceMeters}));
 for(const durationSeconds of [NaN,Infinity,-1,0])assert.throws(()=>f.record({durationSeconds}));
 assert.equal(f.entries.get('moovon:platform:v1'),before);
});
test('a failing view listener cannot roll back or duplicate a committed activity',()=>{
 const f=fixture();f.P.onChange(()=>{throw Error('View failed');});const a=f.record({id:'unique-view-failure'});assert.equal(f.P.activities().filter(p=>p.id===a.id).length,1);
 f.record({id:a.id});assert.equal(f.P.activities().filter(p=>p.id===a.id).length,1);
});
test('legacy history and comments migrate once without duplicate activity or retroactive euros',()=>{
 const f=fixture(),at=f.D.now()-1000;
 f.entries.set('moovon:app:v2:corelis',JSON.stringify({profiles:{camille:{history:[{id:'old',dist:2500,at,title:'Ancienne',published:true}]}},posts:[{id:'post-old',userId:'camille',dist:2500,createdAt:at,n:'Camille',title:'Ancienne'}],comments:{'post-old':[{id:'comment-old',userId:'lea',name:'Léa',text:'Bravo',at}]}}));
 const a=f.P.feed().find(p=>p.legacy);assert.equal(a.distanceMeters,2500);assert.equal(a.contributionCents,0);assert.equal(a.route,'');assert.equal(a.durationSeconds,null);assert.equal(f.P.comments(a.id)[0].text,'Bravo');
 f.P.rules();assert.equal(f.P.activities().filter(p=>p.legacy).length,1);assert.ok(f.entries.has('moovon:app:v2:corelis'));
});
test('shared-storage changes notify views while identity sessions remain independent',()=>{
 const f=fixture();f.P.rules();let seen=0;f.P.onChange(e=>{if(e.type==='storage')seen++;});
 for(const fn of f.events.storage)fn({key:'moovon:platform:v1'});assert.equal(seen,1);assert.equal(f.D.current().user.id,'camille');
});
