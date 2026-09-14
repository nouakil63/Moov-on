/* Presentation shell. Identity, email codes and SSO are deliberately simulated. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params=new URLSearchParams(location.search);
  const ADMIN_URL='https://moov-on-vert.vercel.app/admin.html';
  let selectedOrg=Demo.getInvitation(params.get('invite'))?.orgId||Demo.orgs().find(o=>o.id===params.get('org'))?.id||'corelis';
  let loginEmail='',step='email',lastContext='',installPrompt;
  const personas=[
    {orgId:'corelis',email:'camille@corelis.fr',name:'Camille',role:'Salariée',initials:'CR'},
    {orgId:'corelis',email:'lea@corelis.fr',name:'Léa',role:'Responsable RSE',initials:'LF'},
    {orgId:'nova',email:'alex@nova-conseil.fr',name:'Alex',role:'Salarié',initials:'AM'},
    {orgId:'nova',email:'sarah@nova-conseil.fr',name:'Sarah',role:'Administratrice',initials:'SB'}
  ];
  function error(message){const el=$('auth-error');if(el){el.textContent=message;el.hidden=false;}else MoovApp.toast(message);}
  function logo(org,cls='org-mark'){
    return org.logo&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(org.logo)
      ?`<span class="${cls}"><img src="${escape(org.logo)}" alt="Logo ${escape(org.name)}"></span>`
      :`<span class="${cls}">${escape(org.shortName?.slice(0,1)||org.name.slice(0,1))}<i>↗</i></span>`;
  }
  function textColor(hex){const rgb=hex.replace('#','').match(/.{2}/g)?.map(n=>parseInt(n,16))||[21,67,183];const l=rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});return .2126*l[0]+.7152*l[1]+.0722*l[2]>.179?'#0A142B':'#FFFFFF';}
  function applyBrand(org){
    const root=document.documentElement.style;
    root.setProperty('--brand',org.color);root.setProperty('--brand-ink',textColor(org.color));
    root.setProperty('--brand-dim',org.color);root.setProperty('--brand-panel',org.accent||org.color);
    root.setProperty('--accent',org.accent||'#B6E694');
    document.querySelector('meta[name="theme-color"]').content=org.color;
  }
  function renderLogin(){
    if(Demo.current())return;
    const org=Demo.org(selectedOrg)||Demo.orgs()[0];selectedOrg=org.id;applyBrand(org);
    $('experience').hidden=true;$('auth-root').hidden=false;document.body.classList.remove('signed-in');
    $('auth-root').innerHTML=`<div class="login-layout">
      <section class="login-story"><a class="moov-wordmark" href="./index.html" aria-label="Moov’On accueil">moov<span>’</span>on<i>↗</i></a>
        <span class="eyebrow">LE MOUVEMENT QUI NOUS RASSEMBLE</span>
        <h1>Chaque pas.<br>Un impact<span>.</span></h1>
        <p>Bougez ensemble. Soutenez les causes qui comptent. Faites vivre l’énergie de votre entreprise.</p>
        <div class="login-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="energy-ticket"><small>VOTRE ÉNERGIE DEVIENT</small><strong>du concret.</strong><span>⚡ des pas → des projets solidaires</span></div><span class="floating-note">+ 5 200 ⚡<small>Une sortie. Un élan collectif.</small></span><span class="art-leaf">↗</span></div>
        <div class="login-proof"><span><b>01</b> Je bouge</span><span><b>02</b> Je partage</span><span><b>03</b> Je contribue</span></div>
        <small class="login-foot">Une expérience privée, aux couleurs de votre entreprise.</small>
      </section>
      <section class="login-card" aria-label="Rejoindre mon entreprise"><div class="demo-pill"><i></i> Présentation interactive</div>
        <div class="org-choice" role="group" aria-label="Entreprise de démonstration">${Demo.orgs().map(o=>`<button data-org="${escape(o.id)}" aria-pressed="${o.id===org.id}">${escape(o.shortName)}</button>`).join('')}</div>
        <div class="login-org">${logo(org)}<div><span>VOTRE ESPACE ENTREPRISE</span><strong>${escape(org.name)}</strong></div></div>
        <div id="auth-content"></div><p id="auth-error" role="alert" hidden></p>
        <div class="demo-personas"><div class="minor-title">EXPLORER AVEC UN PROFIL DE DÉMONSTRATION</div><div class="persona-grid">${personas.filter(p=>p.orgId===org.id).map(p=>`<button data-persona="${p.email}" data-company="${p.orgId}"><span class="persona-avatar">${p.initials}</span><span><b>${p.name}</b><small>${p.role}</small></span><i>↗</i></button>`).join('')}</div></div>
        <div class="auth-disclosure">Connexion simulée · aucun e-mail envoyé.<br>Les modifications sont conservées dans ce navigateur.</div>
      </section></div>`;
    $('auth-root').querySelectorAll('[data-org]').forEach(b=>b.onclick=()=>{selectedOrg=b.dataset.org;step='email';loginEmail='';renderLogin();});
    $('auth-root').querySelectorAll('[data-persona]').forEach(b=>b.onclick=()=>login(b.dataset.persona,b.dataset.company));
    renderStep();
  }
  function renderStep(){
    const org=Demo.org(selectedOrg),content=$('auth-content');if(!content)return;
    if(params.get('invite')&&step==='email'){
      const invitation=Demo.getInvitation?.(params.get('invite'));
      content.innerHTML=`<h2>Vous êtes invité·e.</h2><p>Rejoignez votre équipe et donnez une nouvelle dimension à vos activités.</p>${invitation?`<p class="invite-recipient">${escape(invitation.email||invitation.user?.email||'Invitation nominative')}</p>`:''}<button id="accept-invite" class="shell-primary">Accepter l’invitation</button><button id="back-login" class="text-button">Utiliser un autre compte</button>`;
      $('accept-invite').onclick=()=>{try{const user=Demo.acceptInvite(params.get('invite'));params.delete('invite');history.replaceState(null,'',location.pathname);login(user.email,user.orgId);}catch(e){error(e.message);}};
      $('back-login').onclick=()=>{params.delete('invite');renderStep();};return;
    }
    if(step==='email'){
      content.innerHTML=`<h2>Ensemble, on va<br>plus loin.</h2><p>Connectez-vous à votre espace pour retrouver vos collègues et vos missions.</p><form id="login-form"><label for="work-email">Adresse e-mail professionnelle</label><input id="work-email" type="email" autocomplete="email" placeholder="prenom@${escape(org.domain)}" required value="${escape(loginEmail)}"><button class="shell-primary">Continuer par e-mail <span>→</span></button></form><div class="or-line"><span>ou avec votre compte professionnel</span></div><button id="sso-login" class="sso-button"><span class="microsoft-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Se connecter avec mon entreprise</button>`;
      $('login-form').onsubmit=e=>{e.preventDefault();loginEmail=$('work-email').value.trim().toLowerCase();step='code';renderStep();};
      $('sso-login').onclick=()=>{loginEmail=$('work-email').value.trim().toLowerCase()||personas.find(p=>p.orgId===selectedOrg)?.email||'';if(!loginEmail){error('Indiquez votre adresse professionnelle pour continuer.');return;}step='sso';renderStep();};
    }else if(step==='code'){
      content.innerHTML=`<button class="text-button" id="back-login">← Changer d’adresse</button><h2>Votre équipe<br>vous attend.</h2><p>Code de connexion pour <b>${escape(loginEmail)}</b>.</p><div class="demo-code">POUR CETTE DÉMONSTRATION <strong>123456</strong><span>Aucun code n’est envoyé par e-mail.</span></div><form id="verify-form"><label for="email-code">Code à 6 chiffres</label><input id="email-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••"><button class="shell-primary">Rejoindre mon espace →</button></form><button id="resend-code" class="text-button">Afficher à nouveau le code</button>`;
      $('verify-form').onsubmit=e=>{e.preventDefault();if($('email-code').value!=='123456')return error('Le code de démonstration est 123456.');login(loginEmail,selectedOrg);};
      $('resend-code').onclick=()=>{ $('email-code').value='123456';$('email-code').focus();};
      $('back-login').onclick=()=>{step='email';renderStep();};$('email-code').focus();
    }else{
      content.innerHTML=`<button class="text-button" id="back-login">← Revenir à la connexion</button><div class="sso-preview"><span class="sso-lock">↗</span><h2>Votre compte<br>professionnel.</h2><p>Connexion d’entreprise — simulation</p><strong>${escape(loginEmail)}</strong><p>En production, votre entreprise validera cette connexion avec son fournisseur d’identité.</p><button id="sso-confirm" class="shell-primary">Continuer avec ce compte →</button></div>`;
      $('sso-confirm').onclick=()=>login(loginEmail,selectedOrg);$('back-login').onclick=()=>{step='email';renderStep();};
    }
    if($('auth-error'))$('auth-error').hidden=true;
  }
  function login(email,orgId){
    try{Demo.login({email,orgId});if(params.get('portal')&&Demo.canAdmin())location.href=ADMIN_URL;else sync();}catch(e){error(e.message);}
  }
  function switchProfile(email,orgId){MoovApp.stop();document.querySelectorAll('dialog[open]').forEach(d=>d.close());login(email,orgId);MoovApp.goHome();}
  function controls(suffix="rail"){const c=Demo.current();return `<details class="presenter-controls"><summary>Outils de présentation</summary><p>Changer de profil pour explorer les parcours.</p><label for="demo-persona-${suffix}">Profil de démonstration</label><select id="demo-persona-${suffix}">${(!personas.some(p=>p.email===c.user.email)&&c.user.role!=='platform')?`<option selected value="${escape(c.user.email)}|${escape(c.org.id)}">${escape(c.user.name)} · Profil actuel</option>`:''}${personas.map(p=>`<option value="${p.email}|${p.orgId}" ${p.email===c.user.email?'selected':''}>${p.name} · ${p.role} · ${Demo.org(p.orgId).shortName}</option>`).join('')}<option value="hello@moovon.demo|corelis" ${c.user.role==='platform'?'selected':''}>Équipe Moov’On · Administration</option></select><button class="shell-secondary" data-switch>Ouvrir ce profil</button>${Demo.canAdmin()?'<a href="admin.html#presentation">Horloge et remise à zéro →</a>':''}<small>Les profils de présentation sont fictifs.</small></details>`;}
  function renderChrome(){
    const c=Demo.current();if(!c)return;
    $('tenant-strip').innerHTML=`<button id="mobile-account" class="tenant-identity" aria-label="Compte et espace entreprise">${logo(c.org)}<span>${escape(c.org.shortName)}<small>${escape(c.org.program)}</small></span><i>⌄</i></button><span class="live-label">DÉMO</span>`;
    $('demo-rail').innerHTML=`<a class="moov-wordmark" href="./index.html">moov<span>’</span>on<i>↗</i></a><div class="rail-heading"><span class="eyebrow">VOTRE COLLECTIF</span><h2>On avance<br>ensemble.</h2><p>Chaque mouvement fait grandir l’impact de ${escape(c.org.shortName)}.</p></div><div class="rail-company">${logo(c.org)}<div><b>${escape(c.org.name)}</b><small>${escape(c.org.program)}</small></div></div><nav class="rail-nav" aria-label="Espaces"><a class="selected" href="./index.html"><span>◉</span> Application salarié <i>↗</i></a><a class="rail-admin" href="admin.html" aria-label="Espace administrateur — nouvel onglet"><span aria-hidden="true">▦</span><div><b>Espace administrateur</b><small>Missions, équipes et budget</small></div><i aria-hidden="true">↗</i></a><button data-account><span>◎</span> Mon compte <i>↗</i></button><button data-install><span>↓</span> Installer sur mon téléphone</button></nav>${controls()}<div class="rail-bottom"><span class="demo-pill"><i></i> Maquette de présentation</span><p>Stories, comptes et personnalisation<br>à explorer en direct.</p><button class="text-button" data-logout>Se déconnecter →</button></div>`;
    $('profile-account').innerHTML=`<div class="account-actions"><button data-account>Mon compte et mon entreprise <span>→</span></button>${Demo.canAdmin()?'<a href="admin.html">Ouvrir le portail entreprise <span>↗</span></a>':''}<button data-install>Installer l’application <span>↓</span></button><button data-logout>Se déconnecter</button></div>`;
    $('mobile-account').onclick=openAccount;
    wireChrome($('demo-rail'));wireChrome($('profile-account'));
  }
  function wireChrome(root){
    root.querySelectorAll('a[href="admin.html"]').forEach(a=>{a.href=ADMIN_URL;a.target='_blank';a.rel='noopener noreferrer';});
    root.querySelectorAll('[data-account]').forEach(b=>b.onclick=openAccount);
    root.querySelectorAll('[data-logout]').forEach(b=>b.onclick=logout);
    root.querySelectorAll('[data-install]').forEach(b=>b.onclick=showInstall);
    root.querySelectorAll('[data-switch]').forEach(b=>b.onclick=()=>{const v=root.querySelector('select').value.split('|');switchProfile(...v);});
  }
  function logout(){MoovApp.stop();document.querySelectorAll('dialog[open]').forEach(d=>d.close());Demo.logout();step='email';lastContext='';sync();}
  function makeDialog(id){let d=$(id);if(!d){d=document.createElement('dialog');d.id=id;d.className='app-dialog';document.body.append(d);d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});}return d;}
  function openAccount(){
    const c=Demo.current();if(!c)return;
    const d=makeDialog('account-dialog');
    d.innerHTML=`<div class="dialog-top"><span class="eyebrow">VOTRE ESPACE</span><button data-close aria-label="Fermer">×</button></div><div class="login-org">${logo(c.org)}<div><strong>${escape(c.org.name)}</strong><small>${escape(c.user.email)}</small></div></div><h2>Bonjour ${escape(c.user.name.split(' ')[0])}.</h2><form id="profile-form"><label for="profile-name">Votre nom</label><input id="profile-name" value="${escape(c.user.name)}" maxlength="70" required><label for="profile-team">Votre équipe</label><input id="profile-team" value="${escape(c.user.team)}" readonly><button class="shell-primary">Enregistrer mon profil</button><p class="form-feedback" role="status"></p></form>${Demo.canAdmin()?'<a class="portal-cta" href="admin.html">Ouvrir le portail entreprise ↗</a>':''}${controls('account')}<button class="text-button" data-logout>Se déconnecter</button>`;
    d.querySelector('[data-close]').onclick=()=>d.close();wireChrome(d);
    d.querySelector('form').onsubmit=e=>{e.preventDefault();try{Demo.updateProfile({name:$('profile-name').value.trim()});d.querySelector('.form-feedback').textContent='Votre profil a été enregistré.';}catch(e){d.querySelector('.form-feedback').textContent=e.message;}};
    d.showModal();
  }
  async function showInstall(){
    if(installPrompt){await installPrompt.prompt();installPrompt=null;return;}
    const d=makeDialog('install-dialog');
    d.innerHTML=`<div class="dialog-top"><span class="eyebrow">MOOV’ON VOUS ACCOMPAGNE</span><button data-close aria-label="Fermer">×</button></div><h2>Votre collectif.<br>Dans votre poche.</h2><p>Cette maquette peut être ajoutée à l’écran d’accueil depuis un lien HTTPS ouvert sur votre téléphone.</p><div class="install-step"><b>Sur iPhone</b><p>Ouvrez le lien dans Safari → Partager → Sur l’écran d’accueil.</p></div><div class="install-step"><b>Sur Android</b><p>Ouvrez le lien dans Chrome → menu ⋮ → Ajouter à l’écran d’accueil ou Installer l’application.</p></div><p class="install-future">Version de présentation web. La publication sur l’App Store et Google Play sera préparée pour la version de production.</p><button class="shell-primary" data-copy-link>Copier le lien de la maquette</button><p class="form-feedback" role="status"></p>`;
    d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-copy-link]').onclick=async()=>{const feedback=d.querySelector('.form-feedback');if(['127.0.0.1','localhost'].includes(location.hostname)){feedback.textContent='Cette adresse est locale. Pour un téléphone, utilisez une version hébergée en HTTPS.';return;}try{await navigator.clipboard.writeText(location.origin+location.pathname);feedback.textContent='Lien copié.';}catch{feedback.textContent='Copiez l’adresse affichée dans votre navigateur.';}};d.showModal();
  }
  function sync(){
    const c=Demo.current();
    if(!c){MoovApp.stop();document.querySelectorAll('dialog[open]').forEach(d=>d.close());lastContext='';renderLogin();return;}
    $('auth-root').hidden=true;$('experience').hidden=false;document.body.classList.add('signed-in');
    applyBrand(c.org);
    const key=JSON.stringify([c.user,c.org,new Date(Demo.now()).toDateString()]);
    if(key!==lastContext){lastContext=key;MoovApp.init();renderChrome();}
    window.MoovStories?.render();
  }
  const fast=document.createElement('button');fast.id='run-fast-forward';fast.className='run-forward';fast.textContent='Présentation : avancer de 1 km';fast.onclick=()=>MoovApp.fastForward();$('btn-pause').parentElement.before(fast);
  $('run-clock-chip').textContent='Simulation ×18';$('btn-discard').textContent='Enregistrer sans publier';
  document.querySelector('#sum-overlay .sum-impact p').textContent='Votre énergie sera créditée à l’enregistrement, avec ou sans publication.';
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  if(params.has('invite')&&Demo.current())Demo.logout();
  Demo.onChange(sync);sync();
  if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
