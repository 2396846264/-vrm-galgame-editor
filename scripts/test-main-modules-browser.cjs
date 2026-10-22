const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { createServer } = await import('vite');
  const output = path.resolve(process.argv[2]);
  fs.mkdirSync(output, { recursive: true });
  const server = await createServer({
    root: path.resolve(__dirname, '..'),
    configLoader: 'runner',
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const receivers = new Set();
    window.chrome ||= {};
    window.chrome.webview = {
      addEventListener: (_name, fn) => receivers.add(fn),
      removeEventListener: (_name, fn) => receivers.delete(fn),
      postMessage: (message) =>
        setTimeout(() => {
          const data =
            message.action === 'init'
              ? { mode: 'editor', project: null }
              : message.action === 'organizeDialogueVoices'
                ? { assets: [], warnings: [] }
                : {};
          for (const fn of receivers) fn({ data: { id: message.id, ok: true, data } });
        }, 0),
    };
  });
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const map =
      '<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/":"/node_modules/three/"}}</script>';
    await route.fulfill({
      response,
      body: (await response.text()).replace('<head>', '<head>' + map),
    });
  });
  await page.route('**/src/main.js*', async (route) => {
    const response = await route.fetch();
    const helper = `
      window.__moduleQA = async () => {
        project = defaultProject('模块拆分回归'); project.id = 'modules-fixture';
        project.characters.push({id:'role-fixture',name:'测试角色',modelId:'',portraitId:'',props:[]});
        project.items.push({id:'item-fixture',name:'钥匙',description:'测试物品',imageId:''});
        normalize(); editorHistory.reset(); renderEditor(); await updatePreview();
        // Compare panel markup separately from asynchronous 3D loading.
        updatePreview = async () => {};
        const panels = {};
        const capture = (name, panel, module) => {
          activePanel = panel; modulePanel = module; renderInspector();
          panels[name] = document.querySelector('#inspector-body').innerHTML.replace(/[0-9a-f]{32}/g,'FIXED_ID');
        };
        capture('story','story',null);
        capture('character','characters','characters');
        selectedCharacter = 50; capture('emptyCharacter','characters','characters'); selectedCharacter = 0;
        capture('characterLauncher','characters',null);
        capture('item','items','items');
        selectedItem = 50; capture('emptyItem','items','items'); selectedItem = 0;
        capture('title','title','title'); capture('render','render','render');
        localStorage.setItem('vrm-editor-settings',JSON.stringify({autoSaveMinutes:30,theme:'dark',appearanceVersion:51}));
        loadEditorSettings(); saveEditorSettings();
        const preferences={theme:document.body.dataset.editorTheme,stored:JSON.parse(localStorage.getItem('vrm-editor-settings'))};
        mode='player';
        localStorage.setItem(saveKey(),JSON.stringify([null,{act:0,step:0,backgroundId:'legacy-image'}]));
        const progress=loadLifetimeProgress();
        rememberDiscovery('music','music-fixture');
        const statistics=progressStatistics();
        return {panels,preferences,progress:{...progress,viewedDialogueIds:progress.viewedDialogueIds.map(()=> 'LINE_ID'),viewedDialogueText:Object.values(progress.viewedDialogueText),seenCharacterIds:progress.seenCharacterIds,enteredActIds:progress.enteredActIds,lastActId:progress.lastActId?'ACT_ID':''},statistics:{total:statistics.total,seen:statistics.seen,characters:statistics.characters.map(({name,total,seen})=>({name,total,seen})),acts:statistics.acts.map(({name,total,seen,status,unlocked})=>({name,total,seen,status,unlocked}))}};
      };`;
    await route.fulfill({ response, body: (await response.text()) + helper });
  });
  try {
    await page.goto(origin + '/');
    await page.waitForSelector('.welcome');
    const result = await page.evaluate(() => __moduleQA());
    assert.equal(result.preferences.theme, 'dark');
    assert.equal(result.preferences.stored.autoSaveMinutes, 30);
    assert(result.progress.heardMusicIds.includes('music-fixture'));
    assert.equal(result.statistics.seen, 1);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'panels-and-state.json'), JSON.stringify(result, null, 2));
    if (process.argv[3])
      assert.deepEqual(result, JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    console.log(
      'PASS: eight panel states, preferences, legacy progress migration and unlock statistics' +
        (process.argv[3] ? ' match the pre-refactor browser baseline.' : '.'),
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
