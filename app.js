(()=>{

'use strict';
/* ========= BARÈME (démo — sera configurable côté entreprise) =========
   1 mètre parcouru = 1 point d'énergie (⚡), à distribuer sur les missions. */
const RATE = {
  energyPerMeter: 1,
  stepsPerMeter: 1.35
};
const SIM_SPEED = 55;      // m/s simulés — accéléré pour la démo (≈5 km en 90 s)

const $ = id => document.getElementById(id);
const fmtInt = n => Math.round(n).toLocaleString('fr-FR');
const fmtE = n => n >= 1e6 ? (n/1e6).toLocaleString('fr-FR',{maximumFractionDigits:1}) + ' M'
              : n >= 1e4 ? Math.round(n/1000).toLocaleString('fr-FR') + ' k'
              : fmtInt(n);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {get(k,f){try{return JSON.parse(localStorage.getItem('moovon:ui:'+k))??f}catch{return f}},set(k,v){try{localStorage.setItem('moovon:ui:'+k,JSON.stringify(v))}catch{toast('Préférence appliquée pour cette session uniquement.');}}};
const ctx = ()=>window.Demo?.current();
const appKey = ()=> 'moovon:app:v2:'+ctx().org.id;
const todayKey = ()=>new Date(Demo.now()).toLocaleDateString('en-CA');
function initialProfile(){const seeded=['corelis','nova'].includes(ctx().org.id)&&['camille','lea','sofiane','alex','sarah','platform'].includes(ctx().user.id);return {energyBal:seeded?6750:0,meKm:seeded?86.4:0,todaySteps:seeded?4320:0,demoSeed:seeded,date:todayKey(),month:todayKey().slice(0,7),given:{}};}
const missionInitial=id=>['corelis','nova'].includes(ctx().org.id)?MISSIONS_DEF.find(m=>m.id===id).got:0;
function readData(){
  const c=ctx(); if(!c) return null;
  let data; try{data=JSON.parse(localStorage.getItem(appKey()));}catch{}
  data ||= {profiles:{},posts:[],missions:{},corpEnergy:c.org.id==='corelis'?14380000:c.org.id==='nova'?9240000:0,challenges:[],likes:{},comments:{}};
  data.profiles[c.user.id] ||= initialProfile();
  const p=data.profiles[c.user.id];
  if(p.date!==todayKey()){p.date=todayKey();p.todaySteps=0;}
  if(p.month!==todayKey().slice(0,7)){p.month=todayKey().slice(0,7);p.meKm=0;}
  return data;
}
let appData=null;
let postHighlight=null, revealFrame=null, highlightTimer=null;
const state={corpEnergy:0,posts:[],energyBal:0,meKm:0,todaySteps:0,missions:{}};
let missions=[];
function hydrate(data=readData()){
  if(!data||!ctx()) return;
  appData=data;
  const p=data.profiles[ctx().user.id];
  Object.assign(state,p,{corpEnergy:data.corpEnergy,posts:data.posts});
  missions=MISSIONS_DEF.map(m=>({...m,name:m.id==='arbres'?'La forêt '+ctx().org.shortName:m.name,got:data.missions[m.id]??missionInitial(m.id),my:p.given[m.id]||0}));
  const day=(new Date(Demo.now()).getDay()+6)%7;
  WEEK.forEach((d,i)=>{d.today=i===day;d.steps=i===day?p.todaySteps:i>day||p.demoSeed===false?0:[9840,11250,7420,12600,8930,11200,6200][i];});
}
function transact(change){
  if(!ctx()){toast('Connectez-vous pour continuer.');return false;}
  let next;
  try{
    next=readData(); change(next,next.profiles[ctx().user.id]);
    localStorage.setItem(appKey(),JSON.stringify(next));
  }catch(e){toast(e.message||'Enregistrement impossible. Libérez du stockage et réessayez.');return false;}
  // A rendering error must not turn an already committed activity into a failed
  // save: retrying it would credit the same activity twice.
  try{hydrate(next);renderAll();window.dispatchEvent(new Event('moovappchange'));}
  catch(e){console.warn('Données enregistrées, affichage à actualiser :',e);toast('Enregistrement effectué. Actualisez la page si l’affichage ne se met pas à jour.');}
  return true;
}
function relTime(time){const s=(Demo.now()-new Date(time).getTime())/1000;return s<60?'à l’instant':s<3600?`il y a ${Math.floor(s/60)} min`:s<86400?`il y a ${Math.floor(s/3600)} h`:`il y a ${Math.floor(s/86400)} j`;}


/* ================= DONNÉES DÉMO ================= */
const TEAM_COLORS = {Marketing:'#B3541E', Finance:'#2C5F8A', RH:'#6E4B8E', 'IT & Data':'#1F7A6D', Juridique:'#8A2C4F', Direction:'#6B6B23'};
const STORIES = [
  {n:'Vous', t:'Marketing', me:true},
  {n:'Sofiane', t:'Finance'}, {n:'Léa', t:'RH'}, {n:'Marc', t:'IT & Data'},
  {n:'Inès', t:'Marketing', seen:true}, {n:'Hugo', t:'Juridique', seen:true}, {n:'Awa', t:'Direction', seen:true}
];
const BASE_FEED = [
  {id:'p1', n:'Sofiane B.', team:'Finance', when:'il y a 25 min', title:'Fractionné avant la réunion budget', dist:6200, time:'32:10', pace:'5:11', give:'Urgence & Secours', bravos:14, comments:3, route:'M30 150 C 90 110, 70 60, 150 70 S 240 130, 300 80 S 360 40, 372 35'},
  {id:'p2', n:'Léa Fontaine', team:'RH', when:'il y a 2 h', title:'Marche du déjeuner avec l’équipe recrutement', dist:3400, time:'41:05', pace:'12:05', give:'Refuge animalier', bravos:22, comments:5, route:'M40 40 C 80 90, 160 60, 190 110 S 150 160, 240 150 S 340 120, 370 145'},
  {id:'p3', n:'Marc Delattre', team:'IT & Data', when:'hier', title:'10 km — plein d’énergie pour la forêt 🎯', dist:10100, time:'52:48', pace:'5:14', give:'La forêt Corélis', bravos:41, comments:9, route:'M30 90 C 110 40, 150 140, 220 100 S 280 30, 330 70 S 365 130, 375 140'}
];

/* Missions (associations fictives — les vraies seront branchées après signature des partenariats) */
const MISSIONS_DEF = [
  {id:'secours', name:'Urgence & Secours', org:'Premiers Secours Solidaires', per:500,  unit:'kit de secours distribué', goal:2000000, got:1240000, icon:'cross'},
  {id:'animaux', name:'Refuge animalier', org:'Les Quatre Pattes',            per:300,  unit:'repas pour un animal',     goal:1500000, got:890000,  icon:'paw'},
  {id:'enfants', name:'Enfants à l’hôpital', org:'Cœur d’Enfants',            per:1000, unit:'heure d’animation offerte', goal:3000000, got:2210000, icon:'heart'},
  {id:'arbres',  name:'La forêt Corélis', org:'Canopée Demain',               per:5000, unit:'arbre planté',             goal:2500000, got:2090000, icon:'tree'},
  {id:'repas',   name:'Repas chauds', org:'Table Ouverte',                    per:500,  unit:'repas chaud servi',        goal:2000000, got:1560000, icon:'bowl'},
];
const MICON = {
  cross:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  paw:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="8" r="2.2"/><circle cx="12" cy="5.5" r="2.2"/><circle cx="17" cy="8" r="2.2"/><path d="M12 10c3 0 6 2.6 6 5.4 0 2-1.5 3.1-3.2 2.8-1.1-.2-1.9-.7-2.8-.7s-1.7.5-2.8.7C7.5 18.5 6 17.4 6 15.4 6 12.6 9 10 12 10Z"/></svg>',
  heart:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C10.9 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>',
  tree:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="m9 9 3-7 3 7"/><path d="m7 15 5-6 5 6"/></svg>',
  bowl:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M7 11V7a2 2 0 0 1 4 0M13 11V5a2 2 0 0 1 4 0v6"/></svg>',
  bolt:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>'
};
const LEADERBOARD = [
  {team:'IT & Data', km:312}, {team:'Marketing', km:236, me:true}, {team:'Finance', km:224},
  {team:'RH', km:187}, {team:'Juridique', km:141}, {team:'Direction', km:96}
];
const WEEK = [
  {d:'L', steps:9840},{d:'M', steps:11250},{d:'M', steps:7420},{d:'J', steps:12600},
  {d:'V', steps:8930},{d:'S', steps:11200},{d:'D', steps:0, today:true}
];

const missionTrees = ()=>Math.floor((missions.find(m=>m.id==='arbres')?.got||0)/5000);
const missionMeals = ()=>Math.floor((missions.find(m=>m.id==='repas')?.got||0)/500);

/* ================= RENDU ================= */
function initials(name){ return name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase(); }

function renderStories(){window.MoovStories?.render();}

function postCard(p){
  const energy = Math.round(p.dist * RATE.energyPerMeter);
  const manual = p.time === '—';
  const stats = manual
    ? `<div class="pstat"><div class="v num">${(p.dist/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})} km</div><div class="l">distance</div></div>
       <div class="pstat"><div class="v num">+${fmtE(energy)}</div><div class="l">énergie ⚡</div></div>
       <div class="pstat"><div class="v num">${p.type==='Vélo'?'Vélo':fmtInt(p.dist*RATE.stepsPerMeter)}</div><div class="l">${p.type==='Vélo'?'activité':'pas'}</div></div>`
    : `<div class="pstat"><div class="v num">${(p.dist/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})} km</div><div class="l">distance</div></div>
       <div class="pstat"><div class="v num">${esc(p.time)}</div><div class="l">durée</div></div>
       <div class="pstat"><div class="v num">${esc(p.pace)}</div><div class="l">min / km</div></div>`;
  return `
  <article class="post${postHighlight?.id===p.id&&postHighlight.orgId===ctx()?.org.id&&postHighlight.until>Date.now()?' is-new-post':''}" data-post="${p.id}">
    <div class="node"><span class="avatar" style="background:${TEAM_COLORS[p.team]||'#555'}">${esc(initials(p.n))}</span></div>
    <div class="when">${esc(p.when)}</div>
    <div class="pname">${esc(p.n)} <span>· ${esc(p.team)}</span></div>
    <div class="pcard">
      <div class="pmap">
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" aria-label="Tracé du parcours" role="img">
          <rect width="400" height="160" fill="var(--sunken)"/>
          <g stroke="var(--line)" stroke-width="8" fill="none" opacity=".8"><path d="M-10 50 L410 42"/><path d="M-10 122 L410 128"/><path d="M100 -10 L112 170"/><path d="M300 -10 L290 170"/></g>
          <path d="${p.route}" fill="none" stroke="var(--brand)" stroke-width="5" stroke-linecap="round"/>
        </svg>
        <div class="grad"></div>
        <div class="pstats num">${stats}</div>
      </div>
      <div class="pbody">
        <div class="ptitle">${esc(p.title)}</div>
        <span class="pimpact num">⚡ +${fmtInt(energy)} énergie récoltée${p.give?` · → ${esc(p.give)}`:''}</span>
      </div>
      <div class="post-actions">
        <button class="pact bravo" aria-pressed="false">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          Bravo · <span class="num bravo-count">${p.bravos}</span>
        </button>
        <button class="pact" data-action="comment" aria-label="Commentaires">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12Z"/></svg>
          <span class="num">${p.comments}</span>
        </button>
        <button class="pact" data-action="share" style="margin-left:auto">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          Partager
        </button>
      </div>
    </div>
  </article>`;
}

function renderFeed(){
  const c=ctx();if(!c)return;
  const seeded=(['corelis','nova'].includes(c.org.id)?BASE_FEED:[]).map((p,i)=>({...p,n:c.org.id==='corelis'?p.n:['Alex Morgan','Sarah Benali','Louis Martin'][i],team:c.org.id==='corelis'?p.team:[c.org.teams[0],c.org.teams.at(-1),c.org.teams[1]||c.org.teams[0]][i],give:p.id==='p3'?'La forêt '+c.org.shortName:p.give,id:c.org.id+'-'+p.id}));
  $('feed').innerHTML=[...state.posts,...seeded].map(p=>{
    const likes=appData.likes?.[p.id]||[];
    return postCard({...p,when:p.createdAt?relTime(p.createdAt):p.when,bravos:(p.bravos||0)+likes.length,comments:(appData.comments?.[p.id]||[]).length}).replace('class="pact bravo" aria-pressed="false"',`class="pact bravo ${likes.includes(c.user.id)?'bravoed':''}" aria-pressed="${likes.includes(c.user.id)}"`);
  }).join('')||'<p class="feed-empty">Votre fil prend vie avec vous. Publiez une première activité avec le bouton +.</p>';
}

function renderToday(){
  const d = new Date(Demo.now()).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  $('greet-date').textContent = d.charAt(0).toUpperCase()+d.slice(1) + ' · '+ctx().user.team;
  const meters = state.todaySteps / RATE.stepsPerMeter;
  $('today-steps').textContent = fmtInt(state.todaySteps);
  $('today-km').textContent = (meters/1000).toLocaleString('fr-FR',{maximumFractionDigits:1});
  $('today-energy').textContent = fmtInt(meters * RATE.energyPerMeter);
  const dates=new Set((appData.profiles[ctx().user.id].history||[]).map(h=>new Date(h.at).toLocaleDateString('en-CA')));
  const cursor=new Date(Demo.now());let streak=0;
  if(!dates.has(cursor.toLocaleDateString('en-CA')))cursor.setDate(cursor.getDate()-1);
  while(dates.has(cursor.toLocaleDateString('en-CA'))){streak++;cursor.setDate(cursor.getDate()-1);}
  if(state.demoSeed)streak=Math.max(6,streak);
  $('streak-count').textContent=streak+' J';
  document.querySelector('.h5-bib').setAttribute('aria-label','Série de '+streak+' jours');
  document.querySelector('.h5-sub>span:last-child b').textContent=streak+' j';
  document.querySelector('.prof-sub .outline').textContent='Série · '+streak+' jours';
  $('bal-ticket').textContent = `${fmtInt(state.energyBal)} ⚡ — choisir mes missions`;
}

function renderCorp(){
  $('corp-energy').textContent = fmtE(state.corpEnergy);
  $('corp-trees').textContent = fmtInt(missionTrees());
  $('corp-meals').textContent = fmtInt(missionMeals());
  const pct = Math.min(100, state.corpEnergy/(ctx().org.monthlyGoal||20000000)*100);
  $('corp-ring').style.background = `conic-gradient(var(--brand) 0 ${pct.toFixed(1)}%, var(--sunken) ${pct.toFixed(1)}% 100%)`;
  $('corp-pct').textContent = Math.round(pct) + ' %';
  const goal = 500, trees = missionTrees(), rest = Math.max(0, goal - trees);
  const dfPct = Math.min(100, trees/goal*100);
  $('df-title').textContent = rest > 0 ? `Plus que ${rest} arbre${rest>1?'s':''} à planter !` : 'Objectif atteint — 500 arbres plantés !';
  $('df-cnt').textContent = `${fmtInt(Math.min(trees, goal))} / ${goal}`;
  $('df-pct').textContent = Math.round(dfPct) + ' %';
  $('df-bar').style.width = dfPct.toFixed(1) + '%';
  $('df-dot').style.left = dfPct.toFixed(1) + '%';
  $('me-km').textContent = state.meKm.toLocaleString('fr-FR',{maximumFractionDigits:1});
  const given = missions.reduce((s,m)=>s+m.my,0);
  $('me-given').textContent = fmtInt(given);
  $('me-bal').textContent = fmtInt(state.energyBal);
}

/* ================= MISSIONS ================= */
function renderMissions(){
  $('bal-big').textContent = fmtInt(state.energyBal);
  $('missions-list').innerHTML = missions.map(m=>{
    const pct = Math.min(100, m.got/m.goal*100);
    return `
    <div class="mcard" data-m="${m.id}">
      <div class="m-top">
        <span class="m-ic">${MICON[m.icon]}</span>
        <div class="m-head"><div class="m-name">${esc(m.name)}</div><div class="m-org">avec ${esc(m.org)}</div></div>
        ${m.my>0?`<span class="m-mine num">Vous : ${fmtE(m.my)} ⚡</span>`:''}
      </div>
      <div class="m-per num">${MICON.bolt} ${fmtInt(m.per)} ⚡ = 1 ${esc(m.unit)}</div>
      <div class="meter"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="meter-cap num"><span>${fmtE(m.got)} / ${fmtE(m.goal)} ⚡</span><span>${Math.round(pct)} %</span></div>
      <button class="m-give" data-give="${m.id}">${MICON.bolt} Donner de l’énergie</button>
      <div class="m-panel" hidden>
        <input type="range" min="0" max="${Math.max(0,Math.min(state.energyBal, m.goal-m.got))}" step="1" value="${Math.min(500,state.energyBal)}" aria-label="Quantité d’énergie à donner">
        <div class="m-live num"><span class="amt">500 ⚡</span><span class="eq">= 1 ${esc(m.unit)}</span></div>
        <button class="m-confirm">Confirmer le don</button>
      </div>
    </div>`;
  }).join('');
  $('missions-list').querySelectorAll('.mcard').forEach(card=>{
    const m = missions.find(x=>x.id===card.dataset.m);
    const panel = card.querySelector('.m-panel');
    const range = card.querySelector('input[type=range]');
    const amt = card.querySelector('.m-live .amt');
    const eq = card.querySelector('.m-live .eq');
    const confirm = card.querySelector('.m-confirm');
    const update = ()=>{
      const v = +range.value;
      amt.textContent = `${fmtInt(v)} ⚡`;
      const units = Math.floor(v/m.per);
      eq.textContent = units>0 ? `= ${fmtInt(units)} ${m.unit}${units>1?'s':''}` : `1 ${m.unit} à ${fmtInt(m.per)} ⚡`;
      confirm.disabled = v<=0;
    };
    card.querySelector('.m-give').addEventListener('click',()=>{
      if(state.energyBal<=0){ toast('Plus d’énergie disponible — bougez pour en récolter !'); return; }
      panel.hidden = !panel.hidden; update();
    });
    range.addEventListener('input',update);
    confirm.addEventListener('click',()=>{
      const v = Math.min(+range.value, state.energyBal);
      if(v<=0) return;
      const ok=transact((data,p)=>{
        const total=data.missions[m.id]??missionInitial(m.id);
        if(v>p.energyBal||v>m.goal-total)throw new Error('Le solde a changé. Réessayez avec un montant disponible.');
        p.energyBal-=v;p.given[m.id]=(p.given[m.id]||0)+v;data.missions[m.id]=total+v;
      });
      if(!ok)return;
      const units = Math.floor(v/m.per);
      toast(`⚡ ${fmtInt(v)} donnés à « ${m.name} »${units>0?` — ${fmtInt(units)} ${m.unit}${units>1?'s':''}`:''}`);
    });
  });
}
function renderMySum(){
  const rows = missions.filter(m=>m.my>0).map(m=>`
    <div class="ms-row">
      <span class="m-ic">${MICON[m.icon]}</span>
      <span class="n">${esc(m.name)}<small>${fmtInt(Math.floor(m.my/m.per))} × ${esc(m.unit)}</small></span>
      <span class="amt num">${fmtE(m.my)} ⚡</span>
    </div>`).join('');
  $('mysum').innerHTML = rows || `
    <div class="ms-row"><span class="m-ic">${MICON.bolt}</span><span class="n">Aucune énergie distribuée pour l’instant<small>Rendez-vous dans l’onglet Missions pour donner vos ⚡</small></span></div>`;
}

function renderLeaderboard(){
  const rows=ctx().org.teams.map((team,i)=>({team,km:(['corelis','nova'].includes(ctx().org.id)?[236,224,187,312,141,96][i%6]:0)+Demo.users(ctx().org.id).filter(u=>u.team===team).reduce((n,u)=>{const p=appData.profiles[u.id];return n+(p?(p.earnedMeters??(p.history||[]).reduce((s,h)=>s+h.dist,0))/1000:0);},0),me:team===ctx().user.team})).sort((a,b)=>b.km-a.km);
  const max = Math.max(1,...rows.map(r=>r.km));
  const own=rows.find(r=>r.me)||rows[0]||{team:ctx().user.team,km:0};
  const other=rows.find(r=>r.team!==own.team)||{team:'Une autre équipe',km:0};
  const distance=v=>v.toLocaleString('fr-FR',{maximumFractionDigits:1});
  document.querySelector('.d4-a .d4-t').textContent=own.team;
  document.querySelector('.d4-a .d4-s').textContent=distance(own.km)+' km';
  document.querySelector('.d4-b .d4-t').textContent=other.team;
  document.querySelector('.d4-b .d4-s').textContent=distance(other.km)+' km';
  document.querySelector('.d4-k').textContent='Duel de la semaine · '+(own.km>=other.km?'votre équipe mène':'à vous de jouer !');
  document.querySelector('.duel-title').textContent=own.team+' vs '+other.team;
  document.querySelector('.duel-head .chip').textContent=distance(Math.abs(own.km-other.km))+' km d’écart';
  document.querySelector('.duel-a').textContent=own.team+' · '+distance(own.km);
  document.querySelector('.duel-a').style.flexBasis=(own.km+other.km?own.km/(own.km+other.km)*100:50)+'%';
  document.querySelector('.duel-b').textContent=distance(other.km)+' · '+other.team;
  document.querySelector('.duel-track').setAttribute('aria-label',own.team+' '+distance(own.km)+' kilomètres contre '+other.team+' '+distance(other.km)+' kilomètres');
  const nextMonth=new Date(Demo.now());nextMonth.setMonth(nextMonth.getMonth()+1,1);
  const monthName=nextMonth.toLocaleDateString('fr-FR',{month:'long'});
  const note='L’équipe gagnante choisit l’association du mois '+(/^[ao]/.test(monthName)?'d’':'de ')+monthName+'.';
  document.querySelector('.d4-foot').textContent=note;document.querySelector('.duel-note').textContent=note;

  $('leaderboard').innerHTML = rows.map((r,i)=>`
    <div class="lb-row ${r.me?'me':''}">
      <div class="lb-rank num">${i+1}</div>
      <span class="avatar" style="width:34px;height:34px;font-size:12px;background:${TEAM_COLORS[r.team]||'#555'}">${initials(r.team)}</span>
      <div class="lb-body">
        <div class="lb-top"><span class="lb-name">${esc(r.team)}${r.me?' — votre équipe':''}</span><span class="lb-val num">${r.km.toLocaleString("fr-FR",{maximumFractionDigits:1})} km</span></div>
        <div class="lb-bar"><i style="width:${(r.km/max*100).toFixed(0)}%"></i></div>
      </div>
    </div>`).join('');
}

function renderWeek(){
  document.querySelector('.wk-sub').textContent='Total : '+fmtInt(WEEK.reduce((n,d)=>n+d.steps,0))+' pas · objectif 70 000';
  const max = Math.max(...WEEK.map(d=>d.steps), 1);
  $('wk-chart').innerHTML = WEEK.map((d,i)=>`
    <button class="wk-col ${d.today?'today':''}" data-i="${i}" aria-pressed="false" aria-label="${["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"][i]} : ${d.steps.toLocaleString('fr-FR')} pas">
      <span class="bar" style="height:${Math.max(4, d.steps/max*100)}%"></span>
      <span class="d">${d.d}</span>
    </button>`).join('');
  $('wk-chart').querySelectorAll('.wk-col').forEach(col=>{
    col.addEventListener('click',()=>{
      $('wk-chart').querySelectorAll('.wk-col').forEach(c=>c.setAttribute('aria-pressed','false'));
      col.setAttribute('aria-pressed','true');
      const d = WEEK[+col.dataset.i];
      $('wk-tip').textContent = d.today && d.steps===0
        ? 'Aujourd’hui : rien pour l’instant — lancez une course avec le bouton +'
        : `${d.steps.toLocaleString('fr-FR')} pas ≈ ⚡ ${fmtInt(d.steps/RATE.stepsPerMeter)} d’énergie`;
    });
  });
}

/* ================= NAVIGATION ================= */
let currentScreen = 'scr-home';
document.querySelectorAll('.navbtn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const target = btn.dataset.nav;
    if(target===currentScreen) return;
    closeFan();
    document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active', s.id===target));
    document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b===btn));
    currentScreen = target; syncVisibility();
  });
});

