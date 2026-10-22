const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const {createServer} = await import('vite');
  const root = path.resolve(__dirname, '..');
  const output = path.resolve(process.argv[2]);
  fs.mkdirSync(output, {recursive:true});
  const server = await createServer({root,configLoader:'runner',logLevel:'error',server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const origin = 'http://127.0.0.1:'+server.httpServer.address().port;
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({viewport:{width:1500,height:1000}});
  page.setDefaultTimeout(120000);
  const errors=[], requests=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE:',error.message);});
  page.on('request',request=>requests.push(request.url()));
  await page.addInitScript(() => {
    const receivers=new Set();
    window.chrome ||= {};
    window.chrome.webview={
      addEventListener:(_name,listener)=>receivers.add(listener),
      removeEventListener:(_name,listener)=>receivers.delete(listener),
      postMessage:message=>setTimeout(()=>{
        const data=message.action==='init'?{mode:'editor',project:null}:message.action==='organizeDialogueVoices'?{assets:[],warnings:[]}:{};
        for(const listener of receivers)listener({data:{id:message.id,ok:true,data}});
      },0),
    };
  });
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/(?:\?.*)?$/,async route=>{
    const response=await route.fetch();
    const map='<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/":"/node_modules/three/"}}</script>';
    await route.fulfill({response,body:(await response.text()).replace('<head>','<head>'+map)});
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    const helper=`
      window.__refactorQA={
        setup:async()=>{project=defaultProject('结构回归');normalize();editorHistory.reset();renderEditor();await updatePreview();},
        state:()=>({text:project.acts[0].steps[0].text,revision:editorSession.revision,dirty:editorSession.dirty}),
        undo:()=>restoreEditorHistory(-1),
        redo:()=>restoreEditorHistory(1),
        slots:()=>{localStorage.setItem(saveKey(),JSON.stringify([null,{act:0,step:0,stepId:project.acts[0].steps[0].id,inventory:{counts:{key:3}}}]));return readSaveSlots();}
      };`;
    await route.fulfill({response,body:await response.text()+helper});
  });
  try {
    await page.goto(origin+'/');
    await page.waitForSelector('.welcome',{timeout:30000});
    assert(!requests.some(url=>/\/testing\/(?!diagnostics-smoke|smoke-loader)[^?]+-smoke\.js/.test(url)),'Normal startup loaded regression scenarios');
    await page.goto(origin+'/?smoke=refactor');
    await page.waitForSelector('.welcome');
    await page.waitForFunction(()=>typeof window.__vrmSmokeCloseEdit==='function');
    await page.evaluate(()=>__refactorQA.setup());
    assert.equal(await page.evaluate(()=>typeof window.__vrmDiagnostics().then),'undefined');
    const before=await page.evaluate(()=>__refactorQA.state());
    await page.evaluate(()=>__vrmSmokeCloseEdit('结构调整后仍可编辑'));
    const changed=await page.evaluate(()=>__refactorQA.state());
    assert.equal(changed.text,'结构调整后仍可编辑');
    assert(changed.dirty&&changed.revision>before.revision,'Test adapter did not update the live editor session');
    await page.evaluate(()=>__refactorQA.undo());
    assert.equal((await page.evaluate(()=>__refactorQA.state())).text,before.text);
    await page.evaluate(()=>__refactorQA.redo());
    assert.equal((await page.evaluate(()=>__refactorQA.state())).text,changed.text);
    const slots=await page.evaluate(()=>__refactorQA.slots());
    assert.equal(slots.length,20);
    assert.equal(slots[1].inventory.counts.key,3);
    await page.screenshot({path:path.join(output,'editor.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({ok:true,normalStartupLoadsNoScenarios:true,synchronousDiagnostics:true,liveSmokeAdapter:true,editUndoRedo:true,savePayloadPreserved:true,pageErrors:errors},null,2));
    console.log('PASS: browser startup, lazy scenarios, synchronous diagnostics, live test adapters, edit/undo/redo and player save payloads.');
  } catch (error) {
    fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({errors,body:await page.locator('body').innerText()},null,2));
    throw error;
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
