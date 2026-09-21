'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'..','demo-store.js'),'utf8');

function storage() {
  const entries = new Map();
  return {failWrites:false,get length(){return entries.size;},key:i=>[...entries.keys()][i] ?? null,getItem:k=>entries.get(k) ?? null,setItem(k,v){if(this.failWrites)throw new Error('QuotaExceededError'); entries.set(k,String(v));},removeItem:k=>entries.delete(k),entries};
}
function tab(shared = storage()) {
  const handlers = {};
  const context = {localStorage:shared,sessionStorage:storage(),console,addEventListener:(name,fn)=>{handlers[name]=fn;}};
  context.window = context;
  vm.createContext(context); vm.runInContext(source,context);
  return {D:context.Demo,shared,session:context.sessionStorage,event:handlers.storage};
}
const login = (D,name='camille',orgId='corelis') => D.login({email:name==='platform'?'hello@moovon.demo':name+'@'+(orgId==='nova'?'nova-conseil.fr':'corelis.fr'),orgId});

test('login requires an existing active account and keeps sessions per tab',()=>{
  const a=tab(),b=tab(a.shared);
  assert.equal(a.D.current(),null);
  assert.throws(()=>a.D.login({email:'unknown@corelis.fr',orgId:'corelis'}),/inconnu/);
  assert.throws(()=>login(a.D,'camille','nova'),/inconnu/);
  login(a.D); login(b.D,'alex','nova');
  assert.equal(a.D.current().user.id,'camille'); assert.equal(b.D.current().user.id,'alex');
  a.D.logout(); assert.equal(a.D.current(),null); assert.equal(b.D.current().user.id,'alex');
});

test('tenant boundaries cover users, stories, moderation, branding and invitations',()=>{
  const {D}=tab(); login(D);
  assert.throws(()=>D.users('nova'),/autre entreprise/);
  assert.throws(()=>D.getStories('nova'),/autre entreprise/);
  assert.throws(()=>D.markStorySeen('story-nova-1'),/autre entreprise/);
  assert.throws(()=>D.reportStory('story-nova-1','test'),/autre entreprise/);
  assert.throws(()=>D.deleteStory('story-nova-1'),/autre entreprise/);
  assert.throws(()=>D.updateOrg('corelis',{name:'hack'}),/administrateur/);
  assert.throws(()=>D.invite('corelis',{}),/administrateur/);
  assert.throws(()=>D.getStories('corelis',{includeExpired:true}),/administrateur/);
  assert.throws(()=>D.reports('corelis'),/administrateur/);
  login(D,'lea');
  assert.throws(()=>D.updateOrg('nova',{name:'hack'}),/autre entreprise/);
  assert.throws(()=>D.setUserStatus('alex','suspended'),/autre entreprise/);
  login(D,'platform','nova'); assert.equal(D.current().org.id,'nova');
  assert.equal(D.updateOrg('nova',{shortName:'NOVA'}).shortName,'NOVA');
});

test('outputs cannot mutate stored state or elevate roles',()=>{
  const {D}=tab(); login(D);
  const current=D.current(); current.user.role='platform'; current.org.name='hack';
  const organizations=D.orgs(); organizations[0].teams.push('fake');
  const posts=D.getStories(); posts[0].text='hack';
  D.updateProfile({role:'platform',orgId:'nova',status:'suspended',name:'Camille Test'});
  assert.equal(D.canAdmin(),false); assert.equal(D.current().org.name,'Banque Corélis');
  assert.equal(D.current().user.orgId,'corelis'); assert.equal(D.current().user.status,'active');
  assert.equal(D.current().user.name,'Camille Test');
  assert.ok(!D.org('corelis').teams.includes('fake')); assert.notEqual(D.getStories()[0].text,'hack');
});

test('invitations are pending, scoped, single-use and expire on the demo clock',()=>{
  const {D}=tab(); login(D,'lea');
  const invited=D.invite('corelis',{name:'Zoé',email:' ZOE@corelis.fr ',team:'RH',role:'employee'});
  assert.equal(invited.user.status,'invited'); assert.equal(invited.invite.email,'zoe@corelis.fr');
  assert.throws(()=>D.login({email:'zoe@corelis.fr',orgId:'corelis'}),/invitation/);
  D.logout(); assert.equal(D.acceptInvite(invited.invite.token).status,'active');
  assert.equal(D.current(),null); assert.throws(()=>D.acceptInvite(invited.invite.token),/déjà/);
  D.login({email:'zoe@corelis.fr',orgId:'corelis'}); assert.equal(D.canAdmin(),false);
  login(D,'lea');
  const expired=D.invite('corelis',{name:'Louis',email:'louis@corelis.fr',team:'RH',role:'admin'});
  D.advanceHours(168); assert.throws(()=>D.acceptInvite(expired.invite.token),/expiré/);
  assert.equal(D.users().find(u=>u.id===expired.user.id).status,'invited');
  assert.throws(()=>D.invite('corelis',{name:'Root',email:'root@corelis.fr',team:'RH',role:'platform'}),/rôle/);
});

