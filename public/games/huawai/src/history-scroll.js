const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function historyScrollMarkup(court){
  const characters=text=>Array.from(text).map(char=>`<span class="history-char">${escapeHtml(char)}</span>`).join('');
  return `<article class="history-scroll" aria-label="${escapeHtml(court.building)}历史札记">
    <div class="history-reading" tabindex="0" role="region" aria-label="历史正文，从右向左阅读；点击画面或按回车显示全文">
      <div class="history-ink" aria-hidden="true"><h2>${(court.moreTitle||court.building).split(/(?<=，)/u).map(characters).join('<br>')}</h2>${court.more.map(text=>`<p>${characters(text)}</p>`).join('')}</div>
      <div class="history-accessible"><h2>${escapeHtml(court.moreTitle||court.building)}</h2>${court.more.map(text=>`<p>${escapeHtml(text)}</p>`).join('')}</div>
    </div>
    <div class="history-footnote"><span class="history-hint">点击画面，展开全文</span>${court.moreReferences?.length?`<details class="history-sources"><summary>资料出处</summary><div>${court.moreReferences.map(ref=>`<a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.title)}</a>`).join('')}</div></details>`:''}</div>
  </article>`;
}

// DOM order and vertical-rl layout share one reading order, including punctuation.
export function bindHistoryScroll(stage,{ready=Promise.resolve(),blocked=()=>false,reducedMotion=false}={}){
  const article=stage?.querySelector('.history-scroll');
  if(!article)return ()=>{};
  const reading=article.querySelector('.history-reading'),hint=article.querySelector('.history-hint');
  const chars=[...article.querySelectorAll('.history-char')];
  let frame=0,disposed=false,complete=false,mediaReady=false,shown=0,last=0,clock=0,follow=true;
  const setHint=()=>{hint.textContent=complete?(reading.scrollWidth>reading.clientWidth+4?'全文已展开 · 横向滑动阅读':'全文已展开'):'点击画面，展开全文';};
  function revealAll(){
    if(disposed||complete)return;
    complete=true;cancelAnimationFrame(frame);article.dataset.complete='true';
    chars.forEach(char=>char.classList.add('is-written'));shown=chars.length;setHint();
  }
  function click(event){if(!event.target.closest('button,a,summary,details'))revealAll();}
  function key(event){if(event.target===reading&&['Enter',' '].includes(event.key)){event.preventDefault();revealAll();}}
  function stopFollowing(){follow=false;}
  function tick(now){
    if(disposed||complete)return;
    const delta=last?Math.min(now-last,80):0;last=now;
    if(mediaReady&&!blocked()&&!document.hidden){
      article.dataset.started='true';clock+=delta;
      const next=Math.min(chars.length,Math.floor(clock/64));
      while(shown<next)chars[shown++].classList.add('is-written');
      if(follow&&shown){
        const char=chars[shown-1].getBoundingClientRect(),box=reading.getBoundingClientRect();
        if(char.left<box.left+18)reading.scrollLeft+=char.left-box.left-32;
      }
      if(shown===chars.length){revealAll();return;}
    }
    frame=requestAnimationFrame(tick);
  }
  stage.addEventListener('click',click);reading.addEventListener('keydown',key);
  reading.addEventListener('wheel',stopFollowing,{passive:true});reading.addEventListener('touchmove',stopFollowing,{passive:true});
  Promise.resolve(ready).catch(()=>{}).then(()=>{if(!disposed)mediaReady=true;});
  if(reducedMotion)revealAll();else frame=requestAnimationFrame(tick);
  return ()=>{disposed=true;cancelAnimationFrame(frame);stage.removeEventListener('click',click);reading.removeEventListener('keydown',key);reading.removeEventListener('wheel',stopFollowing);reading.removeEventListener('touchmove',stopFollowing);};
}
