// The curved fold follows notebook-deckle.svg; the binding and cover stay still.
export function paperBounds(rect){
  return {left:rect.x+rect.width*72/1920,right:rect.x+rect.width*1884/1920,top:rect.y+rect.height*33/1080,bottom:rect.y+rect.height*1035/1080};
}
export function createPageTurn(root,reducedMotion=false){
  let current=null;
  function cancel(){
    if(!current)return;
    const op=current;current=null;
    op.transition?.skipTransition();op.animation?.cancel();op.arrivalCleanup?.();cancelAnimationFrame(op.frame);op.cover?.remove();
    root.inert=op.wasInert;delete document.documentElement.dataset.pageTurn;
    document.documentElement.style.removeProperty('--turn-clip');
    window.removeEventListener('resize',op.resize);op.cancelled(false);
  }
  async function run(prepare,{onReveal=()=>()=>{}}={}){
    cancel();
    const op={wasInert:root.inert};current=op;
    const cancelled=new Promise(resolve=>op.cancelled=resolve);
    root.inert=true;document.documentElement.dataset.pageTurn=reducedMotion?'reduced':'full';
    const bounds=paperBounds((root.querySelector('.notebook-frame')||root).getBoundingClientRect());
    const {left:l,right:r,top:t,bottom:b}=bounds,w=r-l,h=b-t;
    op.cover=document.createElement('div');op.cover.className='paper-curl';op.cover.setAttribute('aria-hidden','true');
    op.cover.innerHTML=`<svg viewBox="0 0 ${innerWidth} ${innerHeight}" preserveAspectRatio="none"><defs>
      <clipPath id="curl-book"><rect x="${l}" y="${t}" width="${w}" height="${h}"/></clipPath>
      <clipPath id="curl-back"><path/></clipPath><clipPath id="curl-front"><path/></clipPath>
      <linearGradient id="curl-shade" gradientUnits="userSpaceOnUse"><stop stop-color="#2e281d" stop-opacity=".24"/><stop offset="1" stop-color="#2e281d" stop-opacity="0"/></linearGradient>
      <linearGradient id="curl-light" gradientUnits="userSpaceOnUse"><stop stop-color="#90794e" stop-opacity=".22"/><stop offset=".24" stop-color="#fffbed" stop-opacity=".9"/><stop offset=".68" stop-color="#fffbed" stop-opacity=".25"/><stop offset="1" stop-color="#917a50" stop-opacity=".22"/></linearGradient>
      </defs><g clip-path="url(#curl-book)">
      <image class="fallback-sheet" href="./assets/shared/paper-extension.png" width="${innerWidth}" height="${innerHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#curl-front)"/>
      <path class="curl-shadow" fill="url(#curl-shade)"/>
      <g clip-path="url(#curl-back)"><rect width="100%" height="100%" fill="#faf2df"/><image href="./assets/shared/paper-extension.png" width="${innerWidth}" height="${innerHeight}" preserveAspectRatio="xMidYMid slice" opacity=".45"/><rect width="100%" height="100%" fill="url(#curl-light)"/></g>
      <path class="curl-edge" fill="none" stroke="#fff9e8" stroke-width="1.25"/>
      </g></svg>`;
    document.body.append(op.cover);
    const front=op.cover.querySelector('#curl-front path'),back=op.cover.querySelector('#curl-back path'),shadow=op.cover.querySelector('.curl-shadow'),edge=op.cover.querySelector('.curl-edge');
    const draw=p=>{
      const arc=Math.sin(p*Math.PI),curl=w*.15*arc;
      const x=r-(w+w*.2)*p,xt=x+w*.055*arc,xb=x+w*.018*arc,xc=x-w*.055*arc,mid=(t+b)/2;
      const flat=`M${l} ${t}H${xt}Q${xc} ${mid} ${xb} ${b}H${l}Z`;
      const fold=`M${xt} ${t}C${xt-curl*.32} ${t+5*arc} ${xt-curl*.92} ${t+h*.015*arc} ${xt-curl} ${t+h*.065*arc}Q${xc-curl*1.2} ${mid} ${xb-curl*.88} ${b-h*.045*arc}C${xb-curl*.55} ${b-3*arc} ${xb-curl*.15} ${b} ${xb} ${b}Q${xc} ${mid} ${xt} ${t}Z`;
      document.documentElement.style.setProperty('--turn-clip',`path('${flat}')`);front.setAttribute('d',flat);back.setAttribute('d',fold);edge.setAttribute('d',fold);
      shadow.setAttribute('d',`M${xt} ${t}Q${xc} ${mid} ${xb} ${b}L${xb+38*arc} ${b}Q${xc+64*arc} ${mid} ${xt+38*arc} ${t}Z`);
      for(const [id,x1,x2] of [['curl-light',x-curl,x],['curl-shade',x-15*arc,x+65*arc]]){
        const gradient=op.cover.querySelector('#'+id);gradient.setAttribute('x1',x1);gradient.setAttribute('x2',x2);gradient.setAttribute('y1',0);gradient.setAttribute('y2',0);
      }
      op.cover.dataset.progress=p.toFixed(3);
    };
    draw(0);
    op.resize=()=>{op.transition?.skipTransition();op.animation?.finish();};window.addEventListener('resize',op.resize,{once:true});
    const turn=async()=>{
      if(document.startViewTransition){
        op.transition=document.startViewTransition(async()=>{if(current===op)await prepare();});
        const completed=op.transition.finished.catch(()=>{});
        const updated=op.transition.updateCallbackDone.catch(()=>{});
        const captured=await op.transition.ready.then(()=>true,()=>false);
        if(!captured){await updated;await completed;return current===op;}
      }else{
        op.cover.classList.add('paper-turn-fallback');await prepare();
      }
      if(current!==op)return false;
      op.arrivalCleanup=onReveal();
      // The new named snapshot is live, so the SVG can curl over the stationary print.
      op.animation=op.cover.animate([{opacity:1},{opacity:1}],{duration:reducedMotion?120:1120,easing:'cubic-bezier(.28,.05,.22,1)',fill:'both'});
      op.animation.id='soft-paper-curl';
      const tick=()=>{if(current!==op)return;draw(op.animation.effect.getComputedTiming().progress||0);op.frame=requestAnimationFrame(tick);};tick();
      await op.animation.finished.catch(()=>{});
      return current===op;
    };
    try{return await Promise.race([turn(),cancelled]);}
    finally{if(current===op)cancel();}
  }
  return {run,cancel,get active(){return current!==null;}};
}
