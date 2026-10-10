// Only photograph visible authoring assets, one at a time. The stored image is
// a file thumbnail, independent of the live speaking portrait and story poses.
export function createModelThumbnailQueue(ctx){
 let owner=null,running=null,pending=[],seen=new Set();const busy=new Set();
 async function drain(){
  while(pending.length&&ctx.allowed()){
   const {project,model}=pending.shift();if(project!==ctx.project()||!project.assets.includes(model)||model.thumbnailPath)continue;
   busy.add(model.id);ctx.repaint();
   try{
    await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,100)));
    if(project!==ctx.project()||!ctx.allowed()){seen.delete(model.id);continue;}
    const photo=await ctx.capture(model);
    if(project!==ctx.project()||!project.assets.includes(model))continue;
    const saved=await ctx.save(model,photo.dataUrl);
    if(project!==ctx.project()||!project.assets.includes(model))continue;
    project.assets.push(saved);model.thumbnailPath=saved.path;model.thumbnailSource='generated';ctx.changed();
   }catch(error){ctx.error(model,error);}
   finally{busy.delete(model.id);ctx.repaint();}
  }
 }
 return {refresh(models){
  if(!ctx.allowed())return;if(owner!==ctx.project()){owner=ctx.project();pending=[];seen=new Set();}
  for(const model of models)if(['mmdCharacter','fbxCharacter'].includes(model.type)&&!model.thumbnailPath&&!seen.has(model.id)){seen.add(model.id);pending.push({project:owner,model});}
  if(!running&&pending.length){running=Promise.resolve().then(drain).finally(()=>{running=null;if(pending.length&&ctx.allowed())this.refresh([]);});}
 },get ready(){return running||Promise.resolve();},isBusy:id=>busy.has(id)};
}
