// Local, headless regression against the development-only mock host. No author project is opened.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const output=process.argv[2];if(!output)throw Error('Provide an output directory');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.UI57_CHROMIUM,headless:true,timeout:20000});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/ui-module-review57.html?check=1');
  await page.waitForSelector('#ui57-check-results',{state:'attached',timeout:60000});
  const report=JSON.parse(await page.locator('#ui57-check-results').textContent());report.errors=errors;
  report.toolbarVisible=await page.evaluate(()=>{const overlay=document.querySelector('#game-ui-picker').getBoundingClientRect();return [...document.querySelectorAll('.topbar button')].every(b=>b.getBoundingClientRect().bottom<=overlay.top+1);});
  fs.writeFileSync(path.join(output,'composition-check.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:path.join(output,'editor.png')});
  if(!report.ok||errors.length||!report.toolbarVisible)throw Error(JSON.stringify(report));
  for(const theme of ['tactical','ark','heian','noir']){
   await page.goto('http://127.0.0.1:4173/ui-module-review57.html?theme='+theme);
   await page.waitForSelector('.ui-live-preview .player[data-game-ui='+theme+']');
   await page.screenshot({path:path.join(output,theme+'-editor.png')});
   await page.locator('.ui-preview-viewport').screenshot({path:path.join(output,theme+'-title.png')});
   await page.locator('[name=ui-preview-page]').selectOption('story');
   await page.locator('.ui-preview-viewport').screenshot({path:path.join(output,theme+'-story.png')});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/ui-module-review57.html?check=1');
  await page.waitForSelector('#ui57-check-results',{state:'attached'});
  const mobile=JSON.parse(await page.locator('#ui57-check-results').textContent());fs.writeFileSync(path.join(output,'composition-small.json'),JSON.stringify(mobile,null,2));
  if(!mobile.ok)throw Error(JSON.stringify(mobile));
  console.log('PASS: 40 theme/layout combinations, eight unchanged title actions, independent UI page without WebGL, mock-host save roundtrip.');
 }catch(e){fs.writeFileSync(path.join(output,'errors.json'),JSON.stringify({errors,text:await page.locator('body').textContent()},null,2));await page.screenshot({path:path.join(output,'failure.png')});throw e;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