test('suspension invalidates another open tab and revokes pending invites',()=>{
  const admin=tab(),employee=tab(admin.shared); login(admin.D,'lea'); login(employee.D);
  admin.D.setUserStatus('camille','suspended');
  assert.equal(employee.D.current(),null);
  assert.throws(()=>employee.D.createStory({text:'not allowed'}),/Connectez/);
  assert.throws(()=>login(employee.D),/suspendu/);
  admin.D.setUserStatus('camille','active'); login(employee.D);
  assert.equal(employee.D.current().user.status,'active');
  assert.throws(()=>admin.D.setUserStatus('lea','suspended'),/propre statut/);
  const pending=admin.D.invite('corelis',{name:'Test',email:'test@corelis.fr',team:'RH'});
  admin.D.setUserStatus(pending.user.id,'suspended');
  assert.throws(()=>employee.D.acceptInvite(pending.invite.token),/invalide/);
});

test('stories expire after 24 hours, keep tenant scope and seen status per user',()=>{
  const {D}=tab(); login(D);
  assert.ok(!D.getStories().some(s=>s.id==='story-corelis-old'));
  const story=D.createStory({text:'Bonjour',bg:'#1543B7'});
  assert.equal(story.expiresAt-story.publishedAt,86400000);
  assert.equal(D.hasSeenStory(story.id),false); D.markStorySeen(story.id); assert.equal(D.hasSeenStory(story.id),true);
  login(D,'lea'); assert.equal(D.hasSeenStory(story.id),false);
  D.advanceHours(24); assert.ok(!D.getStories().some(s=>s.id===story.id));
  assert.ok(D.getStories('corelis',{includeExpired:true}).some(s=>s.id===story.id));
  assert.throws(()=>D.markStorySeen(story.id),/expiré/);
  assert.throws(()=>D.reportStory(story.id,'Old'),/expiré/);
});

test('moderation permits authors or admins to remove and admins to dismiss reports',()=>{
  const {D}=tab(); login(D);
  const report=D.reportStory('story-corelis-2','Contenu à vérifier');
  assert.throws(()=>D.reportStory('story-corelis-2','Encore'),/déjà/);
  assert.throws(()=>D.deleteStory('story-corelis-2'),/propres/);
  assert.throws(()=>D.dismissReport(report.id),/administrateur/);
  const mine=D.createStory({text:'Mon message'}); D.deleteStory(mine.id);
  assert.ok(!D.getStories().some(s=>s.id===mine.id));
  login(D,'lea'); assert.equal(D.reports()[0].status,'open');
  D.dismissReport(report.id); assert.equal(D.reports()[0].status,'dismissed');
  D.deleteStory('story-corelis-1'); assert.ok(!D.getStories().some(s=>s.id==='story-corelis-1'));
});

test('storage quota rolls back mutations and emits no false success',()=>{
  const {D,shared}=tab(); login(D,'lea');
  const before=JSON.stringify([...shared.entries]); let changes=0;
  D.onChange(()=>changes++); shared.failWrites=true;
  assert.throws(()=>D.updateOrg('corelis',{name:'Nouveau'}),/stockage local plein/);
  assert.throws(()=>D.createStory({text:'will fail'}),/stockage local plein/);
  assert.throws(()=>D.invite('corelis',{name:'Fail',email:'fail@corelis.fr',team:'RH'}),/stockage local plein/);
  assert.equal(JSON.stringify([...shared.entries]),before); assert.equal(changes,0);
  assert.equal(D.org('corelis').name,'Banque Corélis');
});

test('bad media and compound invalid branding changes leave existing data untouched',()=>{
  const {D}=tab(); login(D,'lea');
  assert.throws(()=>D.createStory({type:'photo',media:'data:image/svg+xml;base64,PHN2Zz4='}),/image/);
  assert.throws(()=>D.createStory({type:'photo',media:'data:image/png;base64,'+'A'.repeat(1200000)}),/volumineuse/);
  assert.throws(()=>D.updateOrg('corelis',{name:'Should rollback',color:'red'}),/couleur/);
  assert.equal(D.org('corelis').name,'Banque Corélis');
  assert.throws(()=>D.updateOrg('corelis',{teams:['RH']}),/équipe utilisée/);
});

