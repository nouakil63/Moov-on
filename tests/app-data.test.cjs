'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname,'..');
const storeSource = fs.readFileSync(path.join(root,'demo-store.js'),'utf8');
const appSource = fs.readFileSync(path.join(root,'app.js'),'utf8');
// Execute the actual data functions, without evaluating browser event bindings.
const dataSource = appSource.slice(appSource.indexOf("'use strict';"),appSource.indexOf('/* ================= DONNÉES DÉMO'));
const recordSource = appSource.slice(appSource.indexOf('function recordActivity('),appSource.indexOf('function finishActivity('));

function fixture() {
  const entries = new Map(), session = new Map(), messages = [];
  const localStorage = {failWrites:false,getItem:k=>entries.get(k)??null,setItem(k,v){if(this.failWrites)throw Error('QuotaExceededError');entries.set(k,String(v));},removeItem:k=>entries.delete(k)};
  const context = {localStorage,sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},crypto,console,Event:class Event{},addEventListener(){},dispatchEvent(){},document:{getElementById(){return null;}},toast:message=>messages.push(message),renderAll(){},MISSIONS_DEF:[],WEEK:[]};
  context.window = context;
  vm.createContext(context); vm.runInContext(storeSource,context);
  vm.runInContext(dataSource+'\n'+recordSource+'\nglobalThis.testApp={read:readData,hydrate,record:recordActivity,state:()=>state};',context);
  const login = (email='camille@corelis.fr',orgId='corelis')=>{context.Demo.login({email,orgId});context.testApp.hydrate();};
  const read = ()=>JSON.parse(JSON.stringify(context.testApp.read()));
  return {D:context.Demo,A:context.testApp,localStorage,entries,messages,login,read};
}

test('a private activity credits its author and company without publishing or leaking into another profile',()=>{
  const f=fixture(); f.login();
  assert.equal(f.A.record({dist:5200,title:'Sortie privée',time:'30:00',pace:'5:46',publish:false}),true);
  const saved=f.read();
  assert.equal(saved.profiles.camille.energyBal,11950);
  assert.ok(Math.abs(saved.profiles.camille.meKm-91.6)<1e-9);
  assert.equal(saved.profiles.camille.todaySteps,11340);
  assert.equal(saved.profiles.camille.history[0].published,false);
  assert.equal(saved.posts.length,0); assert.equal(saved.corpEnergy,14385200);
  f.login('lea@corelis.fr');
  assert.equal(f.read().profiles.lea.energyBal,6750);
  assert.equal(f.read().profiles.lea.history,undefined);
  assert.equal(f.read().corpEnergy,14385200);
  f.login('alex@nova-conseil.fr','nova');
  assert.equal(f.read().profiles.camille,undefined);
  assert.equal(f.read().corpEnergy,9240000);
});

test('published activities stay in their company and cycling does not create daily steps',()=>{
  const f=fixture(); f.login();
  assert.equal(f.A.record({dist:10000,title:'Vélo',time:'—',pace:'—',type:'Vélo'}),true);
  assert.equal(f.read().profiles.camille.todaySteps,4320);
  assert.equal(f.read().profiles.camille.energyBal,16750);
  assert.equal(f.read().posts[0].userId,'camille'); assert.equal(f.read().posts[0].type,'Vélo');
  f.login('lea@corelis.fr'); assert.equal(f.read().posts.length,1);
  f.login('alex@nova-conseil.fr','nova'); assert.equal(f.read().posts.length,0);
});

test('failed app storage write does not credit energy or create a duplicateable success state',()=>{
  const f=fixture(); f.login();
  f.A.record({dist:1000,title:'Première sortie',time:'—',pace:'—'});
  const before=JSON.stringify([...f.entries]);
  const balance=f.A.state().energyBal;
  f.localStorage.failWrites=true;
  assert.equal(f.A.record({dist:5200,title:'Échec quota',time:'—',pace:'—'}),false);
  assert.equal(JSON.stringify([...f.entries]),before);
  assert.equal(f.A.state().energyBal,balance);
  assert.equal(f.read().posts.length,1);
  assert.ok(f.messages.length>0);
});

test('daily and monthly personal counters reset when reading a new demo date, without resetting the balance',()=>{
  const f=fixture(); f.login();
  f.A.record({dist:1000,title:'Datée',time:'—',pace:'—'});
  f.D.advanceHours(24);
  assert.equal(f.read().profiles.camille.todaySteps,0);
  assert.equal(f.read().profiles.camille.energyBal,7750);
  f.D.advanceHours(31*24);
  assert.equal(f.read().profiles.camille.meKm,0);
  assert.equal(f.read().profiles.camille.energyBal,7750);
  assert.equal(f.read().profiles.camille.history.length,1);
});

test('a signed-out session cannot write application data',()=>{
  const f=fixture(); f.login();
  f.A.record({dist:1000,title:'Before',time:'—',pace:'—'});
  f.D.logout(); const before=JSON.stringify([...f.entries]);
  assert.equal(f.A.record({dist:1000,title:'After logout',time:'—',pace:'—'}),false);
  assert.equal(JSON.stringify([...f.entries]),before);
});
