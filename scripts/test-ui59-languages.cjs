const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const output=process.argv[2],browser=await chromium.launch({executablePath:process.env.UI57_CHROMIUM,headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();page.setDefaultTimeout(90000);
try{
 for(const [language,label]of [['en','Name color'],['ja','名前の色'],['zh-CN','姓名颜色']]){
  await page.goto('http://127.0.0.1:4173/ui59-review.html?kind=main');await page.waitForSelector('.editor');const original=await page.evaluate(()=>JSON.stringify(window.editorProjectSnapshot()));await page.locator('[data-action=editor-settings]').click();await page.locator('#editor-language').selectOption(language);
  if(await page.evaluate(()=>document.documentElement.lang)!==language)throw Error('Language did not update immediately');
  if(await page.evaluate(()=>JSON.stringify(window.editorProjectSnapshot()))!==original)throw Error('Language changed author data');
  await page.goto('http://127.0.0.1:4173/ui59-review.html?kind=characters');await page.waitForSelector('[data-field="character.nameColor"]');
  const text=await page.locator('[data-field="character.nameColor"]').locator('..').innerText();if(!text.includes(label))throw Error('Name color label not translated: '+text);
  if(await page.locator('[data-field="character.name"]').inputValue()!=='保存')throw Error('Author name translated');
  await page.screenshot({path:path.join(output,'characters-'+language+'.png')});
 }
 fs.writeFileSync(path.join(output,'language-check.json'),JSON.stringify({ok:true,english:true,japanese:true,chinese:true,immediateSettingsSwitch:true,preferenceAcrossEditors:true,characterColorLabels:true,authorDataUnchanged:true},null,2));console.log('PASS: actual EN/JA/ZH switch, persisted editor preference, character color labels and unchanged author data.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
