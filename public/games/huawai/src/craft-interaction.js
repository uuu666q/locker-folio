import {coverSegment,hitRegion,shouldFinishDrawing} from './core.js';
import {photoStage} from './photos.js';

export const isCraft=c=>['carve','figure','roof'].includes(c.interaction.type);
const xy=([x,y])=>`${(x*1920).toFixed(2)},${(y*1080).toFixed(2)}`;
const pathData=points=>points.map((p,i)=>`${i?'L':'M'}${xy(p)}`).join(' ')+(points.length===1?` L${xy(points[0])}`:'');
const polygon=c=>`<polygon points="${c.interaction.polygon.map(xy).join(' ')}"/>`;
const rect=([x,y,w,h],extra='')=>`<rect x="${x*1920}" y="${y*1080}" width="${w*1920}" height="${h*1080}" ${extra}/>`;

function chiselPath([x,y,w,h]){
  const left=x*1920,top=y*1080,width=w*1920,height=h*1080,rows=Math.ceil(height/8);
  return Array.from({length:rows+1},(_,i)=>`${i?'L':'M'}${left+(i%2?width:0)},${top+i*height/rows} L${left+(i%2?0:width)},${top+i*height/rows}`).join(' ');
}
function figure(c){
  const [x,y,w,h]=c.interaction.region;
  const [width,height]=c.interaction.figureSize;
  // The sprite extends below the rail; craft-boundary clips it to the window opening.
  return `<svg class="caller-figure" x="${x*1920}" y="${y*1080}" width="${w*1920}" height="${h*1080}" viewBox="${c.interaction.figureViewBox.join(' ')}" preserveAspectRatio="xMidYMax meet"><image href="${c.assets.figure}" width="${width}" height="${height}"/></svg>`;
}
export function craftSvg(c,progress,{complete=false}={}){
  const type=c.interaction.type,chosen=new Set(progress.cells),interactive=!complete;
  let contents='',guideOverlay='';
  if(type==='carve'){
    if(complete)return '';
    contents=c.interaction.regions.map((box,i)=>{
      const [x,y,w,h]=box,done=chosen.has(i);
      return `<g class="carve-letter ${done?'is-carved':''}" data-letter="${i}">
        <defs><clipPath id="glyph-clip-${i}">${rect(box)}</clipPath><mask id="glyph-mask-${i}" maskUnits="userSpaceOnUse" x="${x*1920-5}" y="${y*1080-5}" width="${w*1920+10}" height="${h*1080+10}"><path class="carve-scan" d="${chiselPath(box)}" fill="none" stroke="white" stroke-width="12" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${done?0:1}"/></mask></defs>
        ${rect(box,`fill="${c.interaction.paper}"`)}
        <g clip-path="url(#glyph-clip-${i})" mask="url(#glyph-mask-${i})">${photoStage(c,'interactionLayer')}</g>
        ${rect(box,`class="carve-hit" data-glyph="${i}" tabindex="0" role="button" aria-label="雕刻第${i+1}个字：${c.interaction.glyphs[i]}" aria-pressed="${done}"`)}
        <path class="stone-dust" d="M${(x+w/2)*1920},${(y+h/2)*1080} l-9,13 m13,-8 l8,12 m-14,-20 l2,15"/>
      </g>`;
    }).join('');
  }else{
    const width=c.interaction.radius*2160;
    const marks=complete?'<rect width="1920" height="1080" fill="white"/>':(progress.strokes||[]).map(stroke=>`<path d="${pathData(stroke)}"/>`).join('');
    const artwork=type==='figure'?figure(c):`<g class="roof-pigment" fill="${c.colors[0].value}" opacity=".52" mask="url(#wash-edge)">${polygon(c)}</g>`;
    const paper=type==='figure'?'<image class="figure-paper" href="./assets/shared/paper-extension.png" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>':'';
    const guides=type==='figure'?polygon(c):c.interaction.guidePaths.map(points=>`<path d="${pathData(points)}"/>`).join('');
    const edge=type==='roof'?`<filter id="wash-feather" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter><mask id="wash-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><g fill="white" stroke="black" stroke-width="16" filter="url(#wash-feather)">${polygon(c)}</g></mask>`:'';
    contents=`<defs><clipPath id="craft-boundary">${polygon(c)}</clipPath>${edge}<filter id="ink-feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${type==='roof'?4:2}"/></filter><mask id="craft-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><g id="craft-marks" fill="none" stroke="white" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" filter="url(#ink-feather)">${marks}</g></mask></defs><g clip-path="url(#craft-boundary)">${paper}<g mask="url(#craft-mask)">${artwork}</g></g>${complete||type==='roof'?'':`<g class="craft-guides" fill="none">${guides}</g>`}`;
    if(type==='roof'&&!complete){
      // Keep the pigment multiplied into the original ink, while the guides stay bright.
      guideOverlay=`<svg class="drawing craft-guide-overlay craft-guide-roof" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="craft-guides" fill="none">${guides}</g></svg>`;
    }
  }
  return `<svg ${interactive?'id="drawing"':''} class="${interactive?'drawing':'scene-image craft-complete'} craft-interaction craft-${type}" data-tool="${type}" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" ${interactive?`aria-label="${c.prompt}"`:'aria-hidden="true"'}>${contents}</svg>${guideOverlay}`;
}

