const fileActions=new Set(['save','save-as','new-project','open-project','recent-projects','play','export','edit-environment','open-module']);
export function createEditorSaveNotice({document:doc=document,status=()=>''}={}){
 const sources=new Set(),locked=new Map();let notice;
 function refresh(){
  const editor=doc.querySelector('.editor'),active=sources.size>0&&Boolean(editor);
  if(!notice){notice=doc.createElement('div');notice.id='editor-save-notice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.innerHTML='<span class="editor-save-spinner" aria-hidden="true"></span><div><b>正在保存工程…</b><small>保存完成后即可试玩，请稍候。</small><div class="editor-save-progress" role="progressbar" aria-label="工程正在保存"><i></i></div></div>';doc.body.append(notice);}
  notice.hidden=!active;
  editor?.setAttribute('aria-busy',String(active));
  const marker=doc.querySelector('#save-state');if(marker){marker.classList.toggle('project-saving',active);marker.textContent=active?'◌ 正在保存…':status();}
  if(active){for(const node of doc.querySelectorAll('.topbar [data-action]'))if(fileActions.has(node.dataset.action)){if(!locked.has(node))locked.set(node,{disabled:node.disabled,title:node.title});node.disabled=true;node.dataset.savePending='true';node.title='工程正在保存，完成后即可操作。';}}
  else {for(const [node,previous]of locked){node.disabled=previous.disabled;node.title=previous.title;delete node.dataset.savePending;}locked.clear();}
 }
 return {set(source,active){active?sources.add(source):sources.delete(source);refresh();},refresh,get active(){return sources.size>0;}};
}
