const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
 const qa='C:/vrm galgame引擎/人物动作适配与白模_0.0.72验证';
 const files=fs.readdirSync(qa+'/白模导出').filter(n=>n.endsWith('.fbx'));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1500,height:850},deviceScaleFactor:1});
 try{
  await page.goto('http://127.0.0.1:4174/');
  const results=await page.evaluate(async files=>{
   const THREE=await import('/node_modules/three/build/three.module.js'),{CompatibleFBXLoader}=await import('/src/fbx-loader.js');
   document.body.replaceChildren();document.body.style.cssText='margin:0;background:#e9edf2;overflow:hidden';
   const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edf2');
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1500,850);document.body.append(renderer.domElement);
   scene.add(new THREE.HemisphereLight(0xffffff,0x798394,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,5,4);scene.add(light);
   const rows=[];for(let i=0;i<files.length;i++){
    const {name,data}=files[i],bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),model=new CompatibleFBXLoader().parse(bytes.buffer,'');
    model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3()),scale=1.75/size.y;
    const group=new THREE.Group();group.add(model);group.scale.setScalar(scale);group.position.set((i-1)*2.35,-box.min.y*scale,0);scene.add(group);
    let skin=0,bones=0;model.traverse(o=>{if(o.isSkinnedMesh)skin++;if(o.isBone)bones++;});rows.push({name,skin,bones,size:size.toArray()});
    const label=document.createElement('div');label.textContent=name;label.style.cssText=`position:fixed;bottom:35px;left:${i*33.333}%;width:33.333%;text-align:center;font:20px sans-serif;color:#263547`;document.body.append(label);
   }
   const camera=new THREE.PerspectiveCamera(33,1500/850,.01,100);camera.position.set(0,1.25,9.5);camera.lookAt(0,.9,0);renderer.render(scene,camera);return rows;
  },files.map(name=>({name,data:fs.readFileSync(path.join(qa,'白模导出',name)).toString('base64')})));
  await page.screenshot({path:qa+'/三类白模回读预览.png'});fs.writeFileSync(qa+'/白模渲染检查.json',JSON.stringify({ok:true,results},null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
