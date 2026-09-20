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
    return `<div class="activity-route"><svg viewBox="0 0 400 180" role="img" aria-label="Illustration de trajet simulé"><rect width="400" height="180" fill="var(--sunken)"/><path d="M0 50L400 40M0 130L400 145M100 0L120 180M290 0L270 180" fill="none" stroke="var(--line)" stroke-width="10"/><path d="${esc(route)}" fill="none" stroke="var(--brand)" stroke-width="5" stroke-linecap="round"/></svg><span>Trajet simulé</span></div>`;
  }
  function paintFlames(root=document){root.querySelectorAll('[data-flame]').forEach(el=>{el.innerHTML=flame();});}
  function privacyKey(){const c=current();return 'moovon:privacy:'+c.org.id+':'+c.user.id;}
  function privacyDefault(){try{return localStorage.getItem(privacyKey())!=='show';}catch{return true;}}
  function savePrivacy(hidden){try{localStorage.setItem(privacyKey(),hidden?'hide':'show');}catch{toast('Préférence appliquée pour cette session uniquement.');}}
  function showScreen(id){
    closeFan();if(!$(id))return;activeScreen=id;
    document.querySelectorAll('.screen').forEach(s=>{const selected=s.id===id;s.classList.toggle('active',selected);s.inert=!selected;s.setAttribute('aria-hidden',String(!selected));});
    document.querySelectorAll('.navbtn').forEach(b=>{b.classList.toggle('active',b.dataset.nav===id);b.setAttribute('aria-current',b.dataset.nav===id?'page':'false');});
    if(current()&&id==='scr-profile')renderProfile();if(current()&&id==='scr-events')renderEvents();
  }
  function goHome(){showScreen('scr-home');}
  function revealActivity(id){goHome();requestAnimationFrame(()=>{const card=[...$('feed').querySelectorAll('[data-activity]')].find(el=>el.dataset.activity===id);if(!card)return;card.tabIndex=-1;card.classList.add('activity-just-published');card.focus({preventScroll:true});const pane=$('scr-home');pane.scrollTo({top:Math.max(0,pane.scrollTop+card.getBoundingClientRect().top-pane.getBoundingClientRect().top-16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
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
  function campaignCard(stats,compact=false){
    if(!stats)return '<div class="empty-card"><strong>Votre prochaine mission arrive.</strong><p>Votre entreprise prépare sa campagne. Vos activités restent enregistrées.</p></div>';
    const s=stats,percent=Math.max(0,Math.min(100,s.progressPct));
    return `<article class="campaign-card ${compact?'compact':''}"><div class="campaign-eyebrow">${esc(s.association?.name||'Notre association')}<span>${Math.ceil(s.remainingDays)} jours</span></div><h2>${esc(s.campaign.name||s.mission?.name)}</h2><p>${esc(s.mission?.description||'Chaque activité fait progresser notre objectif collectif.')}</p><div class="impact-number"><strong>${n(s.financedImpact)}</strong><span>/ ${n(s.targetImpact)} ${esc(s.campaign.unit||s.mission?.unit||'unités financées')}</span></div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}" aria-label="Progression de la campagne"><i style="width:${percent}%"></i></div><div class="progress-caption"><span>${euro(s.raisedCents)} mobilisés</span><strong>${decimal(percent)} %</strong></div>${compact?'<button class="text-link" data-impact>Voir notre impact →</button>':`<div class="impact-summary"><div><b>${n(s.activeParticipants)}</b><span>participants actifs</span></div><div><b>${n(s.totalEnergy)}</b><span>${flame()} énergie récoltée</span></div></div><p class="micro-note">Budget engagé : ${euro(s.budgetCents)} · restant : ${euro(s.remainingCents)}.<br>La contribution est calculée à l’enregistrement et plafonnée au budget disponible. Aucun paiement réel dans cette maquette.</p>`}</article>`;
  }
  function renderHome(){
    const c=current(),today=dateKey(Demo.now()),own=P().activities().filter(a=>a.userId===c.user.id),day=own.filter(a=>dateKey(a.at)===today);
    $('greet-date').textContent=date(Demo.now(),{weekday:'long'})+' · '+c.user.team;$('hello-name').textContent='Bonjour '+c.user.name.split(' ')[0];
    $('today-meters').textContent=n(day.reduce((t,a)=>t+a.distanceMeters,0));$('today-energy').textContent=n(day.reduce((t,a)=>t+a.energy,0));
    $('home-campaign').innerHTML=campaignCard(activeStats(),true);$('home-campaign').querySelector('[data-impact]')?.addEventListener('click',()=>showScreen('scr-missions'));
    const feed=P().feed();$('feed').innerHTML=feed.length?feed.map(a=>{
      const likes=P().likes(a.id),comments=P().comments(a.id);
      return `<article class="activity-card" data-activity="${esc(a.id)}"><div class="activity-author"><span class="avatar">${esc(initials(a.name))}</span><div><strong>${esc(a.name||'Collaborateur')}</strong><small>${esc(a.team||'')} · ${date(a.at)} à ${time(a.at)} UTC</small></div><span class="sport-chip">${esc(a.sport)}</span></div><h3>${esc(a.title)}</h3>${routeHTML(a.route,a.hideRoute)}<div class="activity-metrics"><div><b>${n(a.distanceMeters)}</b><small>mètres</small></div><div><b>${a.durationSeconds?clock(a.durationSeconds):'—'}</b><small>durée</small></div><div><b>${flame()} ${n(a.energy)}</b><small>énergie</small></div><div><b>${a.durationSeconds?decimal(a.speedKmh):'—'}</b><small>vitesse · km/h</small></div></div><div class="activity-actions"><button data-like="${esc(a.id)}" aria-pressed="${likes.liked}">♡ ${likes.count} Bravo</button><button data-comments="${esc(a.id)}">${comments.length} commentaire${comments.length!==1?'s':''}</button>${a.userId===c.user.id?`<button data-privacy="${esc(a.id)}" data-hidden="${a.hideRoute}">Trajet ${a.hideRoute?'masqué':'visible'} · modifier</button>`:''}</div></article>`;
    }).join(''):'<div class="empty-card"><strong>Votre collectif prend son élan.</strong><p>Publiez une première activité pour ouvrir le fil.</p><button class="btn impact" data-start>Commencer</button></div>';
    $('feed').querySelectorAll('[data-start]').forEach(b=>b.onclick=openStart);
    $('feed').querySelectorAll('[data-like]').forEach(b=>b.onclick=()=>{try{P().toggleLike(b.dataset.like);}catch(e){report(e);}});
    $('feed').querySelectorAll('[data-comments]').forEach(b=>b.onclick=()=>openComments(b.dataset.comments));
    $('feed').querySelectorAll('[data-privacy]').forEach(b=>b.onclick=()=>editPrivacy(b.dataset.privacy,b.dataset.hidden==='true'));
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
    const s=activeStats();$('impact-content').innerHTML=campaignCard(s)+(s?`<div class="impact-explanation"><h3>Votre mouvement finance du concret.</h3><p>Distance, sport et durée déterminent votre énergie. Le bonus de vitesse est plafonné à ${decimal(P().rules().maxBonusPct)} %. La campagne reçoit automatiquement votre contribution à chaque activité enregistrée.</p><p>${s.forecast?.provisional?'Estimation initiale : le taux s’affinera avec les activités du collectif.':'Le taux estimé évolue avec la participation du collectif.'} Les contributions déjà enregistrées restent acquises.</p><button class="btn ghost block" id="review-campaign">Revoir la progression de la campagne</button></div>`:'');
    $('review-campaign')?.addEventListener('click',()=>showCampaignPopup(s));
  }
  function renderProfile(){
    if(!current())return;const c=current(),s=P().profileStats({weekOffset});
    $('profile-avatar').textContent=initials(c.user.name);$('profile-name-display').textContent=c.user.name;$('profile-team-display').textContent=c.user.team;
    $('profile-total').textContent=n(s.totalDistanceMeters);$('profile-energy').textContent=n(s.totalEnergy);$('week-label').textContent=date(s.weekStart)+' — '+date(s.weekEnd-1);$('week-next').disabled=weekOffset===0;$('week-prev').disabled=weekOffset<=-520;
    $('week-metrics').innerHTML=`<div class="weekly-total"><strong>${n(s.distanceMeters)} <small>m</small></strong><span>${s.evolutionPct===null?'Pas de comparaison disponible':(s.evolutionPct>=0?'+':'')+decimal(s.evolutionPct)+' % vs semaine précédente'}</span><span>Semaine précédente : ${n(s.previousDistanceMeters)} m</span></div><div class="weekly-secondary"><span>Moyenne hebdo <b>${n(s.weeklyAverageMeters)} m</b></span><span>${flame()} Cette semaine <b>${n(s.energy)}</b></span></div>`;
    const max=Math.max(1,...s.days.map(d=>d.distanceMeters));
    $('wk-chart').innerHTML=s.days.map((d,i)=>`<button class="wk-col ${dateKey(d.date)===dateKey(Demo.now())?'today':''}" data-day="${i}" aria-label="${date(d.date,{weekday:'long'})} : ${n(d.distanceMeters)} mètres" aria-pressed="false"><span class="bar" style="height:${Math.max(2,d.distanceMeters/max*100)}%"></span><span class="d">${['L','M','M','J','V','S','D'][i]}</span></button>`).join('');
    $('wk-chart').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('wk-chart').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const d=s.days[Number(b.dataset.day)];$('wk-tip').textContent=date(d.date)+': '+n(d.distanceMeters)+' m · '+n(d.energy)+' énergie.';});
    $('activity-history').innerHTML=s.activities.length?[...s.activities].sort((a,b)=>b.at-a.at).map(a=>`<article class="history-activity"><div><strong>${esc(a.title||a.sport)}</strong><small>${date(a.at)} · ${esc(a.sport)} · ${a.published?'Dans le fil':'Privée'}</small></div><b>${n(a.distanceMeters)} m</b><div class="history-actions"><button data-history-story="${esc(a.id)}">Partager en story</button><button data-history-privacy="${esc(a.id)}">Trajet ${a.hideRoute?'masqué':'visible'} · modifier</button></div></article>`).join(''):'<div class="empty-card"><p>Aucune activité cette semaine. Chaque sortie compte.</p></div>';
    $('activity-history').querySelectorAll('[data-history-story]').forEach(b=>b.onclick=()=>{const a=s.activities.find(a=>a.id===b.dataset.historyStory);window.MoovStories?.openComposer(activityContext(a,'after'));});
    $('activity-history').querySelectorAll('[data-history-privacy]').forEach(b=>b.onclick=()=>{const a=s.activities.find(a=>a.id===b.dataset.historyPrivacy);editPrivacy(a.id,a.hideRoute);});
  }
  function activityContext(a,phase){return {phase,activityId:a.id,sport:a.sport,distanceMeters:a.distanceMeters||0,durationSeconds:a.durationSeconds||0,energy:a.energy||0,speedKmh:a.speedKmh||0,hideRoute:a.hideRoute!==false,route:a.route||''};}
  function renderEvents(){
    if(!current())return;const c=current(),all=P().events();
    const list=all.filter(e=>eventFilter==='all'||eventFilter==='company'&&e.visibility==='company'&&e.orgId===c.org.id||eventFilter==='public'&&e.visibility==='public'||eventFilter==='private'&&e.visibility==='private'||eventFilter==='mine'&&(e.organizerId===c.user.id||e.participantIds.includes(c.user.id)));
    document.querySelectorAll('[data-event-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===eventFilter)));
    $('events-root').innerHTML=list.length?list.map(e=>{const started=e.startsAt<=Demo.now(),joined=e.participantIds.includes(c.user.id),visibility={public:'Ouvert à tous · interentreprises',company:'Votre entreprise',private:'Privé · sur invitation'}[e.visibility];return `<article class="event-card"><div class="event-date"><b>${new Date(e.startsAt).getDate()}</b><span>${new Date(e.startsAt).toLocaleDateString('fr-FR',{month:'short'})}</span></div><div class="event-content"><span class="event-visibility">${visibility}</span><h2>${esc(e.name)}</h2><p>${esc(e.startPoint)} → ${esc(e.endPoint)}</p><div class="event-details">${n(e.distanceMeters)} m · ${eventTime(e.startsAt)} · ${e.participantIds.length}${e.capacity?' / '+e.capacity:''} inscrit${e.participantIds.length>1?'s':''}</div><div class="event-card-foot"><span>${started?'Déjà commencé':joined?'Vous participez':'Avec '+esc(e.organizerName)}</span><button data-event-id="${esc(e.id)}">Voir →</button></div></div></article>`;}).join(''):'<div class="empty-card"><strong>Une sortie à imaginer ensemble.</strong><p>Aucun événement visible dans cette sélection.</p><button class="btn impact" id="empty-create-event">Créer un événement</button></div>';
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
    $('event-form').onsubmit=e=>{e.preventDefault();try{const created=P().createEvent({name:$('ev-name').value,description:$('ev-description').value,startPoint:$('ev-start').value,endPoint:$('ev-end').value,date:$('ev-date').value,time:$('ev-time').value,distanceMeters:Number($('ev-distance').value),capacity:$('ev-capacity').value?Number($('ev-capacity').value):null,visibility:$('ev-visibility').value,invitedUserIds:[...dialog.querySelectorAll('[name="invite"]:checked')].map(n=>n.value)});eventFilter='mine';showScreen('scr-events');renderEvents();openEvent(created.id);toast('Votre événement est créé.');}catch(err){dialogError(err);}};
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
    const calc=calculateRun();run.energy=calc.energy;$('run-time').textContent=clock(run.durationSeconds);$('run-dist').textContent=n(run.distanceMeters);$('run-speed').textContent=decimal(calc.speedKmh);$('run-energy').textContent=n(calc.energy);$('run-hidden-note').hidden=!run.hideRoute;
    const path=$('run-path'),length=path.getTotalLength(),progress=(run.distanceMeters%5000)/5000;path.style.strokeDasharray=length;path.style.strokeDashoffset=length*(1-progress);const pt=path.getPointAtLength(length*progress);$('run-dot').setAttribute('cx',pt.x);$('run-dot').setAttribute('cy',pt.y);
  }
  function runStory(phase){const calc=calculateRun();window.MoovStories?.openComposer({...activityContext({...run,...calc},phase),route:run.route});}
  function finishRun(){
    if(run.distanceMeters<1){toast('Parcourez au moins un mètre avant de terminer.');return;}
    run.active=false;cancelAnimationFrame(run.raf);Object.assign(run,calculateRun());overlay('run-overlay',false);overlay('sum-overlay',true);
    $('sum-dist').textContent=n(run.distanceMeters)+' m';$('sum-time').textContent=clock(run.durationSeconds);$('sum-speed').textContent=decimal(run.speedKmh);$('sum-impact-line').innerHTML=flame()+' '+n(run.energy)+' énergie';$('sum-bonus').textContent='Bonus vitesse : +'+decimal(run.bonusPct)+' %';$('sum-title').value=run.sport+' du '+date(Demo.now());$('sum-hide-route').checked=run.hideRoute;$('summary-feedback').textContent='La story partage le moment. Seul l’enregistrement ci-dessus crédite cette activité.';renderSummaryRoute();
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
  function render(){if(!current()||!P())return;try{renderHome();renderProfile();renderEvents();renderImpact();paintFlames();dialogRefresh?.();window.MoovStories?.render();}catch(e){report(e);}}
  function scheduleRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render();});}
  function init(){if(!current())return;const key=current().org.id+':'+current().user.id;if(identity!==key){if(identity)stop();run={active:false,paused:false,id:null,recorded:null,raf:0};identity=key;weekOffset=0;eventFilter='all';activeScreen='scr-home';}render();showScreen(activeScreen);maybeCampaignPopup();}
  function stop(){run.active=false;cancelAnimationFrame(run.raf);clearTimeout(popupTimer);overlay('run-overlay',false);overlay('sum-overlay',false);closeFan();if(dialog?.open)dialog.close();}
  window.MoovApp={init,render,stop,toast,goHome,openStart,openCreateEvent,openStory:()=>window.MoovStories?.openComposer(),fastForward(){if(run.active&&!run.paused){run.durationSeconds+=1000/run.speedKmh*3.6;run.distanceMeters=run.durationSeconds*run.speedKmh/3.6;updateRun();}},activityContext};
  document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>showScreen(b.dataset.nav));
  document.querySelectorAll('[data-start]').forEach(b=>b.onclick=openStart);document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>window.MoovStories?.openComposer());
  $('fab').onclick=toggleFan;$('scrim').onclick=closeFan;
  document.querySelectorAll('[data-fan]').forEach(b=>b.onclick=()=>{closeFan();({run:openStart,story:()=>window.MoovStories?.openComposer(),event:openCreateEvent}[b.dataset.fan])();});
  $('event-create').onclick=openCreateEvent;document.querySelectorAll('[data-event-filter]').forEach(b=>b.onclick=()=>{eventFilter=b.dataset.eventFilter;renderEvents();});
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