test('changes propagate by storage events while sessions remain isolated',()=>{
  const a=tab(),b=tab(a.shared); login(a.D,'lea'); login(b.D,'camille');
  let notified=0; const unsubscribe=b.D.onChange(()=>notified++);
  a.D.updateOrg('corelis',{color:'#112233'});
  b.event({key:'moovon:demo:v1'});
  assert.equal(notified,1); assert.equal(b.D.current().org.color,'#112233'); assert.equal(b.D.current().user.id,'camille');
  unsubscribe(); b.event({key:'moovon:demo:v1'}); assert.equal(notified,1);
  b.event({key:'another-key'}); assert.equal(notified,1);
});

test('reloading the module preserves data and reset restores seeds without network',()=>{
  const a=tab(); login(a.D,'lea'); a.D.updateOrg('corelis',{shortName:'Changed'});
  a.shared.setItem('moovon:app:v2:corelis','app state');
  a.shared.setItem('moovon:app:v2:nova','app state');
  a.shared.setItem('unrelated-data','keep me');
  const b=tab(a.shared); assert.equal(b.D.org('corelis').shortName,'Changed');
  b.D.reset(); assert.equal(b.D.current(),null); assert.equal(b.D.org('corelis').shortName,'Corélis');
  assert.equal(a.shared.getItem('moovon:app:v2:corelis'),null);
  assert.equal(a.shared.getItem('moovon:app:v2:nova'),null);
  assert.equal(a.shared.getItem('unrelated-data'),'keep me');
});

test('only platform can create a client with an active administrator and isolated data',()=>{
  const {D}=tab();
  const input={name:'Groupe Élan',shortName:'Élan',domain:'elan.fr',adminName:'Marie Test',adminEmail:'marie@elan.fr',teams:['RH','Opérations'],color:'#225577',accent:'#CCAA55'};
  assert.throws(()=>D.createOrg(input),/Connectez/);
  login(D,'lea'); assert.throws(()=>D.createOrg(input),/équipe Moov/);
  login(D,'platform'); const created=D.createOrg(input);
  assert.equal(created.org.id,'elan'); assert.equal(created.org.monthlyGoal,20000000);
  assert.equal(created.user.role,'admin'); assert.equal(created.user.status,'active'); assert.equal(created.user.team,'RH');
  D.login({email:created.user.email,orgId:created.org.id});
  assert.equal(D.canAdmin(),true); assert.equal(D.users().length,1); assert.equal(D.getStories().length,0);
  assert.throws(()=>D.users('corelis'),/autre entreprise/);
  created.org.name='not persisted'; assert.equal(D.current().org.name,'Groupe Élan');
  login(D,'platform'); const second=D.createOrg({...input,domain:'autre-elan.fr'});
  assert.equal(second.org.id,'elan-2');
});

test('duplicate domains, invalid client input and quota failure cannot partially create an organization',()=>{
  const {D,shared}=tab(); login(D,'platform');
  const input={name:'Groupe Test',domain:'test.fr',adminName:'Test',adminEmail:'test@test.fr'};
  const before=JSON.stringify([...shared.entries]);
  assert.throws(()=>D.createOrg({...input,domain:'CORELIS.FR'}),/déjà/);
  assert.throws(()=>D.createOrg({...input,domain:'invalid..fr'}),/invalide/);
  assert.throws(()=>D.createOrg({...input,color:'red'}),/couleurs/);
  assert.throws(()=>D.createOrg({...input,adminEmail:'invalid'}),/e-mail/);
  assert.throws(()=>D.createOrg({...input,teams:[]}),/équipes/);
  assert.throws(()=>D.updateOrg('nova',{domain:'corelis.fr'}),/déjà/);
  assert.equal(JSON.stringify([...shared.entries]),before);
  shared.failWrites=true;
  assert.throws(()=>D.createOrg(input),/stockage local plein/);
  assert.equal(JSON.stringify([...shared.entries]),before);
});

const photoMedia='data:image/png;base64,AAAA';
const overlay=(patch={})=>({id:'text_1',text:'Ensemble 💙\nChaque mètre compte',x:.5,y:.5,size:.07,color:'#FfAa00',background:'dark',font:'sans',align:'center',...patch});
const plain=value=>JSON.parse(JSON.stringify(value));

test('photo overlays persist canonically across reloads and returned copies cannot alter them',()=>{
  const a=tab();login(a.D);
  const overlays=Array.from({length:6},(_,i)=>overlay({id:'text-'+i,x:i%2?.92:.08,y:i%2?.08:.92,size:i%2?.12:.04,background:['none','dark','light'][i%3],font:['sans','serif','hand'][i%3],align:['left','center','right'][i%3],html:'<img onerror=alert(1)>',style:{position:'fixed'}}));
  const expected=overlays.map(({html,style,...value})=>value);
  const story=a.D.createStory({type:'photo',media:photoMedia,overlays});
  assert.deepEqual(plain(story.overlays),expected);
  const saved=JSON.parse(a.shared.getItem('moovon:demo:v1')).stories.find(s=>s.id===story.id);
  assert.deepEqual(saved.overlays,expected);
  overlays[0].text='Changed input';story.overlays[0].x=.9;
  const visible=a.D.getStories().find(s=>s.id===story.id);visible.overlays[0].text='Changed output';
  const b=tab(a.shared);login(b.D);
  assert.deepEqual(plain(b.D.getStories().find(s=>s.id===story.id).overlays),expected);
  assert.equal(saved.expiresAt-saved.publishedAt,86400000);
});

