// Keep the black cover outside #app so it survives scene renders and asset loading.
export function createSceneTransition(root, reducedMotion=false) {
  let current=null;
  function cancel() {
    if(!current)return;
    const operation=current;current=null;
    clearTimeout(operation.timer);
    operation.animation?.cancel();
    operation.cover.remove();
    root.inert=operation.wasInert;
    operation.cancelled(false);
  }
  async function run(prepare,{hold=320,fade=900}={}) {
    cancel();
    const cover=document.createElement('div');
    cover.className='scene-blackout';cover.setAttribute('aria-hidden','true');
    const operation={cover,wasInert:root.inert};
    const cancelled=new Promise(resolve=>operation.cancelled=resolve);
    current=operation;root.inert=true;document.body.append(cover);
    const reveal=async()=>{
      const minimumHold=new Promise(resolve=>operation.timer=setTimeout(resolve,reducedMotion?80:hold));
      await Promise.all([prepare(),minimumHold]);
      if(current!==operation)return false;
      // Give decoded images and the new scene layout a paint before revealing them.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(current!==operation)return false;
      operation.animation=cover.animate([{opacity:1},{opacity:0}],{
        duration:reducedMotion?80:fade,easing:'ease-out',fill:'forwards'
      });
      await operation.animation.finished.catch(()=>{});
      return current===operation;
    };
    try {return await Promise.race([reveal(),cancelled]);}
    finally {if(current===operation)cancel();}
  }
  return {run,cancel,get active(){return current!==null;}};
}
