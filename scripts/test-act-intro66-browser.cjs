const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const out=process.argv[2],browser=await chromium.launch({executablePath:process.env.UI57_CHROMIUM,headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],diagnostics=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text());});
 try{
  await page.goto('http://127.0.0.1:4173/ui59-review.html?kind=main&smoke=1');await page.waitForFunction(()=>Boolean(window.__vrmSmokeIntro66));
  const phase=n=>page.evaluate(n=>window.__vrmSmokeIntro66(n),n),checks=[];
  for(const skin of ['classic','pink-pop','wechat-green','wechat-dark']){
   assert((await phase('hold-'+skin)).ok);
   const appearance=await page.locator('.act-intro').evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect(),f=n.closest('.stage-frame').getBoundingClientRect();return{background:s.background,color:s.color,inside:r.left>=f.left&&r.right<=f.right&&r.top>=f.top&&r.bottom<=f.bottom,easing:n.getAnimations()[0].effect.getKeyframes()[0].easing,exitEasing:n.getAnimations()[0].effect.getKeyframes()[2].easing,holdDuration:(n.getAnimations()[0].effect.getKeyframes()[2].offset-n.getAnimations()[0].effect.getKeyframes()[1].offset)*n.getAnimations()[0].effect.getTiming().duration};});
   assert(appearance.inside);assert.notEqual(appearance.easing,'linear');assert.notEqual(appearance.exitEasing,'linear');assert(Math.abs(appearance.holdDuration-800)<.001);
   await page.locator('.player').screenshot({path:path.join(out,'browser-'+skin+'.png')});
   const result=await phase('finish');assert(result.ok);checks.push({skin,appearance,holdMs:result.holdMs,firstDialogueAfterExit:result.firstDialogueAfterExit});
  }
  const sequence=await phase('sequence');assert(sequence.ok);
  for(const [width,height]of [[1280,720],[640,360]]){
   await page.setViewportSize({width,height});
   const result=await page.evaluate(()=>{const host=document.querySelector('.stage-frame'),n=document.createElement('div');n.className='act-intro';n.textContent='很长的幕名：写给明天的信 / 明日へ届ける手紙 / A letter for tomorrow — <img src=x onerror=alert(1)> '.repeat(2);host.append(n);const r=n.getBoundingClientRect(),f=host.getBoundingClientRect(),result={inside:r.left>=f.left&&r.right<=f.right+1&&r.top>=f.top&&r.bottom<=f.bottom+1,wrapped:n.scrollWidth<=n.clientWidth,plainText:!n.children.length};n.remove();return result;});
   assert(result.inside&&result.wrapped&&result.plainText,JSON.stringify(result));
  }
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({ok:true,checks,sequence,longNames:true,plainAuthorText:true,errors},null,2));console.log('PASS: four skins, curved motion, 800 ms hold, dialogue gating, next act, resume, cancellation, long names.');
 }catch(e){console.error(JSON.stringify({errors,diagnostics,url:page.url(),body:await page.locator('body').innerText().catch(()=>'' )}));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