export function bindCraftDrawing(svg,c,progress,{selected,targets,onProgress,onFinish,schedule}){
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [p.x/1920,p.y/1080];};
  if(c.interaction.type==='carve'){
    let pressed=null;
    const carve=index=>{
      if(index<0||selected.has(index))return;
      selected.add(index);
      const letter=svg.querySelector(`[data-letter="${index}"]`);
      letter.classList.add('is-carved','is-carving');letter.querySelector('[data-glyph]').setAttribute('aria-pressed','true');
      schedule(()=>{letter.classList.remove('is-carving');letter.querySelector('.carve-scan').setAttribute('stroke-dashoffset','0');},750);
      onProgress(true);
      if(selected.size===targets.length)schedule(onFinish,800);
    };
    svg.addEventListener('pointerdown',e=>{if(e.button>0)return;pressed={id:e.pointerId,x:e.clientX,y:e.clientY};});
    svg.addEventListener('pointerup',e=>{
      if(pressed?.id===e.pointerId&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<12)carve(hitRegion(point(e),c.interaction.regions));
      pressed=null;
    });
    svg.addEventListener('pointercancel',()=>pressed=null);
    svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.glyph!==undefined){e.preventDefault();carve(Number(e.target.dataset.glyph));}});
    return;
  }
  let pointer=null,last=null,stroke=null;
  progress.strokes||=[];
  const paint=e=>{
    if(pointer!==e.pointerId)return;
    const next=point(e);
    if(next.some(n=>n<0||n>1)){last=null;return;}
    const from=last||next;
    if(last&&Math.hypot((next[0]-last[0])*16/9,next[1]-last[1])<.002)return;
    coverSegment(targets,selected,from,next,c.interaction.radius);
    const mark=document.createElementNS('http://www.w3.org/2000/svg','path');
    mark.setAttribute('d',pathData([from,next]));mark.classList.add('wet-ink');
    svg.querySelector('#craft-marks').append(mark);
    if(!last&&stroke.length){stroke=[];progress.strokes.push(stroke);}
    stroke.push(next);last=next;onProgress();
  };
  svg.addEventListener('pointerdown',e=>{
    if(pointer!==null||e.button>0)return;e.preventDefault();pointer=e.pointerId;last=null;stroke=[];progress.strokes.push(stroke);
    try{svg.setPointerCapture(pointer);}catch{}
    paint(e);
  });
  svg.addEventListener('pointermove',paint);
  const end=e=>{
    if(pointer!==e.pointerId)return;
    if(e.type==='pointerup')paint(e);
    pointer=null;last=null;onProgress(true);
    if(shouldFinishDrawing(e.type,selected.size/targets.length,c.interaction.threshold))onFinish();
  };
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
}