/* ================= FAB / FAN MENU ================= */
const fab = $('fab'), fan = $('fanmenu'), scrim = $('scrim');
function openFan(){ fab.setAttribute('aria-expanded','true'); fan.classList.add('open'); scrim.classList.add('open'); }
function closeFan(){ fab.setAttribute('aria-expanded','false'); fan.classList.remove('open'); scrim.classList.remove('open'); }
fab.addEventListener('click',()=> fab.getAttribute('aria-expanded')==='true' ? closeFan() : openFan());
scrim.addEventListener('click',()=>{ closeFan(); closeSheets(); });
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  const modal=[...document.querySelectorAll('.overlay.open,.sheet.open')].at(-1);
  if(e.key==='Escape'){if(modal?.id==='run-overlay'){$('btn-pause').click();toast('Course mise en pause. Terminez-la pour enregistrer.');}else if(modal?.classList.contains('sheet')){closeSheets();fab.focus();}else closeFan();}
  if(e.key==='Tab'&&modal){const focusable=[...modal.querySelectorAll('button:not([disabled]),input,select,textarea')].filter(el=>el.offsetParent!==null);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
});

fan.querySelectorAll('.fan-item').forEach(item=>{
  item.addEventListener('click',()=>{
    closeFan();
    const act = item.dataset.fan;
    if(act==='run') startRun();
    if(act==='result'){ $('sheet-result').classList.add('open'); scrim.classList.add('open'); }
    if(act==='challenge'){ $('sheet-challenge').classList.add('open'); scrim.classList.add('open'); }
  });
});
function hidePanel(panel){
  // Remove focus before the exit transform can carry the focused control outside
  // the phone. Hidden-overflow ancestors can otherwise be scrolled by the browser.
  if(panel.contains(document.activeElement))document.activeElement.blur();
  panel.inert=true;panel.setAttribute('aria-hidden','true');panel.classList.remove('open');
}
function closeSheets(){ document.querySelectorAll('.sheet').forEach(hidePanel); scrim.classList.remove('open'); }

