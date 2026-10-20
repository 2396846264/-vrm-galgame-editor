// One clock per WebView; changing projects and rebuilding the UI never resets it.
export class EditorAttribution {
  constructor({now = () => performance.now(), schedule = (fn,ms) => setTimeout(fn,ms), observe = true} = {}) {
    this.now = now; this.schedule = schedule; this.started = now(); this.notice = '';
    this.ready = false; this.observer = observe ? new MutationObserver(() => this.mount()) : null;
    this.observer?.observe(document.body, {childList:true, subtree:true});
    this.timer = schedule(() => { this.ready = true; this.mount(); }, 30 * 60_000);
    this.resize = new ResizeObserver(entries => entries.forEach(({target}) => this.layout(target)));
    this.nodes = new Set();
    this.visibility = () => { if(this.now()-this.started >= 30*60_000) this.ready=true; this.mount(); };
    document.addEventListener('visibilitychange',this.visibility);
  }
  configure(notice, elapsed = 0) {
    this.notice = notice || '';
    // Native elapsed time includes the welcome screen and independently opened modules.
    if(Number(elapsed) > 0) this.started = Math.min(this.started,this.now()-Number(elapsed));
    clearTimeout(this.timer);
    const remaining = Math.max(0,30*60_000-(this.now()-this.started));
    this.ready ||= remaining === 0;
    if(!this.ready) this.timer = this.schedule(() => {this.ready=true;this.mount();},remaining);
    this.mount();
  }
  mount() {
    for(const node of this.nodes) if(!node.isConnected){this.resize.unobserve(node);this.nodes.delete(node);}
    if(!this.ready || !this.notice) return;
    for(const footer of document.querySelectorAll('.editor .status')) {
      if(footer.querySelector('.editor-announcement')) continue;
      const box=document.createElement('div');box.className='editor-announcement';box.setAttribute('aria-label','软件发行提醒');box.title=this.notice;
      const track=document.createElement('span');track.className='announcement-track';
      const text=document.createElement('span');text.textContent=this.notice;track.append(text);
      const copy=text.cloneNode(true);copy.setAttribute('aria-hidden','true');track.append(copy);box.append(track);
      footer.insertBefore(box,footer.querySelector('.editor-feedback')||footer.lastElementChild);
      footer.classList.add('has-announcement');this.nodes.add(box);this.resize.observe(box);this.layout(box);
    }
  }
  layout(box) {
    const text=box.firstElementChild?.firstElementChild;if(!text)return;
    const width=text.getBoundingClientRect().width;
    box.classList.toggle('is-scrolling',width>box.clientWidth);
    box.style.setProperty('--announcement-distance',`${width+48}px`);
    box.style.setProperty('--announcement-duration',`${Math.max(18,(width+48)/38)}s`);
  }
  dispose(){clearTimeout(this.timer);this.observer?.disconnect();this.resize.disconnect();document.removeEventListener('visibilitychange',this.visibility);}
}

export function installOriginEgg({read, version = '0.0.78'}) {
  let count=0,last=0;
  document.addEventListener('click',async event=>{
    const target=event.target.closest('[data-engine-version]');if(!target)return;
    const now=performance.now();count=now-last<1500?count+1:1;last=now;
    if(count<7)return;count=0;
    try {
      const origin=await read();
      let result=target.parentElement.querySelector('.engine-origin');
      if(!result){result=document.createElement('p');result.className='engine-origin';result.setAttribute('role','status');target.after(result);}
      result.textContent=`${origin.engine} · ${origin.creator} · ${origin.id} · ${origin.version || version}`;
    } catch { /* No game state changes when the host is unavailable. */ }
  });
}
