/* Moov'On — stockage de démonstration uniquement.
 * Aucun réseau, aucune authentification réelle : les données et contrôles locaux
 * sont modifiables par l'utilisateur. Ne pas employer ce module en production. */
(function (global) {
  'use strict';

  const KEY = 'moovon:demo:v1';
  const SESSION_KEY = 'moovon:demo:session:v1';
  const DAY = 86400000;
  const listeners = new Set();
  let sequence = 0;
  const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const uid = prefix => prefix + '_' + (global.crypto && global.crypto.randomUUID
    ? global.crypto.randomUUID() : Date.now().toString(36) + '_' + (++sequence) + '_' + Math.random().toString(36).slice(2));
  const emailOf = value => String(value || '').trim().toLowerCase();
  const str = (value, max = 120) => String(value == null ? '' : value).trim().slice(0, max);
  const clock = data => Date.now() + data.clockOffsetMs;
  const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const validDomain = value => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
  const validMedia = value => typeof value === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value);

  function seed() {
    const time = Date.now();
    const organizations = [
      {id:'corelis', name:'Banque Corélis', shortName:'Corélis', program:'Corélis en mouvement', color:'#1543B7', accent:'#EFAD42', logo:'', domain:'corelis.fr', teams:['Marketing','Finance','RH','IT & Data'], monthlyGoal:20000000},
      {id:'nova', name:'Nova Conseil', shortName:'Nova', program:'Nova en mouvement', color:'#7254CC', accent:'#EE9C72', logo:'', domain:'nova-conseil.fr', teams:['Conseil','Audit','RH'], monthlyGoal:12000000}
    ];
    const users = [
      {id:'camille',orgId:'corelis',name:'Camille Roux',email:'camille@corelis.fr',team:'Marketing',role:'employee',status:'active'},
      {id:'lea',orgId:'corelis',name:'Léa Fontaine',email:'lea@corelis.fr',team:'RH',role:'admin',status:'active'},
      {id:'sofiane',orgId:'corelis',name:'Sofiane B.',email:'sofiane@corelis.fr',team:'Finance',role:'employee',status:'active'},
      {id:'alex',orgId:'nova',name:'Alex Morgan',email:'alex@nova-conseil.fr',team:'Conseil',role:'employee',status:'active'},
      {id:'sarah',orgId:'nova',name:'Sarah Benali',email:'sarah@nova-conseil.fr',team:'RH',role:'admin',status:'active'},
      {id:'platform',orgId:'corelis',name:'Équipe Moov’On',email:'hello@moovon.demo',team:'RH',role:'platform',status:'active'}
    ];
    const story = (id,orgId,userId,text,bg,hoursAgo) => ({id,orgId,userId,type:'text',text,media:'',bg,publishedAt:time-hoursAgo*3600000,expiresAt:time+(24-hoursAgo)*3600000,status:'active'});
    return {version:1,clockOffsetMs:0,organizations,users,invitations:[],reports:[],seen:{},stories:[
      story('story-corelis-1','corelis','camille','Pause déjeuner dehors : 3 km et le plein d’énergie ☀️','#1543B7',1),
      story('story-corelis-2','corelis','lea','Demain, on marche ensemble ? Rendez-vous à 12 h 30 devant l’accueil.','#17645B',3),
      story('story-corelis-old','corelis','sofiane','Hier : une belle sortie avec l’équipe Finance.','#8B4D32',26),
      story('story-nova-1','nova','alex','Première sortie de la semaine : chaque mètre compte !','#7254CC',2),
      story('story-nova-2','nova','sarah','Bravo à l’équipe Conseil pour son engagement 💜','#634885',4)
    ]};
  }

  function read() {
    let raw;
    try { raw = global.localStorage.getItem(KEY); }
    catch (_) { fail('Le stockage local est indisponible. Autorisez-le pour utiliser la démonstration.'); }
    if (raw === null) {
      const initial = seed();
      save(initial);
      return initial;
    }
    let data;
    try { data = JSON.parse(raw); } catch (_) { fail('Les données de démonstration sont illisibles. Réinitialisez la démonstration.'); }
    if (!data || data.version !== 1 || !Array.isArray(data.organizations) || !Array.isArray(data.users) || !Array.isArray(data.stories) || !Array.isArray(data.invitations) || !Array.isArray(data.reports) || !data.seen || !Number.isFinite(data.clockOffsetMs)) {
      fail('Les données de démonstration sont incompatibles. Réinitialisez la démonstration.');
    }
    return data;
  }
  function save(data) {
    try { global.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (_) { fail('Enregistrement impossible : stockage local plein ou indisponible. Réduisez la taille des images ou libérez de l’espace. Aucune modification enregistrée.'); }
  }
  function session() {
    try { return JSON.parse(global.sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function writeSession(value) {
    try {
      if (value) global.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else global.sessionStorage.removeItem(SESSION_KEY);
    } catch (_) { fail('La session locale ne peut pas être enregistrée dans cet onglet.'); }
  }
  function currentFrom(data) {
    const active = session();
    if (!active) return null;
    const user = data.users.find(u => u.id === active.userId && u.status === 'active');
    const org = data.organizations.find(o => o.id === active.orgId);
    return user && org && (user.orgId === org.id || user.role === 'platform') ? {org,user} : null;
  }
  function requireSession(data) {
    return currentFrom(data) || fail('Connectez-vous avec un compte actif pour continuer.');
  }
  function access(data, orgId, admin = false) {
    const active = requireSession(data);
    const target = orgId || active.org.id;
    if (!data.organizations.some(o => o.id === target)) fail('Entreprise introuvable.');
    if (active.user.role !== 'platform' && active.org.id !== target) fail('Cet espace appartient à une autre entreprise.');
    if (admin && !['admin','platform'].includes(active.user.role)) fail('Cette action est réservée à un administrateur.');
    return {active,orgId:target};
  }
  function emit(type) {
    for (const listener of listeners) {
      try { listener({type}); } catch (error) { if (global.console) global.console.warn('Actualisation de la démonstration :', error); }
    }
  }
  function change(type, action) {
    const draft = read();
    const result = action(draft);
    save(draft); // Commit before notifying; a quota failure keeps the previous state.
    emit(type);
    return copy(result);
  }
  function getStory(data, id, includeExpired = false) {
    const story = data.stories.find(s => s.id === id);
    if (!story) fail('Story introuvable.');
    const {active} = access(data, story.orgId);
    if (!includeExpired && (story.status !== 'active' || story.expiresAt <= clock(data))) fail('Cette story a expiré ou a été retirée.');
    return {story,active};
  }
  function safeRole(role) {
    if (!['employee','admin'].includes(role)) fail('Choisissez le rôle salarié ou administrateur.');
    return role;
  }
  function image(value, allowEmpty) {
    if (allowEmpty && !value) return '';
    if (!validMedia(value)) fail('Choisissez une image PNG, JPEG, WebP ou GIF valide.');
    if (value.length > 1200000) fail('Cette image est trop volumineuse pour la démonstration.');
    return value;
  }

  const Demo = {
    current() { return copy(currentFrom(read())); },
    orgs() { return copy(read().organizations); },
    org(id) { return copy(read().organizations.find(o => o.id === id) || null); },
    users(orgId) {
      const data = read(), target = access(data,orgId).orgId;
      return copy(data.users.filter(u => u.orgId === target));
    },
    login({email,orgId} = {}) {
      const data = read();
      const normalized = emailOf(email);
      const user = data.users.find(u => u.email === normalized && (u.orgId === orgId || u.role === 'platform'));
      const org = data.organizations.find(o => o.id === orgId);
      if (!user || !org) fail('Ce compte de démonstration est inconnu dans cette entreprise.');
      if (user.status === 'suspended') fail('Ce compte a été suspendu. Contactez votre administrateur.');
      if (user.status !== 'active') fail('Acceptez votre invitation avant de vous connecter.');
      writeSession({userId:user.id,orgId:org.id});
      emit('login');
      return copy({org,user});
    },
    logout() { writeSession(null); emit('logout'); },
    canAdmin() { const active = currentFrom(read()); return !!active && ['admin','platform'].includes(active.user.role); },
    createOrg({name,shortName,domain,color = '#1543B7',accent = '#EFAD42',program,adminName,adminEmail,teams = ['Direction','Équipes']} = {}) {
      return change('organization-created', data => {
        if (requireSession(data).user.role !== 'platform') fail('La création d’entreprise est réservée à l’équipe Moov’On.');
        const displayName = str(name), short = str(shortName || name,60), normalizedDomain = emailOf(domain);
        const ownerName = str(adminName), ownerEmail = emailOf(adminEmail);
        if (!displayName || !short) fail('Renseignez le nom de l’entreprise.');
        if (!validDomain(normalizedDomain)) fail('Le domaine de l’entreprise est invalide.');
        if (data.organizations.some(o => o.domain === normalizedDomain)) fail('Une entreprise utilise déjà ce domaine.');
        if (!validColor(color) || !validColor(accent)) fail('Utilisez des couleurs au format #RRGGBB.');
        if (!ownerName) fail('Renseignez le nom de l’administrateur.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) fail('Renseignez une adresse e-mail administrateur valide.');
        if (data.users.some(u => u.role === 'platform' && u.email === ownerEmail)) fail('Cette adresse est réservée à l’équipe Moov’On.');
        if (!Array.isArray(teams)) fail('La liste des équipes est invalide.');
        const teamList = [...new Set(teams.map(t => str(t,60)).filter(Boolean))];
        if (!teamList.length || teamList.length > 30) fail('Renseignez entre 1 et 30 équipes.');
        const base = short.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'entreprise';
        let id = base, suffix = 2;
        while (data.organizations.some(o => o.id === id)) id = base + '-' + suffix++;
        const org = {id,name:displayName,shortName:short,program:str(program || short+' en mouvement'),color,accent,logo:'',domain:normalizedDomain,teams:teamList,monthlyGoal:20000000};
        const user = {id:uid('user'),orgId:id,name:ownerName,email:ownerEmail,team:teamList[0],role:'admin',status:'active'};
        data.organizations.push(org); data.users.push(user);
        return {org,user};
      });
    },
    updateOrg(id,patch = {}) {
      return change('organization', data => {
        access(data,id,true);
        const org = data.organizations.find(o => o.id === id);
        for (const key of ['name','shortName','program']) if (Object.hasOwn(patch,key)) {
          const value = str(patch[key]);
          if (!value) fail('Le nom et le programme doivent être renseignés.');
          org[key] = value;
        }
        for (const key of ['color','accent']) if (Object.hasOwn(patch,key)) {
          if (!validColor(patch[key])) fail('Utilisez une couleur au format #RRGGBB.');
          org[key] = patch[key];
        }
        if (Object.hasOwn(patch,'logo')) org.logo = image(patch.logo,true);
        if (Object.hasOwn(patch,'domain')) {
          const value = emailOf(patch.domain);
          if (!validDomain(value)) fail('Le domaine de l’entreprise est invalide.');
          if (data.organizations.some(o => o.id !== id && o.domain === value)) fail('Une entreprise utilise déjà ce domaine.');
          org.domain = value;
        }
        if (Object.hasOwn(patch,'monthlyGoal')) {
          const goal = Number(patch.monthlyGoal);
          if (!Number.isSafeInteger(goal) || goal <= 0) fail('L’objectif mensuel doit être un entier positif.');
          org.monthlyGoal = goal;
        }
        if (Object.hasOwn(patch,'teams')) {
          if (!Array.isArray(patch.teams)) fail('La liste des équipes est invalide.');
          const teams = [...new Set(patch.teams.map(t => str(t,60)).filter(Boolean))];
          if (!teams.length || teams.length > 30) fail('Renseignez entre 1 et 30 équipes.');
          if (data.users.some(u => u.orgId === id && !teams.includes(u.team))) fail('Une équipe utilisée par un membre ne peut pas être retirée.');
          org.teams = teams;
        }
        return org;
      });
    },
    invite(orgId,{name,email,team,role = 'employee'} = {}) {
      return change('invitation', data => {
        access(data,orgId,true);
        const org = data.organizations.find(o => o.id === orgId);
        const normalized = emailOf(email), displayName = str(name);
        if (!displayName) fail('Renseignez le nom du collaborateur.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail('Renseignez une adresse e-mail valide.');
        if (!org.teams.includes(team)) fail('Choisissez une équipe de cette entreprise.');
        if (data.users.some(u => u.orgId === orgId && u.email === normalized)) fail('Cette adresse possède déjà un compte dans cette entreprise.');
        if (data.users.some(u => u.role === 'platform' && u.email === normalized)) fail('Cette adresse est réservée à l’équipe Moov’On.');
        const user = {id:uid('user'),orgId,name:displayName,email:normalized,team,role:safeRole(role),status:'invited'};
        const createdAt = clock(data);
        const invite = {id:uid('invite'),orgId,userId:user.id,email:normalized,token:uid('invitation'),createdAt,expiresAt:createdAt+7*DAY,status:'pending'};
        data.users.push(user); data.invitations.push(invite);
        return {user,invite};
      });
    },
    acceptInvite(token) {
      return change('invitation-accepted', data => {
        const invitation = data.invitations.find(i => i.token === token);
        if (!invitation || invitation.status !== 'pending') fail('Cette invitation est invalide ou a déjà été utilisée.');
        if (invitation.expiresAt <= clock(data)) fail('Cette invitation a expiré. Contactez votre administrateur.');
        const user = data.users.find(u => u.id === invitation.userId && u.orgId === invitation.orgId);
        if (!user || user.status !== 'invited') fail('Ce compte ne peut plus accepter cette invitation.');
        user.status = 'active'; invitation.status = 'accepted'; invitation.acceptedAt = clock(data);
        return user;
      });
    },
    getInvitation(token) {
      const data = read();
      const invitation = data.invitations.find(i => i.token === token);
      if (!invitation) return null;
      const user = data.users.find(u => u.id === invitation.userId);
      const org = data.organizations.find(o => o.id === invitation.orgId);
      if (!user || !org) return null;
      return {orgId:org.id,orgName:org.name,name:user.name,email:invitation.email,status:invitation.status === 'pending' && invitation.expiresAt <= clock(data) ? 'expired' : invitation.status,expiresAt:invitation.expiresAt};
    },
    invitations(orgId) {
      const data = read(), target = access(data,orgId,true).orgId;
      return copy(data.invitations.filter(i => i.orgId === target));
    },
    setUserStatus(userId,status) {
      return change('user-status', data => {
        const user = data.users.find(u => u.id === userId);
        if (!user) fail('Collaborateur introuvable.');
        const {active} = access(data,user.orgId,true);
        if (!['active','suspended'].includes(status)) fail('Choisissez le statut actif ou suspendu.');
        if (user.id === active.user.id) fail('Vous ne pouvez pas modifier votre propre statut.');
        if (user.role === 'platform') fail('Le compte Moov’On ne peut pas être modifié ici.');
        if (status === 'active' && user.status === 'invited') fail('Le collaborateur doit d’abord accepter son invitation.');
        user.status = status;
        if (status === 'suspended') data.invitations.filter(i => i.userId === userId && i.status === 'pending').forEach(i => {i.status = 'revoked';});
        return user;
      });
    },
    updateProfile(patch = {}) {
      return change('profile', data => {
        const {user,org} = requireSession(data);
        if (Object.hasOwn(patch,'name')) {
          const name = str(patch.name);
          if (!name) fail('Renseignez votre nom.');
          user.name = name;
        }
        if (Object.hasOwn(patch,'team')) {
          if (user.orgId !== org.id) fail('Votre profil appartient à votre entreprise d’origine.');
          if (!org.teams.includes(patch.team)) fail('Choisissez une équipe de votre entreprise.');
          user.team = patch.team;
        }
        return user;
      });
    },
    reset() {
      const keys = [];
      try {
        for (let i = 0; i < global.localStorage.length; i++) {
          const key = global.localStorage.key(i);
          if (key && key.startsWith('moovon:app:v2:')) keys.push(key);
        }
      } catch (_) { fail('Le stockage local est indisponible.'); }
      save(seed());
      try { keys.forEach(key => global.localStorage.removeItem(key)); }
      catch (_) { fail('Les données de l’application ne peuvent pas être effacées. Réessayez la réinitialisation.'); }
      writeSession(null); emit('reset');
    },
    onChange(fn) {
      if (typeof fn !== 'function') fail('Le gestionnaire de changement doit être une fonction.');
      listeners.add(fn); return () => listeners.delete(fn);
    },
    now() { return clock(read()); },
    advanceHours(n) {
      if (!Number.isFinite(n) || n < 0 || n > 8760) fail('Indiquez une durée entre 0 et 8 760 heures.');
      return change('clock', data => { requireSession(data); data.clockOffsetMs += n*3600000; return clock(data); });
    },
    getStories(orgId, {includeExpired = false} = {}) {
      const data = read(), target = access(data,orgId,includeExpired).orgId;
      return copy(data.stories.filter(s => s.orgId === target && s.status === 'active' && (includeExpired || s.expiresAt > clock(data))).sort((a,b) => b.publishedAt-a.publishedAt));
    },
    createStory({type = 'text',text = '',media = '',bg = '#1543B7'} = {}) {
      return change('story', data => {
        const {user,org} = requireSession(data);
        if (!['text','photo'].includes(type)) fail('Choisissez une story texte ou photo.');
        const caption = String(text).trim();
        if (caption.length > 1000) fail('Une story peut contenir au maximum 1 000 caractères.');
        if (type === 'text' && !caption) fail('Écrivez un message pour votre story.');
        if (!validColor(bg)) fail('Choisissez une couleur de fond valide.');
        const publishedAt = clock(data);
        const story = {id:uid('story'),orgId:org.id,userId:user.id,type,text:caption,media:type === 'photo' ? image(media,false) : '',bg,publishedAt,expiresAt:publishedAt+DAY,status:'active'};
        data.stories.push(story); return story;
      });
    },
    deleteStory(id) {
      return change('story-deleted', data => {
        const {story,active} = getStory(data,id,true);
        if (story.userId !== active.user.id && !['admin','platform'].includes(active.user.role)) fail('Vous pouvez retirer uniquement vos propres stories.');
        story.status = 'deleted'; story.deletedAt = clock(data);
        story.media = ''; // Reclaim local image space when a story is removed.
        data.reports.filter(r => r.storyId === id && r.status === 'open').forEach(r => {r.status = 'dismissed'; r.dismissedAt = clock(data);});
        return story;
      });
    },
    reportStory(id,reason) {
      return change('story-reported', data => {
        const {story,active} = getStory(data,id);
        const message = str(reason,500);
        if (!message) fail('Indiquez le motif du signalement.');
        const existing = data.reports.find(r => r.storyId === id && r.userId === active.user.id && r.status === 'open');
        if (existing) fail('Vous avez déjà signalé cette story.');
        const report = {id:uid('report'),orgId:story.orgId,storyId:id,userId:active.user.id,reason:message,status:'open',createdAt:clock(data)};
        data.reports.push(report); return report;
      });
    },
    reports(orgId) {
      const data = read(), target = access(data,orgId,true).orgId;
      return copy(data.reports.filter(r => r.orgId === target).sort((a,b) => b.createdAt-a.createdAt));
    },
    markStorySeen(id) {
      return change('story-seen', data => {
        const {active} = getStory(data,id);
        const key = active.org.id + ':' + active.user.id;
        const seen = data.seen[key] || (data.seen[key] = []);
        if (!seen.includes(id)) seen.push(id);
        return true;
      });
    },
    hasSeenStory(id) {
      const data = read(), {active} = getStory(data,id);
      return (data.seen[active.org.id + ':' + active.user.id] || []).includes(id);
    },
    dismissReport(id) {
      return change('report-dismissed', data => {
        const report = data.reports.find(r => r.id === id);
        if (!report) fail('Signalement introuvable.');
        access(data,report.orgId,true);
        report.status = 'dismissed'; report.dismissedAt = clock(data); return report;
      });
    },
    stats(orgId) {
      const data = read(), target = access(data,orgId,true).orgId;
      const users = data.users.filter(u => u.orgId === target && u.role !== 'platform');
      const stories = data.stories.filter(s => s.orgId === target && s.status === 'active');
      return {users:users.length,activeUsers:users.filter(u=>u.status==='active').length,invitedUsers:users.filter(u=>u.status==='invited').length,suspendedUsers:users.filter(u=>u.status==='suspended').length,activeStories:stories.filter(s=>s.expiresAt>clock(data)).length,expiredStories:stories.filter(s=>s.expiresAt<=clock(data)).length,openReports:data.reports.filter(r=>r.orgId===target && r.status==='open').length};
    }
  };
  global.Demo = Object.freeze(Demo);
  if (global.addEventListener) global.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) emit('storage');
  });
})(window);
