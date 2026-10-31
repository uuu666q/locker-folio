import {cropBox} from './photos.js';

const target=document.querySelector('#frames'),status=document.querySelector('#status');
try{
  const response=await fetch('./content/courtyards.json');
  if(!response.ok)throw Error('院落配置加载失败');
  const courts=await response.json();
  for(const c of courts){
    const image=new Image();image.src=c.assets.focusReference;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    canvas.setAttribute('aria-label',`${c.building}补画完成特写`);
    const crop=cropBox(c.artwork,c.shots.focus);
    // This is an exact export of the existing app crop, not a newly generated image.
    const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(image,...crop,0,0,1920,1080);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error(`${c.building}导出失败`);
    const article=document.createElement('article');article.dataset.court=c.id;
    const heading=document.createElement('h2');heading.textContent=`0${c.order} / ${c.name} · ${c.building}`;
    const link=document.createElement('a');link.className='download';link.href=URL.createObjectURL(blob);
    link.download=`0${c.order}-${c.building}-补画完成特写-1920x1080.png`;link.textContent=`下载${c.building}特写 PNG`;
    const note=document.createElement('p');note.textContent=`原图裁切（像素）：${crop.map(n=>n.toFixed(2)).join(' / ')}`;
    article.append(canvas,heading,link,note);target.append(article);
  }
  status.textContent='四张特写已就绪 · 点击对应链接下载';
}catch(error){status.textContent=`导出未完成：${error.message}。请检查素材并刷新。`;}
