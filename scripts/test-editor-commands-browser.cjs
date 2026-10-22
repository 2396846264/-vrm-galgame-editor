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
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let id = 0;
    crypto.randomUUID = () => (++id).toString(16).padStart(32, '0');
    window.confirm = () => true;
    const receivers = new Set();
    window.chrome ||= {};
    window.chrome.webview = {
      addEventListener: (_, fn) => receivers.add(fn),
      removeEventListener: (_, fn) => receivers.delete(fn),
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
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        '<head>',
        '<head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/":"/node_modules/three/"}}</script>',
      ),
    });
  });
  await page.route('**/src/main.js*', async (route) => {
    const response = await route.fetch();
    const helper = `
      window.__commandsQA = {
        setup: async () => {
          project=defaultProject('编辑命令回归');project.id='commands-fixture';normalize();editorHistory.reset();
          updatePreview=async()=>{};renderEditor();
        },
        state: async () => {
          const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(project)));
          const sha256=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
          const metadata=typeof editorSession==='undefined'?{dirty,revision:changeRevision}:editorSession;
          return {project:{sha256,assets:project.assets.map(({id,type})=>({id,type})),acts:project.acts.map(({id,steps})=>({id,steps:steps.map(({id,voiceId})=>({id,voiceId}))}))},selectedAct,selectedStep,selectedCharacter,selectedItem,dirty:metadata.dirty,revision:metadata.revision,history:editorHistory.status()};
        },
        panel: value => {activePanel=value;modulePanel=['characters','items'].includes(value)?value:null;renderSidebar();renderInspector();},
        undo: () => restoreEditorHistory(-1), redo: () => restoreEditorHistory(1),
        reorder: () => reorderStory('act',0,1,true),
        seedVoice: () => {const voiceAsset={id:'voice-fixture',type:'voice',name:'配音',path:'voice.wav',characterId:project.characters[0].id,dialogueId:step().id};project.assets.push(voiceAsset);step().characterId=voiceAsset.characterId;step().voiceId=voiceAsset.id;project.characters[0].props=[];editorHistory.reset();},
        contextDelete: () => deleteContextObject({kind:'act',source:act()}),
      };`;
    await route.fulfill({ response, body: (await response.text()) + helper });
  });
  const states = [];
  const capture = async (name) => {
    states.push({ name, ...(await page.evaluate(() => __commandsQA.state())) });
    console.log('Checked:', name);
  };
  const action = async (name, dataset = {}) => {
    await page.evaluate(
      ({ name, dataset }) => {
        const trigger = document.createElement('button');
        trigger.dataset.action = name;
        Object.assign(trigger.dataset, dataset);
        trigger.textContent = name;
        document.body.append(trigger);
        trigger.click();
        trigger.remove();
      },
      { name, dataset },
    );
    await capture(name);
  };
  try {
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page.waitForSelector('.welcome');
    await page.evaluate(() => __commandsQA.setup());
    await capture('initial');
    await action('add-act');
    await action('add-step');
    await page.locator('[data-field="step.text"]').fill('继承测试');
    await page.locator('[data-field="step.text"]').fill('连续输入合并');
    await capture('typing');
    await action('add-step');
    await action('duplicate-step');
    await action('move-up');
    await action('move-down');
    await action('delete-step');
    await page.evaluate(() => __commandsQA.undo());
    await capture('undo');
    await page.evaluate(() => __commandsQA.redo());
    await capture('redo');
    await page.evaluate(() => __commandsQA.reorder());
    await capture('reorder');
    await action('delete-act');
    await page.evaluate(() => __commandsQA.panel('characters'));
    await action('add-character');
    await action('delete-character');
    await action('add-character');
    await page.evaluate(() => __commandsQA.panel('story'));
    await page.evaluate(() => __commandsQA.seedVoice());
    await action('delete-asset', { assetId: 'voice-fixture' });
    assert.equal(states.at(-1).project.acts[0].steps[0].voiceId, '');
    await page.evaluate(() => __commandsQA.undo());
    await capture('undo-voice');
    assert(states.at(-1).project.assets.some((asset) => asset.id === 'voice-fixture'));
    await page.evaluate(() => __commandsQA.panel('items'));
    await action('add-inventory-item');
    await action('delete-inventory-item');
    await page.evaluate(() => __commandsQA.panel('story'));
    await action('add-act');
    await page.evaluate(() => __commandsQA.contextDelete());
    await capture('context-delete');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'commands-and-history.json'),
      JSON.stringify(states, null, 2),
    );
    if (process.argv[3])
      assert.deepEqual(states, JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    console.log(
      'PASS: ' +
        states.length +
        ' editor command/history states' +
        (process.argv[3] ? ' match the pre-refactor baseline.' : '.'),
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
