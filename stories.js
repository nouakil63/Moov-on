/* Moov'On presentation stories. Local Demo storage only; no network requests. */
(() => {
  'use strict';
  const D = () => window.Demo;
  const icons = {
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    camera:'<path d="M8 5 9.5 3h5L16 5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12" r="4"/>',
    text:'<path d="M4 5h16M12 5v15M8 20h8"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    left:'<path d="m14 6-6 6 6 6"/>',
    right:'<path d="m10 6 6 6-6 6"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    play:'<path d="m8 5 11 7-11 7Z"/>',
    send:'<path d="m21 3-6 18-4-8-8-4Z"/><path d="m11 13 10-10"/>',
    check:'<path d="m5 12 4 4L19 6"/>'
  };
  const svg = (key, size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]||icons.photo}</svg>`;
  const el = (tag, cls, txt) => { const n=document.createElement(tag); if(cls)n.className=cls; if(txt!==undefined)n.textContent=txt; return n; };
  const byId = id => document.getElementById(id);
  const initials = name => String(name||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const color = value => /^#[a-f0-9]{6}$/i.test(value||'') ? value : '#1746ad';
  const inkFor = value => { const c=color(value).slice(1); const a=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)); return a[0]*.299+a[1]*.587+a[2]*.114>164 ? '#10213b' : '#ffffff'; };
  const photoOK = media => typeof media==='string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(media);
  const number = value => Number(value||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
  const layerFonts={sans:'Arial, sans-serif',serif:'Georgia, serif',hand:'"Comic Sans MS", cursive'};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let sceneObserver=null;
  function watchScene(){
    sceneObserver?.disconnect();
    if(!window.ResizeObserver)return;
    sceneObserver=new ResizeObserver(()=>{
      if(modalMode==='composer')layoutLayers(byId('st-overlay-canvas'),composer?.overlays||[],true);
      else fitReaderScene();
    });
    const target=modalMode==='composer'?byId('st-preview'):byId('st-reader-media');
    if(target)sceneObserver.observe(target);
  }
  // Both editor and reader use the same 9:16 canvas and relative coordinates.
  function layoutLayers(canvas,layers,editable=false){
    if(!canvas?.clientWidth||!canvas.clientHeight)return;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    for(const layer of layers){
      const node=[...canvas.children].find(n=>n.dataset.layerId===layer.id);if(!node)continue;
      node.style.fontFamily=layerFonts[layer.font]||layerFonts.sans;
      node.style.fontSize=width*layer.size+'px';node.style.color=color(layer.color);
      node.style.textAlign=layer.align;node.dataset.background=layer.background;
      node.style.padding=width*.012+'px '+width*.025+'px';
      // Long or multiline text stays completely inside the photo.
      for(let i=0;i<3&&node.offsetHeight>height*.82;i++)node.style.fontSize=parseFloat(node.style.fontSize)*(height*.82/node.offsetHeight)*.96+'px';
      const boundX=Math.min(.5,Math.max(.08,(node.offsetWidth/2+width*.02)/width));
      const boundY=Math.min(.5,Math.max(.08,(node.offsetHeight/2+height*.02)/height));
      const x=clamp(layer.x,boundX,1-boundX),y=clamp(layer.y,boundY,1-boundY);
      if(editable){layer.x=x;layer.y=y;}
      node.style.left=x*100+'%';node.style.top=y*100+'%';
    }
  }
  function drawLayers(canvas,layers,editable=false){
    canvas.replaceChildren();
    for(const layer of layers){
      const node=el(editable?'button':'div','st-text-layer',layer.text);node.dataset.layerId=layer.id;
      if(editable){
        node.type='button';node.setAttribute('aria-label','Modifier le texte : '+layer.text);node.setAttribute('aria-pressed',String(composer.selectedLayer===layer.id));
        let moved=false;
        node.addEventListener('click',()=>{selectLayer(layer.id,!moved);moved=false;});
        node.addEventListener('keydown',event=>{
          const moves={ArrowLeft:[-.015,0],ArrowRight:[.015,0],ArrowUp:[0,-.015],ArrowDown:[0,.015]},move=moves[event.key];
          if(!move)return;event.preventDefault();layer.x=clamp(layer.x+move[0],.08,.92);layer.y=clamp(layer.y+move[1],.08,.92);layoutLayers(canvas,layers,true);
        });
        let drag=null;
        node.addEventListener('pointerdown',event=>{
          if(event.button!==0||composer?.busy)return;
          moved=false;
          drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:layer.x,startY:layer.y};
          node.setPointerCapture(event.pointerId);node.classList.add('st-dragging');
        });
        node.addEventListener('pointermove',event=>{
          if(!drag||drag.pointer!==event.pointerId)return;
          if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)moved=true;
          const rect=canvas.getBoundingClientRect();
          layer.x=clamp(drag.startX+(event.clientX-drag.x)/rect.width,.08,.92);
          layer.y=clamp(drag.startY+(event.clientY-drag.y)/rect.height,.08,.92);
          layoutLayers(canvas,layers,true);
        });
        const release=()=>{drag=null;node.classList.remove('st-dragging');};
        node.addEventListener('pointerup',release);node.addEventListener('pointercancel',release);node.addEventListener('lostpointercapture',release);
      }
      canvas.append(node);
    }
    layoutLayers(canvas,layers,editable);
  }
  function selectedLayer(){return composer?.overlays.find(layer=>layer.id===composer.selectedLayer);}
  function selectLayer(id,focusInput=false){
    if(!composer||composer.busy)return;
    composer.selectedLayer=id;composer.stickersOpen=false;updateLayerTools();
    if(focusInput){byId('st-layer-input').focus({preventScroll:true});byId('st-layer-input').select();byId('st-layer-tools').scrollIntoView({block:'nearest',behavior:'auto'});}
  }
  function addLayer(text='Votre texte'){
    if(!composer||composer.overlays.length>=6||composer.busy)return;
    const layer={id:'layer-'+Date.now()+'-'+composer.nextLayer++,text,x:.5,y:.4+composer.overlays.length*.05,size:.08,color:'#ffffff',background:'none',font:'sans',align:'center'};
    composer.overlays.push(layer);composer.selectedLayer=layer.id;
    drawLayers(byId('st-overlay-canvas'),composer.overlays,true);selectLayer(layer.id,text==='Votre texte');
  }
  function updateLayerTools(){
    if(!composer)return;
    const layer=selectedLayer(),ready=composer.type==='photo'&&!!composer.media;
    byId('st-photo-tools').hidden=!ready;byId('st-layer-tools').hidden=!ready||!layer;
    byId('st-stickers').hidden=!ready||!composer.stickersOpen;
    byId('st-overlay-hint').hidden=!ready||!composer.overlays.length;
    byId('st-overlay-canvas').hidden=!ready;
    byId('st-add-text').disabled=composer.busy||composer.overlays.length>=6;
    byId('st-sticker-toggle').disabled=composer.busy||composer.overlays.length>=6;
    byId('st-sticker-toggle').setAttribute('aria-expanded',String(!!composer.stickersOpen));
    byId('st-layer-count').textContent=composer.overlays.length+' / 6';
    byId('st-overlay-canvas').querySelectorAll('.st-text-layer').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.layerId===composer.selectedLayer)));
    if(!layer)return;
    if(document.activeElement!==byId('st-layer-input'))byId('st-layer-input').value=layer.text;
    byId('st-layer-size').value=layer.size;byId('st-layer-font').value=layer.font;
    byId('st-layer-background').textContent='Fond : '+({none:'aucun',dark:'sombre',light:'clair'})[layer.background];
    byId('st-layer-align').textContent='Aligner : '+({left:'gauche',center:'centré',right:'droite'})[layer.align];
    byId('st-layer-colors').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===layer.color)));
  }
  function changeLayer(values){
    const layer=selectedLayer();if(!layer||composer.busy)return;
    Object.assign(layer,values);
    const node=[...byId('st-overlay-canvas').children].find(n=>n.dataset.layerId===layer.id);
    node.textContent=layer.text||'…';node.setAttribute('aria-label','Modifier le texte : '+layer.text);
    layoutLayers(byId('st-overlay-canvas'),composer.overlays,true);updateLayerTools();
  }
  function activityCard(activity,readerMode=false){
    if(activity.phase==='before')return null;
    const card=el('div','st-activity-card'+(readerMode?' st-activity-reader':''));
    card.append(el('strong','',({during:'En plein effort',after:'Activité terminée'})[activity.phase]+' · '+activity.sport));
    const metrics=el('div','st-activity-metrics');
    const duration=activity.durationSeconds ? Math.floor(activity.durationSeconds/60)+' min '+Math.floor(activity.durationSeconds%60)+' s' : 'Durée non renseignée';
    for(const [value,label] of [[number(activity.distanceMeters),'mètres'],[duration,'durée'],[activity.durationSeconds?number(activity.speedKmh)+' km/h':'—','vitesse'],[number(activity.energy),'énergie']]){
      const item=el('div');item.append(el('b','',value),el('span','',label));if(label==='énergie'){const flame=el('i');flame.innerHTML=Energy.icon;item.lastChild.prepend(flame);}metrics.append(item);
    }
    card.append(metrics);
    if(!activity.hideRoute&&activity.route){
      const map=document.createElementNS('http://www.w3.org/2000/svg','svg');map.setAttribute('viewBox','0 0 410 180');map.setAttribute('role','img');map.setAttribute('aria-label','Illustration du trajet simulé');map.classList.add('st-activity-route');
      const path=document.createElementNS(map.namespaceURI,'path');path.setAttribute('d',activity.route);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','5');map.append(path);card.append(map,el('small','','Trajet illustratif · simulation'));
    }else card.append(el('small','',activity.hideRoute?'Trajet masqué · vos statistiques restent visibles':'Aucun trajet partagé'));
    return card;
  }
  let dialog=null, action=null, modalMode='', openSession='', restoreFocus=null, restoreUser='', reader=null;
  let composer=null, readFrame=0, noticeTimer=0, subscribed=false, scheduled=false;
  let lastPublishedId='', returnToPublished=false;
  const keyFor = current => current ? current.org.id+':'+current.user.id : '';
  const current = () => D() && D().current();
  const now = () => D() ? D().now() : Date.now();
  const liveStories = () => {
    const session=current();
    if(!session)return [];
    return D().getStories(session.org.id).filter(s=>s.orgId===session.org.id && Number(s.expiresAt)>now());
  };
  const userFor = id => { const c=current(); return c && (id===c.user.id?c.user:D().users(c.org.id).find(u=>u.id===id)); };
  const setError = (node, error) => { node.textContent=error instanceof Error ? error.message : String(error); node.hidden=false; };

  function makeDialog() {
    if(dialog)return;
    const host=byId('phone-screen-zone')||byId('device')||document.body;
    dialog=el('dialog','st-dialog'); dialog.id='st-dialog';
    dialog.setAttribute('aria-label','Stories'); host.append(dialog);
    action=el('dialog','st-dialog st-action-dialog'); action.id='st-action-dialog'; host.append(action);
    dialog.addEventListener('close',()=>{
      stopCamera();
      sceneObserver?.disconnect();
      if(action.open)action.close();
      cancelAnimationFrame(readFrame); reader=null; composer=null; modalMode=''; openSession='';
      const target=restoreFocus?.isConnected?restoreFocus:byId('stories')?.querySelector(`[data-st-user="${CSS.escape(restoreUser)}"] button`);
      restoreFocus=null;restoreUser='';
      if(target && target.isConnected && !target.closest('[inert]')){
        target.focus({preventScroll:true});
        if(returnToPublished)target.scrollIntoView({block:'nearest',inline:'nearest'});
      }
      returnToPublished=false;
    });
    action.addEventListener('close',()=>{
      if(reader){reader.actionPaused=false;reader.last=0;updatePauseButton();}
    });
    dialog.addEventListener('keydown', event=>{
      if(modalMode!=='reader'||!reader||action.open)return;
      if(event.key==='ArrowRight'){event.preventDefault();stepReader(1);}
      if(event.key==='ArrowLeft'){event.preventDefault();stepReader(-1);}
      if(event.code==='Space' && !event.target.closest('button,textarea,input,select')){event.preventDefault();togglePause();}
    });
    window.addEventListener('resize',fitDialogs);
    window.addEventListener('scroll',fitDialogs,{capture:true,passive:true});
    window.visualViewport?.addEventListener('resize',fitDialogs);
    window.visualViewport?.addEventListener('scroll',fitDialogs);
    if(window.ResizeObserver)new ResizeObserver(fitDialogs).observe(host);
    document.addEventListener('visibilitychange',()=>{
      if(reader)reader.last=0;
      if(document.hidden&&composer?.cameraOpen){stopCamera();composer.cameraOpen=true;composer.cameraError='Appareil photo en pause. Appuyez sur Réessayer pour reprendre.';updateComposer();}
      if(!document.hidden)render();
    });
    window.addEventListener('pagehide',()=>stopCamera());
  }

  function fitDialogs() {
    const zone=byId('phone-screen-zone'),device=zone||byId('device'); if(!device||!dialog)return;
    const rect=device.getBoundingClientRect();
    const vv=window.visualViewport;
    const topLimit=vv ? vv.offsetTop : 0;
    const leftLimit=vv ? vv.offsetLeft : 0;
    const available=vv ? vv.height : window.innerHeight;
    const availableWidth=vv ? vv.width : window.innerWidth;
    const left=Math.max(leftLimit,rect.left),top=Math.max(topLimit,rect.top);
    const width=Math.max(1,Math.min(rect.right,leftLimit+availableWidth)-left);
    const height=Math.max(1,Math.min(rect.bottom,topLimit+available)-top);
    dialog.classList.toggle('st-in-phone',!!zone);
    Object.assign(dialog.style,{width:width+'px',height:height+'px',left:left+'px',top:top+'px'});
    const inset=Math.min(18,width*.05),actionTop=top+Math.min(90,height*.15);
    Object.assign(action.style,{width:Math.max(1,width-inset*2)+'px',left:(left+inset)+'px',top:actionTop+'px',maxHeight:Math.max(1,top+height-actionTop-inset)+'px'});
    if(modalMode==='reader')fitReaderScene();
  }

  function openModal(mode) {
    if(!current())return false;
    makeDialog();
    sceneObserver?.disconnect();
    stopCamera();
    cancelAnimationFrame(readFrame); reader=null;composer=null;
    if(action.open)action.close();
    if(!dialog.open){restoreFocus=document.activeElement;restoreUser=document.activeElement?.closest('[data-st-user]')?.dataset.stUser||'';}
    modalMode=mode;openSession=keyFor(current());
    dialog.replaceChildren();fitDialogs();
    return true;
  }
  function showModal() { if(!dialog.open)dialog.showModal(); fitDialogs(); }
  function closeModal(){stopCamera();if(dialog?.open)dialog.close();}
  function notify(message){
    let n=byId('st-notice');
    if(!n){n=el('div','st-notice');n.id='st-notice';n.setAttribute('role','status');(byId('device')||document.body).append(n);}
    n.textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.remove(),3800);
  }

  function render() {
    const rail=byId('stories'); if(!rail || !D())return;
    if(!subscribed){D().onChange(scheduleRender);window.Platform?.onChange(scheduleRender);subscribed=true;}
    const session=current();
    if(dialog?.open && openSession!==keyFor(session))closeModal();
    rail.replaceChildren();rail.classList.add('st-rail');
    rail.hidden=!session;
    if(!session)return;
    rail.style.setProperty('--st-accent',color(session.org.accent||session.org.color));
    const stories=liveStories();
    if(!stories.some(s=>s.id===lastPublishedId))lastPublishedId='';
    const groups=new Map();
    stories.forEach(s=>{if(!groups.has(s.userId))groups.set(s.userId,[]);groups.get(s.userId).push(s);});
    const authors=[session.user.id,...[...groups.keys()].filter(id=>id!==session.user.id).sort((a,b)=>Math.max(...groups.get(b).map(s=>s.publishedAt))-Math.max(...groups.get(a).map(s=>s.publishedAt)))];
    authors.forEach(id=>{
      const own=id===session.user.id,u=userFor(id)||{name:'Collègue'},items=groups.get(id)||[];
      const person=el('div','st-person');person.dataset.stUser=id;
      const button=el('button','st-person-button');button.type='button';
      button.setAttribute('aria-label',items.length?`${own?'Mes stories':'Stories de '+u.name}, ${items.length} ${items.length>1?'publications':'publication'}`:'Créer ma première story');
      const published=own&&items.some(s=>s.id===lastPublishedId);
      const ring=el('span','st-ring'+(!items.length?' st-no-story':published?' st-just-published':items.every(s=>D().hasSeenStory(s.id))?' st-seen':''));
      const thumb=el('span','st-avatar',initials(u.name));
      if(own&&items.length){
        const latest=items.find(s=>s.id===lastPublishedId)||items.reduce((a,b)=>a.publishedAt>b.publishedAt?a:b);
        thumb.classList.add('st-story-thumb');thumb.replaceChildren();
        if(latest.type==='photo'&&photoOK(latest.media)){
          const image=el('img');image.src=latest.media;image.alt='';thumb.append(image);
        }else{
          thumb.style.backgroundColor=color(latest.bg);thumb.style.color=inkFor(latest.bg);
          thumb.append(el('span','st-thumb-text',latest.text||initials(u.name)));
        }
      }
      ring.append(thumb);button.append(ring,el('span','st-person-name',own?'Ma story':u.name.split(' ')[0]));
      if(published)button.append(el('span','st-person-status','Publiée ✓'));
      button.addEventListener('click',()=>items.length?openReader(id):openComposer());person.append(button);
      if(own){const add=el('button','st-add-small','+');add.type='button';add.setAttribute('aria-label','Ajouter une story');add.addEventListener('click',openComposer);person.append(add);}
      rail.append(person);
    });
    if(!stories.length){const n=el('div','st-rail-empty');n.append(el('strong','', 'Le mouvement se partage.'),el('span','','Une photo, un mot : racontez votre journée à vos collègues.'));rail.append(n);}
    if(reader && modalMode==='reader'){
      const active=stories.find(s=>s.id===reader.ids[reader.index]);
      if(!active)showUnavailable();
      else {reader.expiresAt=Number(active.expiresAt);reader.clockOffset=now()-Date.now();refreshReaderActivity(active);}
    }
  }
  function scheduleRender(){ if(scheduled)return; scheduled=true;queueMicrotask(()=>{scheduled=false;render();}); }

  function openComposer(input={}) {
    if(!openModal('composer'))return;
    const session=current(),context=input?.activity||input;
    const snapshot=['before','during','after'].includes(context?.phase)?{...context}:null;
    if(snapshot&&!snapshot.activityId&&snapshot.id)snapshot.activityId=snapshot.id;
    if(snapshot?.activityId){const source=window.Platform?.storySnapshot(snapshot.activityId);if(source)snapshot.route=source.route;}
    const history=window.Platform?.activities().filter(a=>a.userId===session.user.id)||[];
    composer={type:'photo',text:'',media:'',bg:color(session.org.color),busy:false,fileVersion:0,cameraVersion:0,cameraOpen:false,cameraFacing:'environment',activity:snapshot||{phase:'before',sport:'Course',hideRoute:true},history,snapshot,overlays:[],nextLayer:1,selectedLayer:null,stickersOpen:false};
    const departure=sport=>sport==='Marche'?'Je pars marcher !':sport==='Vélo'?'Je pars pédaler !':'Je pars courir !';
    composer.text=composer.activity.phase==='before'?departure(composer.activity.sport):composer.activity.phase==='during'?number(composer.activity.distanceMeters)+' mètres déjà parcourus !':'Activité terminée : '+number(composer.activity.distanceMeters)+' mètres.';
    dialog.setAttribute('aria-labelledby','st-compose-title');dialog.removeAttribute('aria-label');
    dialog.innerHTML=`<div class="st-layout">
      <header class="st-topbar"><div><div class="st-eyebrow">Un moment à partager</div><h2 id="st-compose-title">Votre story</h2></div><button type="button" class="st-icon-button" id="st-compose-close" aria-label="Fermer la création de story">${svg('close')}</button></header>
      <div class="st-camera-panel" id="st-camera-panel" hidden>
        <div class="st-camera-stage"><video id="st-camera-video" autoplay muted playsinline aria-label="Aperçu de l’appareil photo"></video><div class="st-camera-status" id="st-camera-status" role="status"><span id="st-camera-message">Ouverture de l’appareil photo…</span><button type="button" class="st-small-button" id="st-camera-retry" hidden>Réessayer</button></div></div>
        <div class="st-camera-controls"><button type="button" class="st-camera-option" id="st-camera-library" aria-label="Choisir une photo dans la galerie">${svg('photo',24)}<span>Galerie</span></button><button type="button" class="st-camera-shutter" id="st-camera-capture" aria-label="Prendre la photo" disabled><span></span></button><button type="button" class="st-camera-option" id="st-camera-switch" aria-label="Changer de caméra" disabled>${svg('camera',24)}<span>Selfie</span></button></div>
        <button type="button" class="st-camera-back" id="st-camera-cancel">Écrire une story</button>
      </div>
      <div class="st-compose-body" id="st-compose-body">
        <div class="st-tabs" role="group" aria-label="Format de la story"><button type="button" class="st-tab" id="st-tab-text" aria-pressed="true">${svg('text',16)}Texte</button><button type="button" class="st-tab" id="st-tab-photo" aria-pressed="false">${svg('photo',16)}Photo</button></div>
        <div class="st-photo-tools" id="st-photo-tools" hidden><button type="button" class="st-small-button" id="st-add-text"><b>Aa</b> Texte</button><button type="button" class="st-small-button" id="st-sticker-toggle" aria-expanded="false" aria-controls="st-stickers">☺ Stickers</button><span id="st-layer-count" aria-live="polite">0 / 6</span></div>
        <div id="st-stickers" class="st-stickers" aria-label="Choisir un sticker" hidden></div>
        <div id="st-preview" class="st-preview st-preview-text" aria-label="Aperçu de votre story"><img id="st-preview-photo" alt="Photo choisie pour la story" hidden><div class="st-upload-placeholder" id="st-upload-placeholder" hidden>${svg('photo',34)}<strong>Votre journée, en image.</strong><span>Choisissez une photo ou capturez le moment.</span></div><div class="st-preview-copy" id="st-preview-copy">Une pause. Un effort.\nUn peu d’énergie en plus.</div><div class="st-overlay-canvas" id="st-overlay-canvas" aria-label="Textes sur votre photo" hidden></div></div>
        <p class="st-overlay-hint" id="st-overlay-hint" hidden>Glissez pour déplacer · touchez pour modifier</p>
        <fieldset class="st-layer-tools" id="st-layer-tools" hidden><legend>Votre texte sur la photo</legend><label for="st-layer-input" class="st-sr-only">Texte sur la photo</label><textarea id="st-layer-input" class="st-textarea" maxlength="180" rows="2" placeholder="Écrivez sur votre photo…"></textarea><div class="st-layer-row"><label for="st-layer-font" class="st-sr-only">Police du texte</label><select id="st-layer-font"><option value="sans">Classique</option><option value="serif">Élégant</option><option value="hand">Manuscrit</option></select><button type="button" class="st-small-button" id="st-layer-background">Fond : aucun</button></div><div class="st-layer-colors" id="st-layer-colors" role="group" aria-label="Couleur du texte"></div><label class="st-layer-size-label" for="st-layer-size">Taille <input id="st-layer-size" type="range" min="0.04" max="0.12" step="0.005" value="0.08"></label><div class="st-layer-row"><button type="button" class="st-small-button" id="st-layer-align">Aligner : centré</button><button type="button" class="st-small-button st-layer-delete" id="st-layer-delete">Supprimer</button><button type="button" class="st-small-button st-layer-done" id="st-layer-done">Terminer</button></div></fieldset>
        <div class="st-palette" id="st-palette"><span>Couleur</span></div>
        <div class="st-upload-actions" id="st-upload-actions" hidden><button type="button" class="st-small-button" id="st-photo-library">${svg('photo',16)}Choisir une photo</button><button type="button" class="st-small-button" id="st-photo-camera">${svg('camera',16)}Appareil photo</button></div>
        <input id="st-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden>
        <label class="st-input-label" for="st-caption"><span id="st-caption-label">Votre message</span><span class="st-counter" id="st-counter">0 / 280</span></label>
        <textarea id="st-caption" class="st-textarea" maxlength="280" rows="3" placeholder="La sortie du midi fait du bien…"></textarea>
        <div class="st-activity-options"><label for="st-sport" id="st-sport-label">Sport</label><select id="st-sport"><option>Course</option><option>Marche</option><option>Vélo</option></select><label for="st-activity-select" id="st-activity-label">Activité enregistrée</label><select id="st-activity-select"></select><label class="st-privacy"><input type="checkbox" id="st-hide-route" checked> Cacher mon trajet</label><p id="st-privacy-note" class="st-activity-note"></p><div id="st-activity-preview"></div></div>
        <div class="st-audience">${svg('lock',16)}<span>Visible par les collègues de <strong id="st-audience-name"></strong> pendant <strong>24 heures</strong>.</span></div>
        <div id="st-compose-error" class="st-error" role="alert" hidden></div>
      </div><footer class="st-bottom-actions" id="st-compose-footer"><button type="button" class="st-primary" id="st-publish" disabled>${svg('send',17)}Publier ma story</button></footer></div>`;
    byId('st-audience-name').textContent=session.org.name;
    byId('st-caption').value=composer.text;
    byId('st-sport').value=composer.activity.sport||'Course';byId('st-hide-route').checked=composer.activity.hideRoute!==false;
    if(snapshot?.phase==='after'&&!history.some(a=>a.id===snapshot.activityId)){const option=el('option','','Cette sortie · '+number(snapshot.distanceMeters)+' m (à enregistrer)');option.value=snapshot.activityId||'current-snapshot';byId('st-activity-select').append(option);}
    for(const a of history){const option=el('option','',a.title+' · '+number(a.distanceMeters)+' m');option.value=a.id;byId('st-activity-select').append(option);}
    if(snapshot?.phase==='after')byId('st-activity-select').value=snapshot.activityId||'current-snapshot';
    function changeActivity(){
      const phase=snapshot?.phase||composer.activity.phase;
      if(snapshot?.phase===phase&&(phase!=='after'||byId('st-activity-select').value===(snapshot.activityId||'current-snapshot')))composer.activity={...snapshot};
      else if(phase==='after'){const selected=history.find(a=>a.id===byId('st-activity-select').value)||history[0],a=window.Platform?.storySnapshot(selected?.id)||selected;composer.activity={...a,activityId:a?.id,phase};}
      else composer.activity={phase:'before',sport:byId('st-sport').value,distanceMeters:0,durationSeconds:0,energy:0,speedKmh:0,route:''};
      composer.activity.hideRoute=byId('st-hide-route').checked;
      if(phase==='before'&&['Je pars courir !','Je pars marcher !','Je pars pédaler !'].includes(composer.text)){composer.text=departure(composer.activity.sport);byId('st-caption').value=composer.text;}
      updateComposer();
    }
    byId('st-sport').onchange=changeActivity;byId('st-activity-select').onchange=changeActivity;byId('st-hide-route').onchange=changeActivity;
    const colors=[color(session.org.color),'#123d35','#c34b27','#5a398c','#18263d'];
    [...new Set(colors)].forEach((bg,i)=>{
      const b=el('button','st-swatch');b.type='button';b.style.background=bg;b.setAttribute('aria-label',i===0?'Couleur de mon entreprise':['','Vert forêt','Terre cuite','Violet','Bleu nuit'][i]);b.setAttribute('aria-pressed',String(bg===composer.bg));
      b.addEventListener('click',()=>{composer.bg=bg;byId('st-palette').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));updateComposer();});byId('st-palette').append(b);
    });
    byId('st-compose-close').addEventListener('click',closeModal);
    for(const kind of ['text','photo'])byId('st-tab-'+kind).addEventListener('click',()=>{stopCamera();composer.fileVersion++;composer.busy=false;composer.type=kind;updateComposer();});
    byId('st-caption').addEventListener('input',e=>{composer.text=e.target.value;updateComposer();});
    const chooseLibrary=()=>{stopCamera();composer.type='photo';updateComposer();byId('st-file').removeAttribute('capture');byId('st-file').click();};
    byId('st-photo-library').addEventListener('click',chooseLibrary);
    byId('st-camera-library').addEventListener('click',chooseLibrary);
    byId('st-photo-camera').addEventListener('click',()=>startCamera());
    byId('st-camera-retry').addEventListener('click',()=>startCamera());
    byId('st-camera-switch').addEventListener('click',()=>startCamera(composer.cameraFacing==='environment'?'user':'environment'));
    byId('st-camera-capture').addEventListener('click',capturePhoto);
    byId('st-camera-cancel').addEventListener('click',()=>{stopCamera();composer.type=composer.media?'photo':'text';updateComposer();});
    byId('st-file').addEventListener('change',loadPhoto);
    byId('st-publish').addEventListener('click',publish);
    byId('st-add-text').addEventListener('click',()=>addLayer());
    byId('st-sticker-toggle').addEventListener('click',()=>{composer.stickersOpen=!composer.stickersOpen;updateLayerTools();});
    for(const [emoji,label] of [['🔥','Énergie'],['💪','Force'],['🏃','Course'],['🚶','Marche'],['🚴','Vélo'],['👏','Bravo'],['❤️','Cœur'],['🎉','Fête']]){
      const button=el('button','',emoji);button.type='button';button.setAttribute('aria-label',label);button.addEventListener('click',()=>addLayer(emoji));byId('st-stickers').append(button);
    }
    for(const [value,label] of [['#ffffff','Blanc'],['#111827','Noir'],['#ffda60','Jaune'],['#ff6b8a','Rose'],['#6ccefa','Bleu'],['#8ce4bd','Vert']]){
      const button=el('button','st-swatch');button.type='button';button.dataset.color=value;button.style.backgroundColor=value;button.setAttribute('aria-label',label);button.addEventListener('click',()=>changeLayer({color:value}));byId('st-layer-colors').append(button);
    }
    byId('st-layer-input').addEventListener('input',event=>changeLayer({text:event.target.value}));
    byId('st-layer-size').addEventListener('input',event=>changeLayer({size:Number(event.target.value)}));
    byId('st-layer-font').addEventListener('change',event=>changeLayer({font:event.target.value}));
    byId('st-layer-background').addEventListener('click',()=>{
      const layer=selectedLayer();if(!layer)return;
      const background=({none:'dark',dark:'light',light:'none'})[layer.background];
      const nextColor=background==='light'&&layer.color==='#ffffff'?'#111827':background==='dark'&&layer.color==='#111827'?'#ffffff':layer.color;
      changeLayer({background,color:nextColor});
    });
    byId('st-layer-align').addEventListener('click',()=>{const layer=selectedLayer();if(layer)changeLayer({align:({center:'left',left:'right',right:'center'})[layer.align]});});
    byId('st-layer-delete').addEventListener('click',()=>{composer.overlays=composer.overlays.filter(layer=>layer.id!==composer.selectedLayer);composer.selectedLayer=null;drawLayers(byId('st-overlay-canvas'),composer.overlays,true);updateLayerTools();byId('st-add-text').focus({preventScroll:true});});
    byId('st-layer-done').addEventListener('click',()=>{composer.overlays=composer.overlays.filter(layer=>layer.text.trim());composer.selectedLayer=null;drawLayers(byId('st-overlay-canvas'),composer.overlays,true);updateLayerTools();byId('st-preview').scrollIntoView({block:'nearest',behavior:'auto'});byId('st-add-text').focus({preventScroll:true});});
    updateComposer();showModal();watchScene();startCamera();
  }

  function stopCamera(draft=composer){
    if(!draft)return;
    draft.cameraVersion=(draft.cameraVersion||0)+1;
    draft.cameraStream?.getTracks().forEach(track=>track.stop());draft.cameraStream=null;
    if(draft.cameraVideo){draft.cameraVideo.pause();draft.cameraVideo.srcObject=null;draft.cameraVideo=null;}
    draft.cameraOpen=false;draft.cameraReady=false;draft.cameraPending=false;
  }
  function sameCamera(draft,version){return composer===draft&&draft.cameraVersion===version&&dialog?.open&&modalMode==='composer'&&openSession===keyFor(current())&&!document.hidden;}
  async function startCamera(facing){
    if(!composer||composer.busy||modalMode!=='composer')return;
    const draft=composer;stopCamera(draft);
    const version=draft.cameraVersion;draft.cameraFacing=facing||draft.cameraFacing||'environment';draft.type='photo';draft.cameraOpen=true;draft.cameraPending=true;draft.cameraError='';
    const video=byId('st-camera-video');draft.cameraVideo=video;video.muted=true;
    updateComposer();
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error(),{name:'NotSupportedError'});
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:draft.cameraFacing},width:{ideal:1280},height:{ideal:1920}}});
      if(!sameCamera(draft,version)){stream.getTracks().forEach(track=>track.stop());return;}
      draft.cameraStream=stream;video.srcObject=stream;
      const actual=stream.getVideoTracks()[0]?.getSettings()?.facingMode||draft.cameraFacing;video.classList.toggle('st-camera-mirrored',actual==='user');
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(sameCamera(draft,version)){stopCamera(draft);draft.cameraOpen=true;draft.cameraError='La caméra s’est arrêtée. Appuyez sur Réessayer pour reprendre.';updateComposer();}},{once:true}));
      await video.play();
      if(!sameCamera(draft,version)){stream.getTracks().forEach(track=>track.stop());if(draft.cameraStream===stream)stopCamera(draft);return;}
      draft.cameraPending=false;draft.cameraReady=video.videoWidth>0&&video.videoHeight>0;
      if(!draft.cameraReady)throw new Error('Aucune image disponible.');
      updateComposer();
    }catch(error){
      if(!sameCamera(draft,version))return;
      stopCamera(draft);draft.cameraOpen=true;
      draft.cameraError=error.name==='NotAllowedError'||error.name==='SecurityError'?'Autorisez l’accès à l’appareil photo dans votre navigateur, puis appuyez sur Réessayer.':error.name==='NotFoundError'?'Aucun appareil photo disponible. Vous pouvez choisir une photo dans la galerie ou écrire une story.':error.name==='NotSupportedError'?'Ce navigateur ne permet pas d’ouvrir la caméra ici. Vous pouvez utiliser la galerie ou écrire une story.':'L’appareil photo est indisponible. Fermez les autres applications qui l’utilisent, puis réessayez.';
      updateComposer();
    }
  }
  async function capturePhoto(){
    const draft=composer;if(!draft?.cameraReady||draft.busy)return;
    const version=++draft.fileVersion,video=draft.cameraVideo;draft.busy=true;updateComposer();
    try{
      const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('La prise de photo a échoué. Réessayez.');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);stopCamera(draft);updateComposer();
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('La prise de photo a échoué. Réessayez.')),'image/jpeg',.9));
      const media=await compressPhoto(blob);
      if(composer===draft&&draft.fileVersion===version){draft.media=media;draft.type='photo';}
    }catch(error){if(composer===draft&&draft.fileVersion===version){stopCamera(draft);setError(byId('st-compose-error'),error);}}
    finally{if(composer===draft&&draft.fileVersion===version){draft.busy=false;updateComposer();}}
  }

  function updateComposer(){
    if(!composer || modalMode!=='composer')return;
    const camera=!!composer.cameraOpen;
    byId('st-camera-panel').hidden=!camera;byId('st-compose-body').hidden=camera;byId('st-compose-footer').hidden=camera;
    byId('st-camera-status').hidden=!!composer.cameraReady;
    byId('st-camera-message').textContent=composer.cameraError||'Autorisez l’appareil photo pour capturer votre moment.';
    byId('st-camera-retry').hidden=!composer.cameraError;
    byId('st-camera-capture').disabled=!composer.cameraReady||composer.busy;
    byId('st-camera-switch').disabled=!composer.cameraReady||composer.busy;
    byId('st-camera-switch').querySelector('span').textContent=composer.cameraFacing==='user'?'Arrière':'Selfie';
    byId('st-camera-cancel').textContent=composer.media?'Revenir à l’aperçu':'Écrire une story';
    byId('st-photo-camera').disabled=composer.busy;byId('st-photo-library').disabled=composer.busy;
    const photo=composer.type==='photo';
    byId('st-tab-text').setAttribute('aria-pressed',String(!photo));byId('st-tab-photo').setAttribute('aria-pressed',String(photo));
    const preview=byId('st-preview');preview.className='st-preview '+(photo?'st-preview-photo':'st-preview-text')+(photo&&composer.media?' st-has-photo':'');
    preview.style.backgroundColor=photo ? '' : composer.bg;preview.style.color=photo ? '' : inkFor(composer.bg);
    byId('st-palette').hidden=photo;byId('st-upload-actions').hidden=!photo;
    const img=byId('st-preview-photo');img.hidden=!photo||!composer.media;if(composer.media)img.src=composer.media;
    byId('st-upload-placeholder').hidden=!photo||!!composer.media;
    const copy=byId('st-preview-copy');copy.textContent=composer.text||(photo?'':'Une pause. Un effort.\nUn peu d’énergie en plus.');
    copy.classList.toggle('st-long-text',composer.text.length>120);copy.hidden=photo;
    updateLayerTools();layoutLayers(byId('st-overlay-canvas'),composer.overlays,true);
    byId('st-caption-label').textContent=photo?'Une légende ? (facultatif)':'Votre message';
    byId('st-counter').textContent=composer.text.length+' / 280';
    const a=composer.activity,before=a.phase==='before';
    byId('st-sport').hidden=byId('st-sport-label').hidden=!before;byId('st-activity-select').hidden=byId('st-activity-label').hidden=a.phase!=='after'||!composer.history.length;
    const card=activityCard(a);byId('st-activity-preview').replaceChildren(...(card?[card]:[]));byId('st-activity-preview').hidden=!card;
    const linkedHidden=a.activityId&&window.Platform?.activityPrivacy(a.activityId);
    byId('st-privacy-note').textContent=linkedHidden?'Le trajet de cette activité est masqué. Vous pouvez modifier sa visibilité depuis votre profil.':before?'':'Cette story partage un instantané. Elle ne crédite pas une seconde activité.';byId('st-privacy-note').hidden=before&&!linkedHidden;
    byId('st-publish').disabled=composer.busy||(photo?!composer.media:!composer.text.trim());
  }

  async function loadPhoto(event){
    const file=event.target.files?.[0];event.target.value='';if(!file||!composer)return;
    stopCamera();
    const draft=composer,version=++draft.fileVersion,error=byId('st-compose-error');error.hidden=true;
    if(file.size>25*1024*1024){setError(error,'Cette photo est trop lourde. Choisissez une image de moins de 25 Mo.');return;}
    draft.busy=true;updateComposer();byId('st-photo-library').textContent='Préparation…';
    try{
      const media=await compressPhoto(file);
      if(composer===draft&&draft.fileVersion===version){draft.media=media;draft.type='photo';}
    }catch(err){if(composer===draft)setError(error,err);}
    finally{if(composer===draft&&draft.fileVersion===version){draft.busy=false;byId('st-photo-library').innerHTML=svg('photo',16)+'Changer la photo';updateComposer();}}
  }
  function compressPhoto(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Cette image ne peut pas être lue. Essayez une photo JPG, PNG ou WebP.'));};
      img.onload=()=>{
        URL.revokeObjectURL(url);
        try{
          let scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));
          const canvas=document.createElement('canvas');let result='';
          for(let attempt=0;attempt<7;attempt++){
            canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
            const ctx=canvas.getContext('2d');if(!ctx)throw new Error('La préparation de la photo a échoué.');
            ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
            result=canvas.toDataURL('image/jpeg',Math.max(.5,.83-attempt*.055));
            if(result.length<=450000){resolve(result);return;}scale*=.8;
          }
          throw new Error('Cette photo est trop détaillée pour la démo. Essayez une image plus petite.');
        }catch(err){reject(err);}
      };
      img.src=url;
    });
  }
  async function publish(){
    if(!composer||composer.busy)return;
    const draft=composer;draft.busy=true;updateComposer();byId('st-compose-error').hidden=true;byId('st-publish').textContent='Publication…';
    try{
      const published=await D().createStory({type:draft.type,text:draft.text.trim(),media:draft.type==='photo'?draft.media:'',bg:draft.bg,activity:draft.activity,overlays:draft.type==='photo'?draft.overlays.filter(layer=>layer.text.trim()):[]});
      if(composer!==draft)return;
      lastPublishedId=published.id;returnToPublished=true;restoreFocus=null;restoreUser=published.userId;
      render();openReader(published.userId,published.id);
    }catch(err){if(composer===draft){setError(byId('st-compose-error'),err);draft.busy=false;byId('st-publish').innerHTML=svg('send',17)+'Publier ma story';updateComposer();}}
  }

  function openReader(userId,storyId=null){
    if(!openModal('reader'))return;
    const items=liveStories().filter(s=>s.userId===userId).sort((a,b)=>a.publishedAt-b.publishedAt);
    reader={ids:items.map(s=>s.id),index:0,elapsed:0,last:0,manualPaused:matchMedia('(prefers-reduced-motion:reduce)').matches,holding:false,actionPaused:false,duration:8000,publishedId:storyId===lastPublishedId?storyId:''};
    const requested=storyId===null?-1:items.findIndex(s=>s.id===storyId);
    if(items.length&&(storyId===null||requested!==-1)){
      const firstNew=requested!==-1?requested:items.findIndex(s=>!D().hasSeenStory(s.id));reader.index=Math.max(0,firstNew);showReaderStory();
    }else showUnavailable();
    showModal();watchScene();fitReaderScene();byId('st-reader-close')?.focus({preventScroll:true});
  }
  function timeLabel(story){
    const mins=Math.max(1,Math.ceil((story.expiresAt-now())/60000));
    const left=mins>=60?`${Math.floor(mins/60)} h${mins%60?' '+(mins%60)+' min':''}`:mins+' min';
    const ago=Math.max(0,Math.floor((now()-story.publishedAt)/60000));
    return `${ago<1?'À l’instant':ago<60?'Il y a '+ago+' min':'Il y a '+Math.floor(ago/60)+' h'} · encore ${left}`;
  }
  function showReaderStory(){
    if(!reader||!current())return;
    const story=liveStories().find(s=>s.id===reader.ids[reader.index]);
    if(!story){showUnavailable();return;}
    cancelAnimationFrame(readFrame);reader.elapsed=0;reader.last=0;reader.holding=false;
    reader.expiresAt=Number(story.expiresAt);reader.clockOffset=now()-Date.now();
    reader.duration=Math.max(7000,Math.min(20000,4000+(String(story.text||'').length+(story.overlays||[]).reduce((sum,layer)=>sum+layer.text.length,0))*60));
    const u=userFor(story.userId)||{name:'Collègue',team:''};
    dialog.setAttribute('aria-label','Story de '+u.name);dialog.removeAttribute('aria-labelledby');
    dialog.innerHTML=`<div class="st-layout st-reader"><div class="st-reader-media" id="st-reader-media"><div class="st-reader-text" id="st-reader-text"></div></div>
      <header class="st-reader-head"><div class="st-progress" id="st-progress" aria-hidden="true"></div><div class="st-reader-author-row"><span class="st-reader-avatar" id="st-reader-avatar"></span><div class="st-reader-meta"><span class="st-reader-author" id="st-reader-author"></span><span class="st-reader-when" id="st-reader-when"></span></div><button type="button" class="st-icon-button" id="st-reader-pause" aria-label="Mettre la story en pause">${svg('pause',16)}</button><button type="button" class="st-icon-button" id="st-reader-more" aria-label="Options de la story">${svg('more',18)}</button><button type="button" class="st-icon-button" id="st-reader-close" aria-label="Fermer la story">${svg('close',19)}</button></div></header>
      <div class="st-reader-spacer" id="st-reader-hold" aria-hidden="true"></div>
      <footer class="st-reader-bottom"><div class="st-private-line">${svg('lock',12)}<span id="st-reader-audience"></span></div><div class="st-reader-nav"><button type="button" class="st-reader-nav-button" id="st-reader-prev" aria-label="Story précédente">${svg('left',19)}</button><span class="st-reader-count" id="st-reader-count" aria-live="polite"></span><button type="button" class="st-reader-nav-button" id="st-reader-next" aria-label="Story suivante">${svg('right',19)}</button></div></footer></div>`;
    if(story.id===reader.publishedId){
      const confirmation=el('div','st-published-confirmation');confirmation.setAttribute('role','status');
      confirmation.innerHTML=svg('check',16);confirmation.append(el('span','','Story publiée · visible pendant 24 h'));
      byId('st-reader-hold').before(confirmation);
    }
    byId('st-reader-avatar').textContent=initials(u.name);byId('st-reader-author').textContent=u.name+(u.team?' · '+u.team:'');byId('st-reader-when').textContent=timeLabel(story);
    byId('st-reader-audience').textContent=current().org.shortName||current().org.name;
    const media=byId('st-reader-media'),text=byId('st-reader-text');
    const isPhoto=story.type==='photo'&&photoOK(story.media);
    media.classList.toggle('st-is-photo',isPhoto);media.style.backgroundColor=color(story.bg||current().org.color);
    text.textContent=story.text||'';text.style.color=isPhoto?'#fff':inkFor(story.bg||current().org.color);text.classList.toggle('st-long-text',(story.text||'').length>130);
    if(isPhoto){
      const scene=el('div','st-photo-scene');scene.id='st-reader-stage';
      const img=el('img');img.alt='Photo partagée par '+u.name;img.src=story.media;
      const canvas=el('div','st-overlay-canvas');canvas.id='st-reader-overlays';
      scene.append(img,canvas);media.prepend(scene);drawLayers(canvas,story.overlays||[]);
      // Keep captions in the foreground so long messages can be scrolled.
      text.classList.add('st-photo-caption');text.tabIndex=0;
      dialog.querySelector('.st-reader-bottom').prepend(text);
    }
    refreshReaderActivity(story);
    reader.ids.forEach((id,i)=>{const segment=el('span'),fill=el('i');fill.style.width=i<reader.index?'100%':'0%';segment.append(fill);byId('st-progress').append(segment);});
    byId('st-reader-count').textContent=`${reader.index+1} / ${reader.ids.length}`;
    byId('st-reader-prev').disabled=reader.index===0;
    if(reader.index===reader.ids.length-1){byId('st-reader-next').textContent='Terminer';byId('st-reader-next').setAttribute('aria-label','Terminer la lecture');}
    byId('st-reader-prev').addEventListener('click',()=>stepReader(-1));byId('st-reader-next').addEventListener('click',()=>stepReader(1));
    byId('st-reader-close').addEventListener('click',closeModal);byId('st-reader-pause').addEventListener('click',togglePause);byId('st-reader-more').addEventListener('click',()=>openStoryAction(story));
    const hold=byId('st-reader-hold');
    hold.addEventListener('pointerdown',event=>{reader.holding=true;hold.setPointerCapture(event.pointerId);updatePauseButton();});
    const release=()=>{if(reader){reader.holding=false;reader.last=0;updatePauseButton();}};
    hold.addEventListener('pointerup',release);hold.addEventListener('pointercancel',release);
    if(isPhoto){
      text.addEventListener('pointerdown',()=>{reader.holding=true;updatePauseButton();});
      text.addEventListener('pointerup',release);text.addEventListener('pointercancel',release);text.addEventListener('pointerleave',release);
      text.addEventListener('focus',()=>{reader.holding=true;updatePauseButton();});text.addEventListener('blur',release);
    }
    updatePauseButton();
    try{D().markStorySeen(story.id);}catch(err){/* Seen status never blocks the reader. */}
    watchScene();fitReaderScene();
    readFrame=requestAnimationFrame(tickReader);
  }
  function refreshReaderActivity(story){
    const media=byId('st-reader-media');if(!media)return;
    const previous=byId('st-reader-activity');
    const serialized=JSON.stringify(story.activity||null);if(previous?.dataset.snapshot===serialized)return;
    const card=story.activity?activityCard(story.activity,true):null;
    previous?.remove();media.classList.toggle('st-with-activity',!!card);
    if(card){card.id='st-reader-activity';card.dataset.snapshot=serialized;media.append(card);}
    fitReaderScene();
  }
  function fitReaderScene(){
    const scene=byId('st-reader-stage'),media=byId('st-reader-media');if(!scene||!media?.clientWidth||!reader)return;
    const head=dialog.querySelector('.st-reader-head'),footer=dialog.querySelector('.st-reader-bottom'),notice=dialog.querySelector('.st-published-confirmation');
    const top=(head?.offsetHeight||88)+(notice?.offsetHeight||0)+12,bottom=(footer?.offsetHeight||106)+12;
    media.style.paddingTop=top+'px';media.style.paddingBottom=bottom+'px';
    const caption=byId('st-reader-text'),card=byId('st-reader-activity');
    const available=media.clientHeight-top-bottom-(caption?.parentElement===media?caption.offsetHeight:0)-(card?.offsetHeight||0)-(card?24:12);
    const width=Math.max(1,Math.min(media.clientWidth-36,Math.max(1,available)*9/16));
    scene.style.width=width+'px';scene.style.height=width*16/9+'px';
    const story=liveStories().find(s=>s.id===reader.ids[reader.index]);
    layoutLayers(byId('st-reader-overlays'),story?.overlays||[]);
  }
  function isPaused(){return !reader||reader.manualPaused||reader.holding||reader.actionPaused||document.hidden;}
  function updatePauseButton(){
    const b=byId('st-reader-pause');if(!b||!reader)return;
    const paused=isPaused();b.innerHTML=svg(paused?'play':'pause',16);b.setAttribute('aria-label',paused?'Reprendre la story':'Mettre la story en pause');b.setAttribute('aria-pressed',String(paused));
  }
  function togglePause(){if(reader){reader.manualPaused=!reader.manualPaused;reader.last=0;updatePauseButton();}}
  function tickReader(timestamp){
    if(!reader||!dialog.open||modalMode!=='reader')return;
    if(Date.now()+reader.clockOffset>=reader.expiresAt){showUnavailable();return;}
    if(reader.last&&!isPaused())reader.elapsed+=Math.min(timestamp-reader.last,200);
    reader.last=timestamp;
    const fill=byId('st-progress')?.children[reader.index]?.firstElementChild;
    if(fill)fill.style.width=Math.min(100,reader.elapsed/reader.duration*100)+'%';
    if(reader.elapsed>=reader.duration){stepReader(1);return;}
    readFrame=requestAnimationFrame(tickReader);
  }
  function stepReader(direction){
    if(!reader)return;
    if(reader.index+direction<0)return;
    if(reader.index+direction>=reader.ids.length){closeModal();return;}
    reader.index+=direction;showReaderStory();byId(direction>0?'st-reader-next':'st-reader-prev')?.focus({preventScroll:true});
  }
  function showUnavailable(){
    cancelAnimationFrame(readFrame);reader=null;if(action?.open)action.close();
    dialog.setAttribute('aria-labelledby','st-unavailable-title');dialog.removeAttribute('aria-label');
    dialog.innerHTML=`<div class="st-story-state"><span class="st-state-icon">${svg('clock',30)}</span><h2 id="st-unavailable-title">Ce moment est passé.</h2><p>Cette story a expiré ou a été supprimée. Retrouvez les nouveaux moments de votre équipe dans l’accueil.</p><button type="button" class="st-primary" id="st-unavailable-close">Revenir aux stories</button></div>`;
    byId('st-unavailable-close').addEventListener('click',closeModal);if(dialog.open)byId('st-unavailable-close').focus({preventScroll:true});
  }

  function openStoryAction(story){
    if(!reader||!current())return;
    story=liveStories().find(item=>item.id===story.id)||story;
    reader.actionPaused=true;updatePauseButton();
    const own=story.userId===current().user.id;
    action.setAttribute('aria-labelledby','st-action-title');
    action.innerHTML=`<h2 id="st-action-title">${own?'Supprimer cette story ?':'Signaler cette story'}</h2><p id="st-action-desc">${own?'Elle disparaîtra immédiatement de votre espace et de celui de vos collègues.':'Votre signalement sera transmis au responsable de votre entreprise.'}</p>${own?'':'<label for="st-report-reason">Motif du signalement</label><select id="st-report-reason"><option value="">Choisir un motif</option><option>Contenu inapproprié</option><option>Harcèlement ou propos blessants</option><option>Image publiée sans accord</option><option>Autre problème</option></select>'}<div id="st-action-error" class="st-error" role="alert" hidden></div><div class="st-action-row"><button type="button" class="st-small-button" id="st-action-cancel">Annuler</button><button type="button" class="st-primary ${own?'st-danger':''}" id="st-action-confirm">${own?'Supprimer':'Envoyer'}</button></div>`;
    action.setAttribute('aria-describedby','st-action-desc');fitDialogs();action.showModal();
    if(own&&story.activity){
      byId('st-action-title').textContent='Options de ma story';
      byId('st-action-desc').textContent='Vous pouvez masquer le trajet en conservant vos statistiques, ou supprimer cette story.';
      const privacy=el('label','st-privacy'),toggle=el('input');toggle.type='checkbox';toggle.id='st-edit-hide-route';toggle.checked=story.activity.hideRoute;
      privacy.append(toggle,document.createTextNode('Cacher mon trajet'));byId('st-action-desc').after(privacy);
      const linkedHidden=story.activity.activityId&&window.Platform?.activityPrivacy(story.activity.activityId);
      if(linkedHidden)privacy.after(el('p','st-activity-note','Le trajet reste aussi masqué par la confidentialité de l’activité. Celle-ci se règle depuis votre profil.'));
      toggle.addEventListener('change',()=>{try{D().setStoryPrivacy(story.id,toggle.checked);const fresh=liveStories().find(s=>s.id===story.id);if(fresh)refreshReaderActivity(fresh);notify('Confidentialité de la story enregistrée.');}catch(err){toggle.checked=!toggle.checked;setError(byId('st-action-error'),err);}});
    }
    byId('st-action-cancel').addEventListener('click',()=>action.close());
    byId('st-action-confirm').addEventListener('click',async()=>{
      const reason=own?'':byId('st-report-reason').value;
      if(!own&&!reason){setError(byId('st-action-error'),'Choisissez un motif pour envoyer votre signalement.');return;}
      const button=byId('st-action-confirm');button.disabled=true;
      try{
        if(own)await D().deleteStory(story.id);else await D().reportStory(story.id,reason);
        action.close();closeModal();render();notify(own?'Votre story a été supprimée.':'Signalement enregistré. Le responsable pourra le consulter.');
      }catch(err){if(action.open){button.disabled=false;setError(byId('st-action-error'),err);}}
    });
    byId('st-action-cancel').focus({preventScroll:true});
  }

  window.MoovStories={render,openComposer,openReader,close:closeModal};
  setInterval(()=>{render();if(reader){const story=liveStories().find(s=>s.id===reader.ids[reader.index]);if(story&&byId('st-reader-when'))byId('st-reader-when').textContent=timeLabel(story);}},30000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
