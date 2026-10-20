const {chromium}=require('C:/Users/PIUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const out='C:/vrm galgame引擎/作者入口与发行提醒_0.0.78验证';
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});
 await page.addInitScript(()=>{const receivers=[];window.__calls=[];window.chrome||={};window.chrome.webview={addEventListener:(n,fn)=>receivers.push(fn),postMessage:msg=>{__calls.push(msg.action);setTimeout(()=>receivers.forEach(fn=>fn({data:{id:msg.id,ok:true,data:msg.action==='init'?{mode:'editor',project:null,feedbackGroup:'123456789',editorNotice:'测试提醒：官方免费，谨防冒充官方收费倒卖。'}:msg.action==='engineOrigin'?{id:'VRMGALGAME-U5-21164898-2026',engine:'公民文艺生产综合自动化系统',creator:'尸工U5十三世',version:'0.0.78',verified:true}:msg.action==='organizeDialogueVoices'?{assets:[],warnings:[]}:{} }})),0)}};});
 await page.route('http://127.0.0.1:4174/?smoke=attribution78',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('<head>','<head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/":"/node_modules/three/"}}</script>')});});
 await page.route('**/src/main.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+`\nwindow.__attrQA={setup:()=>{project=defaultProject('发行提醒验证');normalize();editorHistory.reset();renderEditor();},rebuild:()=>renderEditor(),notice:ms=>editorAttribution.configure('郑重声明：本软件在 GitHub 开源免费；游戏可以商用。稳定版计划于几个月后在 Steam 发售。谨防奸商倒卖，切勿为冒充官方的付费版本买单！允许增加功能、修改和再发行，二次开发请如实说明来源。',ms),settings:()=>renderEditorSettings(),theme:theme=>{editorSettings.theme=theme;applyEditorTheme();},player:()=>{mode='player';renderPlayer();renderSettingsModal();}};`});});
 try{
 await page.goto('http://127.0.0.1:4174/?smoke=attribution78');await page.waitForFunction(()=>window.__attrQA&&document.querySelector('.welcome'));
 await page.evaluate(()=>__attrQA.setup());await page.locator('.creator-star').click();if(!await page.evaluate(()=>__calls.includes('openCreatorHomepage')))throw Error('star does not request external homepage');
 if(await page.locator('.editor-announcement').count())throw Error('notice visible before half hour');
 await page.evaluate(()=>__attrQA.notice(1799000));if(await page.locator('.editor-announcement').count())throw Error('notice visible early');
 await page.waitForTimeout(1100);await page.locator('.editor-announcement').waitFor();
 for(const theme of ['light','dark']){
 await page.evaluate(theme=>__attrQA.theme(theme),theme);await page.waitForTimeout(100);
 const geometry=await page.locator('.editor-announcement').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.querySelector('.editor-feedback').getBoundingClientRect();return {scroll:el.classList.contains('is-scrolling'),left:a.left,right:a.right,qq:b.left,width:innerWidth,track:getComputedStyle(el.firstElementChild).animationName};});
 if(!geometry.scroll||geometry.track!=='editor-announcement-scroll'||geometry.right>geometry.qq||geometry.qq>=geometry.width)throw Error('notice layout '+JSON.stringify(geometry));
 await page.screenshot({path:out+'/editor-'+theme+'.png'});
 }
 await page.evaluate(()=>__attrQA.rebuild());await page.locator('.editor-announcement').waitFor();
 await page.setViewportSize({width:1050,height:700});await page.waitForTimeout(100);if(await page.locator('.editor-feedback').evaluate(el=>el.getBoundingClientRect().right>innerWidth))throw Error('QQ clipped');
 await page.evaluate(()=>__attrQA.settings());const version=page.locator('[data-engine-version]');await version.click({clickCount:6});if(await page.locator('.engine-origin').count())throw Error('egg revealed too early');await version.click();await page.locator('.engine-origin').waitFor();
 await page.evaluate(()=>__attrQA.player());if(await page.locator('.editor-announcement').count())throw Error('announcement leaks into exported game');await page.locator('[data-engine-version]').click({clickCount:7});await page.locator('.engine-origin').waitFor();
 await page.screenshot({path:out+'/player-origin-private.png'});
 if(errors.length)throw Error(errors.join('\n'));
 // Exercise exactly the delayed callback without advancing millions of animation frames.
 const timer=await page.evaluate(async()=>{const {EditorAttribution}=await import('/src/editor-attribution.js');let callback,delay,t=0;const a=new EditorAttribution({now:()=>t,schedule:(fn,ms)=>{callback=fn;delay=ms;return 0},observe:false});a.configure('计时验证');if(a.ready||delay!==1800000)throw Error('wrong timer');t=1799999;if(a.ready)throw Error('early');t=1800000;callback();if(!a.ready)throw Error('missing delayed reveal');a.configure('计时验证');if(!a.ready)throw Error('reset readiness');a.dispose();return true;});
 const report={ok:true,starUsesNativeBrowser:true,hiddenForFirst30Minutes:true,delayedTimer:timer,persistentAfterRerender:true,continuousMarquee:true,leftOfQQ:true,themes:['light','dark'],smallWindowQQVisible:true,editorAndGameSevenTapEgg:true,noGameAnnouncement:true};fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){console.log('DIAGNOSTICS',await page.locator('body').innerText(),errors);throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