/* ================= TOAST ================= */
let toastTimer;
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ================= COURSE EN DIRECT ================= */
const run = {active:false, paused:false, dist:0, t:0, raf:null, last:0, marks:0, pathLen:0};
const runPath = $('run-path'), runDot = $('run-dot');

function startRun(){
  if(!ctx())return;run.recorded=false;
  run.active = true; run.paused = false; run.dist = 0; run.t = 0; run.marks = 0; run.last = 0;
  run.pathLen = runPath.getTotalLength();
  runPath.style.strokeDasharray = run.pathLen;
  runPath.style.strokeDashoffset = run.pathLen;
  $('btn-pause').textContent = 'Pause';
  $('run-overlay').classList.add('open');
  updateRunUI();
  cancelAnimationFrame(run.raf);
  run.raf = requestAnimationFrame(tick);
}
function tick(ts){
  if(!run.active) return;
  if(!run.last) run.last = ts;
  const dt = Math.min((ts - run.last)/1000, .1);
  run.last = ts;
  if(!run.paused){
    run.t += dt;
    run.dist += SIM_SPEED * dt;
    const marks = Math.floor(run.dist / 500);
    if(marks > run.marks){ run.marks = marks; milestone(`+500 ⚡ — ${fmtInt(marks*500)} récoltés`); }
    updateRunUI();
  }
  run.raf = requestAnimationFrame(tick);
}
function updateRunUI(){
  const m = Math.floor(run.t*18/60), s = Math.floor(run.t*18%60), d = Math.floor((run.t%1)*10);
  $('run-time').innerHTML = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}<small>,${d}</small>`;
  $('run-dist').textContent = fmtInt(run.dist);
  $('run-steps').textContent = fmtInt(run.dist * RATE.stepsPerMeter);
  const paceSec = run.dist > 30 ? (run.t*18 / (run.dist/1000)) : 0;
  $('run-pace').textContent = paceSec ? `${Math.floor(paceSec/60)}:${String(Math.floor(paceSec%60)).padStart(2,'0')}` : '–:––';
  $('run-impact-txt').innerHTML =
    `<b class="num">⚡ ${fmtInt(run.dist*RATE.energyPerMeter)}</b> énergie récoltée — à distribuer sur vos missions après la course`;
  const prog = Math.min(run.dist/5000, 1);
  runPath.style.strokeDashoffset = run.pathLen * (1-prog);
  const pt = runPath.getPointAtLength(run.pathLen * prog);
  runDot.setAttribute('cx', pt.x); runDot.setAttribute('cy', pt.y);
}
let msTimer;
function milestone(txt){
  $('milestone-txt').textContent = txt;
  $('milestone').classList.add('show');
  clearTimeout(msTimer); msTimer = setTimeout(()=>$('milestone').classList.remove('show'), 2200);
}
$('btn-pause').addEventListener('click',()=>{
  run.paused = !run.paused;
  $('btn-pause').textContent = run.paused ? 'Reprendre' : 'Pause';
});
$('btn-finish').addEventListener('click',()=>{
  run.active = false;
  cancelAnimationFrame(run.raf);
  const m = Math.floor(run.t*18/60), s = Math.floor(run.t*18%60);
  $('sum-dist').textContent = run.dist>=1000 ? (run.dist/1000).toLocaleString('fr-FR',{maximumFractionDigits:2})+' km' : fmtInt(run.dist)+' m';
  $('sum-time').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  $('sum-pace').textContent = $('run-pace').textContent;
  $('sum-impact-line').textContent = `+${fmtInt(run.dist*RATE.energyPerMeter)} ⚡ récoltés`;
  $('sum-title').value = new Date().getHours() < 12 ? 'Course du matin' : (new Date().getHours() < 18 ? 'Course du midi' : 'Course du soir');
  hidePanel($('run-overlay'));
  $('sum-overlay').classList.add('open');
});

/* ================= PUBLICATION ================= */
function recordActivity({dist,title,time,pace,publish=true,type='Course'}){
  const c=ctx();const meters=Math.round(dist);if(!c||!Number.isFinite(meters)||meters<1||meters>500000){toast('Choisissez une distance entre 1 m et 500 km.');return false;}
  const activityId=crypto.randomUUID(),postId=publish?'u'+crypto.randomUUID():null;
  const saved=transact((data,p)=>{
    p.energyBal+=meters;data.corpEnergy+=meters;p.meKm+=meters/1000;
    if(type!=='Vélo')p.todaySteps+=Math.round(meters*RATE.stepsPerMeter);
    p.earnedMeters=(p.earnedMeters??(p.history||[]).reduce((n,h)=>n+h.dist,0))+meters;
    p.history ||= [];p.history.unshift({id:activityId,dist:meters,title,type,at:Demo.now(),published:publish});
    p.history=p.history.slice(0,40);
    if(publish)data.posts.unshift({id:postId,userId:c.user.id,n:c.user.name,team:c.user.team,title,dist:meters,time,pace,type,createdAt:Demo.now(),bravos:0,comments:0,route:'M40 150 C 110 120, 90 70, 170 80 S 260 120, 310 70 S 370 40, 375 35'});
    data.posts=data.posts.slice(0,100);
  });
  return saved?{activityId,postId,energy:meters,published:publish}:false;
}
function finishActivity(publish){
  if(run.recorded)return;
  const duration=run.t*18;
  const result=recordActivity({dist:run.dist,title:$('sum-title').value.trim().slice(0,160)||'Ma course',time:`${String(Math.floor(duration/60)).padStart(2,'0')}:${String(Math.floor(duration%60)).padStart(2,'0')}`,pace:$('sum-pace').textContent,publish});
  if(!result)return;run.recorded=true;hidePanel($('sum-overlay'));
  if(publish){revealPost(result.postId);confetti();toast('Votre course est publiée dans le fil · +'+fmtInt(result.energy)+' ⚡ crédités.');}
  else{goHome();toast('Course privée enregistrée · +'+fmtInt(result.energy)+' ⚡ crédités.');}
}
$('btn-publish').addEventListener('click',()=>finishActivity(true));
$('btn-discard').addEventListener('click',()=>finishActivity(false));
$('btn-res-publish').addEventListener('click',()=>{
  const km=Number($('res-dist').value);
  if(!Number.isFinite(km)||km<0.001||km>500){toast('Indiquez une distance entre 0,001 et 500 km.');return;}
  const result=recordActivity({dist:km*1000,title:$('res-title').value.trim().slice(0,160)||$('res-type').value,time:'—',pace:'—',type:$('res-type').value});
  if(result){closeSheets();revealPost(result.postId);toast('Votre activité est publiée dans le fil · +'+fmtInt(result.energy)+' ⚡ crédités.');}
});
$('btn-ch-send').addEventListener('click',()=>{
  if(!$('ch-target').value){toast('Ajoutez une autre équipe dans le portail pour créer un duel.');return;}
  if(transact(data=>{data.challenges.unshift({id:crypto.randomUUID(),team:ctx().user.team,target:$('ch-target').value,goal:$('ch-goal').value,createdAt:Demo.now(),status:'pending'});})){closeSheets();toast('Défi créé · retrouvez-le dans l’onglet Défis.');document.querySelector('[data-nav="scr-challenges"]').click();}
});

function goHome(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active', s.id==='scr-home'));
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.nav==='scr-home'));
  currentScreen = 'scr-home'; syncVisibility();
  const scr = $('scr-home'); scr.scrollTop = 0;
}

function clearPostHighlight(){
  cancelAnimationFrame(revealFrame);clearTimeout(highlightTimer);postHighlight=null;
  $('feed')?.querySelectorAll('.is-new-post').forEach(post=>post.classList.remove('is-new-post'));
}
function revealPost(postId){
  const active=ctx();
  if(!active||!appData?.posts.some(post=>post.id===postId))return false;
  clearPostHighlight();
  postHighlight={id:postId,orgId:active.org.id,userId:active.user.id,until:Date.now()+6000};
  goHome();
  revealFrame=requestAnimationFrame(()=>{
    const current=ctx();
    if(!current||current.org.id!==active.org.id||current.user.id!==active.user.id)return;
    const screen=$('scr-home');
    const post=[...$('feed').querySelectorAll('[data-post]')].find(card=>card.dataset.post===postId);
    if(!post)return;
    post.classList.add('is-new-post');post.setAttribute('tabindex','-1');
    const top=Math.max(0,screen.scrollTop+post.getBoundingClientRect().top-screen.getBoundingClientRect().top-12);
    screen.scrollTo({top,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    post.focus({preventScroll:true});
    highlightTimer=setTimeout(()=>{
      if(postHighlight?.id===postId&&postHighlight.orgId===active.org.id)clearPostHighlight();
    },6000);
  });
  return true;
}

/* ================= BRAVOS ================= */
$('feed').addEventListener('click',e=>{
  const article=e.target.closest('[data-post]');if(!article)return;const id=article.dataset.post;
  if(e.target.closest('.bravo'))transact(data=>{data.likes ||= {};const list=data.likes[id]||[];data.likes[id]=list.includes(ctx().user.id)?list.filter(x=>x!==ctx().user.id):[...list,ctx().user.id];});
  if(e.target.closest('[data-action="comment"]'))openComments(id);
  if(e.target.closest('[data-action="share"]')){
    const text=article.querySelector('.ptitle').textContent+' · Moov’On';
    navigator.clipboard?.writeText(text).then(()=>toast('Texte de l’activité copié.')).catch(()=>toast('Copie indisponible sur ce navigateur.'));
  }
});
function publishComment(postId,rawText){
  const current=ctx(),text=String(rawText||'').trim();
  if(!current){toast('Connectez-vous pour publier un commentaire.');return false;}
  if(!text||text.length>400){toast('Écrivez un commentaire de 1 à 400 caractères.');return false;}
  const comment={id:crypto.randomUUID(),userId:current.user.id,name:current.user.name,text,createdAt:Demo.now()};
  const saved=transact(data=>{
    const seeded=['corelis','nova'].includes(current.org.id)&&BASE_FEED.some(post=>current.org.id+'-'+post.id===postId);
    if(!seeded&&!data.posts.some(post=>post.id===postId))throw new Error('Cette publication n’est plus disponible dans votre entreprise.');
    data.comments ||= {};data.comments[postId]||=[];data.comments[postId].push(comment);
  });
  return saved?comment:false;
}
function openComments(id){
  let dialog=$('comments-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='comments-dialog';dialog.className='app-dialog';document.body.append(dialog);}
  const draw=(publishedId=null)=>{
    dialog.innerHTML=`<div class="dialog-top"><h2>Encouragements</h2><button type="button" data-close aria-label="Fermer">×</button></div><div class="comment-list">${(appData.comments?.[id]||[]).map(c=>`<article${c.id===publishedId?' class="is-new-comment" tabindex="-1"':''}><b>${esc(c.name)}</b><p>${esc(c.text)}</p></article>`).join('')||'<p class="empty-note">Soyez le premier à encourager votre collègue.</p>'}</div><p class="form-feedback" role="status">${publishedId?'Votre commentaire a été publié.':''}</p><form><label for="comment-text">Votre message</label><textarea id="comment-text" maxlength="400" required placeholder="Bravo pour cette sortie !"></textarea><button class="shell-primary">Publier le commentaire</button></form>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const comment=publishComment(id,dialog.querySelector('textarea').value);if(comment)draw(comment.id);else dialog.querySelector('.form-feedback').textContent='Commentaire non publié. Vérifiez votre message et l’espace de stockage disponible, puis réessayez.';};
    if(publishedId){const list=dialog.querySelector('.comment-list');list.scrollTop=list.scrollHeight;dialog.querySelector('.is-new-comment')?.focus({preventScroll:true});}
  };draw();dialog.showModal();
}

