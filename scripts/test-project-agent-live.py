"""Real stdio MCP -> named pipe -> GUI -> archive integration. Only own copies."""
import argparse,json,os,subprocess,time,shutil,base64,wave
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--app',required=True);ap.add_argument('--fixture',required=True);ap.add_argument('--output',required=True);a=ap.parse_args()
app=Path(a.app).resolve();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);fixture=out/'copy.vrmg';shutil.copy2(a.fixture,fixture);prefix=out/'ui';report={};host=None
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
editor=subprocess.Popen([str(app/'VRMGalgame.exe'),'--smoke',str(fixture),str(prefix),'--smoke-menu-polish','--smoke-agent'],cwd=app,startupinfo=startup)
try:
 end=time.time()+100
 while not Path(str(prefix)+'.menu-agent-editor.json').exists():
  if Path(str(prefix)+'.error.txt').exists():raise AssertionError(Path(str(prefix)+'.error.txt').read_text())
  if editor.poll() is not None:raise AssertionError('Editor closed')
  if time.time()>end:raise TimeoutError('Bridge startup')
  time.sleep(.15)
 sessions=Path(os.environ['LOCALAPPDATA'])/'VRMGalgame/AgentSessions';session=next(json.loads(f.read_text()) for f in sessions.glob('*.json') if json.loads(f.read_text()).get('pid')==editor.pid)
 host=subprocess.Popen([str(app/'VRMGalgame.Agent.exe'),'--mcp','--session',session['sessionId']],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW);serial=0
 def rpc(method,params={}):
  global serial
  serial+=1;host.stdin.write(json.dumps({'jsonrpc':'2.0','id':serial,'method':method,'params':params},ensure_ascii=False)+'\n');host.stdin.flush();line=host.stdout.readline();assert line,'MCP disconnected';r=json.loads(line);assert r['id']==serial;assert 'error' not in r,r;return r['result']
 def tool(name,args={},error=False):
  r=rpc('tools/call',{'name':name,'arguments':args});assert r.get('isError',False)==error,(name,r)
  if error:return r['content'][0]['text']
  if len(r['content'])>1:
   (out/'capture.png').write_bytes(base64.b64decode(r['content'][1]['data']))
  return json.loads(r['content'][0]['text'])
 rpc('initialize',{'protocolVersion':'2025-11-25'});host.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');host.stdin.flush()
 tools=rpc('tools/list')['tools'];assert len(tools)>=37;report['toolCount']=len(tools)
 caps=tool('get_capabilities');assert len(caps['actors']['slots'])==30;render=tool('get_render_options');assert len(render['options'])==72;report['catalog']=True
 def state():return tool('get_project')
 def edit(ops):return tool('edit_project',{'operations':ops,'expectedRevision':state()['revision']})
 s=state();old=tool('get_editor_state');roles=tool('get_objects',{'kind':'character'})['objects'];assert roles;role=roles[0];info=tool('inspect_character',{'characterId':role['id']});assert info['bones'] and info['propBones'] and info['expressions'];report['actualModelInspect']=True
 assets=tool('get_objects',{'kind':'asset','limit':200})['objects'];image=next(x for x in assets if x['type']=='image');prop=next(x for x in assets if x['type']=='sceneModel');motion=next(x for x in assets if x['type']=='motion')
 operations=[{'action':'create','kind':'act','ref':'act','data':{'name':'MCP44新幕'}},{'action':'create','kind':'dialogue','ownerId':'$act','ref':'line','data':{'text':'MCP44的直接对白','speaker':role['name'],'characterId':role['id']}},{'action':'create','kind':'renderPreset','ref':'look','data':{'name':'MCP44滤镜','settings':{'filters':{'rim':.3,'dof':.25}}}},{'action':'update','kind':'ui','data':{'gameTheme':'astral','roleDetailsRender':{'presetId':'$look','brightness':95},'spatialCamera':{'enabled':True,'strength':.5}}},{'action':'update','kind':'title','data':{'render':{'presetId':'$look'}}},{'action':'create','kind':'prop','ownerId':role['id'],'ref':'prop','data':{'assetId':prop['id'],'bone':info['propBones'][0]['value'],'position':[.1,0,0],'rotation':[0,45,0],'scale':[.5,.5,.5]}},{'action':'set_actor','id':'$line','slot':'row10-right','data':{'characterId':role['id'],'offsetX':2,'yaw':360,'motionId':motion['id'],'motionOptions':{'loop':True,'feet':'free'},'props':['$prop'],'expressionWeights':{info['expressions'][0]:.25}}},{'action':'update','kind':'dialogue','ownerId':'$act','id':'$line','data':{'render':{'presetId':'$look'},'camera':{'position':[0,1.3,5],'target':[0,1,0],'fov':40}}},{'action':'create','kind':'item','ref':'item','data':{'name':'MCP44信件','imageId':image['id'],'description':'通过MCP添加的物品。'}},{'action':'create','kind':'choice','ownerId':'$line','data':{'text':'下一幕','actId':'$act','requirements':[{'itemId':'$item','quantity':1}],'consumeRequired':True}}]
 # Use a motion permitted for this actual role, independent of the library order.
 operations[6]['data']['motionId']=info['motions'][0]['id'] if info['motions'] else ''
 result=edit(operations);ids=result['refs'];assert result['undoSteps']==1;line=tool('get_object',{'kind':'dialogue','id':ids['line']})['object'];assert line['cast']['row10-right']['yaw']==360;assert line['render']['presetId']==ids['look'];assert tool('get_object',{'kind':'ui'})['object']['roleDetailsRender']['brightness']==95;report['directEditing']=True
 r=state()['revision'];tool('edit_project',{'expectedRevision':r-1,'operations':[{'action':'update','kind':'project','data':{'name':'stale'}}]},True);tool('edit_project',{'expectedRevision':r,'operations':[{'action':'update','kind':'project','data':{'name':'bad partial'}},{'action':'update','kind':'asset','id':image['id'],'data':{'path':'C:/bad'}}]},True);assert state()['revision']==r;assert state()['name']!='bad partial';report['rollbackAndRevision']=True
 tool('undo',{'expectedRevision':state()['revision']});assert not any(x['id']==ids['act'] for x in state()['acts']);tool('redo',{'expectedRevision':state()['revision']});assert any(x['id']==ids['act'] for x in state()['acts']);report['undoRedo']=True
 voice=out/'voice.wav'
 with wave.open(str(voice),'wb') as wav:wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000);wav.writeframes(b'\0\0'*800)
 v=tool('import_dialogue_voice',{'actId':ids['act'],'dialogueId':ids['line'],'path':str(voice),'expectedRevision':state()['revision']});assert v['asset']['type']=='voice' and v['asset']['characterId']==role['id'];assert tool('get_object',{'kind':'dialogue','id':ids['line']})['object']['voiceId']==v['asset']['id'];report['dialogueVoice']=True
 effect=tool('import_assets',{'paths':[str(voice)],'type':'effect','expectedRevision':state()['revision']});assert effect['assets'][0]['audioKind']=='effect';report['audioSeparation']=True
 meta=json.loads((Path('work/mmd36-inputs.json')).read_text(encoding='utf-8-sig'));m=tool('import_assets',{'paths':[meta['models'][0]],'type':'mmdCharacter','expectedRevision':state()['revision']});assert any(x['type']=='mmdCharacter' and x.get('textureMap') for x in m['assets']);vmd=tool('import_assets',{'paths':[meta['vmd']],'type':'motion','expectedRevision':state()['revision']});assert vmd['assets'][0]['type']=='motion';report['mmdVmd']=True
 original=json.loads(Path('work/v030-environment-fixture/project.json').read_text(encoding='utf-8-sig'));fbx=next(x for x in original['assets'] if x['type']=='fbxCharacter');fbxpath=str((Path('work/v030-environment-fixture')/fbx['path']).resolve());f=tool('import_assets',{'paths':[fbxpath],'type':'fbxCharacter','expectedRevision':state()['revision']});assert f['assets'][0]['type']=='fbxCharacter';fm=tool('import_assets',{'paths':[fbxpath],'type':'motion','expectedRevision':state()['revision']});assert fm['assets'][0]['type']=='motion';report['fbxModelVsMotion']=True
 tool('find_text',{'query':'MCP44'});edit([{'action':'replace_text','query':'直接对白','replacement':'编辑后的对白'}]);assert '编辑后' in tool('get_object',{'kind':'dialogue','id':ids['line']})['object']['text']
 tool('select_editor_object',{'kind':'dialogue','id':ids['line']});assert tool('get_editor_state')['editor']['selectedDialogueId']==ids['line'];tool('capture_editor');assert (out/'capture.png').stat().st_size>1000;report['screenshotsAndSelection']=True
 mmodel=next(x for x in m['assets'] if x['type']=='mmdCharacter');fmodel=next(x for x in f['assets'] if x['type']=='fbxCharacter');extra=edit([{'action':'create','kind':'character','ref':'mmd','data':{'name':'MCP44MMD','modelId':mmodel['id']}},{'action':'create','kind':'character','ref':'fbx','data':{'name':'MCP44FBX','modelId':fmodel['id']}}])['refs'];mi=tool('inspect_character',{'characterId':extra['mmd']});fi=tool('inspect_character',{'characterId':extra['fbx']});assert mi['expressions'] and mi['bones'] and fi['bones'];report['threeModelInspections']=True
 portrait=tool('generate_portrait',{'characterId':extra['mmd'],'expectedRevision':state()['revision']});assert portrait['portraitId'];report['generatedPortrait']=True
 env=edit([{'action':'create','kind':'environment','ref':'room','data':{'name':'MCP44场景'}},{'action':'duplicate','kind':'environment','id':'$room','ref':'room2'},{'action':'delete','kind':'environment','id':'$room2'}]);assert tool('get_object',{'kind':'environment','id':env['refs']['room']})['object']['nodes'];report['environmentCrud']=True
 weapon=tool('import_assets',{'paths':[meta['weapons'][0]],'type':'sceneModel','expectedRevision':state()['revision']});w=next(x for x in weapon['assets'] if x['type']=='sceneModel');measured=tool('inspect_scene_asset',{'assetId':w['id']});assert measured['bounds'] and measured['meshes']>0;report['mmdSceneInspection']=True
 tool('open_editor_panel',{'panel':'render'});tool('capture_editor',{'panel':'render'});assert tool('get_editor_state')['windows']['modules'];tool('sync_editor_windows',{'expectedRevision':state()['revision']});report['moduleCaptureAndSync']=True
 tool('save',{'expectedRevision':state()['revision']});report['encryptedSave']=fixture.stat().st_size>0
 export=tool('export_game',{'directory':str((out/'export').resolve()),'expectedRevision':state()['revision']});assert Path(export['directory'],'game.vrgdata').exists();report['export']=True;report['ok']=True
finally:
 Path(str(prefix)+'.agent-done').write_text('done')
 if host:
  host.stdin.close()
  try:host.wait(timeout=5)
  except subprocess.TimeoutExpired:host.terminate()
 try:editor.wait(timeout=25)
 except subprocess.TimeoutExpired:editor.terminate()
 (out/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
