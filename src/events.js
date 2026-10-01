export const eventNames = { news: '一般新闻', war: '宣战消息', major: '重大事件' };
export const eventSeconds = { news: 3, war: 0, major: 10 };
export const isEvent = node => node?.kind === 'event';
export function normalizeEvent(value = {}) {
  const type = Object.hasOwn(eventNames, value.type) ? value.type : 'news';
  return { type, title: '', body: '', imageId: '', videoId: '', backgroundId: '', bgmId: '', seId: '', voiceId: '',
    paperName: '世界新闻', date: '', quote: '', buttonText: '继续', countryA: '', countryB: '', flagAId: '', flagBId: '',
    burst: false, declarations: [], burstInterval: .22, ...value, type,
    burstInterval: Math.max(.12, Math.min(3, Number(value.burstInterval) || .22)),
    declarations: Array.isArray(value.declarations) ? value.declarations.slice(0, 59).map(row => ({ countryA: '', countryB: '', flagAId: '', flagBId: '', body: '', ...row })) : [] };
}
export function newEvent(id, stepId) {
  return { id, kind: 'event', name: '新事件', event: normalizeEvent(), cast: {}, castSettings: {},
    steps: [{ id: stepId, text: '', speaker: '', characterId: '', choices: [] }] };
}
export function createEvents(ctx) {
  const { escape: esc, assetUrl } = ctx;
  const eye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  let state = null, frame = 0, generation = 0;
  const image = (id, alt, className = '') => {
    const item = ctx.asset(id);
    return item?.type === 'image' ? `<img class="${className}" src="${esc(assetUrl(item))}" alt="${esc(alt)}" draggable="false">` : '';
  };
  const control = (key, value, multiline = false, row = null) => {
    const attr = `data-event-field="${key}"${row === null ? '' : ` data-event-row="${row}"`}`;
    return multiline ? `<textarea ${attr}>${esc(value)}</textarea>` : `<input ${attr} value="${esc(value)}">`;
  };
  const choice = (key, value, type, empty, row = null) => `<select data-event-field="${key}"${row === null ? '' : ` data-event-row="${row}"`}><option value="">${empty}</option>${ctx.project().assets.filter(a => a.type === type).map(a => `<option value="${esc(a.id)}" ${a.id === value ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>`;
  const field = (label, html) => `<label class="field"><span>${label}</span>${html}</label>`;
  const upload = (key, type) => `<button data-action="event-upload" data-event-key="${key}" data-type="${type}">上传素材</button>`;
  function editor(node) {
    const e = node.event = normalizeEvent(node.event);
    const countries = (row, index = null) => `<div class="event-country-editor">${field('宣战国名称', control('countryA', row.countryA, false, index))}${field('宣战国国旗', choice('flagAId', row.flagAId, 'image', '选择国旗图片', index))}${field('被宣战国名称', control('countryB', row.countryB, false, index))}${field('被宣战国国旗', choice('flagBId', row.flagBId, 'image', '选择国旗图片', index))}${field('补充说明', control('body', row.body, true, index))}</div>`;
    return `<div class="inspector-content event-editor"><h2>事件设置</h2>
      ${field('剧情列表中的名字', control('name', node.name))}
      ${field('事件类型', `<select data-event-field="type">${Object.entries(eventNames).map(([key, name]) => `<option value="${key}" ${e.type === key ? 'selected' : ''}>${name}</option>`).join('')}</select>`)}
      <p class="tip event-rule">${e.type === 'war' ? '玩家可以立即关闭，不用等待。' : `玩家必须观看 ${eventSeconds[e.type]} 秒。眼睛倒计时结束后才可以继续。`}</p>
      ${field('标题', control('title', e.title))}
      ${e.type === 'news' ? `${field('报纸名称', control('paperName', e.paperName))}${field('日期 / 刊号', control('date', e.date))}${field('新闻内容（建议约 100 字）', control('body', e.body, true))}${field('新闻插图', choice('imageId', e.imageId, 'image', '不放插图'))}${upload('imageId', 'image')}` : ''}
      ${e.type === 'war' ? `<label class="weather-toggle"><input type="checkbox" data-event-field="burst" ${e.burst ? 'checked' : ''}><span>连续弹出多条宣战消息</span></label>${countries(e)}${e.burst ? `<h3>后续宣战消息（总计最多 60 条）</h3><p class="tip">上面的消息先出现，下面的消息按顺序接着弹出。玩家随时可以关闭全部窗口。</p>${field('每条消息的间隔（秒）', `<input type="number" data-event-field="burstInterval" min="0.12" max="3" step="0.02" value="${e.burstInterval}">`)}${e.declarations.map((row, index) => `<details class="event-row"><summary>第 ${index + 2} 条 · ${esc(row.countryA || '宣战国')} → ${esc(row.countryB || '被宣战国')}</summary>${countries(row, index)}<button data-action="event-remove-row" data-index="${index}">删除这一条</button></details>`).join('')}<button data-action="event-add-row" ${e.declarations.length >= 59 ? 'disabled' : ''}>＋ 添加宣战消息</button>` : ''}<p class="tip">国旗在下方素材库中导入，推荐横向 PNG 图片。</p>` : ''}
      ${e.type === 'major' ? `${field('重大事件说明（建议 100～200 字）', control('body', e.body, true))}${field('主画面图片', choice('imageId', e.imageId, 'image', '不放图片'))}${upload('imageId', 'image')}${field('主画面视频（选了视频就优先显示）', choice('videoId', e.videoId, 'video', '不播放视频'))}${upload('videoId', 'video')}${field('结尾短句 / 引言', control('quote', e.quote, true))}` : ''}
      <hr><h3>声音与背景</h3>${field('事件背景音乐（循环）', choice('bgmId', e.bgmId, 'audio', '静音'))}${upload('bgmId', 'audio')}${field('开场音效', choice('seId', e.seId, 'audio', '不播放音效'))}${field('播报语音', choice('voiceId', e.voiceId, 'audio', '不播放语音'))}
      ${field('背后模糊的背景', choice('backgroundId', e.backgroundId, 'image', '沿用前一幕背景'))}
      ${field('继续按钮文字', control('buttonText', e.buttonText))}
      <p class="tip">事件期间人物和对白隐藏，天气暂停。播放完会进入后面的剧情。</p>
      <div class="inline-actions"><button data-action="event-preview">重新预览</button><button data-action="event-duplicate">复制事件</button><button data-action="event-delete">删除事件</button></div></div>`;
  }
  function warCard(e, index = 0, burst = false) {
    return `<article class="event-crt ${burst ? 'event-crt-burst' : ''}" style="--stack:${index % 7};--side:${index % 3 - 1}"><div class="crt-case"><header><span>紧急通讯 / ${String(index + 1).padStart(2, '0')}</span><span class="crt-led">● LIVE</span></header><div class="crt-screen"><div class="crt-flags"><div>${image(e.flagAId, e.countryA + '国旗')}<strong>${esc(e.countryA || '宣战国')}</strong></div><b>→</b><div>${image(e.flagBId, e.countryB + '国旗')}<strong>${esc(e.countryB || '被宣战国')}</strong></div></div><h2>${esc(e.countryA || '宣战国')}<br><em>向 ${esc(e.countryB || '被宣战国')} 宣战</em></h2>${e.body ? `<p>${esc(e.body)}</p>` : ''}</div><footer><span>WORLD COMMUNICATION NETWORK</span><i></i></footer></div></article>`;
  }
  function content(e) {
    if (e.type === 'news') return `<article class="event-paper"><div class="paper-masthead">${esc(e.paperName || '世界新闻')}</div><div class="paper-dateline"><span>${esc(e.date || '特别报道')}</span><span>WORLD NEWS</span></div><div class="paper-content"><h1>${esc(e.title || '新闻标题')}</h1>${image(e.imageId, '新闻插图', 'paper-picture')}<p>${esc(e.body || '在事件设置中写下这条新闻。')}</p></div><div class="paper-end">◆</div></article>`;
    if (e.type === 'war') return `<div class="event-war-header"><small>BREAKING TRANSMISSION</small><h1>${esc(e.title || '世界局势突变')}</h1><span class="war-message-count"></span></div><div class="event-war-stack ${e.burst ? 'burst' : ''}">${warCard(e, 0, e.burst)}</div>${e.burst ? `<details class="event-transmission-log"><summary>查看已收到的消息</summary><ol>${[e, ...e.declarations].map((row, i) => `<li data-transmission="${i}" ${i ? 'hidden' : ''}><strong>${String(i + 1).padStart(2, '0')} · ${esc(row.countryA || '宣战国')} 向 ${esc(row.countryB || '被宣战国')}宣战</strong>${row.body ? `<p>${esc(row.body)}</p>` : ''}</li>`).join('')}</ol></details>` : ''}`;
    const video = ctx.asset(e.videoId);
    return `<article class="event-broadcast"><header><span><i></i>特别报道</span><span>${esc(e.date || 'WORLD BULLETIN')}</span></header><div class="broadcast-media">${video?.type === 'video' ? `<video src="${esc(assetUrl(video))}" muted playsinline preload="auto"></video>` : image(e.imageId, '重大事件主画面') || '<div class="broadcast-no-signal">WORLD BULLETIN</div>'}</div><div class="broadcast-copy"><h1>${esc(e.title || '重大事件')}</h1><p>${esc(e.body || '在事件设置中填写重大事件的内容。')}</p>${e.quote ? `<blockquote>${esc(e.quote)}</blockquote>` : ''}</div></article>`;
  }
  function tick(now) {
    const s = state;
    if (!s) return;
    const elapsed = Math.min(.1, Math.max(0, (now - s.last) / 1000));
    s.last = now;
    const paused = document.hidden || ctx.paused() || !s.ready;
    if (!paused) {
      s.remaining = Math.max(0, s.remaining - elapsed);
      s.visibleTime += elapsed;
      if (s.event.type === 'war' && s.event.burst) {
        const rows = s.event.declarations;
        while (s.shown < rows.length && s.visibleTime >= (s.shown + 1) * s.event.burstInterval) {
          const target = document.querySelector('#world-event .event-war-stack');
          const index = ++s.shown;
          target?.insertAdjacentHTML('beforeend', warCard(rows[index - 1], index, true));
          // Keep the foreground readable while retaining every received message in the log.
          while (target?.children.length > 8) target.firstElementChild.remove();
          const entry = s.root.querySelector(`[data-transmission="${index}"]`);
          if (entry) entry.hidden = false;
          ctx.cue?.();
        }
      }
    }
    const video = s.root.querySelector('video');
    if (video) { if (paused) video.pause(); else if (video.paused && !video.ended) video.play().catch(() => {}); }
    const count = s.root.querySelector('.war-message-count');
    if (count) count.textContent = s.event.burst ? `已收到 ${s.shown + 1} / ${s.event.declarations.length + 1} 条消息` : '';
    const button = s.root.querySelector('[data-action="event-confirm"]');
    button.disabled = !s.ready || s.remaining > 0;
    const timer = s.root.querySelector('.event-watch');
    if (timer) {
      timer.classList.toggle('finished', s.remaining <= 0);
      timer.querySelector('span').textContent = !s.ready ? '正在准备画面…' : s.remaining > 0 ? `${paused ? '暂停 · ' : ''}${Math.ceil(s.remaining)} 秒` : '可以继续';
      timer.querySelector('i').style.transform = `scaleX(${s.total ? 1 - s.remaining / s.total : 1})`;
    }
    frame = requestAnimationFrame(tick);
  }
  async function show(node, preview = false, remaining) {
    cancel();
    const token = generation;
    const e = normalizeEvent(node.event), total = eventSeconds[e.type];
    const backdrop = ctx.prepare(node, preview);
    const host = document.querySelector('.stage-frame');
    host.classList.add('event-mode');
    host.insertAdjacentHTML('beforeend', `<section id="world-event" class="world-event event-${e.type} ${preview ? 'event-preview' : ''}" role="dialog" aria-modal="true" aria-label="${esc(eventNames[e.type])}"><div class="event-top-tools"><span>${preview ? '事件预览' : ''}</span><div>${preview || !ctx.player() ? '' : '<button data-action="save-game">存档</button><button data-action="load-game">读档</button><button data-action="settings">设置</button>'}${preview ? '' : '<button data-action="stop-play">返回标题</button>'}</div></div><div class="event-content">${content(e)}</div><footer class="event-actions">${total ? `<div class="event-watch" role="timer" aria-label="最低观看时间">${eye}<span>${total} 秒</span><div><i></i></div></div>` : ''}<button class="event-confirm" data-action="event-confirm" ${total ? 'disabled' : ''}>${esc(e.type === 'war' && e.burst ? '关闭全部消息' : e.buttonText || '继续')}</button></footer></section>`);
    const root = document.querySelector('#world-event');
    state = { nodeId: node.id, event: e, root, preview, remaining: Number.isFinite(remaining) ? Math.max(0, Math.min(total, remaining)) : total,
      total, ready: e.type === 'war', last: performance.now(), visibleTime: 0, shown: 0, objectUrls: [], mediaAbort: new AbortController() };
    if (!preview) ctx.audio(e);
    frame = requestAnimationFrame(tick);
    const waits = [...root.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = img.onerror = resolve; }));
    const video = root.querySelector('video');
    if (video && video.readyState < 2) waits.push(new Promise(resolve => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', resolve, { once: true }); }));
    await Promise.all([backdrop, Promise.race([Promise.all(waits), new Promise(resolve => setTimeout(resolve, 6000))])]);
    if (generation !== token || !state || state.root !== root) return;
    if (video?.error) {
      // Some WebView2 virtual-file responses cannot be sought by the media demuxer.
      // A local blob supplies a complete seekable source without changing the project asset.
      try {
        const response = await fetch(video.src, { signal: state.mediaAbort.signal });
        if (!response.ok) throw new Error('Video asset unavailable');
        const data = await response.arrayBuffer();
        if (generation !== token || !state || state.root !== root) return;
        const type = ctx.asset(e.videoId)?.path?.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
        const url = URL.createObjectURL(new Blob([data], { type })); state.objectUrls.push(url);
        const loaded = new Promise(resolve => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', resolve, { once: true }); });
        video.src = url; video.load();
        await Promise.race([loaded, new Promise(resolve => setTimeout(resolve, 5000))]);
      } catch { /* Show the readable error below if both sources fail. */ }
    }
    if (generation !== token || !state || state.root !== root) return;
    for (const img of root.querySelectorAll('img')) if (!img.naturalWidth) { img.classList.add('event-media-missing'); img.alt = '图片未能读取'; }
    if (video?.error) {
      root.dataset.mediaError = `${video.error.code}: ${video.error.message}`;
      video.replaceWith(Object.assign(document.createElement('p'), { textContent: '视频未能读取，请检查素材。' }));
    }
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550));
    if (generation !== token || !state || state.root !== root) return;
    state.ready = true; state.last = performance.now();
    root.querySelector('[data-action="event-confirm"]').disabled = total > 0 && state.remaining > 0;
  }
  function confirm() {
    if (!state?.ready || state.remaining > 0 || ctx.paused() || document.hidden) return false;
    if (state.preview) { state.root.querySelector('.event-confirm').textContent = '预览结束 · 可重新预览'; return true; }
    const id = state.nodeId;
    cancel(); ctx.finish(id); return true;
  }
  function cancel() {
    generation++; cancelAnimationFrame(frame);
    if (state && !state.preview) ctx.cleanAudio?.();
    state?.mediaAbort.abort();
    state?.root.querySelector('video')?.pause();
    for (const url of state?.objectUrls || []) URL.revokeObjectURL(url);
    document.querySelector('#world-event')?.remove();
    document.querySelector('.stage-frame')?.classList.remove('event-mode');
    state = null;
  }
  return { editor, show, confirm, cancel, remaining: () => state?.remaining, active: () => Boolean(state),
    diagnostics: () => state ? { id: state.nodeId, type: state.event.type, remaining: state.remaining, ready: state.ready,
      preview: state.preview, received: state.shown + 1, windows: state.root.querySelectorAll('.event-crt').length } : null };
}