/* ================= CONFETTI (léger) ================= */
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('confetti'), ctx = cv.getContext('2d');
  const r = cv.getBoundingClientRect(); cv.width = r.width; cv.height = r.height;
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#0F3FA8';
  const colors = [brand, '#0A0A0A', '#8A8A8A', brand];
  const parts = Array.from({length:70},()=>({
    x: cv.width/2 + (Math.random()-.5)*80, y: cv.height*.55,
    vx:(Math.random()-.5)*7, vy:-(4+Math.random()*7),
    s:4+Math.random()*4, c:colors[Math.floor(Math.random()*colors.length)], a:1, rot:Math.random()*Math.PI
  }));
  let frames = 0;
  (function anim(){
    ctx.clearRect(0,0,cv.width,cv.height);
    parts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=.22; p.a-=.011; p.rot+=.1;
      if(p.a<=0) return;
      ctx.save(); ctx.globalAlpha=Math.max(p.a,0); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore();
    });
    if(++frames<130) requestAnimationFrame(anim);
    else ctx.clearRect(0,0,cv.width,cv.height);
  })();
}

/* ================= SÉLECTEUR DE TYPO (outil maquette) ================= */
const TYPOS = {
  act:{label:'Actuelle', sub:'Anton · Barlow Condensed · Archivo', disp:'"Anton"', hero:'"Archivo"', num:'"Barlow Condensed"', body:'"Archivo"', wDisp:400, wHero:900, wNum:700, sBig:'96px', sName:'33px', it:false},
  A:{label:'A — Le stadier', sub:'Oswald · Source Sans', disp:'"Oswald"', hero:'"Oswald"', num:'"Oswald"', body:'"Source Sans 3"', wDisp:700, wHero:700, wNum:600, sBig:'82px', sName:'30px', it:false},
  C:{label:'C — Le contemporain', sub:'Bricolage Grotesque · Figtree', disp:'"Bricolage Grotesque"', hero:'"Bricolage Grotesque"', num:'"Bricolage Grotesque"', body:'"Figtree"', wDisp:800, wHero:800, wNum:800, sBig:'72px', sName:'29px', it:false},
  D:{label:'D — Le duo contrasté', sub:'Unbounded · Big Shoulders', disp:'"Unbounded"', hero:'"Unbounded"', num:'"Big Shoulders"', body:'"Archivo"', wDisp:700, wHero:700, wNum:700, sBig:'88px', sName:'23px', it:false},
  F:{label:'F — Le motorsport', sub:'Saira · Saira Extra Condensed', disp:'"Saira"', hero:'"Saira"', num:'"Saira Extra Condensed"', body:'"Saira"', wDisp:800, wHero:800, wNum:700, sBig:'100px', sName:'30px', it:false},
  G:{label:'G — Le chronométreur', sub:'Archivo Black · IBM Plex Mono', disp:'"Archivo"', hero:'"Archivo"', num:'"IBM Plex Mono"', body:'"IBM Plex Sans"', wDisp:900, wHero:900, wNum:600, sBig:'58px', sName:'31px', it:false},
  I:{label:'I — Le stencil', sub:'Saira Stencil One · Saira Condensed', disp:'"Saira Stencil One"', hero:'"Saira Stencil One"', num:'"Saira Condensed"', body:'"Saira"', wDisp:400, wHero:400, wNum:700, sBig:'82px', sName:'27px', it:false},
  J:{label:'J — La vitesse', sub:'Exo 2, tout en italique', disp:'"Exo 2"', hero:'"Exo 2"', num:'"Exo 2"', body:'"Exo 2"', wDisp:900, wHero:900, wNum:800, sBig:'68px', sName:'29px', it:true},
};
function applyTypo(key){
  const t = TYPOS[key] || TYPOS.act;
  const r = document.documentElement.style;
  r.setProperty('--f-disp', t.disp); r.setProperty('--f-hero', t.hero);
  r.setProperty('--f-num', t.num);  r.setProperty('--f-body', t.body);
  r.setProperty('--w-disp', t.wDisp); r.setProperty('--w-hero', t.wHero); r.setProperty('--w-num', t.wNum);
  r.setProperty('--s-big', t.sBig); r.setProperty('--s-name', t.sName);
  r.setProperty('--fs-disp', t.it ? 'italic' : 'normal');
  r.setProperty('--fs-num', t.it ? 'italic' : 'normal');
  store.set('typo', key);
  document.querySelectorAll('.typo-row').forEach(row=>row.setAttribute('aria-pressed', row.dataset.typo===key));
}
function renderTypoRows(){
  $('typo-rows').innerHTML = Object.entries(TYPOS).map(([k,t])=>`
    <button class="typo-row" data-typo="${k}" aria-pressed="false">
      <span class="tr-name">${t.label}<small>${t.sub}</small></span>
      <span class="tr-sample num" style="font-family:${t.num.replace(/"/g,'&quot;')};font-weight:${t.wNum};${t.it?'font-style:italic;':''}">4 320 <span style="font-family:${t.disp.replace(/"/g,'&quot;')};font-weight:${t.wDisp}">Aa</span></span>
    </button>`).join('');
  $('typo-rows').querySelectorAll('.typo-row').forEach(row=>{
    row.addEventListener('click',()=>applyTypo(row.dataset.typo));
  });
}
$('typo-btn').addEventListener('click',()=>{ closeFan(); $('sheet-typo').classList.add('open'); scrim.classList.add('open'); });