test('invalid overlay fields fail before saving or emitting any mutation',()=>{
  const {D,shared}=tab();login(D);const before=JSON.stringify([...shared.entries]);let changes=0;D.onChange(()=>changes++);
  const invalid=[null,{},'text',Array.from({length:7},(_,i)=>overlay({id:'text_'+i})),[null],[[]],[overlay(),overlay()],new Array(1)];
  const badFields={id:['','two words','<script>','x'.repeat(51),12],text:[180,null,'a'.repeat(181)],x:[NaN,Infinity,-Infinity,.079999,.920001,'0.5',null],y:[NaN,.079999,.920001,'0.5'],size:[NaN,Infinity,.039999,.120001,'0.07'],color:['red','#fff','#12345678',null],background:['black',null],font:['monospace',null],align:['justify',null]};
  for(const [key,values] of Object.entries(badFields))for(const value of values)invalid.push([overlay({[key]:value})]);
  for(const key of Object.keys(overlay())){const missing=overlay();delete missing[key];invalid.push([missing]);}
  for(const overlays of invalid){
    assert.throws(()=>D.createStory({type:'photo',media:photoMedia,overlays}),/superposé|photo/);
    assert.equal(JSON.stringify([...shared.entries]),before);
  }
  assert.throws(()=>D.createStory({type:'text',text:'Bonjour',overlays:[overlay()]}),/uniquement.*photo/);
  assert.equal(JSON.stringify([...shared.entries]),before);assert.equal(changes,0);
});

test('old photo and text stories remain readable with empty overlays and old create calls still work',()=>{
  const {D,shared}=tab();login(D);
  const text=D.createStory({text:'Story texte'}),photo=D.createStory({type:'photo',media:photoMedia});
  assert.deepEqual(plain(photo.overlays),[]);
  const data=JSON.parse(shared.getItem('moovon:demo:v1'));
  data.stories.forEach(story=>delete story.overlays);shared.setItem('moovon:demo:v1',JSON.stringify(data));
  const before=shared.getItem('moovon:demo:v1'),reloaded=tab(shared);login(reloaded.D);
  for(const id of [text.id,photo.id,'story-corelis-1'])assert.deepEqual(plain(reloaded.D.getStories().find(s=>s.id===id).overlays),[]);
  assert.equal(shared.getItem('moovon:demo:v1'),before);
  assert.doesNotThrow(()=>D.createStory({text:'Sans superposition',overlays:[]}));
  const exact=D.createStory({type:'photo',media:photoMedia,overlays:[overlay({id:'x'.repeat(50),text:'a'.repeat(178)+'💙'})]});
  assert.equal(exact.overlays[0].text.length,180);
});

test('overlay retrieval stays scoped to the company and sanitizes extra stored attributes',()=>{
  const a=tab();login(a.D);
  const story=a.D.createStory({type:'photo',media:photoMedia,overlays:[overlay()]});
  const data=JSON.parse(a.shared.getItem('moovon:demo:v1'));
  data.stories.find(s=>s.id===story.id).overlays[0].unsafe='not rendered';
  a.shared.setItem('moovon:demo:v1',JSON.stringify(data));
  assert.deepEqual(plain(a.D.getStories().find(s=>s.id===story.id).overlays),[overlay()]);
  const other=tab(a.shared);login(other.D,'alex','nova');
  assert.ok(!other.D.getStories().some(s=>s.id===story.id));
  assert.throws(()=>other.D.getStories('corelis'),/autre entreprise/);
  assert.throws(()=>other.D.deleteStory(story.id),/autre entreprise/);
  login(other.D,'lea');assert.deepEqual(plain(other.D.getStories().find(s=>s.id===story.id).overlays),[overlay()]);
});

test('overlay creation also rolls back completely when image storage exceeds the quota',()=>{
  const {D,shared}=tab();login(D);const before=shared.getItem('moovon:demo:v1');let changes=0;D.onChange(()=>changes++);
  shared.failWrites=true;
  assert.throws(()=>D.createStory({type:'photo',media:photoMedia,overlays:[overlay()]}),/stockage local plein/);
  assert.equal(shared.getItem('moovon:demo:v1'),before);assert.equal(changes,0);
});
