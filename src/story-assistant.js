import {compileDraft,applyCompiledDraft,draftContext,draftInstructions,splitTextDraft,parseDraft} from './story-draft.js';
import {createEnvironmentAgent,environmentAgentTools,environmentAgentWrites,editorSummary} from './environment-agent.js';
import './story-assistant.css';
export function createStoryAssistant(ctx) {
  const esc=ctx.escape;
  let proposal=null, enabled=false, connection=null, status='', busy=false, boundProject='', applied=new Set();
  const project=()=>ctx.project();
  const check=()=>{if(!project()||ctx.mode()!=='editor')throw new Error('请先在编辑器打开工程。');if(ctx.busy())throw new Error('正在切换剧情或恢复工程，请稍后。');};
  const revision=()=>ctx.revision();
  const guard=args=>{check();if(!Number.isInteger(args.expectedRevision)||args.expectedRevision!==revision())throw new Error(`工程已变化，请重新读取。当前 revision: ${revision()}`);};
  const begin=()=>ctx.begin();
  const changed=async label=>{ctx.changed(label);await ctx.refresh();};
  const environmentAgent=createEnvironmentAgent({...ctx,changed,control:(command,payload={})=>ctx.bridge('agentEnvironmentControl',{command,...payload}),open:ctx.openEnvironment});
  const synchronizedWrites=new Set([...environmentAgentWrites,'import_assets','read_document','set_asset_tags','propose_draft','apply_draft','undo','redo','save','preview','export_game','open_environment','capture_environment']);
  let agentOperationBusy=false;
  const config=()=>connection?{mcpServers:{vrm_galgame:{command:connection.command,args:['--mcp','--session',connection.sessionId]}}}:{};
  const setStatus=(message,error=false)=>{status=message;const n=document.querySelector('#assistant-status');if(n){n.textContent=message;n.classList.toggle('error',error);}};
  const reset=()=>{if(boundProject!==project()?.id){boundProject=project()?.id;proposal=null;applied=new Set();status='';}};
  function render() {
    check(); reset(); document.querySelector('#story-assistant-modal')?.remove();
    const p=project(), a=p.authoring||{documents:[],mode:'faithful',instructions:''};
    document.querySelector('.editor').insertAdjacentHTML('beforeend',`<div id="story-assistant-modal" class="story-assistant-backdrop" role="dialog" aria-modal="true" aria-label="剧情助手"><div class="story-assistant-card">
      <header><h2>剧情助手 · 从故事到可试玩粗稿</h2><button data-action="assistant-close">关闭 ×</button></header><div class="story-assistant-body">
      <section><h3>① 上传小说或大纲</h3><p class="assistant-help">先新建或打开工程，再导入文本。可分次导入多个章节。支持 TXT、Markdown、Word（DOCX）；也可以直接粘贴。</p>
      <div class="assistant-actions"><button data-action="assistant-source">导入文本文件</button></div><ul class="assistant-sources">${(a.documents||[]).map(d=>`<li><span>${esc(d.name)} · ${d.text.length} 字</span><button data-action="assistant-source-remove" data-id="${esc(d.id)}">移除</button></li>`).join('')}</ul>
      <input id="assistant-source-name" placeholder="粘贴内容的名字，如：第一章"><textarea id="assistant-source-text" placeholder="把小说、剧本或大纲粘贴到这里"></textarea><div class="assistant-actions"><button data-action="assistant-source-paste">加入故事素材</button></div>
      <label class="field"><span>改编方式</span><select id="assistant-mode"><option value="faithful" ${a.mode==='faithful'?'selected':''}>忠实原文 · 尽量保留原句</option><option value="adapt" ${a.mode==='adapt'?'selected':''}>游戏化改编 · 调整节奏和演出</option><option value="outline" ${a.mode==='outline'?'selected':''}>根据大纲扩写 · 补出对白</option></select></label>
      <label class="field"><span>作者要求</span><textarea id="assistant-instructions" placeholder="例如：每幕不要太长，人物名称不变，保持悬疑气氛">${esc(a.instructions)}</textarea></label><button data-action="assistant-options">保存编排要求</button>
      <h3 style="margin-top:20px">② 提供模型、背景、动作和音乐</h3><p class="assistant-help">素材会自动归类。配音仍必须在对应对白上传。给素材填写标签，Agent 更容易选对。</p><div class="assistant-actions"><button data-action="assistant-assets">批量导入素材</button></div>
      <div class="assistant-tags">${p.assets.filter(x=>x.type!=='voice').map(x=>`<label><span title="${esc(x.name)}">${esc(x.name)}</span><input data-assistant-tags="${esc(x.id)}" value="${esc((x.tags||[]).join('，'))}" placeholder="标签，如：港口，白天，紧张"></label>`).join('')}</div><button data-action="assistant-tags-save">保存素材标签</button></section>
      <section><h3>③ 连接 Agent</h3><p class="assistant-help">让你正在使用的 Agent 读故事、编排粗稿，也能布置三维环境：摆放模型、图片远景、灯光和游戏镜头。开启后，本地 Agent 可修改当前工程；每批布置都能撤销。这里不会自带 AI，也不需要提供工程密码。</p>
      <div class="assistant-actions"><button data-action="assistant-toggle">${enabled?'断开 Agent':'开启本地 Agent 接口'}</button><button data-action="assistant-copy-task">复制编排任务</button><button data-action="assistant-copy-scene-task">复制场景布置任务</button></div>
      ${enabled?`<p class="assistant-help">将下面的配置添加到支持 MCP 的 Agent 中（每个编辑器窗口有独立连接）。</p><pre class="assistant-config">${esc(JSON.stringify(config(),null,2))}</pre><button data-action="assistant-copy-config">复制 MCP 配置</button>`:''}
      <h3 style="margin-top:20px">④ 检查并采用粗稿</h3><p class="assistant-help">Agent 提交的粗稿会显示在这里。也可导入它生成的 JSON 文件。采用时追加到剧情末尾，已有剧情和角色介绍保留。</p>
      <div class="assistant-actions"><button data-action="assistant-plan-file">导入粗稿 JSON</button><button data-action="assistant-offline">快速拆分（不使用 AI）</button></div>
      <div id="assistant-preview" class="assistant-preview">${preview()}</div><div class="assistant-actions"><button data-action="assistant-apply" ${!proposal||busy?'disabled':''}>采用粗稿 · 可撤销</button><button data-action="assistant-undo">撤销上一步</button><button data-action="assistant-preview-game">试玩当前工程</button></div>
      <div id="assistant-status" class="assistant-status" role="status">${esc(status)}</div>
      <p class="assistant-help">长篇小说请让 Agent 按章节分批编排，避免漏读和人物前后不一致。没有找到的素材会列为待完善事项。普通小说的快速拆分会先保留为旁白；AI 编排需要连接 Agent。</p>
      </section></div></div></div>`);
  }
  function preview() {
    if(!proposal){
      const report=project()?.authoring?.lastReport;
      return report?`<b>上一次已采用：${esc(report.title||'剧情粗稿')}</b><p>${report.actCount} 个剧情节点 · ${report.lineCount} 句对白</p><h4>待完善</h4>${report.notes.length?`<ul>${report.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:'无缺项。'}`:'粗稿尚未生成。';
    }
    const c=proposal.compiled;
    return `<b>${c.acts.length} 个剧情节点 · ${c.lineCount} 句对白 · 新增 ${c.characters.length} 位角色</b><p>${esc(c.characters.map(r=>r.name).join('、'))}</p>${c.acts.map(a=>`<article><strong>${esc(a.name)}</strong><p>${a.kind==='event'?esc(a.event.title):esc(a.steps.slice(0,3).map(s=>`${s.speaker}：${s.text}`).join('\n'))}</p><small>${a.kind==='event'?'事件':`${a.steps.length} 句`}</small></article>`).join('')}<h4>待完善</h4>${c.notes.length?`<ul>${c.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:'无缺项。'}`;
  }
  const updatePreview=()=>{const n=document.querySelector('#assistant-preview');if(n)n.innerHTML=preview();const b=document.querySelector('[data-action=assistant-apply]');if(b)b.disabled=!proposal||busy;};
  async function addDocuments(docs) {
    check();if(!docs?.length)return;
    const old=project().authoring?.documents||[];
    if([...old,...docs].reduce((n,d)=>n+d.text.length,0)>2000000)throw new Error('故事素材总量超过 200 万字，请分工程或分批处理。');
    begin(); project().authoring||={documents:[],mode:'faithful',instructions:''};
    project().authoring.documents.push(...docs.map(d=>({id:crypto.randomUUID(),name:d.name,text:d.text})));
    await changed('导入故事文本');proposal=null;render();setStatus('故事素材已加入工程，保存工程后仍会保留。');
  }
  function propose(draft) {
    check(); reset(); const raw=parseDraft(draft), compiled=compileDraft(raw,project());
    proposal={id:crypto.randomUUID(),draft:structuredClone(raw),compiled,projectId:project().id,revision:revision()};
    updatePreview();setStatus(`粗稿已准备好：${compiled.acts.length} 个剧情节点。采用后可撤销。`);
    return {proposalId:proposal.id,revision:proposal.revision,actCount:compiled.acts.length,lineCount:compiled.lineCount,newCharacters:compiled.characters.map(r=>r.name),notes:compiled.notes};
  }
  async function apply(args) {
    guard(args);
    if(applied.has(args.proposalId))throw new Error('这份粗稿已经采用，请勿重复追加。');
    if(!proposal||proposal.id!==args.proposalId||proposal.projectId!==project().id)throw new Error('粗稿已失效，请重新提交。');
    if(proposal.revision!==revision())throw new Error('工程在预览后有修改，请重新提交粗稿检查。');
    // Compile again against the current catalog immediately before committing.
    const compiled=compileDraft(proposal.draft,project()), start=project().acts.length;
    begin();applyCompiledDraft(project(),compiled,proposal.id);applied.add(proposal.id);proposal=null;
    await changed('采用 Agent 剧情粗稿');ctx.selectAct(start);await ctx.refresh();updatePreview();
    setStatus(`已追加 ${compiled.acts.length} 个剧情节点、${compiled.lineCount} 句对白。${compiled.notes.length} 项待完善，可一键撤销。`);
    return {revision:revision(),actCount:compiled.acts.length,lineCount:compiled.lineCount,notes:compiled.notes};
  }
  async function call(name,args={}) {
    check();reset();if(agentOperationBusy)throw Error('MCP 正在处理上一项操作，请稍候');agentOperationBusy=true;
    let locked=false,result;
    try{
      if(synchronizedWrites.has(name)){await ctx.bridge('agentEnvironmentControl',{command:'lock'});locked=true;}
      if(environmentAgentWrites.has(name))guard(args);
      result=environmentAgentTools.has(name)?await environmentAgent.call(name,args):await dispatch(name,args);
      return result;
    }finally{
      try{if(locked)await ctx.refreshEnvironmentWindow();}catch(error){await ctx.bridge('agentEnvironmentControl',{command:'release'}).catch(()=>{});if(result)result.windowWarning=error.message;}
      agentOperationBusy=false;
    }
  }
  async function dispatch(name,args={}) {
    if(name==='get_project'){const state=await ctx.bridge('agentEnvironmentControl',{command:'read'});return {...draftContext(project()),acts:project().acts.map(a=>({id:a.id,name:a.name,kind:a.kind||'act',lineCount:a.steps.length,environmentId:a.environmentId||''})),environments:environmentAgent.summary(project()),environmentCoordinates:environmentAgent.coordinates,environmentEditor:editorSummary(state),revision:revision(),dirty:ctx.dirty()};}
    if(name==='get_act'){check();const a=project().acts.find(a=>a.id===args.actId);if(!a)throw new Error('找不到这一幕。');return {act:structuredClone(a),revision:revision()};}
    if(name==='get_source') {
      check();const d=project().authoring?.documents?.find(d=>d.id===args.documentId);if(!d)throw new Error('找不到这份故事素材。');
      const offset=Math.max(0,Math.floor(Number(args.offset)||0)),length=Math.min(24000,Math.max(1,Math.floor(Number(args.length)||12000)));
      return {id:d.id,name:d.name,text:d.text.slice(offset,offset+length),offset,nextOffset:Math.min(d.text.length,offset+length),total:d.text.length,complete:offset+length>=d.text.length};
    }
    if(name==='propose_draft'){guard(args);return propose(args.draft);}
    if(name==='apply_draft')return apply(args);
    if(name==='import_assets') {
      guard(args);const p=project(),rev=revision();const result=await ctx.bridge('agentImportAssets',{paths:args.paths});
      if(project()!==p||revision()!==rev)throw new Error('导入时工程已变化，请重新读取后重试。');
      begin();p.assets.push(...result);for(const item of result)ensureFolder(item);await changed('Agent 导入素材');proposal=null;updatePreview();
      return {assets:result,revision:revision()};
    }
    if(name==='read_document') {
      guard(args);const p=project(),rev=revision();const d=await ctx.bridge('agentReadDocument',{path:args.path});
      if(project()!==p||revision()!==rev)throw new Error('读取时工程已变化，请重新操作。');
      await addDocuments([d]);return {documentId:project().authoring.documents.at(-1).id,revision:revision(),characters:d.text.length};
    }
    if(name==='set_asset_tags') {
      guard(args);const item=project().assets.find(a=>a.id===args.assetId);
      if(!item)throw new Error('素材不存在。');
      if(!Array.isArray(args.tags)||args.tags.length>30||args.tags.some(t=>typeof t!=='string'||t.length>80))throw new Error('标签需要文本列表，最多 30 项，每项最多 80 字。');
      begin();item.tags=[...new Set(args.tags)];await changed('Agent 设置素材标签');return {revision:revision()};
    }
    if(name==='undo'||name==='redo'){guard(args);await ctx.undo(name==='undo'?-1:1);proposal=null;updatePreview();return {revision:revision(),history:ctx.history()};}
    if(name==='save'){guard(args);await ctx.save();return {saved:true,revision:revision()};}
    if(name==='preview'){check();await ctx.bridge('previewGame',{project:structuredClone(project())});return {opened:true};}
    if(name==='export_game'){guard(args);await ctx.save();return ctx.bridge('agentExportGame',{directory:args.directory,project:structuredClone(project())});}
    throw new Error('未知的 Agent 操作。');
  }
  function ensureFolder(item) {
    const folderId=`draft-${item.type}`;
    if(!project().assetFolders.some(f=>f.id===folderId))project().assetFolders.push({id:folderId,type:item.type,name:'剧情助手导入'});
    item.folderId=folderId;
  }
  async function click(action,node) {
    if(action==='assistant-open'){render();return;}
    if(action==='assistant-close'){document.querySelector('#story-assistant-modal')?.remove();return;}
    if(busy){setStatus('正在处理，请稍后。');return;}
    busy=true;
    try {
      if(action==='assistant-source') {const docs=await ctx.bridge('pickStoryDocuments');if(docs)await addDocuments(docs);}
      if(action==='assistant-source-paste'){const value=document.querySelector('#assistant-source-text').value.trim();if(!value)throw new Error('请先粘贴小说或大纲。');await addDocuments([{name:document.querySelector('#assistant-source-name').value.trim()||'粘贴的故事',text:value}]);}
      if(action==='assistant-source-remove'){begin();project().authoring.documents=project().authoring.documents.filter(d=>d.id!==node.dataset.id);await changed('移除故事素材');proposal=null;render();}
      if(action==='assistant-options'){begin();project().authoring||={documents:[]};project().authoring.mode=document.querySelector('#assistant-mode').value;project().authoring.instructions=document.querySelector('#assistant-instructions').value.slice(0,12000);await changed('设置编排要求');proposal=null;updatePreview();setStatus('编排要求已保存。');}
      if(action==='assistant-assets'){const result=await ctx.bridge('pickDraftAssets');if(result?.length){begin();project().assets.push(...result);for(const item of result)ensureFolder(item);await changed('导入粗稿素材');proposal=null;render();setStatus(`已导入 ${result.length} 个素材。`);}}
      if(action==='assistant-tags-save'){begin();for(const n of document.querySelectorAll('[data-assistant-tags]')){const a=project().assets.find(x=>x.id===n.dataset.assistantTags);if(a)a.tags=[...new Set(n.value.split(/[,，;；]/).map(t=>t.trim().slice(0,80)).filter(Boolean))].slice(0,30);}await changed('设置素材标签');proposal=null;updatePreview();setStatus('素材标签已保存。');}
      if(action==='assistant-toggle'){connection=await ctx.bridge('setAgentEnabled',{enabled:!enabled});enabled=connection.enabled;render();setStatus(enabled?'本地 Agent 接口已开启。关闭编辑器或点击断开后停止接入。':'Agent 已断开。');}
      if(action==='assistant-copy-config'){await navigator.clipboard.writeText(JSON.stringify(config(),null,2));setStatus('MCP 配置已复制。');}
      if(action==='assistant-copy-scene-task'){await navigator.clipboard.writeText('请通过 vrm_galgame MCP 布置当前工程的三维环境。先读取 get_project、get_environments 和 get_environment；用 inspect_scene_asset 检查模型大小，再用 edit_environment 分批布置。设置游戏镜头，使用 capture_environment 查看实际画面。用 set_environment_reference 指定给幕或标题，完成后 save。不要覆盖环境窗口中的未保存修改：先 sync_environment_editor，再重读版本。请向我询问希望布置的场景和要使用的素材。');setStatus('场景布置任务已复制，粘贴给已连接的 Agent，并告诉它你的场景要求。');}
      if(action==='assistant-copy-task'){await navigator.clipboard.writeText(`请通过 vrm_galgame MCP 编排当前工程。\n${draftInstructions}\n改编方式：${project().authoring?.mode||'faithful'}\n作者要求：${project().authoring?.instructions||'无补充要求'}\n请先读取并读完全部故事素材。`);setStatus('编排任务已复制，粘贴给已连接的 Agent 即可。');}
      if(action==='assistant-plan-file'){const data=await ctx.bridge('pickDraftPlan');if(data)propose(data);}
      if(action==='assistant-offline'){const docs=project().authoring?.documents||[];if(!docs.length)throw new Error('请先导入故事文本。');propose(splitTextDraft(docs.map(d=>d.text).join('\n\n'),project()));}
      if(action==='assistant-apply')await apply({proposalId:proposal?.id,expectedRevision:revision()});
      if(action==='assistant-undo'){await ctx.undo(-1);proposal=null;updatePreview();setStatus('已恢复上一步。');}
      if(action==='assistant-preview-game')await ctx.bridge('previewGame',{project:structuredClone(project())});
    } catch(e){setStatus(e.message,true);ctx.toast(e.message,true);}
    finally {busy=false;updatePreview();}
  }
  return {render,click,call,isEnabled:()=>enabled,setConnection:value=>{connection=value;enabled=Boolean(value?.enabled);}};
}
