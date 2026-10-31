// One decoded audio loop survives every page render. Trimming source silence
// and blending the loop seam avoids both MP3 restart latency and the silent tail.
export function seamlessLoop(context,input){
  const channels=Array.from({length:input.numberOfChannels},(_,i)=>input.getChannelData(i));
  // Require sustained sound: an isolated MP3 decoder click after the quiet tail
  // must not keep nearly two seconds of silence inside the repeating buffer.
  const windowSize=Math.max(1,Math.round(input.sampleRate*.02));
  const windows=Math.ceil(input.length/windowSize);
  const audible=block=>channels.some(data=>{
    const start=block*windowSize,end=Math.min(start+windowSize,input.length);
    let energy=0;for(let i=start;i<end;i++)energy+=data[i]*data[i];
    return energy/(end-start)>.002**2;
  });
  let first=0,last=input.length-1,run=0;
  for(let block=0;block<windows;block++){
    run=audible(block)?run+1:0;
    if(run===3){first=(block-2)*windowSize;break;}
  }
  run=0;
  for(let block=windows-1;block>=0;block--){
    run=audible(block)?run+1:0;
    if(run===3){last=Math.min((block+3)*windowSize,input.length)-1;break;}
  }
  if(last-first<input.sampleRate)return input;
  const fade=Math.min(Math.round(input.sampleRate*.12),Math.floor((last-first)/4));
  const length=last-first+1-fade;
  const output=context.createBuffer(input.numberOfChannels,length,input.sampleRate);
  for(let channel=0;channel<channels.length;channel++){
    const data=channels[channel],out=output.getChannelData(channel);
    out.set(data.subarray(first+fade,last+1));
    for(let i=0;i<fade;i++){
      const t=i/(fade-1),j=length-fade+i;
      out[j]=data[last-fade+1+i]*Math.cos(t*Math.PI/2)+data[first+i]*Math.sin(t*Math.PI/2);
    }
  }
  return output;
}

export function createBackgroundMusic({src,onChange=()=>{}}){
  let context,gain,buffer,loading,source,startedAt=0,offset=0,stopTimer;
  let enabled=true,unlocked=false,blocked=false,failed=false;
  try{enabled=localStorage.getItem('huawai-music-enabled')!=='false';}catch{}
  const notify=()=>{document.documentElement.dataset.music=source&&!blocked&&enabled&&!document.hidden?'playing':blocked?'film':enabled?'ready':'off';onChange();};
  function stopNow(){if(!source)return;offset=(offset+context.currentTime-startedAt)%buffer.duration;try{source.stop();}catch{}source.disconnect();source=null;clearTimeout(stopTimer);stopTimer=null;}
  function sync(){
    if(!context||!buffer){notify();return;}
    const play=enabled&&unlocked&&!blocked&&!document.hidden&&context.state==='running';
    const now=context.currentTime;
    gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);
    if(play){
      clearTimeout(stopTimer);stopTimer=null;
      if(!source){source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);startedAt=now;source.start(0,offset);}
      gain.gain.linearRampToValueAtTime(.32,now+.22);
    }else{
      gain.gain.linearRampToValueAtTime(0,now+.12);
      if(source&&!stopTimer)stopTimer=setTimeout(()=>{stopNow();notify();},140);
    }
    notify();
  }
  async function unlock(){
    if(!enabled)return;
    unlocked=true;
    try{
      if(!context){context=new AudioContext();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);}
      // Resume in the input handler, before any await, to respect browser sound rules.
      const resumed=context.resume();
      if(!loading)loading=fetch(src).then(r=>{if(!r.ok)throw Error('audio unavailable');return r.arrayBuffer();}).then(data=>context.decodeAudioData(data)).then(decoded=>{buffer=seamlessLoop(context,decoded);failed=false;}).catch(()=>{failed=true;loading=null;});
      await Promise.all([resumed,loading]);sync();
    }catch{failed=true;notify();}
  }
  function toggle(){if(enabled&&(!unlocked||failed)){failed=false;unlock();return;}enabled=!enabled;try{localStorage.setItem('huawai-music-enabled',String(enabled));}catch{}if(enabled)unlock();else sync();}
  function setBlocked(value){if(blocked===value)return;blocked=value;sync();}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&unlocked&&enabled)unlock();else sync();});
  window.addEventListener('pagehide',stopNow);
  return {unlock,toggle,setBlocked,get enabled(){return enabled;},get label(){return failed?'重试音乐':!enabled?'音乐已关':unlocked?'背景音乐':'开启音乐';},get status(){return {enabled,unlocked,blocked,failed,playing:!!source&&!stopTimer,loopDuration:buffer?.duration||0};}};
}
