import {sampleTargets} from './core.js';
import {interactionFromSource} from './geometry.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const points=path=>path.map(p=>p.join(',')).join(' ');
const rect=([x,y,width,height])=>`<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;

export function focusToSource(c,[x,y]){
  const [cx,cy,cw,ch]=c.shots.focus.crop,{width,height}=c.artwork;
  const scale=Math.min(1920/(width*cw),1080/(height*ch));
  return [(x*1920-(1920-width*cw*scale)/2)/scale+cx*width,(y*1080-(1080-height*ch*scale)/2)/scale+cy*height];
}

export function journalArt(c,p){
  const {width,height}=c.artwork,s=c.sourceInteraction,id=`journal-${c.id}`;
  const image=`<image href="${esc(c.assets.sketchThumbnail)}" width="${width}" height="${height}"/>`;
  const active=p.completed||p.cells?.length||p.strokes?.length;
  let overlay='';
  if(active){
    const polygon=s.polygon?`<polygon points="${points(s.polygon)}"/>`:'';
    const scale=Math.min(1920/(width*c.shots.focus.crop[2]),1080/(height*c.shots.focus.crop[3]));
    let marks='';
    if(p.completed)marks=`<rect width="${width}" height="${height}" fill="white"/>`;
    else if(c.interaction.type==='trace'){
      const targets=sampleTargets(interactionFromSource(c));
      marks=(p.cells||[]).filter(i=>targets[i]).map(i=>{const [x,y]=focusToSource(c,targets[i]);return `<circle cx="${x}" cy="${y}" r="${c.interaction.radius*1080/scale}" fill="white"/>`;}).join('');
    }else marks=(p.strokes||[]).map(stroke=>`<polyline points="${points(stroke.map(point=>focusToSource(c,point)))}" fill="none" stroke="white" stroke-width="${c.interaction.radius*2160/scale}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    let art='',boundary='';
    if(c.interaction.type==='trace'){
      boundary=s.paths.map(path=>`<polyline points="${points(path)}" fill="none" stroke="white" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
      art=`<rect width="${width}" height="${height}" fill="#7b927f" mask="url(#${id}-ink)"/>`;
    }else if(c.interaction.type==='carve'){
      boundary=s.regions.filter((_,i)=>p.completed||p.cells?.includes(i)).map(box=>rect(box)).join('');
      marks=`<rect width="${width}" height="${height}" fill="white"/>`;
      art=`<rect width="${width}" height="${height}" fill="#b58443" mask="url(#${id}-ink)"/>`;
    }else if(c.interaction.type==='figure'){
      boundary=polygon;
      const [x,y,w,h]=s.region,[fw,fh]=c.interaction.figureSize;
      art=`<svg class="journal-caller" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${c.interaction.figureViewBox.join(' ')}" preserveAspectRatio="xMidYMax meet"><image href="${esc(c.assets.figure)}" width="${fw}" height="${fh}"/></svg>`;
    }else if(c.interaction.type==='roof'){
      // The completed journal records the whole tiled roof; partial work keeps its own strokes.
      boundary=p.completed&&c.journalRoofPolygon?`<polygon points="${points(c.journalRoofPolygon)}"/>`:polygon;
      const color=c.colors.find(color=>color.value===p.color)?.value||c.colors[0].value;
      art=`<g fill="${esc(color)}" opacity=".64" style="mix-blend-mode:multiply">${boundary}</g>`;
    }
    overlay=`<defs><filter id="${id}-invert" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-.2126 -.7152 -.0722 0 1 -.2126 -.7152 -.0722 0 1 -.2126 -.7152 -.0722 0 1 0 0 0 1 0"/></filter><mask id="${id}-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g filter="url(#${id}-invert)">${image}</g></mask><mask id="${id}-boundary" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g fill="white">${boundary}</g></mask><mask id="${id}-marks" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">${marks}</mask></defs><g data-journal-pigment="${c.interaction.type}" mask="url(#${id}-boundary)"><g mask="url(#${id}-marks)">${art}</g></g>`;
  }
  return `<svg class="journal-art" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(c.building)}，${active?'已交互部分留下色彩与笔迹':'尚未补画的灰色速写'}"><g class="journal-pencil">${image}</g>${overlay}</svg>`;
}
