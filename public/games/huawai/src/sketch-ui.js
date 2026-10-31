// Small pen-drawn marks: the labels remain real text and accessible button names.
const marks={
  music:'<path d="M12 24V8l15-3v16M12 12l15-3"/><ellipse cx="8" cy="25" rx="4" ry="3"/><ellipse cx="23" cy="22" rx="4" ry="3"/>',
  brush:'<path d="m13 21 12-17q2-2 3 0L17 24M14 20l4 3M13 22c-7 0-3 7-9 8 8 1 12-2 12-7M10 26l-3 2"/><path d="M19 28q6 1 10-1" opacity=".5"/>',
  map:'<path d="m3 7 8-3 10 4 8-3v22l-8 2-10-4-8 3ZM11 4v21M21 8v21"/><path d="m7 17 6-4 5 5 7-6" stroke-dasharray="2 3"/>',
  book:'<path d="M8 4q9-1 18 1l-1 24-18-1Z M11 5l-1 22M5 9h5M5 15h5M5 21h5M15 11l7 1M15 17l5-1"/>',
  leaf:'<path d="M7 28q2-12 17-24c6 11-1 21-16 22M11 23l10-13M15 18l7 1M18 14l-1-5"/>',
  return:'<path d="M25 10q-8-4-18 4m1-7-3 8 9 2M7 15q3 14 18 9"/>',
  arrow:'<path d="M4 20q12 2 22-11M17 8l11-2-2 11M5 24l10-2"/>',
  replay:'<path d="M25 10C14-3 1 12 7 23s23 4 21-8M25 3l1 8-9-1"/><path d="m11 22 7-11 3 2-7 10-4 2Z"/>',
  sound:'<path d="m4 13 6-1 7-6v21l-7-7-6-1Z M22 11q7 5 0 10M25 6q13 10 0 20"/>',
  pause:'<path d="m11 6-1 21M22 5l-1 22" stroke-width="2.5"/>',
  play:'<path d="m9 5 17 11-18 12Z"/>',
  eraser:'<path d="m5 20 13-15 11 10-13 15-6-1Z M11 13l12 9M17 30h12"/>',
  close:'<path d="m8 7 16 18M25 7 7 26"/>',
};
const actionMarks={start:'brush',focus:'brush',auto:'brush',continue:'brush',directory:'map',journal:'book',about:'leaf',more:'leaf',next:'arrow',skip:'arrow',panorama:'return','back-journal':'return',replay:'replay','reset-court':'replay',reset:'eraser','confirm-reset':'eraser','confirm-reset-court':'eraser',pause:'pause',mute:'sound','close-modal':'book','retry-scene':'replay','retry-photo':'replay'};
export function buttonContents(action,label){
  let mark=action==='music'?'music':actionMarks[action];
  if(action==='pause'&&label.includes('继续'))mark='play';
  const icon=mark?`<svg class="action-mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${marks[mark]}</svg>`:'';
  const clean=label.replace(/<span class="nav-symbol">.*?<\/span>\s*/g,'').replace(/[↗→←▶Ⅱ]/g,'').trim();
  return `${icon}<span class="action-label">${clean}</span>`;
}
