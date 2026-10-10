import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './library.css';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Only visible writing is searched. Asset paths, IDs and animation data are never replaced.
export function textFields(project) {
  const result = [];
  const add = (object, key, label) => { if (typeof object?.[key] === 'string') result.push({ object, key, label }); };
  for (const [i, act] of project.acts.entries()) {
    add(act, 'name', `剧情节点 ${i + 1} 名称`);
    if (act.kind === 'event') {
      for (const key of ['title','body','paperName','date','quote','buttonText','countryA','countryB']) add(act.event, key, `事件 ${act.name}`);
      for (const row of act.event?.declarations || []) for (const key of ['countryA','countryB','body']) add(row, key, `事件 ${act.name} 的宣战消息`);
      continue;
    }
    for (const [j, line] of act.steps.entries()) {
      add(line, 'text', `第 ${i + 1} 幕 · 第 ${j + 1} 句`);
      add(line, 'speaker', `第 ${i + 1} 幕 · 第 ${j + 1} 句显示名字`);
      for (const choice of line.choices || []) add(choice, 'text', `第 ${i + 1} 幕选项`);
    }
  }
  for (const item of project.characters) {
    for (const key of ['name', 'title', 'description']) add(item, key, `角色 ${item.name}`);
    for (const story of item.stories || []) for (const key of ['title', 'text']) add(story, key, `角色 ${item.name} 的故事`);
  }
  add(project.title, 'authorNote', '制作说明');
  return result;
}
export function searchText(project, query) {
  if (!query) return [];
  return textFields(project).filter(({ object, key }) => object[key].includes(query));
}
export function replaceText(project, query, replacement) {
  const found = searchText(project, query);
  let count = 0;
  for (const { object, key } of found) {
    count += object[key].split(query).length - 1;
    object[key] = object[key].split(query).join(replacement);
  }
  return count;
}
export function bookUnlocked(project, book, progress) {
  const act = project.acts.find(item => item.id === book.unlockActId);
  return Boolean(act?.kind !== 'event' && act?.steps.length && act.steps.every(line => progress?.viewedDialogueIds?.includes(line.id)));
}
export function createLibrary(ctx) {
  const { escape: esc, assetUrl, bridge, markDirty, toast } = ctx;
  let selected = 0, reader = null, request = 0;
  const books = () => ctx.project().knowledgeBooks ||= [];
  const asset = id => ctx.project().assets.find(item => item.id === id);
  const pdfOptions = item => ({ url: assetUrl(item), cMapUrl: new URL('./pdf-resources/cmaps/', location.href).href,
    cMapPacked: true, standardFontDataUrl: new URL('./pdf-resources/standard_fonts/', location.href).href,
    wasmUrl: new URL('./pdf-resources/wasm/', location.href).href, isEvalSupported: false });
  const options = (items, value, empty) => `<option value="">${empty}</option>${items.map(item => `<option value="${esc(item.id)}" ${item.id === value ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}`;
  function editor() {
    const book = books()[selected];
    document.querySelector('#sidebar-body').innerHTML = `<div class="section-heading">知识库 <button data-action="book-import">＋ 导入 PDF</button></div><div class="list">${books().map((item, i) => `<button class="list-row ${i === selected ? 'selected' : ''}" data-action="book-select" data-index="${i}">${esc(item.name)}</button>`).join('')}</div><p class="tip">先导入 PDF，再在右侧选定解锁的幕。封面默认取 PDF 第一页。</p>`;
    document.querySelector('#inspector-body').innerHTML = book ? `<div class="inspector-content"><h2>书本设置</h2><label class="field"><span>书名</span><input data-book-field="name" value="${esc(book.name)}"></label><label class="field"><span>简介</span><textarea data-book-field="description">${esc(book.description || '')}</textarea></label><label class="field"><span>完成哪一幕后解锁</span><select data-book-field="unlockActId">${options(ctx.project().acts.filter(a => a.kind !== 'event'), book.unlockActId, '请选择一幕（未设置时保持锁定）')}</select></label><p class="tip">玩家看完所选幕的全部对白后，书本才可打开。</p><label class="field"><span>封面图片</span><select data-book-field="coverId">${options(ctx.project().assets.filter(item => item.type === 'image'), book.coverId, '使用 PDF 第一页')}</select></label><button data-action="book-cover">上传封面</button><button data-action="book-preview">预览翻书</button><hr><button data-action="book-delete">删除这本书</button></div>` : '<div class="inspector-content"><h2>知识库</h2><p>点击左边“导入 PDF”，把制作文档放进游戏。PDF 会随工程保存和随游戏导出。</p></div>';
  }
  function renderSearch(query = document.querySelector('#text-search')?.value || '') {
    document.querySelector('#text-search-modal')?.remove();
    const found = searchText(ctx.project(), query);
    const count = found.reduce((n, { object, key }) => n + object[key].split(query).length - 1, 0);
    document.querySelector('.editor').insertAdjacentHTML('beforeend', `<div id="text-search-modal" class="editor-settings-backdrop"><div class="search-box"><header><h2>查找与替换</h2><button data-action="search-close">关闭 ×</button></header><div class="search-fields"><label>查找<input id="replace-find" value="${esc(query)}" placeholder="输入要查找的文字"></label><label>替换为<input id="replace-with" placeholder="输入新文字；留空表示删除"></label><button data-action="search-find">查找</button><button data-action="search-replace" ${count ? '' : 'disabled'}>全部替换（${count} 处）</button><button data-action="search-undo" ${ctx.history().canUndo ? '' : 'disabled'}>撤销</button><button data-action="search-redo" ${ctx.history().canRedo ? '' : 'disabled'}>重做</button></div><p>查找对白、选项、幕名称、角色名称、角色介绍和角色故事。按原文字精确匹配。</p><div class="search-results">${found.map(({ object, key, label }) => `<article><b>${esc(label)}</b><p>${esc(object[key])}</p></article>`).join('') || '<p>没有匹配的内容。</p>'}</div></div></div>`);
  }
  function shelf() {
    ctx.openModal('knowledge');
    const progress = ctx.progress();
    document.querySelector('.player').insertAdjacentHTML('beforeend', `<div id="player-modal" class="player-modal"><div class="modal-box book-library"><header><div><small>LIBRARY</small><h2>书库</h2></div><button data-action="close-modal">关闭 ×</button></header><div class="book-shelf">${books().map((book, i) => {
      const unlocked = bookUnlocked(ctx.project(), book, progress);
      const chapter = ctx.project().acts.find(item => item.id === book.unlockActId);
      return `<button class="book-card ${unlocked ? '' : 'book-locked'}" title="${esc(book.description || book.name)}" data-action="book-read" data-index="${i}" aria-disabled="${!unlocked}"><div class="book-cover" data-book-cover="${i}">${book.coverId && asset(book.coverId) ? `<img src="${esc(assetUrl(asset(book.coverId)))}" alt="${esc(book.name)}">` : '<span class="book-cover-placeholder">PDF</span>'}${unlocked ? '' : '<strong class="book-seal">未解锁</strong>'}</div><b>${esc(book.name)}</b><small>${unlocked ? '点击阅读' : `完成「${chapter?.name || '未设置章节'}」后解锁`}</small></button>`;
    }).join('') || '<p>制作者还没有添加书本。</p>'}</div></div></div>`);
    books().forEach((book, i) => { if (!book.coverId) cover(book, i); });
  }
  async function pageCanvas(pdf, number, width = 800) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
  async function cover(book, index) {
    const target = document.querySelector(`[data-book-cover="${index}"]`);
    if (!asset(book.pdfId) || !target) return;
    let pdf;
    try {
      pdf = await pdfjs.getDocument(pdfOptions(asset(book.pdfId))).promise;
      const canvas = await pageCanvas(pdf, 1, 350);
      if (target.isConnected) target.querySelector('.book-cover-placeholder')?.replaceWith(canvas);
    } catch { if (target.isConnected) target.querySelector('.book-cover-placeholder').textContent = '封面加载失败'; }
    finally { await pdf?.destroy(); }
  }
  async function openBook(index, preview = false) {
    const book = books()[index];
    if (!book || (!preview && !bookUnlocked(ctx.project(), book, ctx.progress()))) { toast('完成指定幕的全部对白后才能阅读'); return; }
    if (!asset(book.pdfId)) { toast('找不到这本书的 PDF', true); return; }
    await closeReader();
    const token = ++request;
    const gameUi = preview ? 'classic' : document.querySelector('.player')?.dataset.gameUi || 'classic';
    document.body.insertAdjacentHTML('beforeend', `<div id="book-reader" class="book-reader" data-game-ui="${gameUi}" role="dialog" aria-modal="true" aria-label="${esc(book.name)}"><header><button data-action="book-reader-close">‹ ${preview ? '返回编辑器' : '返回书库'}</button><b>${esc(book.name)}</b><div><button data-action="book-zoom-out" aria-label="缩小">−</button><button data-action="book-zoom-in" aria-label="放大">＋</button></div></header><div class="book-scroll"><div class="book-spread"><div class="book-paper book-left"></div><div class="book-paper book-right"></div><div class="book-spine"></div></div></div><footer><button data-action="book-prev">‹ 上一页</button><span id="book-page-state">正在打开…</span><button data-action="book-next">下一页 ›</button></footer></div>`);
    const loading = pdfjs.getDocument(pdfOptions(asset(book.pdfId)));
    reader = { loading, pdf: null, page: 1, busy: true, zoom: 1, index };
    try {
      const pdf = await loading.promise;
      if (token !== request) { await pdf.destroy(); return; }
      reader.pdf = pdf;
      const saved = preview ? 1 : Number(localStorage.getItem(`vrm-book-${ctx.project().id}-${book.id}`)) || 1;
      reader.page = Math.max(1, Math.min(pdf.numPages, saved));
      reader.page = reader.page % 2 ? reader.page : reader.page - 1;
      await drawSpread();
    } catch (error) { if (token === request) { toast(`PDF 无法打开：${error.message}`, true); await closeReader(); } }
  }
  async function drawSpread(direction = 0) {
    const state = reader, token = request;
    if (!state?.pdf) return;
    state.busy = true;
    const spread = document.querySelector('.book-spread');
    const pages = await Promise.all([0, 1].map(offset => state.page + offset <= state.pdf.numPages ? pageCanvas(state.pdf, state.page + offset, 1100) : null));
    if (token !== request || !spread?.isConnected) return;
    if (direction && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const leaf = document.createElement('div'); leaf.className = `book-turn ${direction > 0 ? 'turn-next' : 'turn-prev'}`;
      const existing = spread.querySelector(direction > 0 ? '.book-right canvas' : '.book-left canvas');
      if (existing) { const copy = document.createElement('canvas'); copy.width = existing.width; copy.height = existing.height; copy.getContext('2d').drawImage(existing, 0, 0); leaf.append(copy); }
      const reversePage = pages[direction > 0 ? 0 : 1];
      if (reversePage) { const back = document.createElement('canvas'); back.className = 'book-turn-back'; back.width = reversePage.width; back.height = reversePage.height; back.getContext('2d').drawImage(reversePage, 0, 0); leaf.append(back); }
      spread.append(leaf);
      leaf.addEventListener('animationend', () => leaf.remove(), { once: true });
    }
    for (const [i, side] of ['.book-left', '.book-right'].entries()) { const target = spread.querySelector(side); target.replaceChildren(); if (pages[i]) target.append(pages[i]); }
    document.querySelector('#book-page-state').textContent = `${state.page}${state.page < state.pdf.numPages ? `–${state.page + 1}` : ''} / ${state.pdf.numPages} 页`;
    document.querySelector('[data-action="book-prev"]').disabled = state.page <= 1;
    document.querySelector('[data-action="book-next"]').disabled = state.page + 1 >= state.pdf.numPages;
    localStorage.setItem(`vrm-book-${ctx.project().id}-${books()[state.index].id}`, String(state.page));
    await new Promise(resolve => setTimeout(resolve, direction ? 650 : 0));
    if (reader === state) state.busy = false;
  }
  async function closeReader() {
    request++; document.querySelector('#book-reader')?.remove();
    const previous = reader; reader = null;
    if (previous) await previous.loading.destroy();
  }
  async function click(action, node) {
    if (action === 'search-open') { renderSearch(); return true; }
    if (action === 'search-close') { document.querySelector('#text-search-modal')?.remove(); return true; }
    if (action === 'search-find') { renderSearch(document.querySelector('#replace-find').value); return true; }
    if (action === 'search-replace') {
      const query = document.querySelector('#replace-find').value, replacement = document.querySelector('#replace-with').value;
      if (!query) return true;
      const count = replaceText(ctx.project(), query, replacement); markDirty(); ctx.refresh(); renderSearch(query); toast(`已替换 ${count} 处，可撤销`); return true;
    }
    if (action === 'search-undo' || action === 'search-redo') { await (action === 'search-undo' ? ctx.undo() : ctx.redo()); return true; }
    if (action === 'knowledge-open') { shelf(); return true; }
    if (!action.startsWith('book-')) return false;
    if (action === 'book-import') {
      const imported = await bridge('importAsset', { type: 'pdf' });
      for (const item of imported || []) { ctx.project().assets.push(item); books().push({ id: crypto.randomUUID(), name: item.name.replace(/\.pdf$/i, ''), pdfId: item.id, coverId: '', description: '', unlockActId: ctx.project().acts[0]?.id || '' }); }
      selected = Math.max(0, books().length - 1); markDirty(); editor();
    } else if (action === 'book-select') { selected = Number(node.dataset.index); editor(); }
    else if (action === 'book-cover') { const imported = await bridge('importAsset', { type: 'image', single: true }); if (imported?.length) { ctx.project().assets.push(...imported); books()[selected].coverId = imported[0].id; markDirty(); editor(); } }
    else if (action === 'book-delete') { books().splice(selected, 1); selected = Math.max(0, selected - 1); markDirty(); editor(); }
    else if (action === 'book-preview') await openBook(selected, true);
    else if (action === 'book-read') await openBook(Number(node.dataset.index));
    else if (action === 'book-reader-close') await closeReader();
    else if ((action === 'book-prev' || action === 'book-next') && reader && !reader.busy) {
      const direction = action === 'book-next' ? 1 : -1;
      const page = reader.page + direction * 2;
      if (page >= 1 && page <= reader.pdf.numPages) { reader.page = page; await drawSpread(direction); }
    } else if (action === 'book-zoom-in' || action === 'book-zoom-out') {
      if (reader) { reader.zoom = Math.max(1, Math.min(2.5, reader.zoom + (action === 'book-zoom-in' ? .25 : -.25))); document.querySelector('.book-spread').style.setProperty('--book-zoom', reader.zoom); }
    }
    return true;
  }
  function input(node) {
    if (!node.dataset.bookField) return false;
    if (books()[selected]) { books()[selected][node.dataset.bookField] = node.value; markDirty(); }
    return true;
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('#text-search-modal')) { event.preventDefault(); event.stopImmediatePropagation(); document.querySelector('#text-search-modal').remove(); return; }
    if (event.key === 'Enter' && event.target.id === 'text-search') { event.preventDefault(); renderSearch(event.target.value); }
    if (document.querySelector('#book-reader') && !event.target.matches('input,textarea,select')) {
      if (['ArrowLeft','ArrowRight','Escape'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); click(event.key === 'Escape' ? 'book-reader-close' : event.key === 'ArrowLeft' ? 'book-prev' : 'book-next', {}).catch(error => toast(error.message, true)); }
    }
  }, true);
  let swipeStart = null;
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('.book-spread')) swipeStart = { x: event.clientX, y: event.clientY };
  });
  document.addEventListener('pointerup', event => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (reader?.zoom === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy))
      click(dx < 0 ? 'book-next' : 'book-prev', {}).catch(error => toast(error.message, true));
  });
  document.addEventListener('pointercancel', () => swipeStart = null);
  return { editor, click, input, shelf, openBook, closeReader,
    editorState: () => ({ selected }),
    restoreEditorState: state => { selected = Math.max(0, Math.min(state?.selected || 0, books().length - 1)); },
    refreshSearch: () => {
      if (!document.querySelector('#text-search-modal')) return;
      const query = document.querySelector('#replace-find').value, replacement = document.querySelector('#replace-with').value;
      renderSearch(query); document.querySelector('#replace-with').value = replacement;
    },
    reset: () => { selected = 0; closeReader(); }
  };
}