/* ================= RACCOURCIS ACCUEIL ================= */
const goMissions = ()=>document.querySelector('.navbtn[data-nav="scr-missions"]').click();
$('go-missions').addEventListener('click', goMissions);
$('go-impact').addEventListener('click', goMissions);
$('go-challenges').addEventListener('click', ()=>document.querySelector('.navbtn[data-nav="scr-challenges"]').click());
$('go-duel').addEventListener('click', ()=>document.querySelector('.navbtn[data-nav="scr-challenges"]').click());

function syncVisibility(){
  const open=[...document.querySelectorAll('.overlay.open,.sheet.open')].at(-1);
  document.querySelectorAll('.screen').forEach(el=>{el.inert=!el.classList.contains('active')||!!open;el.setAttribute('aria-hidden',String(el.inert));});
  document.querySelectorAll('.overlay,.sheet').forEach(el=>{el.inert=!el.classList.contains('open');el.setAttribute('aria-hidden',String(el.inert));});
  document.querySelectorAll('.navbtn').forEach(el=>el.setAttribute('aria-current',el.classList.contains('active')?'page':'false'));
  fan.inert=!fan.classList.contains('open');
  document.querySelectorAll('#device nav,#tenant-strip,#typo-btn,#demo-rail').forEach(el=>el.inert=!!open);
  if(open&&document.activeElement&&!open.contains(document.activeElement))open.querySelector('input,button,select')?.focus({preventScroll:true});
}
new MutationObserver(syncVisibility).observe($('device'),{attributes:true,subtree:true,attributeFilter:['class']});
function renderChallenges(){
  let box=$('custom-challenges');if(!box){box=document.createElement('div');box.id='custom-challenges';document.querySelector('#scr-challenges .pagehead').after(box);}
  box.innerHTML=appData.challenges.map(c=>`<article class="created-challenge"><span class="chip">${c.status==='pending'?'À relever':c.status==='active'?'En cours':'Terminé'}</span><h3>${esc(c.team)} × ${esc(c.target)}</h3><p>${esc(c.goal)}</p><button data-challenge="${c.id}" class="btn ghost">${c.status==='pending'?'Relever le défi':c.status==='active'?'Terminer le défi':'Défi relevé ✓'}</button></article>`).join('');
  box.querySelectorAll('[data-challenge]').forEach(b=>{const ch=appData.challenges.find(c=>c.id===b.dataset.challenge);b.disabled=ch.status==='done';b.onclick=()=>transact(data=>{const c=data.challenges.find(c=>c.id===b.dataset.challenge);c.status=c.status==='pending'?'active':'done';});});
  const trees=missionTrees(),pct=Math.min(100,trees/500*100),hero=document.querySelector('.hero-challenge');
  hero.querySelector('h2').textContent='La forêt '+ctx().org.shortName+' — 500 arbres';
  hero.querySelector('.meter i').style.width=pct+'%';hero.querySelector('.meter-cap').innerHTML=`<span>${fmtInt(trees)} / 500 arbres</span><span>${Math.round(pct)} %</span>`;
  const date=new Date(Demo.now()),last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  hero.querySelector('.hc-sub').textContent='Toute l’entreprise · '+date.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  hero.querySelector('.hc-days .v').textContent=last-date.getDate();
  document.querySelector('.defi3 p').textContent='Défi du mois · '+(last-date.getDate())+' jours restants';
  document.querySelector('#scr-challenges .pagehead .sub').textContent=(3+appData.challenges.length)+' défis · '+ctx().org.name;
}
function renderAll(){if(!ctx()||!appData)return;renderFeed();renderMissions();renderMySum();renderCorp();renderToday();renderLeaderboard();renderWeek();renderChallenges();renderHistory();}
function renderHistory(){
  let box=$('private-history');if(!box){box=document.createElement('div');box.id='private-history';document.querySelector('.prof-stats').after(box);}
  const history=appData.profiles[ctx().user.id].history||[];
  box.innerHTML=history.length?`<div class="section-label">Vos dernières activités</div>`+history.slice(0,3).map(h=>`<div class="history-row"><span><b>${esc(h.title)}</b><small>${h.published?'Publiée dans le fil':'Activité privée'} · ${esc(h.type)}</small></span><strong>${(h.dist/1000).toLocaleString('fr-FR')} km</strong></div>`).join(''):'';
}
function init(){
  if(!ctx())return;hydrate();
  $('hello-name').textContent='Bonjour '+ctx().user.name.split(' ')[0];
  document.querySelector('.prof-name').textContent=ctx().user.name;
  document.querySelector('.prof-head .avatar').textContent=initials(ctx().user.name);
  document.querySelector('.prof-sub .chip').textContent=ctx().user.team;
  document.querySelector('.c3-name').textContent=ctx().org.name+' · '+ctx().org.program;
  document.querySelector('#ch-target').innerHTML=ctx().org.teams.filter(t=>t!==ctx().user.team).map(t=>`<option>${esc(t)}</option>`).join('');
  $('res-dist').min='0.001';$('res-dist').step='0.001';
  document.querySelector('#sum-overlay h2')?.replaceChildren(document.createTextNode('Belle sortie, '+ctx().user.name.split(' ')[0]));
  renderAll();renderTypoRows();applyTypo(store.get('typo','act'));syncVisibility();
}
window.MoovApp={init,render:renderAll,toast,goHome,revealPost,stop(){run.active=false;cancelAnimationFrame(run.raf);clearPostHighlight();document.querySelectorAll('.overlay,.sheet').forEach(hidePanel);closeFan();},fastForward(){if(run.active&&!run.paused){run.dist+=1000;run.t+=1000/SIM_SPEED;updateRunUI();}}};
window.addEventListener('storage',e=>{if(ctx()&&e.key===appKey()){hydrate();renderAll();}});
syncVisibility();



})();
