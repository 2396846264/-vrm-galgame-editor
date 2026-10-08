export const copyLabels={act:'幕或事件',step:'对白',character:'角色',item:'玩家物品',environment:'场景',environmentNodes:'场景物体',prop:'绑定物品',titleActor:'标题人物',choice:'分支选项',book:'知识库书本',asset:'素材',folder:'素材文件夹'};
export function cloneEditorObject(kind,source,uid){
 const copy=structuredClone(source),ids=new Map();
 function identify(value){if(!value||typeof value!=='object')return;if(!Array.isArray(value)&&typeof value.id==='string')ids.set(value.id,uid());for(const child of Object.values(value))identify(child);}
 identify(copy);if(!copy.id&&kind!=='choice')copy.id=uid();
 function rewrite(value){if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(key==='id'||key.endsWith('Id')){if(typeof child==='string'&&ids.has(child))value[key]=ids.get(child);}else if(key==='props'&&Array.isArray(child)&&child.every(v=>typeof v==='string'))value[key]=child.map(v=>ids.get(v)||v);rewrite(value[key]);}}
 rewrite(copy);if(typeof copy.name==='string')copy.name=copy.name.slice(0,kind==='item'?96:196)+'（副本）';if(kind==='environment')copy.revision=0;
 return copy;
}
export function insertEditorCopy(project,kind,source,{ownerId,afterId,folderId}={},uid){
 if(!copyLabels[kind]||!source)throw Error('没有可粘贴的内容');
 let list,owner;
 if(kind==='step'||kind==='choice'){owner=project.acts.find(a=>a.id===ownerId);if(kind==='choice')owner=project.acts.flatMap(a=>a.steps||[]).find(s=>s.id===ownerId);if(!owner||kind==='step'&&owner.kind==='event')throw Error('请选择普通幕的对白列表');list=kind==='step'?owner.steps:(owner.choices||=[]);}
 else if(kind==='prop'){owner=project.characters.find(c=>c.id===ownerId);if(!owner)throw Error('请先选择角色');list=owner.props||=[];}
 else if(kind==='titleActor')list=project.title.actors||=[];
 else{const key={act:'acts',character:'characters',item:'items',environment:'environments',book:'knowledgeBooks',asset:'assets',folder:'assetFolders'}[kind];if(!key)throw Error('请到环境编辑器粘贴场景物体');list=project[key]||=[];}
 const copy=cloneEditorObject(kind,source,uid);if(kind==='asset'&&folderId!==undefined)copy.folderId=folderId;
 const index=afterId?list.findIndex(v=>v.id===afterId):-1;list.splice(index<0?list.length:index+1,0,copy);
 return copy;
}
export function projectClipboard(projectId,storage){
 const key='vrmg-object-clipboard:'+projectId;
 return {read(){try{const value=JSON.parse(storage.getItem(key));return value?.projectId===projectId&&copyLabels[value.kind]?value:null;}catch{return null;}},write(kind,data){if(!copyLabels[kind])throw Error('不支持复制这类内容');storage.setItem(key,JSON.stringify({projectId,kind,data:structuredClone(data)}));}};
}
