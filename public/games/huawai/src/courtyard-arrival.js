// Paper and binding stay still; only the supplied drawing and its notes move.
export function animateCourtyardArrival(root,reducedMotion=false){
  if(reducedMotion||root.dataset.phase!=='PANORAMA')return ()=>{};
  const animations=[];
  const animate=(selector,frames,delay=0,duration=960)=>{
    const element=root.querySelector(selector);if(!element)return;
    const animation=element.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.65,.24,1)',fill:'both'});
    animation.id='courtyard-arrival';animations.push(animation);
  };
  root.dataset.entryMotion='arriving';
  // Moving the blend layer itself keeps its white paper from becoming an opaque group.
  animate('.observation-image',[{transform:'translate(-20px, 14px) scale(.9)'},{transform:'translate(0, 0) scale(1)'}]);
  animate('.observation-notes',[{transform:'translateX(34px)',opacity:0},{transform:'translateX(0)',opacity:1}],240,780);
  animate('.scene-heading',[{transform:'translateY(10px)',opacity:0},{transform:'translateY(0)',opacity:1}],120,650);
  return ()=>{animations.forEach(animation=>animation.cancel());delete root.dataset.entryMotion;};
}
