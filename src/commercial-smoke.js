export async function commercialSmoke(c,phase){
 const p=c.project(),library=c.library(),assert=(v,m)=>{if(!v)throw Error(m);};
 if(phase==='prepare'){
  assert(p.assets.length===0,'新工程仍带预制素材');
  p.acts[0].steps[0].text='这是一段用于核验慢速对白与商业发行功能的测试文字，请检查逐字显示、保存和重新打开。';
  p.assets.push({id:'commercial-pdf-standard',name:'Standard fonts',type:'pdf',path:'assets/books/standard.pdf'},
    {id:'commercial-pdf-chinese',name:'Chinese embedded fonts',type:'pdf',path:'assets/books/chinese.pdf'});
  p.knowledgeBooks=[{id:'book-standard',name:'Standard fonts',pdfId:'commercial-pdf-standard',unlockActId:p.acts[0].id},
    {id:'book-chinese',name:'Chinese embedded fonts',pdfId:'commercial-pdf-chinese',unlockActId:p.acts[0].id}];
  c.dirty();await c.save();return{ok:true,newProjectHadNoAssets:true};
 }
 if(phase==='pdf'){
  const results=[];
  for(let index=0;index<2;index++){
   await library.openBook(index,true);
   const canvases=[...document.querySelectorAll('.book-paper canvas')];assert(canvases.length>0,'PDF 未渲染');
   const canvas=canvases[0],pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ink=0;
   for(let n=0;n<pixels.length;n+=4)if(pixels[n+3]>0&&pixels[n]<150&&pixels[n+1]<150&&pixels[n+2]<150)ink++;
   assert(ink>100,'PDF 字形为空白');
   if(index===0){await library.click('book-next',{});assert(document.querySelector('#book-page-state').textContent.startsWith('3'),'PDF 翻页失败');}
   results.push({index,ink,pages:document.querySelector('#book-page-state').textContent});await library.closeReader();
  }
  const disallowed=performance.getEntriesByType('resource').filter(r=>/Liberation|quickjs-/i.test(r.name)).map(r=>r.name);
  assert(!disallowed.length,'读取了已移除资源');
  return{ok:true,results,disallowedResources:disallowed,systemFonts:true,embeddedChinese:true};
 }
 throw Error(phase);
}
