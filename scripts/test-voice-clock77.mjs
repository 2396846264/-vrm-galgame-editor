import assert from 'node:assert/strict';
import {VoiceDialogueClock,voiceTextIndex} from '../src/voice-dialogue-clock.js';
class AudioClock extends EventTarget{duration=10;currentTime=0;paused=true;ended=false;readyState=4;seeking=false;emit(name){this.dispatchEvent(new Event(name));}}
const audio=new AudioClock(),positions=[],active=[];let complete=0,failed=0;
const clock=new VoiceDialogueClock(audio,100,{progress:index=>positions.push(index),speaking:value=>active.push(value),complete:()=>complete++,failed:()=>failed++});clock.tick();assert.equal(positions.at(-1),0);assert.equal(active.at(-1),false);
audio.paused=false;audio.emit('playing');audio.currentTime=2.5;clock.tick();assert.equal(positions.at(-1),25);assert.equal(active.at(-1),true);
audio.emit('waiting');assert.equal(active.at(-1),false);clock.tick();assert.equal(positions.at(-1),25);audio.emit('playing');audio.paused=true;audio.emit('pause');assert.equal(active.at(-1),false);
audio.currentTime=7.5;audio.paused=false;audio.emit('seeked');assert.equal(positions.at(-1),75);clock.reveal();assert.equal(positions.at(-1),100);assert.equal(complete,0,'revealing text must not end the voice animation');audio.currentTime=8;clock.tick();assert.equal(positions.at(-1),100);assert.equal(active.at(-1),true);
audio.currentTime=10;audio.ended=true;audio.emit('ended');assert.equal(complete,1);assert.equal(active.at(-1),false);assert.equal(clock.finished,true);audio.emit('ended');assert.equal(complete,1);
const broken=new AudioClock(),bad=new VoiceDialogueClock(broken,20,{failed:()=>failed++});broken.emit('error');assert.equal(failed,1);assert.equal(bad.finished,true);
const invalid=new AudioClock();invalid.duration=Infinity;const infinite=new VoiceDialogueClock(invalid,20,{failed:()=>failed++});infinite.tick();assert.equal(failed,2);
assert.equal(voiceTextIndex(3,5,10),1);assert.equal(voiceTextIndex(3,999,10),3);assert.equal(voiceTextIndex(3,5,NaN),0);
console.log('PASS voiced text: media progress, waiting, pause/resume, seeking/rate, instant reveal keeps speech alive, exact completion, error fallback, invalid duration, listener disposal.');
