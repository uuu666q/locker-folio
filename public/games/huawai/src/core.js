export const STORAGE_KEY = 'huawai-progress-v1';
export const freshProgress = () => ({ version:1, lastCourt:null, courts:{} });
export const blankCourt = () => ({ visited:false, cells:[], strokes:[], coverage:0, completed:false, completionMethod:null, color:null, videoWatched:false, videoSkipped:false, simulationWatched:false, lastPlayback:null, resultPreviewShown:false, realityShown:false });
export function sanitizeProgress(raw, courts) {
  const output = freshProgress();
  if (!raw || raw.version !== 1 || !raw.courts || typeof raw.courts !== 'object') return output;
  output.lastCourt = courts.some(c => c.id === raw.lastCourt) ? raw.lastCourt : null;
  for (const c of courts) {
    const saved = raw.courts[c.id];
    if (!saved || typeof saved !== 'object') continue;
    const p = blankCourt();
    for (const key of ['visited','completed','videoWatched','videoSkipped','simulationWatched','resultPreviewShown','realityShown']) p[key] = saved[key] === true;
    p.cells = [...new Set(Array.isArray(saved.cells) ? saved.cells.filter(n => Number.isInteger(n) && n >= 0 && n < 20000) : [])];
    p.strokes=Array.isArray(saved.strokes)?saved.strokes.slice(0,256).filter(Array.isArray).map(stroke=>stroke.slice(0,2048).filter(point=>Array.isArray(point)&&point.length===2&&point.every(n=>Number.isFinite(n)&&n>=0&&n<=1))):[];
    p.coverage = Math.max(0, Math.min(1, Number(saved.coverage) || 0));
    p.color = c.colors?.some(x => x.value === saved.color) ? saved.color : null;
    p.completionMethod = ['manual','auto'].includes(saved.completionMethod) ? saved.completionMethod : null;
    p.lastPlayback = ['watched','simulated','skipped','failed'].includes(saved.lastPlayback) ? saved.lastPlayback : null;
    p.interactionRevision=typeof saved.interactionRevision==='string'?saved.interactionRevision:null;
    output.courts[c.id] = p;
  }
  return output;
}
export function sampleTargets(interaction) {
  const points = [];
  if(interaction.type==='carve')return interaction.regions.map(([x,y,w,h])=>[x+w/2,y+h/2]);
  if(interaction.polygon){
    const xs=interaction.polygon.map(p=>p[0]),ys=interaction.polygon.map(p=>p[1]),step=interaction.sampleStep||.012;
    for(let y=Math.min(...ys);y<=Math.max(...ys);y+=step)for(let x=Math.min(...xs);x<=Math.max(...xs);x+=step*9/16)
      if(pointInPolygon([x,y],interaction.polygon))points.push([x,y]);
  }else if (interaction.region) {
    const [x,y,w,h] = interaction.region;
    for (let yy=y; yy<=y+h; yy+=0.022) for (let xx=x; xx<=x+w; xx+=0.022) points.push([xx,yy]);
  } else for (const path of interaction.paths) {
    for (let i=1; i<path.length; i++) {
      const a=path[i-1], b=path[i], steps=Math.ceil(Math.hypot((b[0]-a[0])*16/9,b[1]-a[1])/0.013);
      for (let j=0; j<=steps; j++) points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
    }
  }
  return points;
}
export function pointInPolygon([x,y],polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [ax,ay]=polygon[i],[bx,by]=polygon[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
export function hitRegion([x,y],regions){return regions.findIndex(([rx,ry,w,h])=>x>=rx&&x<=rx+w&&y>=ry&&y<=ry+h);}
export function coverSegment(targets, selected, start, end, radius=0.056) {
  const ax=start[0]*16/9, ay=start[1], bx=end[0]*16/9, by=end[1];
  const dx=bx-ax, dy=by-ay, denom=dx*dx+dy*dy;
  targets.forEach(([x,y],i) => {
    const px=x*16/9, t=denom ? Math.max(0,Math.min(1,((px-ax)*dx+(y-ay)*dy)/denom)) : 0;
    if (Math.hypot(px-ax-t*dx,y-ay-t*dy)<=radius) selected.add(i);
  });
  return selected.size/targets.length;
}
export function recordPlayback(progress, result, simulated) {
  progress.lastPlayback = result === 'watched' && simulated ? 'simulated' : result;
  if (result === 'watched') progress[simulated ? 'simulationWatched' : 'videoWatched'] = true;
  if (result === 'skipped') progress.videoSkipped = true;
}

// A completed-looking stroke must not interrupt a pointer that is still drawing.
export function shouldFinishDrawing(eventType, coverage, threshold) {
  return eventType === 'pointerup' && coverage >= threshold;
}
