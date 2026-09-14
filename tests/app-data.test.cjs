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
const commentSource = appSource.slice(appSource.indexOf('function publishComment('),appSource.indexOf('function openComments('));
const revealSource = appSource.slice(appSource.indexOf('function goHome('),appSource.indexOf('/* ================= BRAVOS'));

function fixture() {
  const entries = new Map(), session = new Map(), messages = [],frames=new Map();let frameId=0;
  const localStorage = {failWrites:false,getItem:k=>entries.get(k)??null,setItem(k,v){if(this.failWrites)throw Error('QuotaExceededError');entries.set(k,String(v));},removeItem:k=>entries.delete(k)};
  const context = {localStorage,sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},crypto,console:{warn:()=>{}},Event:class Event{},addEventListener(){},dispatchEvent(){},document:{getElementById(){return null;}},toast:message=>messages.push(message),renderAll(){},syncVisibility(){},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),setTimeout(){return 1;},clearTimeout(){},matchMedia:()=>({matches:false}),MISSIONS_DEF:[],WEEK:[],BASE_FEED:[{id:'p1'}]};
  context.window = context;
  vm.createContext(context); vm.runInContext(storeSource,context);
  vm.runInContext(dataSource+'\n'+recordSource+'\n'+commentSource+'\nlet currentScreen="scr-home";\n'+revealSource+'\nglobalThis.testApp={read:readData,hydrate,record:recordActivity,comment:publishComment,reveal:revealPost,state:()=>state};',context);
  const login = (email='camille@corelis.fr',orgId='corelis')=>{context.Demo.login({email,orgId});context.testApp.hydrate();};
  const read = ()=>JSON.parse(JSON.stringify(context.testApp.read()));
  return {D:context.Demo,A:context.testApp,localStorage,entries,messages,login,read,context,flushFrames(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}}};
}

test('a private activity credits its author and company without publishing or leaking into another profile',()=>{
  const f=fixture(); f.login();
  const result=f.A.record({dist:5200,title:'Sortie privée',time:'30:00',pace:'5:46',publish:false});
  assert.equal(result.published,false);assert.equal(result.postId,null);assert.equal(result.energy,5200);
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
  const result=f.A.record({dist:10000,title:'Vélo',time:'—',pace:'—',type:'Vélo'});
  assert.equal(result.published,true);assert.equal(result.postId,f.read().posts[0].id);
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

test('publication returns the new head of the feed and invalid distances never create posts',()=>{
  const f=fixture();f.login();
  const first=f.A.record({dist:1000,title:'Première',time:'—',pace:'—'});
  const second=f.A.record({dist:2000,title:'Deuxième',time:'—',pace:'—'});
  assert.notEqual(first.postId,second.postId);assert.equal(f.read().posts[0].id,second.postId);
  const before=JSON.stringify([...f.entries]);
  for(const dist of [NaN,Infinity,-10,0,500001])assert.equal(f.A.record({dist,title:'Invalid',time:'—',pace:'—'}),false);
  assert.equal(JSON.stringify([...f.entries]),before);
});

test('a render failure after commit remains a successful save and exposes its published post',()=>{
  const f=fixture();f.login();
  f.context.renderAll=()=>{throw new Error('Rendering failed after save');};
  const result=f.A.record({dist:1000,title:'Enregistrée',time:'—',pace:'—'});
  assert.ok(result.postId);assert.equal(f.read().posts[0].id,result.postId);
  assert.equal(f.read().posts.length,1);assert.equal(f.read().profiles.camille.energyBal,7750);
});

test('comments publish on an existing company post, persist and reject missing or other-company posts',()=>{
  const f=fixture();f.login();
  const post=f.A.record({dist:1000,title:'Commentable',time:'—',pace:'—'});
  const comment=f.A.comment(post.postId,' Bravo ! ');
  assert.equal(comment.text,'Bravo !');assert.equal(comment.userId,'camille');
  assert.equal(f.read().comments[post.postId][0].id,comment.id);
  f.login('lea@corelis.fr');assert.equal(f.read().comments[post.postId][0].text,'Bravo !');
  assert.ok(f.A.comment('corelis-p1','Bravo à Finance'));
  assert.equal(f.A.comment('missing-post','Hello'),false);
  f.login('alex@nova-conseil.fr','nova');assert.equal(f.A.comment(post.postId,'Hello'),false);
  assert.equal(f.read().comments[post.postId],undefined);
});

test('a failed comment save keeps previous messages and empty comments cannot be submitted',()=>{
  const f=fixture();f.login();const post=f.A.record({dist:1000,title:'Test',time:'—',pace:'—'});
  f.A.comment(post.postId,'Premier');const before=JSON.stringify([...f.entries]);
  assert.equal(f.A.comment(post.postId,'   '),false);
  f.localStorage.failWrites=true;assert.equal(f.A.comment(post.postId,'Second'),false);
  assert.equal(JSON.stringify([...f.entries]),before);assert.equal(f.read().comments[post.postId].length,1);
});

function setupFeed(f,id){
  const classes=new Set();const classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){on?classes.add(c):classes.delete(c);}};
  const post={dataset:{post:id},classList,setAttribute(){},getBoundingClientRect:()=>({top:720}),focus(options){this.focusOptions=options;}};
  const screen={id:'scr-home',classList:{toggle(){}},scrollTop:350,getBoundingClientRect:()=>({top:100}),scrollTo(options){this.scrolled=options;}};
  const feed={querySelectorAll:selector=>selector==='[data-post]'?[post]:classes.has('is-new-post')?[post]:[]};
  f.context.document={getElementById:id=>({'scr-home':screen,feed})[id],querySelectorAll:selector=>selector==='.screen'?[screen]:[]};
  return {screen,post,classes};
}

test('revealPost scrolls the internal home pane and highlights/focuses the newly published card',()=>{
  const f=fixture();f.login();const result=f.A.record({dist:1000,title:'Visible',time:'—',pace:'—'});
  const view=setupFeed(f,result.postId);
  assert.equal(f.A.reveal(result.postId),true);f.flushFrames();
  assert.equal(view.screen.scrolled.top,608);assert.equal(view.screen.scrolled.behavior,'smooth');
  assert.equal(view.post.focusOptions.preventScroll,true);assert.ok(view.classes.has('is-new-post'));
  assert.equal(f.A.reveal('private-or-missing'),false);
});

test('a pending publication reveal cannot focus content after the user changes company',()=>{
  const f=fixture();f.login();const result=f.A.record({dist:1000,title:'Corélis',time:'—',pace:'—'});
  const view=setupFeed(f,result.postId);assert.equal(f.A.reveal(result.postId),true);
  f.login('alex@nova-conseil.fr','nova');f.flushFrames();
  assert.equal(view.screen.scrolled,undefined);assert.equal(view.post.focusOptions,undefined);
});
