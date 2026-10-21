const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const output=process.argv[2];fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({executablePath:process.env.UI57_CHROMIUM,headless:true}),p=await browser.newPage({viewport:{width:1676,height:1100}}),errors=[],checks=[];p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:4173/ui59-review.html?kind=ui');await p.waitForSelector('.ui-preview-viewport');
  if(await p.locator('[name=game-ui-preset],[data-palette-color],[name=loading-style],.knowledge-title-button').count())throw Error('Old UI configuration remains');
  await p.screenshot({path:path.join(output,'ui-editor.png'),fullPage:true});
  await p.setViewportSize({width:1920,height:1400});await p.addStyleTag({content:'#game-ui-picker.ui-module-content .game-ui-picker-card{max-width:none;width:max-content;overflow:visible}.ui-preview-viewport{max-width:none}'});
  for(const [width,height]of [[1676,940],[1600,900],[1280,720],[800,450],[640,360]]){
   await p.locator('.ui-preview-viewport').evaluate((n,{width,height})=>{n.style.width=width+'px';n.style.height=height+'px';}, {width,height});
   for(const mode of ['title','story','settings','saves','library','loading']){
    await p.locator('[data-preview-tab='+mode+']').click();
    const result=await p.locator('.ui-preview-viewport .player').evaluate((root,{width,height,mode})=>{
     const frame=root.querySelector('.stage-frame').getBoundingClientRect(),outside=[],collisions=[];
     const selectors=mode==='title'?'.title-bottom-menu button':mode==='story'?'.scene-top-actions button,.scene-quick-actions button':mode==='loading'?'.loading-spinner':mode==='library'?'.ui-example-modal header button':'.ui-example-modal button';
     const nodes=[...root.querySelectorAll(selectors)].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height),boxes=nodes.map(n=>({name:n.dataset.action||n.textContent.trim(),r:n.getBoundingClientRect()}));
     const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
     for(const {name,r}of boxes)if(r.left<frame.left-1||r.right>frame.right+1||r.top<frame.top-1||r.bottom>frame.bottom+1)outside.push(name);
     for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i].r,boxes[j].r))collisions.push([boxes[i].name,boxes[j].name]);
     if(mode==='story'){const shell=root.querySelector('.dialogue').getBoundingClientRect();if(Math.abs(shell.left-frame.left)>1||Math.abs(shell.width/frame.width-1)>.002||Math.abs(shell.height/frame.height-.26)>.002)collisions.push(['dialogue','incorrect-left']);if(root.querySelector('.scene-top-actions [data-action=save-game],.dialogue-glints'))collisions.push(['removed-decoration-or-save','still-present']);const content=root.querySelector('.dialogue-copy').getBoundingClientRect(),portrait=root.querySelector('.speaker-portrait').getBoundingClientRect();if(Math.abs((portrait.left-frame.left)/frame.width-.04)>.002)collisions.push(['portrait','incorrect-left']);if(root.querySelector('.portrait-glass-frame'))collisions.push(['portrait-pad','still-present']);for(const b of boxes)if(overlap(b.r,content))collisions.push([b.name,'dialogue-content']);}
     const positions=Object.fromEntries((mode==='title'?['.title-bottom-menu']:mode==='story'?['.dialogue','.speaker-portrait','.scene-quick-actions','.scene-top-actions']:[]).map(selector=>{const r=root.querySelector(selector).getBoundingClientRect();return[selector,{x:(r.left-frame.left)/frame.width,y:(r.top-frame.top)/frame.height,width:r.width/frame.width,height:r.height/frame.height}];}));
     return{width,height,mode,frame:[frame.width,frame.height],count:nodes.length,outside,collisions,positions};
    },{width,height,mode});checks.push(result);
    if(width===1676)await p.locator('.ui-preview-viewport .player').screenshot({path:path.join(output,mode+'.png')});
   }
  }
  const failures=checks.filter(c=>c.outside.length||c.collisions.length||Math.abs(c.frame[0]-c.width)>1||Math.abs(c.frame[1]-c.height)>1||c.mode==='title'&&c.count!==9||c.mode==='story'&&c.count!==7);
  if(failures.length)throw Error(JSON.stringify(failures));
  // Operate actual authoring controls and the real player handlers, not preview fixtures.
  await p.goto('http://127.0.0.1:4173/ui59-review.html?kind=main&smoke=1');await p.waitForFunction(()=>Boolean(window.__vrmSmokeReference59));
  const phase=async name=>{const r=await p.evaluate(name=>window.__vrmSmokeReference59(name),name);if(!r.ok)throw Error(name+JSON.stringify(r));return r;};
  await phase('prepare');const saved=await p.evaluate(()=>window.__mockWrites.at(-1).payload.project);if(saved.characters[0].nameColor!=='#6bc9ff'||saved.characters[1].nameColor!=='#e6a1d5'||saved.acts[0].steps[0].text!=='保存')throw Error('Color save changed author content');
  await phase('reopen');await phase('title');await p.locator('.title-bottom-menu [data-action=knowledge-open]').click();await p.waitForSelector('.book-library');
  const libraryChecks=[];
  for(const [width,height]of [[2560,1600],[1676,940],[1280,720],[800,600],[640,360]]){
   await p.setViewportSize({width,height});
   const result=await phase('library');if(result.cards.length!==4)throw Error('Missing long-title library fixtures');libraryChecks.push({width,height,...result});
   await p.locator('.book-shelf').evaluate(n=>{if(n.scrollWidth>n.clientWidth+1)throw Error('Library shelf scrolls horizontally');});
   if(width===1676)await p.screenshot({path:path.join(output,'actual-library.png')});
  }
  await p.setViewportSize({width:1676,height:940});await phase('close');
  await phase('story');await phase('name0');await phase('name1');
  for(const name of ['settings','saves','inventory','progress']){await phase(name);if(!await p.locator('#player-modal').count())throw Error(name+' did not open');await phase('close');}
  if(errors.length)throw Error(JSON.stringify(errors));
  fs.writeFileSync(path.join(output,'browser-check.json'),JSON.stringify({ok:true,checks,libraryChecks,errors,nameColorSave:true,independentNameColors:true,authorTextUnchanged:true,actualLibraryAction:true,actualModalActions:true},null,2));
  console.log('PASS: 30 reference layouts, frame size, button boundaries, no overlaps, only one fixed UI, nine bottom actions, independent name colors and actual author/player controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
