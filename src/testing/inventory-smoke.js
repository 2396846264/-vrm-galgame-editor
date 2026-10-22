import {normalizeInventory,validateInventoryProject} from '../inventory.js';

// Legacy regression scenarios. Mutable test access is supplied explicitly by the host.
export function install(host) {
window.__vrmSmokeInventory=async function(phase){
 if(!new URLSearchParams(location.search).has('smoke'))throw Error('Smoke only');
 const assert=(test,message)=>{if(!test)throw Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),click=action=>document.querySelector('[data-action="'+action+'"]')?.click();
 async function display(index,line=0){host.playing=true;host.playAct=index;host.playStep=line;host.preparedAct=-1;host.saveModalMode='';document.querySelector('#player-modal')?.remove();document.querySelector('#inventory-reward')?.remove();await host.showPlayStep();host.finishTyping();await wait(300);}
 async function rewards(){for(let i=0;i<6&&host.playerInventory.pending.length;i++){click('confirm-item-reward');await wait(120);}}
 async function ready(){await wait(50);for(let i=0;i<400;i++){if(!host.transitioning)return;await wait(50);}throw Error('等待幕切换完成超时');}
 if(phase==='prepare'){
   host.project.items=[];
   for(const [id,name,consumable,label,color,description]of[
    ['usd','美元',true,'$','#3c8970','一枚美元代表一美元的余额。这是旅途中可以使用的零钱，能支付车费、购买日用品，也能换取其他补给。选择需要美元的分支时，系统会检查余额并扣除所需数量。零钱用完后，背包不再显示它，但鉴赏仍可阅读这段介绍。'],
    ['key','旧钥匙',false,'⚿','#b68a37','一把旧钥匙，表面留着长年使用的磨痕。它可以打开某些地点的门，也是故事中的重要线索。选择需要钥匙的分支时，只检查玩家是否持有，不会消耗钥匙。妥善保管后，它能在后面的剧情中反复使用，直到故事结束。'],
    ['ticket','纪念车票',false,'票','#516fa5','一张尚未获得的纪念车票，用来检查物品鉴赏的锁定效果。未获得时，立绘会变灰并盖上红色封条，不能点击阅读。真正获得后，系统才会解锁详情；即使物品后来不在背包里，曾经获得的记录也仍然保留。']]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(64,100,384,312,24);ctx.fill();ctx.strokeStyle='#e4e9dc';ctx.lineWidth=10;ctx.strokeRect(84,120,344,272);ctx.fillStyle='#fff';ctx.font='bold 160px sans-serif';ctx.textAlign='center';ctx.fillText(label,256,310);const image=await host.bridge('saveInventoryImage',{dataUrl:canvas.toDataURL('image/png'),itemId:id,name});host.project.assets.push(image);host.project.items.push({id,name,imageId:image.id,description});
   }
   const template=structuredClone(host.project.acts[0]),base=structuredClone(template.steps[0]);
   const line=(id,text)=>({...structuredClone(base),id,text,choices:[],itemGrants:[],voiceId:'',seId:''});
   const first={...structuredClone(template),id:'item-start',name:'获得物品与打车',steps:[line('no-money','现在还没有美元，打车选项会变灰。'),line('receive-money','出发前，你找到了五美元和一把旧钥匙。'),line('travel-choice','要走路前往目的地，还是花五美元打车？')]};
   first.steps[0].choices=[{text:'走路去',actId:'walk'},{text:'打车（5 美元）',actId:'taxi',consumeRequired:true,requirements:[{itemId:'usd',quantity:5}]}];first.steps[1].itemGrants=[{itemId:'usd',quantity:5},{itemId:'key',quantity:1}];first.steps[2].choices=structuredClone(first.steps[0].choices);
   const taxi={...structuredClone(template),id:'taxi',name:'打车后',steps:[line('taxi-result','你花了五美元抵达目的地，旧钥匙仍在背包里。')]};taxi.steps[0].choices=[{text:'用旧钥匙开门',actId:'door',requirements:[{itemId:'key',quantity:1}]}];
   const walk={...structuredClone(template),id:'walk',name:'步行',steps:[line('walk-result','步行不花钱。')]},door={...structuredClone(template),id:'door',name:'开门',steps:[line('door-result','门打开了，旧钥匙还在。')]};host.project.acts=[first,taxi,walk,door];host.project.name='玩家物品与分支验证';host.playerInventory=normalizeInventory({},host.project.items);host.inventorySession=true;host.activePanel='items';host.selectedItem=0;host.renderSidebar();host.renderInspector();host.markDirty();await host.save();return {ok:true,definitions:host.project.items.length,squareImages:true};
 }
 if(phase==='locked'){
   host.playerInventory=normalizeInventory({},host.project.items);host.inventorySession=true;await display(0);assert(document.querySelector('[data-action="choose"][data-index="1"]').disabled,'没有钱也能打车');assert(document.querySelector('.choice-missing').textContent.includes('美元'),'没有缺少物品提示');const before=host.playerInventory.counts.usd||0;document.querySelector('[data-action="choose"][data-index="1"]').click();await wait(100);assert(host.playAct===0&&(host.playerInventory.counts.usd||0)===before,'锁定选项仍被执行');return {ok:true,disabledChoice:true,missingItemText:true};
 }
 if(phase==='reward'){
   host.playerInventory=normalizeInventory({},host.project.items);host.inventorySession=true;await display(0,1);assert(host.playerInventory.counts.usd===5&&host.playerInventory.counts.key===1,'获得数量错误');assert(document.querySelector('#inventory-reward')&&document.querySelector('.inventory-reward-dialogue').textContent.includes('美元 × 5'),'没有额外获得对话');const snapshot=host.snapshotSlot();localStorage.setItem('inventory-pending-test-'+host.project.id,JSON.stringify(snapshot));const image=document.querySelector('.inventory-reward-image');assert(image.naturalWidth===image.naturalHeight,'立绘不是正方形');return {ok:true,extraDialogue:true,centerArtwork:true,pendingSaved:snapshot.inventory.pending.length===2};
 }
 if(phase==='reload-pending'){
   const slot=JSON.parse(localStorage.getItem('inventory-pending-test-'+host.project.id));const slots=Array(20).fill(null);slots[1]=slot;localStorage.setItem(host.saveKey(),JSON.stringify(slots));host.playing=false;host.loadSlot(1);await ready();host.finishTyping();assert(host.playerInventory.counts.usd===5&&host.playerInventory.pending.length===2,'读档重复发放或丢失提示');await rewards();await display(0,1);assert(host.playerInventory.counts.usd===5&&!host.playerInventory.pending.length,'同句重复发放');return {ok:true,noDuplicateReward:true,pendingRestored:true};
 }
 if(phase==='spend'){
   await rewards();await display(0,2);assert(!document.querySelector('[data-action="choose"][data-index="1"]').disabled,'有5美元仍不能打车');const before=host.snapshotSlot();document.querySelector('[data-action="choose"][data-index="1"]').click();await ready();host.finishTyping();assert(host.project.acts[host.playAct].id==='taxi'&&(host.playerInventory.counts.usd||0)===0,'打车没有扣5美元');assert(host.playerInventory.counts.key===1,'钱被扣时工具也丢失');document.querySelector('[data-action="choose"][data-index="0"]').click();await ready();host.finishTyping();assert(host.playerInventory.counts.key===1,'工具被消耗');const after=host.snapshotSlot(),slots=Array(20).fill(null);slots[1]=before;slots[2]=after;localStorage.setItem(host.saveKey(),JSON.stringify(slots));host.playing=false;host.loadSlot(1);await ready();host.finishTyping();assert(host.playerInventory.counts.usd===5,'读回花钱前存档没有恢复余额');host.playing=false;host.loadSlot(2);await ready();host.finishTyping();assert((host.playerInventory.counts.usd||0)===0&&host.playerInventory.counts.key===1,'花钱后存档恢复错误');return {ok:true,currencyConsumed:true,toolPreserved:true,independentSaveBalances:true};
 }
 if(phase==='gallery'){
   if(host.mode==='editor'){host.mode='player';host.renderPlayer();host.playing=true;host.playAct=1;host.playStep=0;await host.showPlayStep();host.finishTyping();}host.galleryTab='items';host.renderGalleryModal();assert(document.querySelector('[data-item-id="ticket"]').disabled,'未知物品能点');assert(document.querySelector('.inventory-seal').textContent==='未获得','没有红色封条');assert(getComputedStyle(document.querySelector('[data-item-id="ticket"] img')).filter.includes('grayscale'),'未知立绘不是灰色');assert(!document.querySelector('[data-item-id="usd"]').disabled,'用完的钱不能鉴赏');return {ok:true,unknownLocked:true,grayArtwork:true,redSeal:true,consumedStillKnown:true};
 }
 if(phase==='detail'){document.querySelector('[data-item-id="usd"]').click();assert(document.querySelector('.inventory-detail p').textContent.includes('当前持有：0'),'用完物品的详情数量错误');assert(document.querySelector('.inventory-detail').textContent.includes('这段介绍'),'介绍没有显示');return {ok:true,descriptionShown:true,zeroBalanceShown:true};}
 if(phase==='export'){
   host.mode='editor';host.playing=false;host.closePlayerModal();document.querySelector('#player-modal')?.remove();host.renderEditor();validateInventoryProject(host.project);host.markDirty();await host.save();await host.bridge('saveProjectAs',{project:structuredClone(host.project),name:'玩家物品与分支示例'});await host.bridge('exportGame',{folderName:'物品栏试玩'});return {ok:true,exported:true};
 }
 if(phase==='player'||phase==='reopen'){
   assert(host.project.items.length===3,'物品定义没有保存');host.playerInventory=normalizeInventory({},host.project.items);host.inventorySession=true;await display(0);assert(document.querySelector('[data-action="choose"][data-index="1"]').disabled,'独立游戏条件失效');await display(0,1);assert(host.playerInventory.counts.usd===5,'独立游戏没有发放');await rewards();await display(0,2);document.querySelector('[data-action="choose"][data-index="1"]').click();await ready();host.finishTyping();assert((host.playerInventory.counts.usd||0)===0&&host.playerInventory.counts.key===1,'独立游戏扣除错误');host.renderBackpack();assert(document.querySelector('[data-item-id="key"]'),'背包缺少工具');return {ok:true,projectItems:true,grantWorks:true,consumeWorks:true,toolInBackpack:true};
 }
 throw Error('Unknown phase');
};
}
