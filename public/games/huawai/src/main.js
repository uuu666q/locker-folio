import { STORAGE_KEY, freshProgress, blankCourt, sanitizeProgress, sampleTargets, coverSegment, recordPlayback, shouldFinishDrawing } from './core.js';
import { photoStage, photoView } from './photos.js';
import { backgroundVideo, bindBackgroundVideo } from './background-video.js';
import { interactionFromSource, sourcePoint } from './geometry.js';
import { createSceneTransition } from './scene-transition.js';
import { createPageTurn } from './page-turn.js';
import { mapColorMarkup } from './map-color.js';
import { animateFocus } from './focus-camera.js';
import { createFilmBuffer } from './film-buffer.js';
import { createBackgroundMusic } from './background-music.js';
import {isCraft,craftSvg,bindCraftDrawing} from './craft-interaction.js';
import {buttonContents} from './sketch-ui.js';
import {historyScrollMarkup,bindHistoryScroll} from './history-scroll.js';
import {journalArt} from './journal-art.js';
import {animateCourtyardArrival} from './courtyard-arrival.js';

const root = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (action, text, cls='', extra='') => `<button class="${cls} sketch-action" data-action="${action}" ${extra}>${buttonContents(action,text)}</button>`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let directoryConfig, backgroundVideos={}, courts, progress, page='home', court, state='PANORAMA', timers=[], epoch=0, storageWarning=false;
let selected=new Set(), targets=[], elapsed=0, paused=false, muted=false, simulated=true;
let loaded={}, mediaError='', photoError=false, modal=null, sketchExpanded=false, returnPage='directory';
let lastPointer=null, activePointer=null, lastClock=0;
let backgroundCleanup=()=>{};
let focusCleanup=()=>{};
let filmCleanup=()=>{};
let historyCleanup=()=>{};
const sceneTransition=createSceneTransition(root,reducedMotion);
const pageTurn=createPageTurn(root,reducedMotion);
const filmBuffer=createFilmBuffer();
const music=createBackgroundMusic({src:'./assets/audio/background.mp3',onChange:()=>{
  const control=root.querySelector('[data-action="music"]');
  if(control){control.innerHTML=buttonContents('music',music.label);control.setAttribute('aria-pressed',String(music.enabled));}
}});
const decodedAssets=new Map();
let resultReady=Promise.resolve();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch { storageWarning=true; document.querySelector('#storage-note')?.removeAttribute('hidden'); }
}
function currentProgress() { return progress.courts[court.id] ||= blankCourt(); }
function clearWork() {
  epoch++;
  historyCleanup();historyCleanup=()=>{};
  focusCleanup();focusCleanup=()=>{};
  filmCleanup();filmCleanup=()=>{};
  backgroundCleanup();backgroundCleanup=()=>{};
  timers.forEach(id=>{clearTimeout(id);clearInterval(id);}); timers=[];
  const v=document.querySelector('video'); if(v) { v.pause(); v.removeAttribute('src'); v.load(); }
  activePointer=null; lastPointer=null;
}
function later(fn, ms) { const token=epoch; const id=setTimeout(()=>{if(token===epoch){if(modal)later(fn,100);else fn();}},ms); timers.push(id); }
function duration(name) { return reducedMotion ? 80 : court.transitions[name]; }
function go(destination) { pageTurn.cancel();sceneTransition.cancel();clearWork();filmBuffer.release(); modal=null; page=destination; render(); }
async function beginTour() {
  return sceneTransition.run(async()=>{
    clearWork();modal=null;page='directory';render();
    const paper=new Image();paper.src=directoryConfig.extension;
    // Decode the map and paper under the black cover, before revealing the new layout.
    let timeout;
    await Promise.race([
      Promise.allSettled([document.querySelector('.map-original').decode(),paper.decode(),document.fonts.ready]),
      new Promise(resolve=>timeout=setTimeout(resolve,5000))
    ]);
    clearTimeout(timeout);
  },{hold:260,fade:900});
}
function status(c) { const p=progress.courts[c.id]; return p?.completed ? '已补画' : p?.visited ? '已浏览' : '未探索'; }
function image(src, cls='', extra='') { return `<img class="${cls}" src="${esc(src)}" alt="" draggable="false" ${extra}>`; }
function usesPhotoCrop(c,key) { return !!c.photos&&(key==='realityResult'||c.assets[key]===c.assets.focusReference); }
function layer(key, cls='', style='') { return loaded[key] ? (usesPhotoCrop(court,key)?photoStage(court,key,{className:`scene-image ${cls}`,style}):image(court.assets[key],`scene-image ${cls}`,style?`style="${style}"`:'')) : ''; }
function preview(c,key,cls='') {return usesPhotoCrop(c,key)?photoStage(c,key,{className:`photo-preview ${cls}`}):image(c.assets[key],cls);}
function header() {
  if(page==='scene'&&['DRAWING','FOCUS_REVIEW','PEN_FINISH','REVEAL'].includes(state))return `<header class="site-header"><nav aria-label="主导航">${button('directory','四院目录')}</nav></header>`;
  return `<header class="site-header"><nav aria-label="主导航">${button('directory','<span class="nav-symbol">▦</span> 四院目录',page==='directory'?'active':'')}${button('journal','<span class="nav-symbol">▤</span> 我的画笺',page==='journal'?'active':'')}${button('about','关于作品','nav-about')}</nav></header>`;
}
function footer() {
  return `<footer class="site-footer"><div><span id="storage-note" ${storageWarning?'':'hidden'}>进度暂时无法保存</span>${button('music',music.label,'music-toggle',`aria-pressed="${music.enabled}" title="背景音乐：文化短片期间自动暂停"`)}${button('reset','重置体验','reset')}</div></footer>`;
}
function notebookFrame() {
  return `<div class="notebook-frame" aria-hidden="true"><div class="notebook-paper-edge"></div><div class="notebook-binding">${Array.from({length:11},()=>'<i></i>').join('')}</div></div>`;
}
function home() {
  const visited=!!progress.lastCourt;
  return `<main class="home"><div class="home-art">${backgroundVideo(backgroundVideos.home,{autoplay:true,videoOnly:true})}</div><section class="home-copy"><h1>画外的一笔</h1><p class="intro">循着一笔，走进四院。</p><div class="home-actions">${button('start','开始游览','primary large')}${visited?button('continue','继续上次','text-button'):''}</div></section></main>`;
}
function directory() {
  const d=directoryConfig, scale=1080/d.height, width=d.width*scale;
  return `<main class="directory map-directory"><div class="directory-heading">${folioTitle('四院目录','游')}</div><div class="map-canvas"><img class="map-original" src="${esc(d.image)}" alt="清真大寺四进院速写总览">${mapColorMarkup(progress)}${d.chapters.map(mark=>{
    const c=courts.find(c=>c.id===mark.id),x=(1920-width)/2+mark.point[0]*scale,y=mark.point[1]*scale;
    return `<button class="map-chapter ${mark.side} ${progress.courts[c.id]?.completed?'is-complete':''}" data-action="enter" data-id="${c.id}" style="--anchor-x:${x/1920-.5};left:${x/1920*100}%;top:${y/1080*100}%" aria-label="进入${c.name}·${c.building}，${status(c)}"><span class="map-dot">${c.order}</span><span class="map-caption"><small>${c.name} / ${status(c)}</small><strong>${c.building}</strong><em>${c.action}</em></span></button>`;
  }).join('')}</div><nav class="directory-compact-index" aria-label="四院速写索引">${courts.map(c=>`<button data-action="enter" data-court="${c.id}"><span class="index-number">${c.order}</span><span><strong>${c.building}</strong><small><span class="index-action">${c.action}</span><span class="index-status">${status(c)}</span></small></span></button>`).join('')}</nav></main>`;
}
function folioTitle(title,seal) {
  return `<h1 class="folio-title"><span class="folio-seal" aria-hidden="true">${esc(seal)}</span><span class="folio-title-text">${esc(title)}</span></h1>`;
}
function journal() {
  const completed=courts.filter(c=>progress.courts[c.id]?.completed).length;
  return `<main class="journal page-content"><div class="page-heading">${folioTitle('我的画笺','记')}<p>已完成 ${completed} / 4</p></div><section class="journal-sheet"><div class="journal-grid">${courts.map(c=>{const p=progress.courts[c.id]||blankCourt();return `<article class="journal-item ${p.completed?'complete':''}" data-court="${c.id}">${journalArt(c,p)}<div class="journal-copy"><h3><small>${c.name}</small>${c.building}</h3><p class="journal-status">${p.completed?'已补画':p.visited?'补画进度 '+Math.round(p.coverage*100)+'%':'未探索'}</p><p class="journal-fact ${p.completed?'':'locked'}">${p.completed?esc(c.journalFact):'待补一笔，留下一则院中小识。'}</p></div></article>`;}).join('')}</div></section><div class="journal-bottom">${button('directory','继续探索','primary')}${button('back-journal','返回','text-button')}</div></main>`;
}
function sceneHeading() {
  if(!['PANORAMA','LOADING','REALITY_RESULT'].includes(state))return '';
  return `<div class="scene-heading court-heading"><span class="court-heading-seal" aria-hidden="true">${['壹','贰','叁','肆'][court.order-1]}</span><div class="court-heading-copy"><p>${esc(court.name)}<span class="court-heading-rule" aria-hidden="true"></span></p><h1>${esc(court.building)}</h1></div></div>`;
}
function journeySteps() {
  const steps=['观察','补画','入墨','回到实景'];
  const icons=[
    '<path d="M5 16q11-14 22 0-11 14-22 0Z"/><circle cx="16" cy="16" r="3.5"/>',
    '<path d="m10 22 13-17 3 3-13 17-6 2 3-5Zm8-11 4 3M6 29q10 1 19-2"/>',
    '<path d="M16 4c-2 6-9 10-9 17a9 9 0 0 0 18 0c0-7-7-11-9-17Z M12 21q0 4 4 5"/>',
    '<path d="M4 26 12 12l6 9 5-13 6 18ZM8 27h19"/><circle cx="9" cy="7" r="2"/>'
  ];
  const current=['LOADING','PANORAMA'].includes(state)?0:['FOCUS_TRANSITION','FOCUS_REVIEW','DRAWING','PEN_FINISH'].includes(state)?1:['REVEAL','VIDEO','TAIL'].includes(state)?2:3;
  return `<ol class="journey-steps" aria-label="体验流程">${steps.map((label,i)=>`<li ${i===current?'aria-current="step"':''} class="${i<current?'passed':''}"><span class="journey-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"><path class="journey-orbit" d="M-3 17C-4-7 39-8 36 17S-4 40-3 17M2 4C16-4 33-1 36 14"/>${icons[i]}</svg></span><span class="journey-label">${label}</span></li>`).join('')}</ol>`;
}
function background() {
  const base=layer('sketchBase')||layer('panorama');
  const completedArt=isCraft(court)?craftSvg(court,currentProgress(),{complete:true}):'';
  if(state==='LOADING') return (court.photos?photoStage(court,'panorama',{className:'scene-image'}):image(court.assets.panorama,'scene-image'))+'<div class="loading-label">正在准备本院画面…</div>';
  if(state==='PANORAMA') return `<img class="observation-image" src="${esc(court.assets.panorama)}" alt="${esc(court.building)}速写" draggable="false">`;
  if(state==='FOCUS_TRANSITION') return court.photos?photoView(court,'focus',{className:'scene-image',from:'entry',duration:duration('focus')}):layer('panorama')+layer('sketchBase','fade-in',`--fade:${duration('focus')}ms`);
  if(state==='FOCUS_REVIEW') return layer('sketchComplete')+completedArt;
  if(state==='DRAWING') return base+(isCraft(court)?'':concealedStrokes());
  if(state==='PEN_FINISH') return (layer('sketchComplete')||base)+completedArt;
  if(state==='REVEAL') return layer('sketchComplete')+layer('watercolorStart','fade-in',`--fade:${duration('sketchToInk')}ms`)+completedArt;
  if(state==='VIDEO') return (layer('sketchComplete')||base)+completedArt+(simulated?layer('watercolorEnd','sim-tail',`opacity:${Math.min(1,elapsed/court.media.simulationDuration)}`):'<div class="culture-film-slot"></div><p class="film-loading" role="status">正在接续短片…</p>');
  if(state==='TAIL') return layer('watercolorEnd')||layer('watercolorStart');
  return (photoError?layer('watercolorEnd')||layer('watercolorStart')||base:layer('realityResult'))||base;
}
function concealedStrokes(){
  const i=court.interaction;
  const marks=i.region?`<rect x="${i.region[0]*1920}" y="${i.region[1]*1080}" width="${i.region[2]*1920}" height="${i.region[3]*1080}" fill="white"/>`:i.paths.map(p=>`<polyline points="${p.map(([x,y])=>[x*1920,y*1080].join(',')).join(' ')}" fill="none" stroke="white" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg class="scene-image" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><filter id="soft-paper-edge"><feGaussianBlur stdDeviation="4"/></filter><mask id="missing-strokes"><g filter="url(#soft-paper-edge)">${marks}</g></mask></defs><image href="${esc(directoryConfig.extension)}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity=".91" mask="url(#missing-strokes)"/></svg>`;
}
function guideSvg() {
  if(isCraft(court))return craftSvg(court,currentProgress());
  const p=currentProgress(), tint=p.color||court.colors?.[0]?.value||'#6f8779';
  const region=court.interaction.region;
  const regionRect=region?`<rect x="${region[0]*1920}" y="${region[1]*1080}" width="${region[2]*1920}" height="${region[3]*1080}"/>`:'';
  const guides=court.interaction.region?(()=>{const [x,y,w,h]=court.interaction.region;return `<path d="M ${x*1920} ${(y+h/2)*1080} H ${(x+w)*1920}"/>`;})():court.interaction.paths.map(points=>`<polyline points="${points.map(([x,y])=>`${x*1920},${y*1080}`).join(' ')}"/>`).join('');
  const circles=[...selected].map(i=>targets[i]?`<circle cx="${targets[i][0]*1920}" cy="${targets[i][1]*1080}" r="61" fill="white"/>`:'').join('');
  return `<svg id="drawing" class="drawing" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-label="补画区域，沿浅色引导线轻划，或使用自动补全"><defs><mask id="reveal-mask"><rect width="1920" height="1080" fill="black"/><g id="mask-marks">${circles}</g></mask><clipPath id="region-clip">${regionRect}</clipPath></defs><g ${region?'clip-path="url(#region-clip)"':''}><g mask="url(#reveal-mask)">${usesPhotoCrop(court,'interactionLayer')?photoStage(court,'interactionLayer'):`<image href="${esc(court.assets.interactionLayer)}" width="1920" height="1080"/>`}</g>${court.interaction.type==='color'?`<g mask="url(#reveal-mask)" fill="${tint}" opacity=".62">${regionRect}</g>`:''}</g><g class="draw-guides" fill="none" stroke="#ac7755" stroke-width="8" stroke-dasharray="10 14">${guides}</g></svg>`;
}
function sceneControls() {
  const p=currentProgress();
  if(state==='PANORAMA') return `<aside class="observation-notes" aria-label="本院操作"><p class="observation-note">${esc(court.prompt)}</p><div class="observation-entry">${button('focus',p.completed?'查看补画':'开始补画','observation-focus')}</div>${p.completed?`<div class="observation-links">${button('result','查看实景','text-button')}${button('replay','重新回顾','text-button')}</div>`:''}</aside>`;

  if(state==='FOCUS_REVIEW') return `<div class="drawing-toolbar review-toolbar">${button('panorama','返回','light')}<p>已完成补画</p>${button('replay','重新补画','primary')}</div>`;
  if(state==='DRAWING') return `${guideSvg()}<div class="drawing-toolbar" role="group" aria-label="补画工具">${button('panorama','返回','light')}<div class="drawing-task"><p id="drawing-status" role="status">${esc(court.prompt)}</p><div class="coverage" aria-label="补画进度"><div class="progress-track"><i id="coverage-bar" style="width:${p.coverage*100}%"></i></div><b id="coverage">${court.interaction.type==='carve'?selected.size+' / 4 字':Math.round(p.coverage*100)+'%'}</b></div></div>${court.colors.length?`<div class="palette" aria-label="画笔颜色">${court.colors.map(c=>button('color',`<i style="background:${c.value}"></i>${c.name}`,p.color===c.value?'selected':'',`data-color="${c.value}" aria-pressed="${p.color===c.value}"`)).join('')}</div>`:''}${button('auto','自动补全','primary')}</div>`;
  if(state==='VIDEO') return `${simulated?'<div class="media-label">短片预览</div>':''}<div class="subtitle" id="subtitle">${esc(subtitle())}</div><div class="video-controls">${button('pause',paused?'继续播放':'暂停','light','id="pause-button"')}<div class="video-progress"><span id="elapsed">${elapsed.toFixed(1)}s</span><div class="progress-track"><i id="video-bar" style="width:${elapsed/court.media.simulationDuration*100}%"></i></div></div>${simulated?'':button('mute',muted?'开启声音':'静音','light','id="mute-button"')}${button('skip','跳过短片','light')}</div>`;
  if(state==='REALITY_RESULT') return `${historyScrollMarkup(court)}<div class="result-panel">${photoError?'<p class="error-note">实景照片暂未加载</p>':''}${mediaError?`<p class="error-note">${esc(mediaError)}</p>`:''}<div class="result-actions">${court.nextCourtId?button('next','下一院','primary'):button('journal','查看画笺','primary')}${button('replay',mediaError?'重试短片':'重新回顾','light')}${button('directory','返回目录','text-button')}${photoError?button('retry-photo','重试加载照片','light'):''}</div></div>`;
  if(state==='LOADING') return '';
  return '';
}
function scene() {
  return `<main class="scene-page">${sceneHeading()}${journeySteps()}<section class="stage ${court.artwork?'sketch-stage':''} ${court.photos?'photo-stage':''} ${court.presentation?.portraitResult&&['REALITY_RESULT','REALITY_TRANSITION'].includes(state)&&!backgroundVideos[court.id]?'portrait-result':''} ${court.presentation?.portraitEntry&&state==='PANORAMA'?'portrait-entry':''}" data-state="${state}" data-tool="${court.interaction.type}" aria-label="${court.name}体验舞台"><div class="scene-images">${background()}</div>${state==='REALITY_RESULT'?backgroundVideo(backgroundVideos[court.id],{autoplay:true}):''}${state==='PANORAMA'&&!loaded.panorama?`<div class="media-label warning">全景图片暂未加载 ${button('retry-scene','重试加载','text-button')}</div>`:''}${sceneControls()}</section></main>`;
}
function modalMarkup() {
  let title='',body='',actions='';
  if(modal==='about') {
    title='关于《画外的一笔》';
    body=`<p>《画外的一笔》以西安化觉巷清真大寺为起点，将木牌坊、石牌坊、省心楼与礼拜大殿串联成一段穿行四进院落的探索。我们用速写记录建筑的轮廓，也邀请你放慢脚步，发现屋檐、构件与院落之间容易被忽略的细节，走近它们背后的历史与文化。</p>
      <p>画中的空白，是留给你的参与空间。通过观察与补画，你亲手添上一笔；当手绘转为实景，纸上的线条便与真实的建筑相遇。“画外”是等待被认识的世界，“一笔”是你与它建立联系的开始。</p>
      <p><strong>创作团队</strong><br>刘伊璠、谌柚<br>太原理工大学 · 数字媒体艺术专业 · 大二学生</p>
      <p><strong>影像来源</strong><br>作品中的实景视频素材来源于光厂平台，已购买个人授权。</p>`;
  }
  if(modal==='reset') {title='重置体验？';body='<p>这会清除此浏览器中四院的浏览、补画与播放记录，回到开始页。</p>';actions=button('confirm-reset','清除进度并重新开始','primary');}
  if(modal==='reset-court') {title='重新补画这一院？';body='<p>只清除当前院落的笔画与选色，其他院落及观影记录保留。“重新回顾”也会从补画开始，但保留本院选色。</p>';actions=button('confirm-reset-court','清除本院补画','primary');}
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="关闭">×</button><h2 id="modal-title">${title}</h2>${body}<div class="modal-actions">${actions}${button('close-modal',actions?'取消':'返回','light')}</div></section></div>`;
}
function render() {
  historyCleanup();historyCleanup=()=>{};
  music.setBlocked(page==='scene'&&['REVEAL','VIDEO','TAIL'].includes(state));
  backgroundCleanup();backgroundCleanup=()=>{};
  root.dataset.page=page;root.dataset.phase=page==='scene'?state:'';
  const notebook=page==='directory'||page==='journal'||(page==='scene'&&['PANORAMA','LOADING'].includes(state));
  root.dataset.notebook=String(notebook);
  const paper=notebook||(page==='scene'&&['FOCUS_TRANSITION','FOCUS_REVIEW','DRAWING','PEN_FINISH','REVEAL'].includes(state));
  root.innerHTML=header()+(page==='home'?home():page==='directory'?directory():page==='journal'?journal():scene())+(paper?'<div class="paper-gold-grain" aria-hidden="true"></div>':'')+(notebook?notebookFrame():'')+footer()+(modal?modalMarkup():'');
  if(page==='scene'&&state==='VIDEO'&&!simulated)root.querySelector('.culture-film-slot').replaceWith(filmBuffer.take(court));
  if(page==='directory'){
    const map=root.querySelector('.map-original');
    // Never expose floating pigment shapes before the underlying ink has decoded.
    map.decode().then(()=>{if(map.isConnected)map.dataset.ready='true';}).catch(()=>{});
  }
  const isResult=page==='scene'&&state==='REALITY_RESULT',token=epoch;
  let resolveReady;
  resultReady=isResult&&root.querySelector('.background-video')?new Promise(resolve=>resolveReady=resolve):Promise.resolve();
  backgroundCleanup=bindBackgroundVideo(root,{onReady:ok=>{
    if(token!==epoch)return;
    if(isResult&&ok){currentProgress().realityShown=true;persist();}
    resolveReady?.();
  }});
  if(isResult)historyCleanup=bindHistoryScroll(root.querySelector('.stage'),{ready:resultReady,blocked:()=>sceneTransition.active||!!modal,reducedMotion});
  if(page==='scene'&&state==='DRAWING') bindDrawing();
  if(modal) document.querySelector('.modal button')?.focus();
}
function setState(next) {
  if(next==='FOCUS_TRANSITION'&&state==='PANORAMA'){
    clearWork();state=next;
    root.querySelector('.journey-steps')?.replaceWith(document.createRange().createContextualFragment(journeySteps()));
    focusCleanup=animateFocus(root,court,duration('focus'),()=>setState(currentProgress().completed?'FOCUS_REVIEW':'DRAWING'));
    return;
  }
  clearWork(); state=next; render();
  if(next==='PANORAMA'||next==='DRAWING'||next==='FOCUS_REVIEW')filmBuffer.prepare(court);
  if(next==='FOCUS_TRANSITION') later(()=>setState(currentProgress().completed?'FOCUS_REVIEW':'DRAWING'),duration('focus'));
  if(next==='PEN_FINISH') later(()=>setState('REVEAL'),duration('penFinish'));
  if(next==='REVEAL') later(startVideo,duration('sketchToInk'));
  if(next==='TAIL') later(()=>toReality(),duration('tailHold'));
}
function decodeAsset(src) {
  if(!decodedAssets.has(src)){
    const pending=(async()=>{
      const img=new Image();img.src=src;let timeout;
      const ok=await Promise.race([img.decode().then(()=>true,()=>false),new Promise(resolve=>timeout=setTimeout(()=>resolve(false),5000))]);
      clearTimeout(timeout);
      if(!ok)decodedAssets.delete(src);
      return ok?img:null;
    })();
    decodedAssets.set(src,pending);
  }
  return decodedAssets.get(src);
}
async function loadAssets(token) {
  // The distant result photo must not delay entry into the sketch. Warm it in the background.
  const target=court;
  if(target.assets.realityResult)decodeAsset(target.assets.realityResult).then(img=>{if(court===target&&page==='scene'){loaded.realityResult=!!img;photoError=!img;}});
  const entries=await Promise.all(Object.entries(target.assets).filter(([key,value])=>!['video','realityResult'].includes(key)&&value).map(async([key,src])=>[key,!!await decodeAsset(src)]));
  if(token!==epoch)return false;
  loaded={...loaded,...Object.fromEntries(entries)};photoError=!loaded.realityResult;return true;
}
async function enter(id,{blackout=false}={}) {
  const fromDirectory=page==='directory';
  pageTurn.cancel();sceneTransition.cancel();
  if(blackout)return sceneTransition.run(()=>loadCourt(id),{hold:duration('blackout'),fade:duration('sceneFade')});
  if(fromDirectory)return pageTurn.run(()=>loadCourt(id),{onReveal:()=>animateCourtyardArrival(root,reducedMotion)});
  return sceneTransition.run(()=>loadCourt(id),{hold:100,fade:360});
}
async function loadCourt(id) {
  clearWork();court=courts.find(c=>c.id===id)||courts[0];page='scene';modal=null;state='LOADING';loaded={};mediaError='';photoError=false;sketchExpanded=false;
  progress.lastCourt=court.id;const p=currentProgress();p.visited=true;
  if(court.colors.length&&!p.color)p.color=court.colors[0].value;
  targets=sampleTargets(court.interaction);
  if(p.interactionRevision!==court.interactionRevision){Object.assign(p,{cells:[],strokes:[],coverage:0,completed:false,completionMethod:null,interactionRevision:court.interactionRevision});}
  selected=new Set(p.cells.filter(i=>i<targets.length));p.coverage=selected.size/targets.length;persist();render();
  const token=epoch;
  if(await loadAssets(token)) {
    setState('PANORAMA');
    // Decode the actual displayed element before the incoming page is captured.
    const arrivalToken=epoch;
    await root.querySelector('.observation-image')?.decode().catch(()=>{});
    if(arrivalToken!==epoch)return false;
    if(!loaded.panorama) {mediaError='全景图暂未加载，请重试加载或返回目录。';toast(mediaError);}
    return true;
  }
  return false;
}
function saveDrawing() {const p=currentProgress();p.cells=[...selected];p.coverage=selected.size/targets.length;persist();}
function finishDrawing(method) {
  if(state!=='DRAWING'||currentProgress().completed)return;
  if(method==='auto')selected=new Set(targets.map((_,i)=>i));
  saveDrawing();Object.assign(currentProgress(),{completed:true,completionMethod:method});persist();setState('PEN_FINISH');
}
function bindDrawing() {
  const svg=document.querySelector('#drawing');
  if(isCraft(court)){
    bindCraftDrawing(svg,court,currentProgress(),{selected,targets,schedule:later,onFinish:()=>finishDrawing('manual'),onProgress:commit=>{
      const coverage=selected.size/targets.length;
      currentProgress().coverage=coverage;currentProgress().cells=[...selected];
      document.querySelector('#coverage').textContent=court.interaction.type==='carve'?`${selected.size} / 4 字`:Math.round(coverage*100)+'%';
      document.querySelector('#coverage-bar').style.width=coverage*100+'%';
      document.querySelector('#drawing-status').textContent=court.interaction.type!=='carve'&&coverage>=court.interaction.threshold?'松手完成':court.prompt;
      if(commit)persist();
    }});
    return;
  }
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [p.x/1920,p.y/1080];};
  const draw=e=>{
    if(activePointer!==e.pointerId||state!=='DRAWING')return;
    const next=point(e), previous=new Set(selected);coverSegment(targets,selected,lastPointer||next,next,court.interaction.radius);lastPointer=next;
    for(const i of selected)if(!previous.has(i)){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',targets[i][0]*1920);circle.setAttribute('cy',targets[i][1]*1080);circle.setAttribute('r','61');circle.setAttribute('fill','white');document.querySelector('#mask-marks').append(circle);}
    const coverage=selected.size/targets.length;document.querySelector('#coverage').textContent=Math.round(coverage*100)+'%';document.querySelector('#coverage-bar').style.width=coverage*100+'%';
    document.querySelector('#drawing-status').textContent=coverage>=court.interaction.threshold?'松手完成':court.prompt;
  };
  svg.addEventListener('pointerdown',e=>{if(activePointer!==null||e.button>0)return;e.preventDefault();activePointer=e.pointerId;try{svg.setPointerCapture(e.pointerId);}catch{/* Pointer may already have been cancelled by the OS. */}lastPointer=point(e);draw(e);});
  svg.addEventListener('pointermove',draw);
  const end=e=>{
    if(activePointer!==e.pointerId)return;
    if(e.type==='pointerup')draw(e);
    saveDrawing();activePointer=null;lastPointer=null;
    if(shouldFinishDrawing(e.type,selected.size/targets.length,court.interaction.threshold))finishDrawing('manual');
  };
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
}
function subtitle() {return !simulated&&court.media.useOverlaySubtitles===false?'':court.subtitleTimeline.find(s=>elapsed>=s.start&&elapsed<s.end)?.text||'';}
function updatePlaybackUi() {
  const v=document.querySelector('video'), length=simulated?court.media.simulationDuration:(v?.duration||court.media.simulationDuration);
  if(document.querySelector('#elapsed'))document.querySelector('#elapsed').textContent=elapsed.toFixed(1)+'s';
  if(document.querySelector('#video-bar'))document.querySelector('#video-bar').style.width=Math.min(100,elapsed/length*100)+'%';
  if(document.querySelector('.sim-tail'))document.querySelector('.sim-tail').style.opacity=Math.min(1,elapsed/length);
  if(document.querySelector('#subtitle'))document.querySelector('#subtitle').textContent=subtitle();
  const pauseButton=document.querySelector('#pause-button');
  if(pauseButton&&pauseButton.dataset.paused!==String(paused)){
    pauseButton.innerHTML=buttonContents('pause',paused?'继续播放':'暂停');pauseButton.dataset.paused=String(paused);
  }
}
function startVideo() {
  simulated=!court.assets.video||!court.media.videoReady;elapsed=0;paused=document.hidden;mediaError='';setState('VIDEO');lastClock=performance.now();
  const token=epoch;
  if(simulated) {
    const id=setInterval(()=>{if(token!==epoch)return;const now=performance.now();if(!paused){elapsed=Math.min(court.media.simulationDuration,elapsed+Math.min(.25,(now-lastClock)/1000));updatePlaybackUi();if(elapsed>=court.media.simulationDuration)finishVideo();}lastClock=now;},50);timers.push(id);
  } else {
    const v=root.querySelector('.scene-video');v.muted=muted;
    let frame;
    const reveal=()=>{if(token!==epoch)return;v.classList.add('film-visible');root.querySelector('.film-loading')?.remove();};
    const revealFrame=()=>{if(frame!==undefined||token!==epoch)return;if(v.requestVideoFrameCallback)frame=v.requestVideoFrameCallback(reveal);else if(v.readyState>=2)reveal();};
    v.addEventListener('playing',revealFrame);
    filmCleanup=()=>{v.removeEventListener('playing',revealFrame);if(frame!==undefined)v.cancelVideoFrameCallback(frame);};
    v.addEventListener('timeupdate',()=>{if(token===epoch){elapsed=v.currentTime;updatePlaybackUi();}});
    v.addEventListener('ended',()=>{if(token===epoch)finishVideo();});
    v.addEventListener('error',()=>{if(token===epoch)failVideo();});
    v.addEventListener('playing',()=>{if(token===epoch){paused=false;updatePlaybackUi();}});
    if(!paused)v.play().then(revealFrame).catch(error=>{if(token===epoch&&error.name!=='AbortError'){paused=true;updatePlaybackUi();root.querySelector('.film-loading')?.remove();toast('浏览器暂停了自动播放，请点击继续播放。');}});
    later(()=>{if(v.readyState<2&&!document.hidden&&!paused)failVideo();},10000);
  }
}
function finishVideo() {if(state!=='VIDEO')return;recordPlayback(currentProgress(),'watched',simulated);persist();if(backgroundVideos[court.id])toReality();else setState('TAIL');}
function failVideo() {recordPlayback(currentProgress(),'failed',false);persist();mediaError='视频暂未播放成功，可重试或继续游览。';toReality();}
function toReality() {
  return sceneTransition.run(()=>{showResult();return resultReady;},{hold:duration('blackout'),fade:duration('sceneFade')});
}
function showResult() {
  const p=currentProgress();p.resultPreviewShown=true;
  if(!backgroundVideos[court.id]&&!photoError&&court.media.realityIsVerifiedPhoto)p.realityShown=true;
  persist();setState('REALITY_RESULT');
}
function replay() {
  if(page!=='scene')return;
  mediaError='';selected=new Set();
  Object.assign(currentProgress(),{cells:[],strokes:[],coverage:0,completed:false,completionMethod:null});persist();
  return sceneTransition.run(()=>setState('DRAWING'),{hold:duration('blackout'),fade:duration('sceneFade')});
}
function togglePause(force) {
  if(state!=='VIDEO')return;paused=typeof force==='boolean'?force:!paused;
  const v=document.querySelector('video');if(v){if(paused)v.pause();else v.play().catch(()=>{paused=true;updatePlaybackUi();toast('短片无法播放，请重试或跳过。');});}lastClock=performance.now();updatePlaybackUi();
}
function toast(message) {document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.role='status';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),5000);}
function openModal(kind) {
  document.querySelector('.background-media:not([data-autoplay]) .background-video')?.pause();
  if(state==='VIDEO'&&page==='scene')togglePause(true);
  modal=kind;
  document.querySelector('.modal-backdrop')?.remove();root.insertAdjacentHTML('beforeend',modalMarkup());document.querySelector('.modal button').focus();
}
root.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el)return;
  const action=el.dataset.action;
  if(action==='music'){music.toggle();return;}
  if(action==='close-modal'){modal=null;document.querySelector('.modal-backdrop')?.remove();document.querySelector('[data-action="about"]')?.focus();return;}
  if(action==='home'){go('home');return;}
  if(action==='directory'){go('directory');return;}
  if(action==='journal'){if(page!=='journal')returnPage=page;go('journal');return;}
  if(action==='back-journal'){if(returnPage==='scene'&&court)enter(court.id);else go(returnPage);return;}
  if(action==='start'){beginTour();return;}
  if(action==='continue'){enter(progress.lastCourt||courts[0].id);return;}
  if(action==='enter'){enter(el.dataset.id||el.dataset.court);return;}
  if(['about','reset','reset-court'].includes(action)){openModal(action);return;}
  if(action==='confirm-reset'){progress=freshProgress();persist();go('home');return;}
  if(action==='confirm-reset-court'){Object.assign(currentProgress(),{cells:[],strokes:[],coverage:0,completed:false,completionMethod:null,color:null});persist();if(await enter(court.id))setState('FOCUS_TRANSITION');return;}
  if(page!=='scene')return;
  if(action==='retry-scene'){enter(court.id);return;}
  if(action==='panorama'&&state!=='LOADING'){setState('PANORAMA');return;}
  if(action==='focus'&&state==='PANORAMA'){setState('FOCUS_TRANSITION');return;}
  if(action==='toggle-sketch'&&state==='PANORAMA'){sketchExpanded=!sketchExpanded;render();return;}
  if(action==='auto'&&state==='DRAWING'){finishDrawing('auto');return;}
  if(action==='color'&&state==='DRAWING'){saveDrawing();currentProgress().color=el.dataset.color;persist();render();return;}
  if(action==='skip'&&state==='VIDEO'){recordPlayback(currentProgress(),'skipped',simulated);persist();toReality();return;}
  if(action==='pause'){togglePause();return;}
  if(action==='mute'){muted=!muted;const v=document.querySelector('video');if(v)v.muted=muted;el.innerHTML=buttonContents('mute',muted?'开启声音':'静音');return;}
  if(action==='result'&&state==='PANORAMA'){showResult();return;}
  if(action==='replay'&&['PANORAMA','FOCUS_REVIEW','REALITY_RESULT'].includes(state)){replay();return;}
  if(action==='next'&&state==='REALITY_RESULT'&&court.nextCourtId){enter(court.nextCourtId,{blackout:true});return;}
  if(action==='retry-photo'&&state==='REALITY_RESULT'){el.disabled=true;el.innerHTML=buttonContents('retry-photo','正在重新加载…');if(await loadAssets(epoch))showResult();}
});
// Prepare only the court under the pointer/focus, not four competing video downloads.
function warmEntry(e){const entry=e.target.closest('[data-action="enter"]');if(!entry)return;const c=courts.find(c=>c.id===(entry.dataset.id||entry.dataset.court));if(c)decodeAsset(c.assets.panorama);}
root.addEventListener('pointerover',warmEntry);root.addEventListener('focusin',warmEntry);
// The first visitor action also enables music; later renders never recreate it.
document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-action="music"]'))music.unlock();},{passive:true});
document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.target.closest('[data-action="music"]'))music.unlock();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(page==='scene'&&state==='VIDEO')togglePause(true);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(modal){modal=null;document.querySelector('.modal-backdrop')?.remove();}else go('directory');}
  if(e.key==='Tab'&&modal){const focusable=[...document.querySelectorAll('.modal button,.modal a')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
window.addEventListener('pagehide',()=>{if(page==='scene'&&state==='DRAWING')saveDrawing();});
try {
  const getJson=async url=>{const response=await fetch(url);if(!response.ok)throw Error('配置请求失败');return response.json();};
  const [directoryData,backgroundData,courtData,playback]=await Promise.all([getJson('./content/directory.json'),getJson('./content/background-videos.json'),getJson('./content/courtyards.json'),getJson('./content/playback-manifest.json').catch(()=>({}))]);
  directoryConfig=directoryData;backgroundVideos=backgroundData;courts=courtData;
  for(const c of courts){const web=playback[c.assets.video];if(web&&(!c.media.videoVersion||web.sourceHash.startsWith(c.media.videoVersion)))c.assets.video=web.src;}
  for(const c of Object.values(backgroundVideos))if(playback[c.src])c.src=playback[c.src].src;
  document.documentElement.style.setProperty('--paper-extension',`url("${directoryConfig.extension.replaceAll('"','%22')}")`);
  courts=courts.map(c=>{const mapped={...c,interaction:interactionFromSource(c)};if(c.sourceHotspot){const [x,y]=sourcePoint(c,c.sourceHotspot,'entry');mapped.hotspot={...c.hotspot,x,y};}return mapped;});
  try {progress=sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)),courts);} catch {progress=freshProgress();storageWarning=true;}
  render();
  // The next page's small map is ready before "开始游览"; this does not hold up the cover.
  const warmMap=()=>setTimeout(()=>{decodeAsset(directoryConfig.image);decodeAsset(directoryConfig.extension);},0);
  if(document.readyState==='complete')warmMap();else window.addEventListener('load',warmMap,{once:true});
} catch(error) {root.innerHTML=`<main class="fatal"><h1>画卷暂未展开</h1><p>请检查本地服务与 content/courtyards.json 配置后刷新。</p><p>${esc(error.message)}</p><button onclick="location.reload()">重新加载</button></main>`;}
