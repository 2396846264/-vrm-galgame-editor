"""Real stdio MCP -> named pipe -> WebView editor integration, in a copied project."""
import argparse, json, os, shutil, subprocess, time, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--app',required=True);p.add_argument('--fixture',required=True);p.add_argument('--output',required=True);a=p.parse_args()
app=Path(a.app).resolve();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
fixture=out/'copied-project.vrmg';shutil.copy2(a.fixture,fixture)
source=out/'故事.docx'
with zipfile.ZipFile(source,'w') as z:
    z.writestr('word/document.xml','''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>第一章 港口急报</w:t></w:r></w:p><w:p><w:r><w:t>绯音：我们必须马上离开！</w:t></w:r></w:p><w:p><w:r><w:t>小雪：我会守住这里。</w:t></w:r></w:p></w:body></w:document>''')
gb=out/'旧编码小说.txt';gb.write_bytes('澄夏：这是旧编码的小说。'.encode('gb18030'))
report=out/'ui';records={};host=None
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
editor=subprocess.Popen([str(app/'VRMGalgame.exe'),'--smoke',str(fixture),str(report),'--smoke-menu-polish','--smoke-agent'],cwd=app,startupinfo=startup)
try:
    end=time.time()+90
    while not Path(str(report)+'.menu-agent-editor.json').exists():
        if Path(str(report)+'.error.txt').exists():raise AssertionError(Path(str(report)+'.error.txt').read_text())
        if editor.poll() is not None:raise AssertionError('Editor exited before enabling bridge')
        if time.time()>end:raise TimeoutError('Editor did not become ready')
        time.sleep(.2)
    ui=json.loads(Path(str(report)+'.menu-agent-editor.json').read_text(encoding='utf-8-sig'))
    assert ui.get('ok'),ui;records['ui']=ui
    sessions=Path(os.environ['LOCALAPPDATA'])/'VRMGalgame'/'AgentSessions'
    entries=[json.loads(f.read_text()) for f in sessions.glob('*.json')]
    session=next(s for s in entries if s['pid']==editor.pid)
    host=subprocess.Popen([str(app/'VRMGalgame.Agent.exe'),'--mcp','--session',session['sessionId']],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',bufsize=1,creationflags=subprocess.CREATE_NO_WINDOW)
    serial=0
    def rpc(method,params=None):
        global serial
        serial+=1;host.stdin.write(json.dumps(dict(jsonrpc='2.0',id=serial,method=method,params=params or {}),ensure_ascii=False)+'\n');host.stdin.flush()
        line=host.stdout.readline();assert line,'MCP exited: '+host.stderr.read()
        reply=json.loads(line);assert reply['id']==serial;return reply
    def tool(name,args=None,error=False):
        r=rpc('tools/call',dict(name=name,arguments=args or {}));assert 'error' not in r,r
        v=r['result'];assert v.get('isError',False)==error,v
        return v['content'][0]['text'] if error else json.loads(v['content'][0]['text'])
    host.stdin.write('{broken}\n');host.stdin.flush();assert json.loads(host.stdout.readline())['error']['code']==-32700
    assert rpc('tools/list')['error']['code']==-32002
    init=rpc('initialize',dict(protocolVersion='2025-11-25',capabilities={},clientInfo={'name':'integration-test','version':'1'}));assert init['result']['protocolVersion']=='2025-11-25'
    host.stdin.write(json.dumps(dict(jsonrpc='2.0',method='notifications/initialized'))+'\n');host.stdin.flush()
    tools=rpc('tools/list')['result']['tools'];assert len(tools)>=14
    assert rpc('tools/call',dict(name='execute_script'))['error']['code']==-32602
    context=tool('get_project');old_count=len(context['acts']);old_roles={r['name']:r for r in context['characters']}
    assert '未保存修改' in context['name'];doc=context['documents'][0]
    first=tool('get_source',dict(documentId=doc['id'],offset=0,length=10));assert len(first['text'])==10 and not first['complete']
    second=tool('get_source',dict(documentId=doc['id'],offset=first['nextOffset'],length=24000));assert second['complete']
    imported=tool('read_document',dict(path=str(source),expectedRevision=context['revision']));context=tool('get_project')
    content=tool('get_source',dict(documentId=imported['documentId']));assert '小雪' in content['text'] and '\n' in content['text']
    imported_gb=tool('read_document',dict(path=str(gb),expectedRevision=context['revision']));context=tool('get_project');assert '旧编码' in tool('get_source',dict(documentId=imported_gb['documentId']))['text']
    assert '路径' not in json.dumps(context)
    tool('read_document',dict(path=str(app/'VRMGalgame.exe'),expectedRevision=context['revision']),error=True)
    # Import actual background and audio files from the native editor's exported
    # sample supplied next to this test, preserving the original source bytes.
    assets=Path(a.fixture).parent/'ui.export'/'game'/'assets'
    image=next((assets/'image').rglob('*.png'));audio=next((assets/'audio').rglob('*.wav'))
    imported_assets=tool('import_assets',dict(paths=[str(image),str(audio)],expectedRevision=context['revision']));assert len(imported_assets['assets'])==2
    context=tool('get_project');bg=next(x['id'] for x in imported_assets['assets'] if x['type']=='image');bgm=next(x['id'] for x in imported_assets['assets'] if x['type']=='audio')
    tool('set_asset_tags',dict(assetId=bg,tags=['港口','雨天'],expectedRevision=context['revision']));context=tool('get_project');assert next(x for x in context['assets'] if x['id']==bg)['tags']==['港口','雨天']
    model=next(x['id'] for x in context['assets'] if x['type']=='vrm');motion=next(x['id'] for x in context['assets'] if x['type']=='motion')
    draft=dict(schemaVersion=1,title='港口急报',characters=[dict(name='小雪',description='守望港口的少女',modelId=model)],acts=[dict(name='港口急报 · Agent 粗稿',backgroundId=bg,bgmId=bgm,weather={'type':'rain','intensity':.65},steps=[dict(speaker='绯音',text='我们必须马上离开！',motionId=motion,emotion='surprised'),dict(speaker='小雪',text='我会守住这里。'),dict(speaker='旁白',text='雨越下越大，电台传来远方的急报。')]),dict(kind='event',name='远方战报',event=dict(type='war',title='世界局势突变',body='甲国宣布向乙国宣战。',countryA='甲国',countryB='乙国',bgmId=bgm))],notes=['本测试验证 Agent 接口及粗稿导入，不代表内置 AI 生成质量。'])
    bad=json.loads(json.dumps(draft));bad['acts'][0]['backgroundId']='nonexistent'
    tool('propose_draft',dict(draft=bad,expectedRevision=context['revision']),error=True)
    plan=tool('propose_draft',dict(draft=draft,expectedRevision=context['revision']));assert plan['actCount']==2 and plan['lineCount']==3
    result=tool('apply_draft',dict(proposalId=plan['proposalId'],expectedRevision=plan['revision']));context=tool('get_project');assert len(context['acts'])==old_count+2
    assert next(r for r in context['characters'] if r['name']=='小雪')['modelId']==model
    for name,role in old_roles.items():assert next(r for r in context['characters'] if r['name']==name)==role
    generated=tool('get_act',dict(actId=context['acts'][-2]['id']))['act'];assert generated['weather']['type']=='rain' and generated['bgmId']==bgm and generated['steps'][0]['motionId']==motion
    tool('apply_draft',dict(proposalId=plan['proposalId'],expectedRevision=context['revision']),error=True)
    tool('save',dict(expectedRevision=0),error=True)
    tool('undo',dict(expectedRevision=context['revision']));context=tool('get_project');assert len(context['acts'])==old_count
    tool('redo',dict(expectedRevision=context['revision']));context=tool('get_project');assert len(context['acts'])==old_count+2
    tool('save',dict(expectedRevision=context['revision']));context=tool('get_project');assert not context['dirty']
    export=out/'exported-game';tool('export_game',dict(directory=str(export),expectedRevision=context['revision']));assert (export/'web.integrity.json').is_file()
    exported=json.loads((export/'game'/'project.json').read_text(encoding='utf-8-sig'));assert 'authoring' not in exported
    assert len(exported['acts'])==old_count+2;assert all(f.get('locked') for f in exported['assetFolders'] if f['type']=='voice')
    tool('export_game',dict(directory=str(export),expectedRevision=context['revision']),error=True)
    # CLI uses the very same live bridge, without a second editor or AI runtime.
    cli=subprocess.run([str(app/'VRMGalgame.Agent.exe'),'--call','get_project','--session',session['sessionId']],capture_output=True,text=True,encoding='utf-8',timeout=10,creationflags=subprocess.CREATE_NO_WINDOW)
    assert cli.returncode==0;assert json.loads(cli.stdout)['data']['revision']==context['revision']
    records.update(ok=True,protocolTools=len(tools),nativeDocx=True,nativeGb18030=True,sourceChunks=True,realAssetImport=True,assetTags=True,liveUnsavedState=True,playableDraft=True,existingStoryAndRolesPreserved=True,missingAssetRejected=True,repeatedApplyRejected=True,staleWriteRejected=True,undoRedo=True,encryptedSave=True,exportedGame=True,authoringSourcesExcludedFromGame=True,cli=True)
    with zipfile.ZipFile(fixture) as z:assert all(i.flag_bits&1 and i.compress_type==99 for i in z.infolist())
finally:
    Path(str(report)+'.agent-done').write_text('done')
    if host:
        host.stdin.close()
        try:host.wait(timeout=5)
        except subprocess.TimeoutExpired:host.terminate()
    try:editor.wait(timeout=20)
    except subprocess.TimeoutExpired:editor.terminate()
    if records.get('ok'):assert not (sessions/(session['sessionId']+'.json')).exists(),'Agent session persisted after close'
    (out/'checks.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False))
