// Non-destructive crop coordinates are fractions of the original image.
export function cropBox(meta, shot) {
  const [x,y,w,h]=shot.crop;
  return [x*meta.width,y*meta.height,w*meta.width,h*meta.height];
}
export function photoView(c, shotName, options={}) {
  const result=shotName==='result',meta=(!result||c.presentation?.resultUsesArtwork)&&c.artwork?c.artwork:c.photos[result?'overview':'detail'],shot=c.shots[shotName];
  const href=c.assets[result?'realityResult':'focusReference'];
  const box=cropBox(meta,shot).join(' ');
  const animation=options.from ? `<animate attributeName="viewBox" from="${cropBox(meta,c.shots[options.from]).join(' ')}" to="${box}" dur="${options.duration/1000}s" fill="freeze"/>` : '';
  const safeHref=href.replaceAll('&','&amp;').replaceAll('"','&quot;');
  const alignment=options.from?c.shots[options.from].align:shot.align;
  const fit=result&&!c.presentation?.resultUsesArtwork?'slice':'meet';
  return `<svg class="${options.className||''}" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" ${options.style?`style="${options.style}"`:''} aria-hidden="true"><svg width="1920" height="1080" viewBox="${box}" preserveAspectRatio="${alignment||'xMidYMid'} ${fit}" overflow="hidden">${animation}<image href="${safeHref}" width="${meta.width}" height="${meta.height}"/></svg></svg>`;
}
export function photoStage(c,key,options={}) {
  const shot=key==='panorama'||(c.artwork&&key==='sketchThumbnail')?'entry':key==='realityResult'?'result':'focus';
  const effect=c.artwork?(key.startsWith('watercolor')?'sketch-ink-placeholder':''):(key==='sketchBase'?'photo-paper':key==='sketchComplete'||key==='sketchThumbnail'?'photo-sketch':key.startsWith('watercolor')?'photo-ink':'');
  return photoView(c,shot,{...options,className:`${options.className||''} ${effect}`});
}
