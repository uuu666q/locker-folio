import {cropBox} from './photos.js';

// Match photoView's inner "meet" and outer 1920×1080 "slice" projection exactly.
export function focusImageRect(court, viewport) {
  const meta=court.artwork||court.photos.detail;
  const [x,y,w,h]=cropBox(meta,court.shots.focus);
  const inner=Math.min(1920/w,1080/h),outer=Math.max(viewport.width/1920,viewport.height/1080);
  return {
    x:(viewport.width-1920*outer)/2+((1920-w*inner)/2-x*inner)*outer,
    y:(viewport.height-1080*outer)/2+((1080-h*inner)/2-y*inner)*outer,
    width:meta.width*inner*outer,height:meta.height*inner*outer,
  };
}

export function animateFocus(root,court,duration,onFinish) {
  const image=root.querySelector('.observation-image');
  if(!image){onFinish();return ()=>{};}
  const parent=image.parentElement,from=image.getBoundingClientRect(),origin=parent.getBoundingClientRect();
  const to=focusImageRect(court,{width:window.innerWidth,height:window.innerHeight});
  const raw=image.cloneNode();raw.className='focus-raw-image';raw.alt='';raw.setAttribute('aria-hidden','true');
  const base=`position:absolute;left:0;top:0;width:${from.width}px;height:${from.height}px;max-width:none;max-height:none;transform-origin:0 0;pointer-events:none;`;
  image.style.cssText=base;raw.style.cssText=base+'opacity:0;';parent.append(raw);
  const start=`translate(${from.x-origin.x}px,${from.y-origin.y}px) scale(1)`;
  const end=`translate(${to.x-origin.x}px,${to.y-origin.y}px) scale(${to.width/from.width})`;
  const options={duration,easing:'cubic-bezier(.42,0,.2,1)',fill:'forwards'};
  const animations=[];
  for(const el of [image,raw])animations.push(el.animate([{transform:start},{transform:end}],options));
  // Preserve the exact paper-blended first frame, then blend into the raw focus image.
  animations.push(image.animate([{opacity:1},{opacity:0}],options));
  animations.push(raw.animate([{opacity:0},{opacity:1}],options));
  for(const el of root.querySelectorAll('.observation-notes,.observation-caption,.notebook-frame,.scene-heading,.scene-bottom')){
    animations.push(el.animate([{opacity:1},{opacity:0}],{...options,duration:duration*.55}));
  }
  root.dataset.camera='moving';
  const notes=root.querySelector('.observation-notes');if(notes)notes.inert=true;
  let alive=true;
  const resized=()=>{if(alive)onFinish();};window.addEventListener('resize',resized,{once:true});
  animations[0].finished.then(()=>{if(alive)onFinish();}).catch(()=>{});
  return ()=>{alive=false;window.removeEventListener('resize',resized);animations.forEach(a=>a.cancel());delete root.dataset.camera;};
}
