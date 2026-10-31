// Source pixels -> 1920x1080 scene coordinates. Never infer position from viewport size.
export function sourcePoint(c,point,shot='focus'){
  const [x,y,w,h]=c.shots[shot].crop, m=c.artwork;
  const scale=Math.min(1920/(m.width*w),1080/(m.height*h));
  const ox=(1920-m.width*w*scale)/2,oy=(1080-m.height*h*scale)/2;
  return [(ox+(point[0]-x*m.width)*scale)/1920,(oy+(point[1]-y*m.height)*scale)/1080];
}
export function interactionFromSource(c){
  const s=c.sourceInteraction;
  if(!s)return c.interaction;
  const mapped={...c.interaction};
  if(s.paths)mapped.paths=s.paths.map(path=>path.map(p=>sourcePoint(c,p)));
  if(s.region){const [x,y,w,h]=s.region,a=sourcePoint(c,[x,y]),b=sourcePoint(c,[x+w,y+h]);mapped.region=[...a,b[0]-a[0],b[1]-a[1]];}
  if(s.regions)mapped.regions=s.regions.map(([x,y,w,h])=>{const a=sourcePoint(c,[x,y]),b=sourcePoint(c,[x+w,y+h]);return [...a,b[0]-a[0],b[1]-a[1]];});
  if(s.polygon)mapped.polygon=s.polygon.map(p=>sourcePoint(c,p));
  if(s.guidePaths)mapped.guidePaths=s.guidePaths.map(path=>path.map(p=>sourcePoint(c,p)));
  return mapped;
}
