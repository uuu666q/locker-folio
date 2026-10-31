// Independent from the cultural film state: these clips are real-scene backgrounds.
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function backgroundVideo(config, {autoplay=false,videoOnly=false}={}) {
  if (!config?.src) return '';
  if(autoplay)return `<div class="background-media auto-background" data-background-media data-autoplay ${videoOnly?'data-video-only':''}><video class="background-video" autoplay loop muted playsinline preload="auto" aria-hidden="true" src="${escape(config.src)}"></video>${videoOnly?'':'<div class="autoplay-error" hidden><span role="status">实景视频暂未播放，已保留静态画面。</span><button data-background-retry>重试播放</button></div>'}</div>`;
  return `<div class="background-media" data-background-media><video class="background-video" loop muted playsinline preload="none" aria-hidden="true" data-src="${escape(config.src)}"></video><button class="background-hit" data-background-toggle aria-label="播放${escape(config.title)}实景背景"></button><div class="background-controls"><button data-background-toggle class="light">▶ 播放实景</button><button data-background-sound class="light" disabled>开启声音</button><span role="status">${escape(config.title)} · 点击播放，循环呈现</span></div></div>`;
}
export function bindBackgroundVideo(root,{onReady=()=>{}}={}) {
  const host=root.querySelector('[data-background-media]');
  if (!host) return ()=>{};
  const video=host.querySelector('video'), toggles=host.querySelectorAll('[data-background-toggle]'), label=host.querySelector('[role="status"]'), sound=host.querySelector('[data-background-sound]');
  if(host.hasAttribute('data-autoplay')){
    let alive=true,timeout,frame,retry,attempt=0,pending=false;
    const videoOnly=host.hasAttribute('data-video-only');
    const error=host.querySelector('.autoplay-error');
    video.muted=true;
    const stopWaiting=()=>{clearTimeout(timeout);clearTimeout(retry);if(frame!==undefined)video.cancelVideoFrameCallback(frame);frame=undefined;};
    const valid=token=>alive&&host.isConnected&&token===attempt&&!document.hidden;
    const fail=(token,reason)=>{
      if(!valid(token)||reason?.name==='AbortError')return;
      stopWaiting();pending=false;
      if(videoOnly){
        // Keep the last video frame on the cover. A tab suspension is never a poster fallback.
        retry=setTimeout(()=>{if(valid(token)){video.load();play();}},1500);
      }else{host.classList.add('is-failed');host.classList.remove('has-frame');error.hidden=false;onReady(false);}
    };
    const ready=token=>{
      if(!valid(token)||video.paused)return;
      stopWaiting();pending=false;host.classList.add('has-frame');host.classList.remove('is-failed');
      if(error)error.hidden=true;onReady(true);
    };
    const waitForFrame=token=>{
      if(!valid(token)||video.paused)return;
      if(video.requestVideoFrameCallback){if(frame!==undefined)video.cancelVideoFrameCallback(frame);frame=video.requestVideoFrameCallback(()=>ready(token));}
      else if(video.readyState>=2)ready(token);
    };
    function play(){
      if(!alive||!host.isConnected||document.hidden||pending)return;
      stopWaiting();pending=true;const token=++attempt;
      timeout=setTimeout(()=>fail(token),10000);
      // play() may resolve without another "playing" event when already playing.
      video.play().then(()=>waitForFrame(token)).catch(reason=>{
        if(token!==attempt||!alive)return;
        if(document.hidden||reason.name==='AbortError'){
          stopWaiting();pending=false;
          if(!document.hidden)retry=setTimeout(()=>{if(valid(token))play();},150);
          return;
        }
        fail(token,reason);
      });
    }
    const playing=()=>waitForFrame(attempt);
    const failed=()=>fail(attempt,video.error);
    const suspend=()=>{attempt++;pending=false;stopWaiting();video.pause();};
    const resume=()=>{if(document.hidden)suspend();else play();};
    const retryNow=()=>{stopWaiting();attempt++;pending=false;if(error)error.hidden=true;host.classList.remove('is-failed');video.load();play();};
    video.addEventListener('playing',playing);video.addEventListener('error',failed);
    host.querySelector('[data-background-retry]')?.addEventListener('click',retryNow);
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pageshow',resume);window.addEventListener('pagehide',suspend);window.addEventListener('focus',resume);
    play();
    return ()=>{
      alive=false;attempt++;stopWaiting();
      video.removeEventListener('playing',playing);video.removeEventListener('error',failed);
      document.removeEventListener('visibilitychange',resume);
      window.removeEventListener('pageshow',resume);window.removeEventListener('pagehide',suspend);window.removeEventListener('focus',resume);
    };
  }
  let failed=false, starting=false, loadTimeout;
  const update=()=>{
    const playing=!video.paused && !video.ended;
    host.classList.toggle('is-playing',playing);
    toggles[0].setAttribute('aria-label',playing?'暂停实景背景':'播放实景背景');
    toggles[1].textContent=starting?'正在加载…':playing?'Ⅱ 暂停实景':failed?'↻ 重试实景':'▶ 播放实景';
    toggles.forEach(b=>b.disabled=starting);
    sound.disabled=video.readyState<2;
    sound.textContent=video.muted?'开启声音':'关闭声音';
    label.textContent=failed?'视频暂时无法播放，保留静态底图，可重试':starting?'正在加载实景视频…':playing?'实景拍摄 · 循环播放':video.currentTime>0?'已暂停 · 点击继续':'实景拍摄 · 点击播放，循环呈现';
  };
  const fail=()=>{clearTimeout(loadTimeout);if(!host.isConnected)return;failed=true;starting=false;video.pause();host.classList.remove('has-frame');update();};
  toggles.forEach(b=>b.addEventListener('click',async()=>{
    if (!video.paused) {video.pause();return;}
    starting=true;update();
    loadTimeout=setTimeout(()=>{if(starting)fail();},15000);
    if(!video.getAttribute('src')||failed){video.src=video.dataset.src;video.load();}
    failed=false;
    try {await video.play();} catch {fail();}
    clearTimeout(loadTimeout);if(host.isConnected){starting=false;update();}
  }));
  sound.addEventListener('click',()=>{video.muted=!video.muted;update();});
  video.addEventListener('playing',()=>{clearTimeout(loadTimeout);starting=false;failed=false;host.classList.add('has-frame');update();});
  video.addEventListener('pause',update);
  video.addEventListener('error',fail);
  video.addEventListener('loadeddata',update);
  return ()=>clearTimeout(loadTimeout);
}
