export const filmSource=court=>court.assets.video+(court.media.videoVersion?'?v='+court.media.videoVersion:'');

// Keep just the current court's paused film. Its already-decoded first frame and
// buffered bytes move into the stage itself, rather than requesting a new video.
export function createFilmBuffer(){
  let spare=null;
  function release(){if(!spare)return;spare.video.pause();spare.video.removeAttribute('src');spare.video.load();spare=null;}
  function prepare(court){
    if(!court?.assets.video||!court.media.videoReady)return null;
    const src=filmSource(court);
    if(spare?.src===src)return spare.video;
    release();const video=document.createElement('video');
    video.className='scene-video';video.playsInline=true;video.preload='auto';video.src=src;
    spare={src,video};video.load();return video;
  }
  function take(court){const video=prepare(court);spare=null;return video;}
  return {prepare,take,release};
}
