const buffers=new WeakMap();
export function playNavalGunAudio(audio,caliber,volume=1){
 if(audio.state!=='running')return false;
 const duration=caliber>=100?.55:.16,time=audio.currentTime;let cache=buffers.get(audio);if(!cache){cache=new Map();buffers.set(audio,cache);}let buffer=cache.get(duration);
 if(!buffer){buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*7);cache.set(duration,buffer);}
 const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=caliber>=100?260:1400;
 gain.gain.setValueAtTime(Math.max(0,Math.min(1,volume))*.3,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(time);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return true;
}
