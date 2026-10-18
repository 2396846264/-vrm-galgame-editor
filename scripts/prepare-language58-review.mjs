import fs from 'node:fs';
const html=fs.readFileSync('dist/index.html','utf8');
const main=[...html.matchAll(/src="([^" ]+\.js)"/g)].at(-1)[1];
const environment=[...fs.readFileSync('dist/environment.html','utf8').matchAll(/src="([^" ]+\.js)"/g)].at(-1)[1];
const aircraft=[...fs.readFileSync('dist/aircraft.html','utf8').matchAll(/src="([^" ]+\.js)"/g)].at(-1)[1];
const styles=Object.fromEntries(['index','environment','aircraft'].map(name=>[name,[...fs.readFileSync(`dist/${name}.html`,'utf8').matchAll(/<link rel="stylesheet"[^>]+>/g)].map(m=>m[0]).join('')]));
fs.writeFileSync('dist/language58-review.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><div id="app"></div><script type="module">
const params=new URLSearchParams(location.search),kind=params.get('kind')||'ui';
const sheets=${JSON.stringify(styles)};document.head.insertAdjacentHTML('beforeend',sheets[kind==='environment'?'environment':kind==='aircraft'?'aircraft':'index']);
const scene={id:'env',name:'保存',revision:0,nodes:[],camera:{position:[0,1.3,4.3],target:[0,1.05,0],fov:32},lighting:{color:'#ffffff',intensity:2.2},background:'#a8c9e6'};
const seed={version:1,id:'language58-review',name:'保存',ui:{},title:{actors:[],logoImageId:'__none__'},renderPresets:[],renderPresetSchema:1,render:{},assets:[],characters:[{id:'role',name:'保存',modelId:'',description:'这是作者原文 Save 日本語'}],acts:[{id:'act',name:'保存',kind:'dialogue',steps:[{id:'line',text:'保存',speaker:'保存',choices:[]}]}],items:[],knowledgeBooks:[],environments:[scene],assetFolders:[]};
window.__mockSeed=structuredClone(seed);window.__mockWrites=[];
const bus=new EventTarget();window.chrome||={};window.chrome.webview={addEventListener:(...args)=>bus.addEventListener(...args),postMessage:async m=>{let data={};
if(m.action==='init')data=kind==='environment'?{environment:scene,environments:[scene],assets:[],projectId:seed.id}:{mode:kind==='player'?'player':'editor',editorModule:['main','welcome','player'].includes(kind)?null:kind,project:kind==='welcome'?null:seed,directory:'测试工程路径/保存'};
else if(m.action==='organizeDialogueVoices')data={assets:[],warnings:[]};
else if(m.action==='saveModule'||m.action==='saveProject'){window.__mockWrites.push(m);data={project:structuredClone(m.payload.project),revision:1};}
queueMicrotask(()=>bus.dispatchEvent(new MessageEvent('message',{data:{id:m.id,ok:true,data}})));}};
await import(kind==='environment'?${JSON.stringify(environment)}:kind==='aircraft'?${JSON.stringify(aircraft)}:${JSON.stringify(main)});
</script></html>`);
console.log('Prepared development-only language58-review.html; remove before packaging.');
