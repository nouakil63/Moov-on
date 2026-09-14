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
  let dialog=null, action=null, modalMode='', openSession='', restoreFocus=null, restoreUser='', reader=null;
  let composer=null, readFrame=0, noticeTimer=0, subscribed=false, scheduled=false;
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
    const host=byId('device')||document.body;
    dialog=el('dialog','st-dialog'); dialog.id='st-dialog';
    dialog.setAttribute('aria-label','Stories'); host.append(dialog);
    action=el('dialog','st-dialog st-action-dialog'); action.id='st-action-dialog'; host.append(action);
    dialog.addEventListener('close',()=>{
      if(action.open)action.close();
      cancelAnimationFrame(readFrame); reader=null; composer=null; modalMode=''; openSession='';
      const target=restoreFocus?.isConnected?restoreFocus:byId('stories')?.querySelector(`[data-st-user="${CSS.escape(restoreUser)}"] button`);
      restoreFocus=null;restoreUser='';
      if(target && target.isConnected && !target.closest('[inert]')) target.focus({preventScroll:true});
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
    window.visualViewport?.addEventListener('resize',fitDialogs);
    document.addEventListener('visibilitychange',()=>{
      if(reader)reader.last=0;
      if(!document.hidden)render();
    });
  }

  function fitDialogs() {
    const device=byId('device'); if(!device||!dialog)return;
    const rect=device.getBoundingClientRect();
    const vv=window.visualViewport;
    const topLimit=vv ? vv.offsetTop : 0;
    const available=vv ? vv.height : window.innerHeight;
    const width=Math.min(rect.width,window.innerWidth);
    const left=Math.max(0,Math.min(rect.left,window.innerWidth-width));
    const height=Math.min(rect.height,available);
    const top=Math.max(topLimit,Math.min(rect.top,topLimit+available-height));
    Object.assign(dialog.style,{width:width+'px',height:height+'px',left:left+'px',top:top+'px'});
    Object.assign(action.style,{width:Math.max(250,width-36)+'px',left:(left+18)+'px',top:(top+Math.max(20,height*.3))+'px',maxHeight:Math.max(180,height*.65)+'px'});
  }

  function openModal(mode) {
    if(!current())return false;
    makeDialog();
    cancelAnimationFrame(readFrame); reader=null;
    if(action.open)action.close();
    if(!dialog.open){restoreFocus=document.activeElement;restoreUser=document.activeElement?.closest('[data-st-user]')?.dataset.stUser||'';}
    modalMode=mode;openSession=keyFor(current());
    dialog.replaceChildren();fitDialogs();
    return true;
  }
  function showModal() { if(!dialog.open)dialog.showModal(); fitDialogs(); }
  function closeModal(){ if(dialog?.open)dialog.close(); }
  function notify(message){
    let n=byId('st-notice');
    if(!n){n=el('div','st-notice');n.id='st-notice';n.setAttribute('role','status');(byId('device')||document.body).append(n);}
    n.textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.remove(),3800);
  }

  function render() {
    const rail=byId('stories'); if(!rail || !D())return;
    if(!subscribed){D().onChange(scheduleRender);subscribed=true;}
    const session=current();
    if(dialog?.open && openSession!==keyFor(session))closeModal();
    rail.replaceChildren();rail.classList.add('st-rail');
    rail.hidden=!session;
    if(!session)return;
    rail.style.setProperty('--st-accent',color(session.org.accent||session.org.color));
    const stories=liveStories();
    const groups=new Map();
    stories.forEach(s=>{if(!groups.has(s.userId))groups.set(s.userId,[]);groups.get(s.userId).push(s);});
    const authors=[session.user.id,...[...groups.keys()].filter(id=>id!==session.user.id).sort((a,b)=>Math.max(...groups.get(b).map(s=>s.publishedAt))-Math.max(...groups.get(a).map(s=>s.publishedAt)))];
    authors.forEach(id=>{
      const own=id===session.user.id,u=userFor(id)||{name:'Collègue'},items=groups.get(id)||[];
      const person=el('div','st-person');person.dataset.stUser=id;
      const button=el('button','st-person-button');button.type='button';
      button.setAttribute('aria-label',items.length?`${own?'Mes stories':'Stories de '+u.name}, ${items.length} ${items.length>1?'publications':'publication'}`:'Créer ma première story');
      const ring=el('span','st-ring'+(!items.length?' st-no-story':items.every(s=>D().hasSeenStory(s.id))?' st-seen':''));
      ring.append(el('span','st-avatar',initials(u.name)));button.append(ring,el('span','st-person-name',own?'Ma story':u.name.split(' ')[0]));
      button.addEventListener('click',()=>items.length?openReader(id):openComposer());person.append(button);
      if(own){const add=el('button','st-add-small','+');add.type='button';add.setAttribute('aria-label','Ajouter une story');add.addEventListener('click',openComposer);person.append(add);}
      rail.append(person);
    });
    if(!stories.length){const n=el('div','st-rail-empty');n.append(el('strong','', 'Le mouvement se partage.'),el('span','','Une photo, un mot : racontez votre journée à vos collègues.'));rail.append(n);}
    if(reader && modalMode==='reader'){
      const active=stories.find(s=>s.id===reader.ids[reader.index]);
      if(!active)showUnavailable();
      else {reader.expiresAt=Number(active.expiresAt);reader.clockOffset=now()-Date.now();}
    }
  }
  function scheduleRender(){ if(scheduled)return; scheduled=true;queueMicrotask(()=>{scheduled=false;render();}); }

  function openComposer() {
    if(!openModal('composer'))return;
    const session=current();composer={type:'text',text:'',media:'',bg:color(session.org.color),busy:false,fileVersion:0};
    dialog.setAttribute('aria-labelledby','st-compose-title');dialog.removeAttribute('aria-label');
    dialog.innerHTML=`<div class="st-layout">
      <header class="st-topbar"><div><div class="st-eyebrow">Un moment à partager</div><h2 id="st-compose-title">Votre story</h2></div><button type="button" class="st-icon-button" id="st-compose-close" aria-label="Fermer la création de story">${svg('close')}</button></header>
      <div class="st-compose-body">
        <div class="st-tabs" role="group" aria-label="Format de la story"><button type="button" class="st-tab" id="st-tab-text" aria-pressed="true">${svg('text',16)}Texte</button><button type="button" class="st-tab" id="st-tab-photo" aria-pressed="false">${svg('photo',16)}Photo</button></div>
        <div id="st-preview" class="st-preview st-preview-text" aria-label="Aperçu de votre story"><img id="st-preview-photo" alt="Photo choisie pour la story" hidden><div class="st-upload-placeholder" id="st-upload-placeholder" hidden>${svg('photo',34)}<strong>Votre journée, en image.</strong><span>Choisissez une photo ou capturez le moment.</span></div><div class="st-preview-copy" id="st-preview-copy">Une pause. Un effort.\nUn peu d’énergie en plus.</div></div>
        <div class="st-palette" id="st-palette"><span>Couleur</span></div>
        <div class="st-upload-actions" id="st-upload-actions" hidden><button type="button" class="st-small-button" id="st-photo-library">${svg('photo',16)}Choisir une photo</button><button type="button" class="st-small-button" id="st-photo-camera">${svg('camera',16)}Appareil photo</button></div>
        <input id="st-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden>
        <label class="st-input-label" for="st-caption"><span id="st-caption-label">Votre message</span><span class="st-counter" id="st-counter">0 / 280</span></label>
        <textarea id="st-caption" class="st-textarea" maxlength="280" rows="3" placeholder="La sortie du midi fait du bien…"></textarea>
        <div class="st-audience">${svg('lock',16)}<span>Visible par les collègues de <strong id="st-audience-name"></strong> pendant <strong>24 heures</strong>.</span></div>
        <div id="st-compose-error" class="st-error" role="alert" hidden></div>
      </div><footer class="st-bottom-actions"><button type="button" class="st-primary" id="st-publish" disabled>${svg('send',17)}Publier ma story</button></footer></div>`;
    byId('st-audience-name').textContent=session.org.name;
    const colors=[color(session.org.color),'#123d35','#c34b27','#5a398c','#18263d'];
    [...new Set(colors)].forEach((bg,i)=>{
      const b=el('button','st-swatch');b.type='button';b.style.background=bg;b.setAttribute('aria-label',i===0?'Couleur de mon entreprise':['','Vert forêt','Terre cuite','Violet','Bleu nuit'][i]);b.setAttribute('aria-pressed',String(bg===composer.bg));
      b.addEventListener('click',()=>{composer.bg=bg;byId('st-palette').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));updateComposer();});byId('st-palette').append(b);
    });
    byId('st-compose-close').addEventListener('click',closeModal);
    for(const kind of ['text','photo'])byId('st-tab-'+kind).addEventListener('click',()=>{composer.type=kind;updateComposer();});
    byId('st-caption').addEventListener('input',e=>{composer.text=e.target.value;updateComposer();});
    byId('st-photo-library').addEventListener('click',()=>{byId('st-file').removeAttribute('capture');byId('st-file').click();});
    byId('st-photo-camera').addEventListener('click',()=>{byId('st-file').setAttribute('capture','environment');byId('st-file').click();});
    byId('st-file').addEventListener('change',loadPhoto);
    byId('st-publish').addEventListener('click',publish);
    updateComposer();showModal();byId('st-tab-text').focus({preventScroll:true});
  }

  function updateComposer(){
    if(!composer || modalMode!=='composer')return;
    const photo=composer.type==='photo';
    byId('st-tab-text').setAttribute('aria-pressed',String(!photo));byId('st-tab-photo').setAttribute('aria-pressed',String(photo));
    const preview=byId('st-preview');preview.className='st-preview '+(photo?'st-preview-photo':'st-preview-text')+(photo&&composer.media?' st-has-photo':'');
    preview.style.backgroundColor=photo ? '' : composer.bg;preview.style.color=photo ? '' : inkFor(composer.bg);
    byId('st-palette').hidden=photo;byId('st-upload-actions').hidden=!photo;
    const img=byId('st-preview-photo');img.hidden=!photo||!composer.media;if(composer.media)img.src=composer.media;
    byId('st-upload-placeholder').hidden=!photo||!!composer.media;
    const copy=byId('st-preview-copy');copy.textContent=composer.text||(photo?'':'Une pause. Un effort.\nUn peu d’énergie en plus.');
    copy.classList.toggle('st-long-text',composer.text.length>120);copy.hidden=photo&&!composer.media;
    byId('st-caption-label').textContent=photo?'Une légende ? (facultatif)':'Votre message';
    byId('st-counter').textContent=composer.text.length+' / 280';
    byId('st-publish').disabled=composer.busy||(photo?!composer.media:!composer.text.trim());
  }

  async function loadPhoto(event){
    const file=event.target.files?.[0];event.target.value='';if(!file||!composer)return;
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
      await D().createStory({type:draft.type,text:draft.text.trim(),media:draft.type==='photo'?draft.media:'',bg:draft.bg});
      if(composer!==draft)return;
      closeModal();render();notify('Votre story est publiée. Elle reste visible pendant 24 h.');
    }catch(err){if(composer===draft){setError(byId('st-compose-error'),err);draft.busy=false;byId('st-publish').innerHTML=svg('send',17)+'Publier ma story';updateComposer();}}
  }

  function openReader(userId){
    if(!openModal('reader'))return;
    const items=liveStories().filter(s=>s.userId===userId).sort((a,b)=>a.publishedAt-b.publishedAt);
    reader={ids:items.map(s=>s.id),index:0,elapsed:0,last:0,manualPaused:matchMedia('(prefers-reduced-motion:reduce)').matches,holding:false,actionPaused:false,duration:8000};
    if(items.length){const firstNew=items.findIndex(s=>!D().hasSeenStory(s.id));reader.index=Math.max(0,firstNew);showReaderStory();}else showUnavailable();
    showModal();byId('st-reader-close')?.focus({preventScroll:true});
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
    reader.duration=Math.max(7000,Math.min(16000,4000+String(story.text||'').length*60));
    const u=userFor(story.userId)||{name:'Collègue',team:''};
    dialog.setAttribute('aria-label','Story de '+u.name);dialog.removeAttribute('aria-labelledby');
    dialog.innerHTML=`<div class="st-layout st-reader"><div class="st-reader-media" id="st-reader-media"><div class="st-reader-text" id="st-reader-text"></div></div>
      <header class="st-reader-head"><div class="st-progress" id="st-progress" aria-hidden="true"></div><div class="st-reader-author-row"><span class="st-reader-avatar" id="st-reader-avatar"></span><div class="st-reader-meta"><span class="st-reader-author" id="st-reader-author"></span><span class="st-reader-when" id="st-reader-when"></span></div><button type="button" class="st-icon-button" id="st-reader-pause" aria-label="Mettre la story en pause">${svg('pause',16)}</button><button type="button" class="st-icon-button" id="st-reader-more" aria-label="Options de la story">${svg('more',18)}</button><button type="button" class="st-icon-button" id="st-reader-close" aria-label="Fermer la story">${svg('close',19)}</button></div></header>
      <div class="st-reader-spacer" id="st-reader-hold" aria-hidden="true"></div>
      <footer class="st-reader-bottom"><div class="st-private-line">${svg('lock',12)}<span id="st-reader-audience"></span></div><div class="st-reader-nav"><button type="button" class="st-reader-nav-button" id="st-reader-prev" aria-label="Story précédente">${svg('left',19)}</button><span class="st-reader-count" id="st-reader-count" aria-live="polite"></span><button type="button" class="st-reader-nav-button" id="st-reader-next" aria-label="Story suivante">${svg('right',19)}</button></div></footer></div>`;
    byId('st-reader-avatar').textContent=initials(u.name);byId('st-reader-author').textContent=u.name+(u.team?' · '+u.team:'');byId('st-reader-when').textContent=timeLabel(story);
    byId('st-reader-audience').textContent=current().org.shortName||current().org.name;
    const media=byId('st-reader-media'),text=byId('st-reader-text');
    const isPhoto=story.type==='photo'&&photoOK(story.media);
    media.classList.toggle('st-is-photo',isPhoto);media.style.backgroundColor=color(story.bg||current().org.color);
    text.textContent=story.text||'';text.style.color=isPhoto?'#fff':inkFor(story.bg||current().org.color);text.classList.toggle('st-long-text',(story.text||'').length>130);
    if(isPhoto){const img=el('img');img.alt=story.text||'Photo partagée par '+u.name;img.src=story.media;media.prepend(img);}
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
    updatePauseButton();
    try{D().markStorySeen(story.id);}catch(err){/* Seen status never blocks the reader. */}
    readFrame=requestAnimationFrame(tickReader);
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
    reader.actionPaused=true;updatePauseButton();
    const own=story.userId===current().user.id;
    action.setAttribute('aria-labelledby','st-action-title');
    action.innerHTML=`<h2 id="st-action-title">${own?'Supprimer cette story ?':'Signaler cette story'}</h2><p id="st-action-desc">${own?'Elle disparaîtra immédiatement de votre espace et de celui de vos collègues.':'Votre signalement sera transmis au responsable de votre entreprise.'}</p>${own?'':'<label for="st-report-reason">Motif du signalement</label><select id="st-report-reason"><option value="">Choisir un motif</option><option>Contenu inapproprié</option><option>Harcèlement ou propos blessants</option><option>Image publiée sans accord</option><option>Autre problème</option></select>'}<div id="st-action-error" class="st-error" role="alert" hidden></div><div class="st-action-row"><button type="button" class="st-small-button" id="st-action-cancel">Annuler</button><button type="button" class="st-primary ${own?'st-danger':''}" id="st-action-confirm">${own?'Supprimer':'Envoyer'}</button></div>`;
    action.setAttribute('aria-describedby','st-action-desc');fitDialogs();action.showModal();
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
