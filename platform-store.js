/* Shared presentation data. Local browser storage, not production authentication. */
(function (global) {
  'use strict';
  const KEY = 'moovon:platform:v1', DAY = 86400000;
  const listeners = new Set();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
  const uid = prefix => prefix + '_' + (global.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const now = () => global.Demo.now();
  const session = () => global.Demo.current() || fail('Connectez-vous pour continuer.');
  const isAdmin = c => ['admin','platform'].includes(c.user.role);
  function orgAccess(orgId, admin = false) {
    const c = session(), id = orgId || c.org.id;
    if (!global.Demo.org(id)) fail('Entreprise introuvable.');
    if (c.user.role !== 'platform' && id !== c.org.id) fail('Cet espace appartient à une autre entreprise.');
    if (admin && !isAdmin(c)) fail('Cette action est réservée à un administrateur.');
    return {c, id};
  }
  const operator = () => { const c = session(); if (c.user.role !== 'platform') fail('Cette opération est réservée au CRM Moov’On.'); return c; };
  const required = (value, name, max) => clean(value, max) || fail('Renseignez ' + name + '.');
  function euros(value, label) {
    const amount = Number(value), cents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000000) fail(label + ' doit être un montant positif valide.');
    return cents;
  }
  function dateValue(value, time = '00:00') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !/^\d{2}:\d{2}$/.test(time || '')) fail('Renseignez une date et une heure valides.');
    const stamp = Date.parse(value + 'T' + time + ':00Z');
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,16) !== value + 'T' + time) fail('La date ou l’heure est invalide.');
    return stamp;
  }
  function eventDate(value, time) {
    dateValue(value,time); // Validate calendar values before using the browser timezone.
    const [year,month,day]=value.split('-').map(Number),[hours,minutes]=time.split(':').map(Number);
    const date=new Date(year,month-1,day,hours,minutes,0,0);
    if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hours||date.getMinutes()!==minutes)fail('Cette heure n’existe pas dans votre fuseau horaire.');
    return date.getTime();
  }
  const image = value => {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 1200000 || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(value)) fail('Utilisez une petite image PNG, JPEG ou WebP.');
    return value;
  };
  function save(data) {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (_) { fail('Le stockage local est plein ou indisponible. Aucune modification enregistrée.'); }
  }
  function emit(type) { listeners.forEach(fn => { try { fn({type}); } catch (e) { global.console?.warn('Affichage à actualiser', e); } }); }
  function change(type, fn) { const data = read(), result = fn(data); save(data); emit(type); return clone(result); }
  const monthStart = n => { const d = new Date(n); return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1); };
  const route = 'M40 150 C 110 120, 90 70, 170 80 S 260 120, 310 70 S 370 40, 375 35';
  function makeSeed() {
    const clock = now(), start = monthStart(clock);
    const data = {version:1,rules:clone(global.Energy.defaults),associations:[
      {id:'canopy',name:'Canopée Solidaire',logo:'',description:'Partenaire fictif de présentation : restauration des espaces naturels et solidarité locale.',website:'',contact:'',demo:true},
      {id:'table',name:'Table Ouverte',logo:'',description:'Partenaire fictif de présentation : repas et accompagnement des familles.',website:'',contact:'',demo:true}
    ],missions:[
      {id:'trees',associationId:'canopy',name:'Planter des arbres',description:'Contribuer à un projet de plantation.',unit:'arbres',unitCostCents:500,goalCents:5000000},
      {id:'kits',associationId:'canopy',name:'Financer du matériel scolaire',description:'Équiper des enfants pour la rentrée.',unit:'kits scolaires',unitCostCents:1500,goalCents:3000000},
      {id:'meals',associationId:'table',name:'Financer des repas',description:'Soutenir la distribution de repas.',unit:'repas',unitCostCents:800,goalCents:5000000}
    ],campaigns:[],activities:[],events:[],comments:[],likes:{},migration:{legacy:false}};
    for (const org of global.Demo.orgs()) {
      if (!['corelis','nova'].includes(org.id)) continue;
      const mission = data.missions.find(m=>m.id === (org.id === 'corelis' ? 'trees' : 'meals'));
      data.campaigns.push({id:'campaign-'+org.id,orgId:org.id,associationId:mission.associationId,missionId:mission.id,budgetCents:1000000,unitCostCents:mission.unitCostCents,unit:mission.unit,name:mission.name,period:'monthly',startAt:start,endAt:global.Energy.campaignEnd(start,'monthly'),createdAt:start,status:'active',demo:true});
    }
    // Consistent sample history for the fictitious presentation personas.
    const people = [{id:'camille',org:'corelis',name:'Camille Roux',team:'Marketing'},{id:'lea',org:'corelis',name:'Léa Fontaine',team:'RH'},{id:'sofiane',org:'corelis',name:'Sofiane B.',team:'Finance'},{id:'alex',org:'nova',name:'Alex Morgan',team:'Conseil'},{id:'sarah',org:'nova',name:'Sarah Benali',team:'RH'}];
    for (let day = 35; day >= 1; day--) {
      for (let index = 0; index < people.length; index++) {
        if ((day + index) % 3 !== 0) continue;
        const person = people[index], sport = ['Course','Marche','Vélo'][index % 3];
        const distanceMeters = sport === 'Vélo' ? 10000 + (day%3)*1000 : sport === 'Marche' ? 2500 + (day%3)*250 : 5000 + (day%3)*500;
        const ref = data.rules.sports[sport].referenceSpeedKmh;
        const calc = global.Energy.calculate({sport,distanceMeters,durationSeconds:distanceMeters/ref*3.6},data.rules);
        const at = clock-day*DAY, campaign = activeOf(data,person.org,at);
        const contributionCents = campaign ? Math.min(Math.round(calc.energy*.012*100),remaining(data,campaign)) : 0;
        data.activities.push({id:'sample-'+person.id+'-'+day,userId:person.id,orgId:person.org,name:person.name,team:person.team,title:sport==='Marche'?'La pause du midi en mouvement':sport==='Vélo'?'À vélo pour notre collectif':'Une sortie qui fait du bien',...calc,at,published:day%2===0,hideRoute:true,route,contributionCents,ratioEuroPerEnergy:contributionCents/(100*calc.energy),rulesVersion:1,campaignId:campaign?.id||null,demo:true});
      }
    }
    const future = clock + 3*DAY;
    data.events.push({id:'event-lunch',orgId:'corelis',organizerId:'lea',organizerName:'Léa Fontaine',name:'La marche du déjeuner',description:'Un moment ensemble, à votre rythme. Toutes les allures sont bienvenues.',startPoint:'Accueil de l’entreprise',endPoint:'Jardin public',startsAt:future,distanceMeters:3000,capacity:20,visibility:'company',invitedUserIds:[],participantIds:['lea'],createdAt:clock,demo:true});
    data.events.push({id:'event-open',orgId:'nova',organizerId:'sarah',organizerName:'Sarah Benali',name:'Les 5 000 mètres solidaires',description:'Une course collective ouverte aux membres de toutes les entreprises de la démonstration.',startPoint:'Entrée du parc',endPoint:'Esplanade du parc',startsAt:clock+7*DAY,distanceMeters:5000,capacity:null,visibility:'public',invitedUserIds:[],participantIds:['sarah'],createdAt:clock,demo:true});
    migrateLegacy(data);
    return data;
  }
  function migrateLegacy(data) {
    for (const org of global.Demo.orgs()) {
      let legacy;
      try { legacy = JSON.parse(global.localStorage.getItem('moovon:app:v2:'+org.id)||'null'); } catch (_) { continue; }
      if (!legacy) continue;
      const imported = new Map();
      for (const [userId,profile] of Object.entries(legacy.profiles||{})) {
        for (const item of (profile.history||[])) {
          if (!(Number(item.dist)>0) || !Number.isFinite(item.at)) continue;
          const id = 'legacy-'+(item.id || uid('activity'));
          const a = {id,userId,orgId:org.id,name:'Collaborateur',team:'',title:clean(item.title)||'Activité conservée',sport:['Course','Marche','Vélo'].includes(item.type)?item.type:'Marche',distanceMeters:Number(item.dist),durationSeconds:null,speedKmh:null,energy:Math.round(item.dist),baseEnergy:Math.round(item.dist),bonusPct:0,at:item.at,published:!!item.published,hideRoute:true,route:'',contributionCents:0,campaignId:null,legacy:true};
          data.activities.push(a); imported.set(userId+'|'+item.at,a);
        }
      }
      for (const post of (legacy.posts||[])) {
        if (!(Number(post.dist)>0)||!Number.isFinite(post.createdAt)) continue;
        let a = imported.get(post.userId+'|'+post.createdAt);
        if (!a) {
          a = {id:'legacy-'+post.id,userId:post.userId,orgId:org.id,sport:['Course','Marche','Vélo'].includes(post.type)?post.type:'Course',distanceMeters:Number(post.dist),durationSeconds:null,speedKmh:null,energy:Math.round(post.dist),bonusPct:0,at:post.createdAt,contributionCents:0,campaignId:null,legacy:true};
          data.activities.push(a);
        }
        Object.assign(a,{name:clean(post.n)||'Collaborateur',team:clean(post.team),title:clean(post.title),published:true,hideRoute:true,route:''});
        for (const c of (legacy.comments?.[post.id]||[])) data.comments.push({id:'legacy-'+(c.id||uid('comment')),activityId:a.id,userId:c.userId||null,name:clean(c.name)||'Collaborateur',text:clean(c.text,400),at:c.at||post.createdAt});
      }
    }
    data.migration.legacy=true;
  }
  function read() {
    let raw;
    try { raw = global.localStorage.getItem(KEY); } catch (_) { fail('Le stockage local est indisponible.'); }
    if (!raw) { const seeded = makeSeed(); save(seeded); return seeded; }
    let data; try { data = JSON.parse(raw); } catch (_) { fail('Données de présentation illisibles. Utilisez la remise à zéro du portail.'); }
    if (data.version !== 1 || !['associations','missions','campaigns','activities','events','comments'].every(key=>Array.isArray(data[key])) || !data.rules || !data.likes) fail('Données de présentation incompatibles.');
    return data;
  }
  function activeOf(data,orgId,at=now()) { return data.campaigns.filter(c=>c.orgId===orgId && c.status!=='closed' && c.startAt<=at && at<c.endAt).sort((a,b)=>b.createdAt-a.createdAt)[0]||null; }
  const raised = (data,c) => data.activities.filter(a=>a.campaignId===c.id).reduce((sum,a)=>sum+(a.contributionCents||0),0);
  const remaining = (data,c) => Math.max(0,c.budgetCents-raised(data,c));
  function statsOf(data,campaign) {
    const clock=now(), c=campaign, until=Math.min(clock,c.endAt);
    const activities=data.activities.filter(a=>a.campaignId===c.id && a.at<=clock);
    const liveIds=new Set(global.Demo.directory().filter(u=>u.orgId===c.orgId).map(u=>u.id));
    const from=Math.max(c.startAt,until-data.rules.forecast.activeWindowDays*DAY);
    const recent=activities.filter(a=>a.at>=from && a.at< c.endAt && !a.legacy && liveIds.has(a.userId));
    const activeParticipants=new Set(recent.map(a=>a.userId)).size;
    const raisedCents=raised(data,c), budgetCents=c.budgetCents, remainingCents=Math.max(0,budgetCents-raisedCents);
    const remainingDays=c.status==='closed'?0:Math.max(0,(c.endAt-Math.max(clock,c.startAt))/DAY);
    const forecast=global.Energy.forecast({budgetCents,raisedCents,activeParticipants,activityCount:recent.length,totalEnergy:recent.reduce((n,a)=>n+a.energy,0),observationDays:Math.max(0,(until-from)/DAY),remainingDays},data.rules);
    const mission=data.missions.find(m=>m.id===c.missionId), association=data.associations.find(a=>a.id===c.associationId);
    return {campaign:c,mission,association,activeParticipants,activityCount:activities.length,totalEnergy:activities.reduce((n,a)=>n+a.energy,0),raisedCents,budgetCents,remainingCents,progressPct:Math.min(100,raisedCents/budgetCents*100),targetImpact:Math.floor(budgetCents/c.unitCostCents),financedImpact:Math.floor(raisedCents/c.unitCostCents),forecast,remainingDays,energyRequired:forecast.ratioEuroPerEnergy>0?Math.ceil(remainingCents/100/forecast.ratioEuroPerEnergy):0,endingSoon:c.status!=='closed'&&global.Energy.endingSoon(c.startAt,c.endAt,clock)};
  }
  function publishedActivity(data,id) { const {id:orgId}=orgAccess(); return data.activities.find(a=>a.id===id && a.orgId===orgId && a.published)||fail('Cette publication est indisponible.'); }
  function visibleActivity(a,c) {
    const copy=clone(a);
    if (copy.hideRoute || copy.userId!==c.user.id && !copy.published) copy.route='';
    return copy;
  }
  function eventVisible(event,c) { return event.visibility==='public' || event.organizerId===c.user.id || event.visibility==='company'&&event.orgId===c.org.id || event.visibility==='private'&&event.invitedUserIds.includes(c.user.id); }
  function getEvent(data,id,c) { const e=data.events.find(e=>e.id===id); return e&&eventVisible(e,c)?e:fail('Événement indisponible.'); }
  const Platform = {
    catalog() { session(); const d=read(); return clone({associations:d.associations,missions:d.missions}); },
    rules() { return clone(read().rules); },
    updateRules(rules) { operator(); return change('rules',data=>{const validated=global.Energy.validateRules(rules); validated.version=data.rules.version+1; data.rules=validated; return data.rules;}); },
    saveAssociation(input={}) { operator(); return change('association',data=>{
      const existing=input.id?data.associations.find(a=>a.id===input.id):null;
      if (input.id&&!existing) fail('Association introuvable.');
      const website=clean(input.website,500);
      if (website) { try { const u=new URL(website); if (!['http:','https:'].includes(u.protocol)) throw Error(); } catch (_) {fail('Le site doit commencer par https:// ou http://.');} }
      const value={id:existing?.id||uid('association'),name:required(input.name,'le nom de l’association',100),logo:image(input.logo),description:clean(input.description,1500),website,contact:clean(input.contact,400)};
      if(existing)Object.assign(existing,value);else data.associations.push(value);return value;
    }); },
    saveMission(input={}) { operator(); return change('mission',data=>{
      if(!data.associations.some(a=>a.id===input.associationId))fail('Choisissez une association du CRM.');
      const existing=input.id?data.missions.find(m=>m.id===input.id):null;
      if(input.id&&!existing)fail('Mission introuvable.');
      if(existing && existing.associationId!==input.associationId && data.campaigns.some(c=>c.missionId===existing.id))fail('Une mission utilisée ne peut pas changer d’association.');
      const value={id:existing?.id||uid('mission'),associationId:input.associationId,name:required(input.name,'le nom de la mission',120),description:clean(input.description,1500),unit:required(input.unit,'l’unité d’impact',60),unitCostCents:euros(input.unitCostEuros,'Le coût unitaire'),goalCents:euros(input.goalEuros,'L’objectif en euros')};
      if(existing)Object.assign(existing,value);else data.missions.push(value);return value;
    }); },
    missionStats(id) { session(); const d=read(),m=d.missions.find(m=>m.id===id)||fail('Mission introuvable.'); const campaigns=d.campaigns.filter(c=>c.missionId===id),ids=new Set(campaigns.map(c=>c.id)); const amount=d.activities.filter(a=>ids.has(a.campaignId)).reduce((s,a)=>s+a.contributionCents,0); return {goalCents:m.goalCents,raisedCents:amount,targetImpact:Math.floor(m.goalCents/m.unitCostCents),financedImpact:campaigns.reduce((sum,c)=>sum+Math.floor(raised(d,c)/c.unitCostCents),0)}; },
    campaigns(orgId) { const {id}=orgAccess(orgId); return clone(read().campaigns.filter(c=>c.orgId===id).sort((a,b)=>b.createdAt-a.createdAt)); },
    activeCampaign(orgId) { const {id}=orgAccess(orgId); return clone(activeOf(read(),id)); },
    campaignStats(id) { const d=read(),campaign=d.campaigns.find(c=>c.id===id)||fail('Campagne introuvable.');orgAccess(campaign.orgId);return clone(statsOf(d,campaign)); },
    createCampaign(input={}) { const {id:orgId}=orgAccess(input.orgId,true); return change('campaign',data=>{
      const mission=data.missions.find(m=>m.id===input.missionId&&m.associationId===input.associationId)||fail('Choisissez une mission de cette association.');
      const startAt=dateValue(input.startDate),endAt=global.Energy.campaignEnd(startAt,input.period),clock=now();
      if(endAt<=clock)fail('La campagne doit se terminer dans le futur.');
      const conflicts=data.campaigns.filter(c=>c.orgId===orgId&&c.status!=='closed'&&c.startAt<endAt&&startAt<c.endAt);
      if(conflicts.length&&!input.replaceActive)fail('Une campagne couvre déjà cette période. Confirmez son remplacement pour conserver son historique et ouvrir la nouvelle.');
      const campaign={id:uid('campaign'),orgId,associationId:mission.associationId,missionId:mission.id,name:mission.name,unit:mission.unit,unitCostCents:mission.unitCostCents,budgetCents:euros(input.budgetEuros,'Le budget'),period:input.period,startAt,endAt,createdAt:clock,status:'active'};
      conflicts.forEach(c=>{
        c.replacedBy=campaign.id;
        if(startAt>clock && c.startAt<startAt){
          // Keep crediting the current campaign until the scheduled handover.
          c.originalEndAt=c.originalEndAt||c.endAt;c.endAt=startAt;
        }else{c.status='closed';c.closedAt=clock;}
      });
      data.campaigns.push(campaign);return campaign;
    }); },
    recordActivity(input={}) { const c=session(); return change('activity',data=>{
      const id=clean(input.id,120)||uid('activity'), existing=data.activities.find(a=>a.id===id);
      if(existing){if(existing.userId!==c.user.id||existing.orgId!==c.org.id)fail('Identifiant d’activité déjà utilisé.');return visibleActivity(existing,c);}
      const calc=global.Energy.calculate(input,data.rules),clock=now(),campaign=activeOf(data,c.org.id,clock);
      const value={id,userId:c.user.id,orgId:c.org.id,name:c.user.name,team:c.user.team,...calc,title:clean(input.title,160)||calc.sport,at:clock,published:input.publish===true,hideRoute:input.hideRoute!==false,route:input.route?route:'',campaignId:campaign?.id||null,contributionCents:0,ratioEuroPerEnergy:0,rulesVersion:data.rules.version};
      data.activities.push(value);
      if(campaign){
        const stats=statsOf(data,campaign), ratio=stats.forecast.ratioEuroPerEnergy;
        value.ratioEuroPerEnergy=ratio;
        value.contributionCents=Math.min(stats.remainingCents,Math.max(0,Math.round(calc.energy*ratio*100)));
      }
      return visibleActivity(value,c);
    }); },
    activities(orgId) { const {c,id}=orgAccess(orgId);return read().activities.filter(a=>a.orgId===id&&(isAdmin(c)||a.userId===c.user.id)).sort((a,b)=>b.at-a.at).map(a=>visibleActivity(a,c)); },
    feed() { const c=session();return read().activities.filter(a=>a.orgId===c.org.id&&a.published).sort((a,b)=>b.at-a.at).map(a=>visibleActivity(a,c)); },
    activityPrivacy(id) { const c=session(),a=read().activities.find(a=>a.id===id&&a.orgId===c.org.id);return a ? a.hideRoute : null; },
    storySnapshot(id) { const c=session();return clone(read().activities.find(a=>a.id===id&&a.userId===c.user.id&&a.orgId===c.org.id)||null); },
    setActivityPrivacy(id,hideRoute) { const c=session(); if(typeof hideRoute!=='boolean')fail('Choisissez la visibilité du trajet.'); return change('activity-privacy',data=>{const a=data.activities.find(a=>a.id===id&&a.userId===c.user.id&&a.orgId===c.org.id)||fail('Vous pouvez modifier uniquement vos activités.');a.hideRoute=hideRoute;return visibleActivity(a,c);}); },
    likes(id) { const d=read(),a=publishedActivity(d,id),c=session(),list=d.likes[a.id]||[];return {count:list.length,liked:list.includes(c.user.id)}; },
    toggleLike(id) { const c=session();return change('like',d=>{const a=publishedActivity(d,id),list=d.likes[a.id]||(d.likes[a.id]=[]),i=list.indexOf(c.user.id);if(i>=0)list.splice(i,1);else list.push(c.user.id);return {count:list.length,liked:list.includes(c.user.id)};}); },
    comments(id) { const d=read();publishedActivity(d,id);return clone(d.comments.filter(c=>c.activityId===id)); },
    comment(id,text) { const c=session();return change('comment',d=>{publishedActivity(d,id);const value={id:uid('comment'),activityId:id,userId:c.user.id,name:c.user.name,text:required(text,'un commentaire',400),at:now()};d.comments.push(value);return value;}); },
    profileStats({weekOffset=0}={}) {
      const c=session(),offset=Number(weekOffset);if(!Number.isSafeInteger(offset)||offset>0||offset< -520)fail('Choisissez une semaine passée ou en cours.');
      const clock=now(),today=new Date(clock);today.setUTCHours(0,0,0,0);today.setUTCDate(today.getUTCDate()-(today.getUTCDay()+6)%7);
      const weekStart=today.getTime()+offset*7*DAY,weekEnd=weekStart+7*DAY,all=read().activities.filter(a=>a.userId===c.user.id&&a.orgId===c.org.id&&a.at<=clock);
      const selected=all.filter(a=>a.at>=weekStart&&a.at<weekEnd),previous=all.filter(a=>a.at>=weekStart-7*DAY&&a.at<weekStart);
      const distanceMeters=selected.reduce((s,a)=>s+a.distanceMeters,0),previousDistanceMeters=previous.reduce((s,a)=>s+a.distanceMeters,0),totalDistanceMeters=all.reduce((s,a)=>s+a.distanceMeters,0);
      const weeks=Math.max(1,Math.ceil((clock-Math.min(clock,...all.map(a=>a.at)))/7/DAY));
      return clone({weekStart,weekEnd,distanceMeters,energy:selected.reduce((s,a)=>s+a.energy,0),previousDistanceMeters,evolutionPct:previousDistanceMeters>0?(distanceMeters-previousDistanceMeters)/previousDistanceMeters*100:null,weeklyAverageMeters:totalDistanceMeters/weeks,totalDistanceMeters,totalEnergy:all.reduce((s,a)=>s+a.energy,0),days:Array.from({length:7},(_,i)=>{const stamp=weekStart+i*DAY,activities=selected.filter(a=>a.at>=stamp&&a.at<stamp+DAY);return {date:stamp,distanceMeters:activities.reduce((s,a)=>s+a.distanceMeters,0),energy:activities.reduce((s,a)=>s+a.energy,0)};}),activities:selected.map(a=>visibleActivity(a,c))});
    },
    directory() { return global.Demo.directory(); },
    events() {const c=session();return clone(read().events.filter(e=>eventVisible(e,c)).sort((a,b)=>a.startsAt-b.startsAt));},
    createEvent(input={}) {const c=session();return change('event',d=>{
      if(!['public','company','private'].includes(input.visibility))fail('Choisissez la visibilité de l’événement.');
      const startsAt=eventDate(input.date,input.time);if(startsAt<=now())fail('Choisissez une date de départ dans le futur.');
      const distanceMeters=Number(input.distanceMeters);if(!Number.isFinite(distanceMeters)||distanceMeters<=0||distanceMeters>1000000)fail('La distance doit être comprise entre 1 et 1 000 000 mètres.');
      const capacity=input.capacity==null||input.capacity===''?null:Number(input.capacity);if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>100000))fail('Le nombre de participants doit être un entier positif.');
      const people=new Set(global.Demo.directory().map(u=>u.id));
      const invitedUserIds=input.visibility==='private'?[...new Set(input.invitedUserIds||[])].filter(id=>id!==c.user.id):[];
      if(invitedUserIds.some(id=>!people.has(id)))fail('Choisissez les invités parmi les comptes actifs inscrits.');
      const event={id:uid('event'),name:required(input.name,'le nom de l’événement',120),description:clean(input.description,1500),startPoint:required(input.startPoint,'le départ',160),endPoint:required(input.endPoint,'l’arrivée',160),orgId:c.org.id,organizerId:c.user.id,organizerName:c.user.name,startsAt,distanceMeters,capacity,visibility:input.visibility,invitedUserIds,participantIds:[c.user.id],createdAt:now()};
      d.events.push(event);return event;
    });},
    joinEvent(id) {const c=session();return change('event-join',d=>{const e=getEvent(d,id,c);if(e.startsAt<=now())fail('Cet événement a déjà commencé.');if(e.participantIds.includes(c.user.id))return e;if(e.capacity!==null&&e.participantIds.length>=e.capacity)fail('Cet événement est complet.');e.participantIds.push(c.user.id);return e;});},
    leaveEvent(id) {const c=session();return change('event-leave',d=>{const e=getEvent(d,id,c);if(e.organizerId===c.user.id)fail('L’organisateur reste inscrit à son événement.');e.participantIds=e.participantIds.filter(id=>id!==c.user.id);return e;});},
    onChange(fn) {if(typeof fn!=='function')fail('Gestionnaire invalide.');listeners.add(fn);return()=>listeners.delete(fn);}
  };
  global.Platform=Object.freeze(Platform);
  global.addEventListener?.('storage',event=>{if(event.key===KEY||event.key===null)emit('storage');});
  global.Demo.onChange(event=>{if(event.type==='reset'){global.localStorage.removeItem(KEY);emit('reset');}else emit('identity');});
})(window);
