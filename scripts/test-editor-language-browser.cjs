const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const output=process.argv[2];fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.UI57_CHROMIUM,headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],reports=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const open=async kind=>{console.log('Open '+kind);const p=await context.newPage();p.setDefaultTimeout(90000);await p.goto('http://127.0.0.1:4173/language58-review.html?kind='+kind);await p.waitForFunction(()=>document.querySelector('.welcome,.editor,.workspace,.vehicle-page,.player,.fatal'));if(await p.locator('.fatal').count())throw Error(await p.locator('.fatal').textContent());console.log('Ready '+kind);return p;};
 const snapshot=p=>p.evaluate(()=>JSON.stringify(window.editorProjectSnapshot?.()));
 const audit=async(p,kind,language)=>{
  console.log('Audit '+kind+' '+language);const state=await p.evaluate(()=>{const known=[],raw=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_COMMENT);let n;while(n=walker.nextNode()){if(n.nodeType===8&&n.data.startsWith('editor-text:')){const source=decodeURIComponent(n.data.slice(12));known.push({source,text:n.nextSibling?.textContent});}else if(n.nodeType===3&&/[\u3400-\u9fff]/.test(n.data)&&!n.parentElement?.closest('script,style,textarea')&&!n.previousSibling?.data?.startsWith('editor-text:'))raw.push(n.data.trim());}return{lang:document.documentElement.lang,known,raw:[...new Set(raw)].filter(Boolean),settings:JSON.parse(localStorage.getItem('vrm-editor-settings')),inputValues:[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea')].filter(n=>n.value==='保存').length};});
  if(state.lang!==language)throw Error(kind+' language mismatch '+state.lang);
  reports.push({kind,language,...state});fs.writeFileSync(path.join(output,'language-progress.json'),JSON.stringify(reports,null,2));if(process.env.CAPTURE_LANGUAGE58&&['welcome','ui','main'].includes(kind))await p.screenshot({path:path.join(output,kind+'-'+language+'.png'),animations:'disabled',timeout:60000});
 };
 try{
  const welcome=await open('welcome');await welcome.locator('[data-action=editor-settings]').click();await welcome.locator('#editor-language').selectOption('en');await welcome.getByRole('heading',{name:'Editor settings',exact:true}).waitFor();
  await audit(welcome,'welcome','en');
  const ui=await open('ui');await ui.getByRole('heading',{name:'Game UI editor',exact:true}).waitFor();const before=await snapshot(ui);
  await ui.locator('.game-ui-option[data-sample-ui=tactical]').click();await ui.locator('[data-palette-color=accent]').fill('#987654');await ui.locator('[data-palette-color=accent]').dispatchEvent('input');const edited=await snapshot(ui);
  await welcome.locator('#editor-language').selectOption('ja');await ui.waitForFunction(()=>document.documentElement.lang==='ja');await audit(ui,'ui','ja');
  if(await snapshot(ui)!==edited)throw Error('Language change mutated the in-memory project');
  if(await ui.locator('[data-palette-color=accent]').inputValue()!=='#987654'||!await ui.locator('[name=game-ui-preset][value=tactical]').isChecked())throw Error('Live language change lost UI draft');
  await welcome.locator('#editor-language').selectOption('zh-CN');await ui.waitForFunction(()=>document.documentElement.lang==='zh-CN');await ui.getByRole('heading',{name:'游戏 UI 编辑器',exact:true}).waitFor();
  await welcome.locator('#editor-language').selectOption('en');await ui.waitForFunction(()=>document.documentElement.lang==='en');await audit(ui,'ui','en');
  await ui.locator('[data-action=apply-game-ui]').click();await ui.waitForFunction(()=>window.__mockWrites.length===1);const saved=await ui.evaluate(()=>window.__mockWrites[0].payload.project);if(saved.acts[0].steps[0].text!=='保存'||saved.characters[0].name!=='保存'||saved.name!=='保存'||saved.ui.gamePalettes.tactical.accent!=='#987654')throw Error('Author data or save behavior changed');
  await ui.close();const reopened=await open('ui');await reopened.getByRole('heading',{name:'Game UI editor',exact:true}).waitFor();await reopened.close();
  for(const language of ['en','ja']){
   await welcome.locator('#editor-language').selectOption(language);
   for(const kind of ['main','characters','items','title','render','knowledge','environment','aircraft']){
    const p=await open(kind);await p.waitForTimeout(250);const previous=await snapshot(p);await audit(p,kind,language);if(previous!==await snapshot(p))throw Error(kind+' changed project');await p.close();
   }
  }
  const player=await open('player');await player.waitForTimeout(100);if(await player.locator('html').getAttribute('lang')!=='zh-CN')throw Error('Editor preference leaked into game');if(!await player.locator('[data-action=play]').first().textContent().then(t=>t.includes('开始游戏')))throw Error('Player UI changed');await player.close();
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(output,'language-check.json'),JSON.stringify({ok:true,reports,errors},null,2));
  console.log('PASS: English/Japanese settings, live multi-window sync, persistence, eight editors, UI draft/save preservation, original author text and unchanged player language.');
 }catch(error){fs.writeFileSync(path.join(output,'language-failure.json'),JSON.stringify({error:error.stack,errors,reports},null,2));throw error;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
