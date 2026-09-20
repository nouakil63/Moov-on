/* Employee presentation: shared local Platform ledger, simulated movement. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), P=()=>window.Platform, current=()=>window.Demo?.current();
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=value=>Math.round(Number(value)||0).toLocaleString('fr-FR');
  const decimal=value=>(Number(value)||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
  const euro=cents=>((Number(cents)||0)/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  const date=(value,options={})=>new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short',timeZone:'UTC',...options});
  const dateKey=value=>new Date(value).toISOString().slice(0,10);
  const localDateKey=value=>{const d=new Date(value);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const eventDate=value=>new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
  const eventTime=value=>new Date(value).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const time=value=>new Date(value).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
  const clock=seconds=>{const s=Math.max(0,Math.floor(seconds||0));return (s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
  const flame=()=>window.Energy?.icon||'';
  const initials=name=>String(name||'?').split(/\s+/).slice(0,2).map(v=>v[0]).join('');
  const ROUTE='M35 150 C70 135 85 55 145 75 C205 95 220 155 275 110 C320 75 345 55 370 35';
  let activeScreen='scr-home',weekOffset=0,eventFilter='all',toastTimer,dialog=null,dialogRestore=null,identity='',renderQueued=false;
  const popupSeen=new Set();
  let popupTimer=0,dialogRefresh=null,run={active:false,paused:false,id:null,recorded:null,raf:0};
  function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4500);}
  function report(error){toast(error?.message||'Cette action n’a pas pu être enregistrée.');}
  function routeHTML(route,hidden=false){
    if(hidden)return '<div class="route-message">Trajet masqué · vos statistiques restent visibles</div>';
    if(!route||route.length>1000||!/^\s*[Mm][MLCQSHVTAZmlcqshvtaz0-9.,\s+\-]+$/.test(route))return '<div class="route-message">Aucun trajet partagé</div>';
    return `<div class="activity-route"><svg viewBox="0 0 400 160" role="img" aria-label="Illustration de trajet simulé"><rect width="400" height="160" fill="var(--sunken)"/><path d="M0 50L400 40M0 130L400 145M100 0L120 180M290 0L270 180" fill="none" stroke="var(--line)" stroke-width="10"/><path d="${esc(route)}" fill="none" stroke="var(--brand)" stroke-width="5" stroke-linecap="round"/></svg><span>Trajet simulé</span></div>`;
  }
  function paintFlames(root=document){root.querySelectorAll('[data-flame]').forEach(el=>{el.innerHTML=flame();});}
  function privacyKey(){const c=current();return 'moovon:privacy:'+c.org.id+':'+c.user.id;}
  function privacyDefault(){try{return localStorage.getItem(privacyKey())!=='show';}catch{return true;}}
  function savePrivacy(hidden){try{localStorage.setItem(privacyKey(),hidden?'hide':'show');}catch{toast('Préférence appliquée pour cette session uniquement.');}}
  function showScreen(id){
    closeFan();if(!$(id))return;activeScreen=id;
    document.querySelectorAll('.screen').forEach(s=>{const selected=s.id===id;s.classList.toggle('active',selected);s.inert=!selected;s.setAttribute('aria-hidden',String(!selected));});
    document.querySelectorAll('.navbtn').forEach(b=>{b.classList.toggle('active',b.dataset.nav===id);b.setAttribute('aria-current',b.dataset.nav===id?'page':'false');});
    if(current()&&id==='scr-profile')renderProfile();if(current()&&id==='scr-challenges'){renderChallenges();renderEvents();}
  }
  function goHome(){showScreen('scr-home');}
  function revealActivity(id){goHome();requestAnimationFrame(()=>{const card=[...$('feed').querySelectorAll('[data-activity]')].find(el=>el.dataset.activity===id);if(!card)return;card.tabIndex=-1;card.classList.add('activity-just-published','is-new-post');card.focus({preventScroll:true});const pane=$('scr-home');pane.scrollTo({top:Math.max(0,pane.scrollTop+card.getBoundingClientRect().top-pane.getBoundingClientRect().top-16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
  function closeFan(){$('fab').setAttribute('aria-expanded','false');$('fanmenu').classList.remove('open');$('fanmenu').inert=true;$('scrim').classList.remove('open');}
  function toggleFan(){const opening=!$('fanmenu').classList.contains('open');closeFan();if(opening){$('fanmenu').classList.add('open');$('fanmenu').inert=false;$('scrim').classList.add('open');$('fab').setAttribute('aria-expanded','true');}}
  function fitDialog(){
    if(!dialog?.open)return;const r=$('phone-screen-zone').getBoundingClientRect(),v=window.visualViewport;
    const left=Math.max(r.left,v?.offsetLeft||0),top=Math.max(r.top,v?.offsetTop||0),right=Math.min(r.right,(v?.offsetLeft||0)+(v?.width||innerWidth)),bottom=Math.min(r.bottom,(v?.offsetTop||0)+(v?.height||innerHeight));
    Object.assign(dialog.style,{left:left+'px',top:top+'px',width:Math.max(1,right-left)+'px',height:Math.max(1,bottom-top)+'px'});
  }
  function openDialog(title,body){
    closeFan();if(!dialog){dialog=document.createElement('dialog');dialog.id='employee-dialog';dialog.className='employee-dialog';$('phone-screen-zone').append(dialog);dialog.addEventListener('close',()=>{dialogRefresh=null;if(dialogRestore?.isConnected&&!dialogRestore.closest('[inert]'))dialogRestore.focus({preventScroll:true});});}
    dialogRefresh=null;if(!dialog.open)dialogRestore=document.activeElement;
    dialog.innerHTML=`<div class="employee-dialog-layout"><header><div><span class="minor-label">MOOV’ON · VOTRE COLLECTIF</span><h2 id="employee-dialog-title">${esc(title)}</h2></div><button class="round-close" data-close aria-label="Fermer">×</button></header><div class="employee-dialog-body">${body}<p class="form-error" id="employee-dialog-error" role="alert" hidden></p></div></div>`;
    dialog.setAttribute('aria-labelledby','employee-dialog-title');dialog.querySelector('[data-close]').onclick=()=>dialog.close();if(!dialog.open)dialog.showModal();fitDialog();dialog.querySelector('input,select,textarea,button')?.focus({preventScroll:true});return dialog;
  }
  function dialogError(e){const el=$('employee-dialog-error');if(el){el.hidden=false;el.textContent=e?.message||String(e);el.scrollIntoView({block:'nearest'});}else report(e);}
  function overlay(id,show){const el=$(id);el.classList.toggle('open',show);el.inert=!show;el.setAttribute('aria-hidden',String(!show));const any=document.querySelector('.overlay.open');document.querySelectorAll('.screens,.navwrap,#tenant-strip').forEach(n=>n.inert=!!any);if(show&&!document.querySelector('dialog[open]'))el.querySelector('input,button')?.focus({preventScroll:true});}
  function activeStats(){const campaign=P().activeCampaign();return campaign?P().campaignStats(campaign.id):null;}
  const icon=(paths,size=17)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const peopleIcon=()=>icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>');
  const arrowIcon=()=>icon('<path d="m9 6 6 6-6 6"/>');
  const trophyIcon=()=>icon('<path d="M8 21h8M12 17v4M17 4H7v5a5 5 0 0 0 10 0V4Z"/><path d="M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-3.5 3.8M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 3.5 3.8"/>');
  const challengeLabel=campaign=>({monthly:'Défi du mois',quarterly:'Défi du trimestre',yearly:'Défi de l’année'}[campaign?.period]||'Défi collectif');
  function duelTeams(stats){
    const own=stats.teams.find(t=>t.me)||{team:current().user.team,distanceMeters:0};
    const other=stats.teams.find(t=>t.team!==own.team)||null,total=own.distanceMeters+(other?.distanceMeters||0);
    return {own,other,share:total?own.distanceMeters/total*100:50};
  }
  function scrollChallengesTo(id){
    showScreen('scr-challenges');
    requestAnimationFrame(()=>{const pane=$('scr-challenges'),target=$(id);if(!target)return;pane.scrollTo({top:pane.scrollTop+target.getBoundingClientRect().top-pane.getBoundingClientRect().top,behavior:'auto'});});
  }
  function homeCampaign(stats){
    const c=current(),s=stats,percent=s?Math.max(0,Math.min(100,s.progressPct)):0,unit=s?.campaign.unit||s?.mission?.unit||'unités financées';
    const duel=duelTeams(P().challengeStats());
    const corp=`<button class="corp3" data-impact aria-label="Voir l’impact collectif"><div class="c3-top"><span class="c3-name">${esc(c.org.name)} · ${esc(c.org.program)}</span><span class="chev">${arrowIcon()}</span></div><div class="c3-main"><div class="c3-ring" id="corp-ring" style="background:conic-gradient(var(--brand) 0 ${percent}%,var(--sunken) ${percent}% 100%)"><div><span class="v num" id="corp-pct">${Math.round(percent)} %</span><span class="l">de l’objectif</span></div></div><div class="c3-facts"><div class="c3-fact"><span class="ic">${flame()}</span><span class="num"><b>${n(s?.totalEnergy)}</b> d’énergie collective</span></div><div class="c3-fact"><span class="ic">${icon('<path d="M12 22v-7M9 9l3-7 3 7M7 15l5-6 5 6"/>')}</span><span class="num"><b>${n(s?.financedImpact)}</b> ${esc(unit)}</span></div><div class="c3-fact"><span class="ic">${peopleIcon()}</span><span class="num"><b>${n(s?.activeParticipants)}</b> participants actifs</span></div></div></div></button>`;
    const campaign=s?`<button class="defi3" id="go-challenges" data-challenges aria-label="Voir le défi collectif"><div class="d3-row"><span class="d3-em">${flame()}</span><div><h3>${esc(s.campaign.name||s.mission?.name)}</h3><p>${challengeLabel(s.campaign)} · encore ${Math.ceil(s.remainingDays)} jours</p></div></div><div class="d3-bar"><i style="width:${percent}%"></i><span class="d3-dot" style="left:${Math.max(4,Math.min(96,percent))}%">${icon('<path d="m5 12 4 4L19 6"/>',11)}</span></div><div class="d3-cap num"><span>${n(s.financedImpact)} / ${n(s.targetImpact)} ${esc(unit)}</span><span>${Math.round(percent)} %</span></div></button>`:`<button class="defi3" id="go-challenges" data-challenges><div class="d3-row"><span class="d3-em">${flame()}</span><div><h3>Notre prochaine mission arrive</h3><p>Votre entreprise prépare sa campagne.</p></div></div></button>`;
    const {own,other}=duel;
    const meeting=other?`<button class="duel4" id="go-duel" aria-label="Voir le duel de la semaine"><div class="d4-k">Duel de la semaine · ${own.distanceMeters===other.distanceMeters?'les équipes sont à égalité':own.distanceMeters>other.distanceMeters?'votre équipe mène':'à vous de jouer !'}</div><div class="d4-track"><div class="d4-a"><span class="d4-t">${esc(own.team)}</span><span class="d4-s num">${n(own.distanceMeters)} m</span></div><div class="d4-b"><span class="d4-t">${esc(other.team)}</span><span class="d4-s num">${n(other.distanceMeters)} m</span></div><span class="d4-vs">VS</span></div><div class="d4-foot">Chaque mètre fait avancer votre équipe.</div></button>`:'';
    return corp+campaign+meeting;
  }

  function campaignCard(stats){
    if(!stats)return '<div class="mcard empty-card"><strong>Votre prochaine mission arrive.</strong><p>Votre entreprise prépare sa campagne. Vos activités restent enregistrées.</p></div>';
    const s=stats,percent=Math.max(0,Math.min(100,s.progressPct)),unit=s.campaign.unit||s.mission?.unit||'unités financées';
    return `<article class="mcard campaign-card"><div class="m-top"><span class="m-ic">${flame()}</span><div class="m-head"><div class="m-name">${esc(s.campaign.name||s.mission?.name)}</div><div class="m-org">${esc(s.association?.name||'Notre association')}</div></div><span class="m-mine">${Math.ceil(s.remainingDays)} jours</span></div><p class="m-per">${esc(s.mission?.description||'Chaque activité fait progresser notre objectif collectif.')}</p><div class="m-per impact-number"><b>${n(s.financedImpact)} / ${n(s.targetImpact)}</b> ${esc(unit)}</div><div class="meter progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}" aria-label="Progression de la campagne"><i style="width:${percent}%"></i></div><div class="meter-cap progress-caption"><span>${euro(s.raisedCents)} mobilisés</span><strong>${decimal(percent)} %</strong></div><div class="m-panel"><div class="m-live"><span>${peopleIcon()} ${n(s.activeParticipants)} participants actifs</span><span class="eq">${flame()} ${n(s.totalEnergy)}</span></div><p class="micro-note">Budget engagé : ${euro(s.budgetCents)} · restant : ${euro(s.remainingCents)}.<br>Contribution automatique à l’enregistrement, plafonnée au budget. Aucun paiement réel dans cette maquette.</p></div></article>`;
  }
  function streakFor(activities){
    const dates=new Set(activities.map(a=>dateKey(a.at)));let cursor=Demo.now(),streak=0;
    if(!dates.has(dateKey(cursor)))cursor-=86400000;
    while(dates.has(dateKey(cursor))){streak++;cursor-=86400000;}return streak;
  }
  function renderHome(){
    const c=current(),today=dateKey(Demo.now()),own=P().activities().filter(a=>a.userId===c.user.id),day=own.filter(a=>dateKey(a.at)===today),streak=streakFor(own);
    $('greet-date').textContent=date(Demo.now(),{weekday:'long'})+' · '+c.user.team;$('hello-name').textContent='Bonjour '+c.user.name.split(' ')[0];
    $('today-meters').textContent=n(day.reduce((t,a)=>t+a.distanceMeters,0));$('today-energy').textContent=n(day.reduce((t,a)=>t+a.energy,0));$('today-duration').textContent=n(day.reduce((t,a)=>t+(a.durationSeconds||0),0)/60);$('streak-count').textContent=streak+' J';$('today-streak').textContent=streak+' j';
    $('home-campaign').innerHTML=homeCampaign(activeStats());$('home-campaign').querySelectorAll('[data-impact]').forEach(b=>b.onclick=()=>showScreen('scr-missions'));$('go-challenges').onclick=()=>scrollChallengesTo('challenge-hero');$('go-duel')?.addEventListener('click',()=>scrollChallengesTo('challenge-duel'));
    const feed=P().feed();$('feed').innerHTML=feed.length?feed.map(a=>{
      const likes=P().likes(a.id),comments=P().comments(a.id),hidden=a.hideRoute||!a.route;
      return `<article class="post activity-card" data-activity="${esc(a.id)}"><div class="node"><span class="avatar" style="background:var(--brand)">${esc(initials(a.name))}</span></div><div class="when">${date(a.at)} à ${time(a.at)} UTC · ${esc(a.sport)}</div><div class="pname">${esc(a.name||'Collaborateur')} <span>· ${esc(a.team||'')}</span></div><div class="pcard"><div class="pmap ${hidden?'pmap-private':''}">${routeHTML(a.route,a.hideRoute)}<div class="grad"></div><div class="pstats activity-metrics num"><div class="pstat"><div class="v">${n(a.distanceMeters)} m</div><div class="l">distance</div></div><div class="pstat"><div class="v">${a.durationSeconds?clock(a.durationSeconds):'—'}</div><div class="l">durée</div></div><div class="pstat"><div class="v">${a.durationSeconds?decimal(a.speedKmh):'—'}</div><div class="l">vitesse · km/h</div></div></div></div><div class="pbody"><h3 class="ptitle">${esc(a.title)}</h3><span class="pimpact num">${flame()} +${n(a.energy)} énergie récoltée</span></div><div class="post-actions"><button class="pact bravo ${likes.liked?'bravoed':''}" data-like="${esc(a.id)}" aria-pressed="${likes.liked}">${icon('<path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>')}Bravo · <span class="num">${likes.count}</span></button><button class="pact" data-comments="${esc(a.id)}" aria-label="Commentaires">${icon('<path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12Z"/>')}<span class="num">${comments.length}</span></button><button class="pact share" data-share="${esc(a.id)}" aria-label="Partager cette activité">${icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>')}</button></div>${a.userId===c.user.id?`<button class="activity-privacy" data-privacy="${esc(a.id)}" data-hidden="${a.hideRoute}">Trajet ${a.hideRoute?'masqué':'visible'} · modifier</button>`:''}</div></article>`;
    }).join(''):'<div class="mcard empty-card"><strong>Votre collectif prend son élan.</strong><p>Publiez une première activité pour ouvrir le fil.</p><button class="btn impact" data-start>Commencer</button></div>';
    $('feed').querySelectorAll('[data-start]').forEach(b=>b.onclick=openStart);
    $('feed').querySelectorAll('[data-like]').forEach(b=>b.onclick=()=>{try{P().toggleLike(b.dataset.like);}catch(e){report(e);}});
    $('feed').querySelectorAll('[data-comments]').forEach(b=>b.onclick=()=>openComments(b.dataset.comments));
    $('feed').querySelectorAll('[data-privacy]').forEach(b=>b.onclick=()=>editPrivacy(b.dataset.privacy,b.dataset.hidden==='true'));
    $('feed').querySelectorAll('[data-share]').forEach(b=>b.onclick=async()=>{const a=P().feed().find(a=>a.id===b.dataset.share);if(!a)return;try{await navigator.clipboard.writeText(a.title+' · '+n(a.distanceMeters)+' mètres · Moov’On');toast('Résumé de l’activité copié.');}catch{toast('Copie indisponible dans ce navigateur.');}});
  }
  function openComments(id){
    const list=()=>P().comments(id).map(c=>`<div class="comment-entry"><b>${esc(c.name)}</b><p>${esc(c.text)}</p></div>`).join('')||'<p class="muted">Soyez la première personne à encourager cette sortie.</p>';
    openDialog('Les encouragements',`<div id="comments-list">${list()}</div><form id="comment-form"><label for="comment-text">Votre commentaire</label><textarea id="comment-text" maxlength="400" rows="3" required></textarea><button class="btn impact block">Publier le commentaire</button></form>`);
    dialogRefresh=()=>{try{$('comments-list').innerHTML=list();}catch(e){dialog.close();}};
    $('comment-form').onsubmit=e=>{e.preventDefault();try{P().comment(id,$('comment-text').value);$('comment-text').value='';dialogRefresh?.();$('comment-text').focus();}catch(err){dialogError(err);}};
  }
  function editPrivacy(id,hidden){
    openDialog('Visibilité de votre trajet',`<p>La distance, la durée et l’énergie restent visibles. Masquer cette activité masque aussi le trajet des stories qui lui sont liées.</p><form id="activity-privacy-form"><label class="privacy-check"><input type="checkbox" id="activity-hide" ${hidden?'checked':''}> Cacher mon trajet</label><button class="btn impact block">Enregistrer</button></form>`);
    $('activity-privacy-form').onsubmit=e=>{e.preventDefault();try{P().setActivityPrivacy(id,$('activity-hide').checked);dialog.close();window.MoovStories?.render();toast('Visibilité du trajet mise à jour.');}catch(err){dialogError(err);}};
  }
  function renderImpact(){
    const s=activeStats();$('impact-content').innerHTML=(s?`<div class="bal-hero"><div class="bh-label">Énergie du collectif</div><div class="bh-big num">${n(s.totalEnergy)} <span data-flame></span></div><div class="bh-sub">Chaque activité contribue automatiquement à la campagne.</div></div><div class="section-label">Notre mission solidaire</div>`:'')+campaignCard(s)+(s?`<div class="impact-explanation"><h3>Votre mouvement finance du concret.</h3><p>Distance, sport et durée déterminent votre énergie. Le bonus de vitesse est plafonné à ${decimal(P().rules().maxBonusPct)} %. La campagne reçoit automatiquement votre contribution à chaque activité enregistrée.</p><p>${s.forecast?.provisional?'Estimation initiale : le taux s’affinera avec les activités du collectif.':'Le taux estimé évolue avec la participation du collectif.'} Les contributions déjà enregistrées restent acquises.</p><button class="btn ghost block" id="review-campaign">Revoir la progression de la campagne</button></div>`:'');
    $('review-campaign')?.addEventListener('click',()=>showCampaignPopup(s));
  }
  function renderProfile(){
    if(!current())return;const c=current(),own=P().activities().filter(a=>a.userId===c.user.id),s=P().profileStats({weekOffset});
    const contributedCents=own.reduce((sum,a)=>sum+(Number.isFinite(a.contributionCents)?a.contributionCents:0),0);
    $('profile-impact').innerHTML=`<div class="ms-row"><span class="m-ic">${icon('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C10.9 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>')}</span><span class="n">Votre contribution<small>Mobilisée sur les campagnes</small></span><strong class="amt num">${euro(contributedCents)}</strong></div><div class="ms-row"><span class="m-ic">${flame()}</span><span class="n">Votre énergie<small>Récoltée sur vos activités</small></span><strong class="amt num">${n(s.totalEnergy)}</strong></div>`;
    $('profile-avatar').textContent=initials(c.user.name);$('profile-name-display').textContent=c.user.name;$('profile-team-display').textContent=c.user.team;
    $('profile-month').textContent=n(P().activities().filter(a=>a.userId===c.user.id&&dateKey(a.at).slice(0,7)===dateKey(Demo.now()).slice(0,7)).reduce((sum,a)=>sum+a.distanceMeters,0));$('profile-streak').textContent='Série · '+streakFor(P().activities().filter(a=>a.userId===c.user.id))+' jours';$('profile-total').textContent=n(s.totalDistanceMeters);$('profile-energy').textContent=n(s.totalEnergy);$('week-label').textContent=date(s.weekStart)+' — '+date(s.weekEnd-1);$('week-next').disabled=weekOffset===0;$('week-prev').disabled=weekOffset<=-520;
    $('week-metrics').innerHTML=`<div class="weekly-total wk-sub"><strong>${n(s.distanceMeters)} <small>m</small></strong><span>${s.evolutionPct===null?'Pas de comparaison disponible':(s.evolutionPct>=0?'+':'')+decimal(s.evolutionPct)+' % vs semaine précédente'}</span><span>Semaine précédente : ${n(s.previousDistanceMeters)} m</span></div><div class="weekly-secondary"><span>Moyenne hebdo <b>${n(s.weeklyAverageMeters)} m</b></span><span>${flame()} Cette semaine <b>${n(s.energy)}</b></span></div>`;
    const max=Math.max(1,...s.days.map(d=>d.distanceMeters));
    $('wk-chart').innerHTML=s.days.map((d,i)=>`<button class="wk-col ${dateKey(d.date)===dateKey(Demo.now())?'today':''}" data-day="${i}" aria-label="${date(d.date,{weekday:'long'})} : ${n(d.distanceMeters)} mètres" aria-pressed="false"><span class="bar" style="height:${Math.max(2,d.distanceMeters/max*100)}%"></span><span class="d">${['L','M','M','J','V','S','D'][i]}</span></button>`).join('');
    $('wk-chart').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('wk-chart').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const d=s.days[Number(b.dataset.day)];$('wk-tip').textContent=date(d.date)+': '+n(d.distanceMeters)+' m · '+n(d.energy)+' énergie.';});
    $('activity-history').innerHTML=s.activities.length?[...s.activities].sort((a,b)=>b.at-a.at).map(a=>`<article class="history-row history-activity"><div><strong>${esc(a.title||a.sport)}</strong><small>${date(a.at)} · ${esc(a.sport)} · ${a.published?'Dans le fil':'Privée'}</small></div><b>${n(a.distanceMeters)} m</b><div class="history-actions"><button data-history-story="${esc(a.id)}">Partager en story</button><button data-history-privacy="${esc(a.id)}">Trajet ${a.hideRoute?'masqué':'visible'} · modifier</button></div></article>`).join(''):'<div class="mcard empty-card"><p>Aucune activité cette semaine. Chaque sortie compte.</p></div>';
    $('activity-history').querySelectorAll('[data-history-story]').forEach(b=>b.onclick=()=>{const a=s.activities.find(a=>a.id===b.dataset.historyStory);window.MoovStories?.openComposer(activityContext(a,'after'));});
    $('activity-history').querySelectorAll('[data-history-privacy]').forEach(b=>b.onclick=()=>{const a=s.activities.find(a=>a.id===b.dataset.historyPrivacy);editPrivacy(a.id,a.hideRoute);});
  }
  function activityContext(a,phase){return {phase,activityId:a.id,sport:a.sport,distanceMeters:a.distanceMeters||0,durationSeconds:a.durationSeconds||0,energy:a.energy||0,speedKmh:a.speedKmh||0,hideRoute:a.hideRoute!==false,route:a.route||''};}
  function renderChallenges(){
    if(!current())return;
    const c=current(),s=activeStats(),stats=P().challengeStats(),{own,other,share}=duelTeams(stats);
    $('challenges-subtitle').textContent='Ensemble, relevons le défi · '+c.org.name;
    const pct=s?Math.max(0,Math.min(100,s.progressPct)):0;
    $('challenge-hero').innerHTML=s?`<div class="hc-label">${trophyIcon()} ${challengeLabel(s.campaign)}</div><h2>${esc(s.campaign.name)} — ${n(s.targetImpact)} ${esc(s.campaign.unit)}</h2><div class="hc-sub">Toute l’entreprise · ${date(s.campaign.startAt)} — ${date(s.campaign.endAt-1)}</div><div class="hc-days"><div class="v num">${Math.ceil(s.remainingDays)}</div><div class="l">jours</div></div><div class="meter" role="progressbar" aria-label="Progression du défi collectif" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div><div class="meter-cap"><span class="num">${n(s.financedImpact)} / ${n(s.targetImpact)} ${esc(s.campaign.unit)}</span><span>${Math.round(pct)} %</span></div>`:'<div class="hc-label">Défi collectif</div><h2>Le prochain défi se prépare</h2><div class="hc-sub">Votre entreprise choisira la prochaine mission solidaire.</div>';
    const max=Math.max(1,...stats.teams.map(t=>t.distanceMeters)),colors=['#647CA1','#B3541E','#428B77','#7657A6'];
    $('leaderboard').innerHTML=stats.teams.map((t,i)=>`<div class="lb-row ${t.me?'me':''}" data-team="${esc(t.team)}"><div class="lb-rank num">${i+1}</div><span class="avatar" style="width:34px;height:34px;font-size:12px;background:${t.me?'var(--brand)':colors[i%colors.length]}">${esc(initials(t.team))}</span><div class="lb-body"><div class="lb-top"><span class="lb-name">${esc(t.team)}${t.me?' — votre équipe':''}</span><span class="lb-val num">${n(t.distanceMeters)} m</span></div><div class="lb-bar"><i style="width:${t.distanceMeters/max*100}%"></i></div></div></div>`).join('');
    $('challenge-duel').innerHTML=other?`<div class="duel-head"><div class="duel-title">${esc(own.team)} vs ${esc(other.team)}</div><span class="chip outline num">${n(Math.abs(own.distanceMeters-other.distanceMeters))} m d’écart</span></div><div class="duel-track" role="img" aria-label="${esc(own.team)} ${n(own.distanceMeters)} mètres contre ${esc(other.team)} ${n(other.distanceMeters)} mètres"><div class="duel-a" style="flex-basis:${share}%"><span>${esc(own.team)}</span><span class="num">${n(own.distanceMeters)} m</span></div><div class="duel-b"><span class="num">${n(other.distanceMeters)} m</span><span>${esc(other.team)}</span></div></div><div class="duel-note">Chaque mètre fait avancer votre équipe. Totaux du ${date(stats.weekStart)} au ${date(stats.weekEnd-1)}.</div>`:'<div class="duel-title">Le collectif se construit</div><div class="duel-note">Le duel apparaîtra lorsqu’une deuxième équipe sera configurée.</div>';
    const minis=[
      {title:'Sprint du midi',description:'2 000 mètres entre 12 h et 14 h',value:stats.own.lunchDistanceMeters,target:2000,unit:'m',paths:'<path d="M4 14a8 8 0 1 1 16 0M12 14l3-5M2 20h20"/>',detail:'Cumulez 2 000 mètres aujourd’hui avec des activités enregistrées entre 12 h et 14 h, heure locale. L’heure de fin de l’activité est utilisée.'},
      {title:'Semaine verte',description:'50 000 mètres cette semaine',value:stats.own.weekDistanceMeters,target:50000,unit:'m',paths:'<path d="M12 22V9M12 9C7 9 5 5.5 5 2c4 0 7 2 7 7ZM12 13c0-4 3-6 7-6 0 3.5-2 6-7 6Z"/>',detail:'Cumulez 50 000 mètres en marche, course ou vélo, du lundi au dimanche (dates UTC).'},
      {title:'Assiduité',description:'5 sorties cette semaine',value:stats.own.weekActivities,target:5,unit:'sorties',paths:'<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/>',detail:'Enregistrez 5 activités cette semaine, du lundi au dimanche (dates UTC).'}
    ];
    $('challenge-minis').innerHTML=minis.map((m,i)=>`<button class="mini" data-mini="${i}" aria-label="${esc(m.title)} : ${n(m.value)} sur ${n(m.target)} ${m.unit}"><div class="ic">${icon(m.paths)}</div><h4>${m.title}</h4><p>${m.description}</p><div class="meter" role="progressbar" aria-label="${m.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(m.value/m.target*100))}"><i style="width:${Math.min(100,m.value/m.target*100)}%"></i></div></button>`).join('');
    $('challenge-minis').querySelectorAll('[data-mini]').forEach(button=>button.onclick=()=>{const m=minis[Number(button.dataset.mini)];openDialog(m.title,`<p>${m.detail}</p><p class="mini-progress num"><strong>${n(m.value)} / ${n(m.target)} ${m.unit}</strong></p><p>${m.value>=m.target?'Objectif atteint, bravo !':'Chaque activité enregistrée fait avancer votre progression.'}</p><button class="btn impact block" id="mini-start">Commencer une activité</button>`);$('mini-start').onclick=()=>{dialog.close();openStart();};});
  }
  function renderEvents(){
    if(!current())return;const c=current(),all=P().events();
    const list=all.filter(e=>eventFilter==='all'||eventFilter==='company'&&e.visibility==='company'&&e.orgId===c.org.id||eventFilter==='public'&&e.visibility==='public'||eventFilter==='private'&&e.visibility==='private'||eventFilter==='mine'&&(e.organizerId===c.user.id||e.participantIds.includes(c.user.id)));
    document.querySelectorAll('[data-event-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===eventFilter)));
    $('events-root').innerHTML=list.length?list.map(e=>{const started=e.startsAt<=Demo.now(),joined=e.participantIds.includes(c.user.id),visibility={public:'Ouvert à tous · interentreprises',company:'Votre entreprise',private:'Privé · sur invitation'}[e.visibility];return `<article class="mcard event-card"><div class="m-ic event-date"><b>${new Date(e.startsAt).getDate()}</b><span>${new Date(e.startsAt).toLocaleDateString('fr-FR',{month:'short'})}</span></div><div class="m-head event-content"><span class="event-visibility">${visibility}</span><h2 class="m-name">${esc(e.name)}</h2><p>${esc(e.startPoint)} → ${esc(e.endPoint)}</p><div class="m-per event-details">${n(e.distanceMeters)} m · ${eventTime(e.startsAt)} · ${e.participantIds.length}${e.capacity?' / '+e.capacity:''} inscrit${e.participantIds.length>1?'s':''}</div><div class="event-card-foot meter-cap"><span>${started?'Déjà commencé':joined?'Vous participez':'Avec '+esc(e.organizerName)}</span><button class="m-give" data-event-id="${esc(e.id)}">Voir →</button></div></div></article>`;}).join(''):'<div class="mcard empty-card"><strong>Une sortie à imaginer ensemble.</strong><p>Aucun événement visible dans cette sélection.</p><button class="btn impact" id="empty-create-event">Créer un événement</button></div>';
    $('events-root').querySelectorAll('[data-event-id]').forEach(b=>b.onclick=()=>openEvent(b.dataset.eventId));$('empty-create-event')?.addEventListener('click',openCreateEvent);
  }
  function openEvent(id){
    const event=P().events().find(e=>e.id===id);if(!event){toast('Événement indisponible.');return;}
    const c=current(),people=P().directory(),joined=event.participantIds.includes(c.user.id),own=event.organizerId===c.user.id,started=event.startsAt<=Demo.now(),full=event.capacity!==null&&event.participantIds.length>=event.capacity;
    openDialog(event.name,`<span class="event-visibility">${{public:'Ouvert aux comptes inscrits de toutes les entreprises',company:'Réservé à votre entreprise',private:'Privé · seuls l’organisateur et les invités peuvent le voir'}[event.visibility]}</span><p class="event-description">${esc(event.description||'Retrouvons-nous pour bouger ensemble.')}</p><dl class="event-definition"><div><dt>Départ</dt><dd>${esc(event.startPoint)}</dd></div><div><dt>Arrivée</dt><dd>${esc(event.endPoint)}</dd></div><div><dt>Rendez-vous</dt><dd>${eventDate(event.startsAt)} à ${eventTime(event.startsAt)} (heure locale)</dd></div><div><dt>Distance</dt><dd>${n(event.distanceMeters)} mètres</dd></div><div><dt>Organisation</dt><dd>${esc(event.organizerName)}</dd></div></dl><h3>${event.participantIds.length}${event.capacity?' / '+event.capacity:''} participants inscrits</h3><div class="participant-list">${event.participantIds.map(id=>{const user=people.find(p=>p.id===id);return `<span>${esc(user?.name||'Compte indisponible')}${user?.orgName?' · '+esc(user.orgName):''}</span>`;}).join('')}</div><button class="btn ${joined?'ghost':'impact'} block" id="event-join" ${own||started||!joined&&full?'disabled':''}>${own?'Vous organisez cet événement':started?'Événement commencé':joined?'Quitter l’événement':full?'Événement complet':'Rejoindre l’événement'}</button><p class="micro-note">Inscription locale à la maquette. Aucun message ni invitation externe envoyé.</p>`);
    $('event-join').onclick=()=>{try{if(joined)P().leaveEvent(id);else P().joinEvent(id);openEvent(id);toast(joined?'Vous avez quitté l’événement.':'Votre inscription est enregistrée.');}catch(e){dialogError(e);}};
    dialogRefresh=()=>{if(!P().events().some(e=>e.id===id))dialog.close();};
  }
  function openCreateEvent(){
    if(!current())return;const c=current(),people=P().directory().filter(p=>p.id!==c.user.id),tomorrow=localDateKey(Demo.now()+86400000);
    openDialog('Créer un événement',`<form id="event-form"><label for="ev-name">Nom de l’événement</label><input id="ev-name" maxlength="120" required placeholder="La sortie du vendredi"><label for="ev-description">Description</label><textarea id="ev-description" rows="3" maxlength="1500" placeholder="Le rythme, le point de rendez-vous, l’esprit de la sortie…"></textarea><div class="form-grid"><div><label for="ev-start">Départ</label><input id="ev-start" maxlength="160" required></div><div><label for="ev-end">Arrivée</label><input id="ev-end" maxlength="160" required></div><div><label for="ev-date">Date</label><input id="ev-date" type="date" value="${tomorrow}" min="${localDateKey(Demo.now())}" required></div><div><label for="ev-time">Heure locale</label><input id="ev-time" type="time" value="12:00" required></div><div><label for="ev-distance">Distance (mètres)</label><input id="ev-distance" type="number" min="1" max="1000000" step="1" value="5000" required></div><div><label for="ev-capacity">Capacité (facultative)</label><input id="ev-capacity" type="number" min="1" max="100000" step="1" placeholder="Sans limite"></div></div><p class="micro-note">L’organisateur est inscrit et compte dans la capacité.</p><label for="ev-visibility">Qui peut voir et rejoindre ?</label><select id="ev-visibility"><option value="company">Mon entreprise</option><option value="public">Tous les comptes inscrits · interentreprises</option><option value="private">Privé · personnes invitées</option></select><fieldset id="ev-invites" hidden><legend>Inviter des comptes inscrits</legend>${people.length?people.map(p=>`<label class="invite-option"><input type="checkbox" name="invite" value="${esc(p.id)}"><span>${esc(p.name)}<small>${esc(p.orgName||p.team||'')}</small></span></label>`).join(''):'<p>Aucun autre compte inscrit disponible.</p>'}</fieldset><p class="organizer-note">Organisé par <strong>${esc(c.user.name)}</strong></p><button class="btn impact block">Créer l’événement</button></form>`);
    $('ev-visibility').onchange=()=>{$('ev-invites').hidden=$('ev-visibility').value!=='private';};
    $('event-form').onsubmit=e=>{e.preventDefault();try{const created=P().createEvent({name:$('ev-name').value,description:$('ev-description').value,startPoint:$('ev-start').value,endPoint:$('ev-end').value,date:$('ev-date').value,time:$('ev-time').value,distanceMeters:Number($('ev-distance').value),capacity:$('ev-capacity').value?Number($('ev-capacity').value):null,visibility:$('ev-visibility').value,invitedUserIds:[...dialog.querySelectorAll('[name="invite"]:checked')].map(n=>n.value)});eventFilter='mine';scrollChallengesTo('events-section');renderEvents();openEvent(created.id);toast('Votre événement est créé.');}catch(err){dialogError(err);}};
  }
  function openStart(){
    if(!current())return;if(run.active){overlay('run-overlay',true);return;}
    const draft={id:crypto.randomUUID(),sport:'Course',hideRoute:privacyDefault(),distanceMeters:0,durationSeconds:0,energy:0,route:''};
    openDialog('À vous de bouger',`<p>Choisissez votre activité. La simulation accélère le temps et la distance ensemble ; aucun GPS réel n’est utilisé.</p><form id="start-form"><label for="start-sport">Votre sport</label><select id="start-sport"><option>Course</option><option>Marche</option><option>Vélo</option></select><label class="privacy-check"><input type="checkbox" id="start-hide" ${draft.hideRoute?'checked':''}> Cacher mon trajet lors du partage</label><div class="start-energy" id="start-energy"></div><button type="button" class="btn ghost block" id="before-story">Une story avant de partir</button><button class="btn impact block">Démarrer l’activité simulée</button></form>`);
    const update=()=>{draft.sport=$('start-sport').value;draft.hideRoute=$('start-hide').checked;const rule=P().rules().sports[draft.sport];$('start-energy').innerHTML=flame()+' '+decimal(rule.pointsPerMeter)+' énergie / mètre · bonus plafonné à '+decimal(P().rules().maxBonusPct)+' %';};
    $('start-sport').onchange=update;$('start-hide').onchange=()=>{update();savePrivacy(draft.hideRoute);};update();
    $('before-story').onclick=()=>{update();window.MoovStories?.openComposer(activityContext(draft,'before'));};
    $('start-form').onsubmit=e=>{e.preventDefault();update();dialog.close();startRun(draft);};
  }
  function startRun(draft){
    run={...draft,ownerKey:current().org.id+':'+current().user.id,active:true,paused:false,recorded:null,distanceMeters:0,durationSeconds:0,speedKmh:{Course:10.8,Marche:5.4,'Vélo':21.6}[draft.sport],raf:0,last:0,route:ROUTE};
    $('run-sport').textContent=run.sport;$('run-hide-route').checked=run.hideRoute;$('btn-pause').textContent='Pause';overlay('run-overlay',true);updateRun();run.raf=requestAnimationFrame(tick);
  }
  function calculateRun(){if(!run.distanceMeters||!run.durationSeconds)return {energy:0,bonusPct:0,speedKmh:run.speedKmh||0};return Energy.calculate({sport:run.sport,distanceMeters:run.distanceMeters,durationSeconds:run.durationSeconds},P().rules());}
  function tick(ts){if(!run.active)return;if(!run.last)run.last=ts;const dt=Math.min(.25,(ts-run.last)/1000);run.last=ts;if(!run.paused&&!document.hidden){run.durationSeconds+=dt*18;run.distanceMeters=run.durationSeconds*run.speedKmh/3.6;updateRun();}run.raf=requestAnimationFrame(tick);}
  function updateRun(){
    const calc=calculateRun();run.energy=calc.energy;$('run-time').textContent=clock(run.durationSeconds);$('run-dist').textContent=n(run.distanceMeters);$('run-speed').textContent=decimal(calc.speedKmh);$('run-energy').textContent=n(calc.energy);$('run-hidden-note').hidden=!run.hideRoute;$('run-impact-txt').innerHTML='<b class="num">'+n(calc.energy)+'</b> énergie récoltée — votre activité contribuera à la campagne à l’enregistrement.';
    const path=$('run-path'),length=path.getTotalLength(),progress=(run.distanceMeters%5000)/5000;path.style.strokeDasharray=length;path.style.strokeDashoffset=length*(1-progress);const pt=path.getPointAtLength(length*progress);$('run-dot').setAttribute('cx',pt.x);$('run-dot').setAttribute('cy',pt.y);
  }
  function runStory(phase){const calc=calculateRun();window.MoovStories?.openComposer({...activityContext({...run,...calc},phase),route:run.route});}
  function finishRun(){
    if(run.distanceMeters<1){toast('Parcourez au moins un mètre avant de terminer.');return;}
    run.active=false;cancelAnimationFrame(run.raf);Object.assign(run,calculateRun());overlay('run-overlay',false);overlay('sum-overlay',true);
    $('summary-heading').textContent='Belle sortie, '+current().user.name.split(' ')[0];$('sum-dist').textContent=n(run.distanceMeters)+' m';$('sum-time').textContent=clock(run.durationSeconds);$('sum-speed').textContent=decimal(run.speedKmh);$('sum-impact-line').innerHTML=flame()+' '+n(run.energy)+' énergie';$('sum-bonus').textContent='Bonus vitesse : +'+decimal(run.bonusPct)+' %';$('sum-title').value=run.sport+' du '+date(Demo.now());$('sum-hide-route').checked=run.hideRoute;$('summary-feedback').textContent='La story partage le moment. Seul l’enregistrement ci-dessus crédite cette activité.';renderSummaryRoute();
  }
  function renderSummaryRoute(){$('summary-route').innerHTML=routeHTML(ROUTE,run.hideRoute);}
  function saveRun(publish){
    if(run.recorded||!run.id||!current()||run.ownerKey!==current().org.id+':'+current().user.id)return;try{const saved=P().recordActivity({id:run.id,sport:run.sport,distanceMeters:run.distanceMeters,durationSeconds:run.durationSeconds,title:$('sum-title').value,publish,hideRoute:run.hideRoute,route:ROUTE});run.recorded=saved;overlay('sum-overlay',false);goHome();render();if(publish)revealActivity(saved.id);toast((publish?'Activité publiée':'Activité privée enregistrée')+' · '+n(saved.energy)+' énergie · '+euro(saved.contributionCents)+' pour la campagne.');}catch(e){report(e);}
  }
  function showCampaignPopup(stats=activeStats()){
    if(!stats)return;openDialog(stats.endingSoon?'Dernière ligne droite !':'Notre progression collective',`<div class="campaign-popup-icon">${flame()}</div><p>${stats.endingSoon?'Il reste '+Math.ceil(stats.remainingDays)+' jours pour faire avancer notre mission.':'Chaque activité ajoute sa contribution à la campagne.'}</p>${campaignCard(stats)}<button class="btn impact block" id="popup-continue">Continuer à bouger</button>`);$('popup-continue').onclick=()=>dialog.close();
  }
  function maybeCampaignPopup(){
    clearTimeout(popupTimer);if(!current())return;const s=activeStats();if(!s?.endingSoon)return;const key='moovon:campaign-notice:'+current().user.id+':'+s.campaign.id+':'+dateKey(Demo.now());
    let shown=popupSeen.has(key);try{shown ||= localStorage.getItem(key)==='shown';}catch{}if(shown)return;
    popupTimer=setTimeout(()=>{if(!current()||document.querySelector('dialog[open],.overlay.open'))return;popupSeen.add(key);try{localStorage.setItem(key,'shown');}catch{}showCampaignPopup(s);},600);
  }
  function render(){if(!current()||!P())return;try{renderHome();renderProfile();renderChallenges();renderEvents();renderImpact();paintFlames();dialogRefresh?.();window.MoovStories?.render();}catch(e){report(e);}}
  function scheduleRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render();});}
  function init(){if(!current())return;const key=current().org.id+':'+current().user.id;if(identity!==key){if(identity)stop();run={active:false,paused:false,id:null,recorded:null,raf:0};identity=key;weekOffset=0;eventFilter='all';activeScreen='scr-home';}render();showScreen(activeScreen);maybeCampaignPopup();}
  function stop(){run.active=false;cancelAnimationFrame(run.raf);clearTimeout(popupTimer);overlay('run-overlay',false);overlay('sum-overlay',false);closeFan();if(dialog?.open)dialog.close();}
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
  try{localStorage.setItem('moovon:ui:typo',JSON.stringify(key));}catch{toast('Préférence appliquée pour cette session uniquement.');}
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

  $('typo-btn').onclick=()=>{openDialog('Typographie','<div class="typo-rows" id="typo-rows"></div><p class="typo-note">Outil de prévisualisation de la maquette — le choix est mémorisé sur cet appareil.</p>');renderTypoRows();};
  try{applyTypo(JSON.parse(localStorage.getItem('moovon:ui:typo'))||'act');}catch{applyTypo('act');}
  window.MoovApp={init,render,stop,toast,goHome,openStart,openCreateEvent,openStory:()=>window.MoovStories?.openComposer(),fastForward(){if(run.active&&!run.paused){run.durationSeconds+=1000/run.speedKmh*3.6;run.distanceMeters=run.durationSeconds*run.speedKmh/3.6;updateRun();}},activityContext};
  document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>showScreen(b.dataset.nav));
  document.querySelectorAll('[data-start]').forEach(b=>b.onclick=openStart);document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>window.MoovStories?.openComposer());
  $('fab').onclick=toggleFan;$('scrim').onclick=closeFan;
  document.querySelectorAll('[data-fan]').forEach(b=>b.onclick=()=>{closeFan();({run:openStart,story:()=>window.MoovStories?.openComposer(),event:openCreateEvent}[b.dataset.fan])();});
  $('go-events-list').onclick=()=>scrollChallengesTo('events-section');$('event-create').onclick=openCreateEvent;document.querySelectorAll('[data-event-filter]').forEach(b=>b.onclick=()=>{eventFilter=b.dataset.eventFilter;renderEvents();});
  $('week-prev').onclick=()=>{weekOffset--;renderProfile();};$('week-next').onclick=()=>{weekOffset=Math.min(0,weekOffset+1);renderProfile();};
  let touchX=0;$('profile-week').addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;},{passive:true});$('profile-week').addEventListener('touchend',e=>{const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>70){weekOffset=Math.max(-520,Math.min(0,weekOffset+(delta<0?1:-1)));renderProfile();}},{passive:true});
  $('btn-pause').onclick=()=>{run.paused=!run.paused;run.last=0;$('btn-pause').textContent=run.paused?'Reprendre':'Pause';};$('btn-finish').onclick=finishRun;$('run-story').onclick=()=>runStory('during');
  $('run-hide-route').onchange=()=>{run.hideRoute=$('run-hide-route').checked;savePrivacy(run.hideRoute);updateRun();};$('sum-hide-route').onchange=()=>{run.hideRoute=$('sum-hide-route').checked;savePrivacy(run.hideRoute);renderSummaryRoute();};
  $('summary-story').onclick=()=>runStory('after');$('btn-publish').onclick=()=>saveRun(true);$('btn-discard').onclick=()=>saveRun(false);
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;const modal=document.querySelector('.overlay.open');if(e.key==='Escape'){if(modal?.id==='run-overlay'){if(!run.paused)$('btn-pause').click();toast('Activité en pause. Terminez-la pour l’enregistrer.');}else if(!modal)closeFan();}if(e.key==='Tab'&&modal){const nodes=[...modal.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled&&!n.hidden),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
  document.addEventListener('visibilitychange',()=>{run.last=0;});window.addEventListener('resize',fitDialog);window.visualViewport?.addEventListener('resize',fitDialog);window.visualViewport?.addEventListener('scroll',fitDialog);window.addEventListener('scroll',fitDialog,{capture:true,passive:true});
  Demo.onChange(event=>{if(event.type==='reset'){popupSeen.clear();identity='';}});
  P()?.onChange(scheduleRender);setInterval(()=>{if(current()){render();maybeCampaignPopup();}},60000);paintFlames();showScreen('scr-home');
})();
