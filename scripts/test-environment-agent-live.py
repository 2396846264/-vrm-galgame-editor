"""Actual stdio MCP -> named pipe -> both WebView windows; generated fixtures only."""
import argparse,base64,hashlib,json,os,struct,subprocess,time,uuid,zipfile,zlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--app',required=True);p.add_argument('--output',required=True);a=p.parse_args()
app=Path(a.app).resolve();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=False)
source=out/'source';source.mkdir();report=out/'ui';host=None;records={};editor=None
project={'version':1,'id':str(uuid.uuid4()),'name':'MCP环境测试','assets':[],'characters':[],'assetFolders':[],'environments':[],'environmentLibrary':{'folders':[],'assignments':{}},'title':{'logoImageId':'__none__','environmentId':'','actors':[]},'acts':[{'id':'test-act','name':'校园场景','steps':[{'id':'line-one','characterId':'','speaker':'旁白','text':'这里是通过 MCP 布置的校园。','cast':{},'choices':[]}]}]}
(source/'project.json').write_text(json.dumps(project,ensure_ascii=False),encoding='utf-8')
# A unit cube GLB used as several colored architectural blocks; no external model.
positions=[];normals=[];indices=[]
faces=[([(1,0,0),(1,1,0),(1,1,1),(1,0,1)],(1,0,0)), ([(0,0,1),(0,1,1),(0,1,0),(0,0,0)],(-1,0,0)), ([(0,1,0),(0,1,1),(1,1,1),(1,1,0)],(0,1,0)), ([(0,0,1),(0,0,0),(1,0,0),(1,0,1)],(0,-1,0)), ([(1,0,1),(1,1,1),(0,1,1),(0,0,1)],(0,0,1)), ([(0,0,0),(0,1,0),(1,1,0),(1,0,0)],(0,0,-1))]
for verts,normal in faces:
 start=len(positions)//3
 for x,y,z in verts:positions.extend([x-.5,y,z-.5]);normals.extend(normal)
 indices.extend([start,start+1,start+2,start,start+2,start+3])
binary=struct.pack('<72f',*positions)+struct.pack('<72f',*normals)+struct.pack('<36H',*indices)
gltf={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'MCP测试方块','mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}],'materials':[{'name':'浅色建筑','pbrMetallicRoughness':{'baseColorFactor':[.72,.8,.85,1],'metallicFactor':0,'roughnessFactor':.85}}],'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':288},{'buffer':0,'byteOffset':288,'byteLength':288},{'buffer':0,'byteOffset':576,'byteLength':72}],'accessors':[{'bufferView':0,'componentType':5126,'count':24,'type':'VEC3','min':[-.5,0,-.5],'max':[.5,1,.5]},{'bufferView':1,'componentType':5126,'count':24,'type':'VEC3'},{'bufferView':2,'componentType':5123,'count':36,'type':'SCALAR'}]}
encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
model=out/'MCP测试方块.glb';model.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
image=out/'MCP远景.png';image.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',64,32,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+bytes([90+y*2,155+y,210])*64 for y in range(32))))+chunk(b'IEND',b''))
bad=out/'无效模型.glb';bad.write_text('invalid')
original=hashlib.sha256(model.read_bytes()).hexdigest()
def wait_file(path,seconds=100):
 end=time.time()+seconds
 while not path.exists():
  if editor and editor.poll() is not None:raise AssertionError('Editor exited: '+str(editor.returncode))
  error=Path(str(report)+'.error.txt')
  if error.exists():raise AssertionError(error.read_text(encoding='utf-8-sig'))
  if time.time()>end:raise TimeoutError(str(path))
  time.sleep(.1)
 return json.loads(path.read_text(encoding='utf-8-sig')) if path.suffix=='.json' else None
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
try:
 editor=subprocess.Popen([str(app/'VRMGalgame.exe'),'--smoke','-',str(report),'--smoke-import-folder',str(source),'--smoke-archive-ops',str(out/'archives'),'--smoke-menu-polish','--smoke-agent-environment'],cwd=app,startupinfo=startup)
 assert wait_file(Path(str(report)+'.menu-agent-env-editor.json'))['ok']
 sessions=Path(os.environ['LOCALAPPDATA'])/'VRMGalgame'/'AgentSessions';session=next(json.loads(f.read_text()) for f in sessions.glob('*.json') if json.loads(f.read_text())['pid']==editor.pid)
 host=subprocess.Popen([str(app/'VRMGalgame.Agent.exe'),'--mcp','--session',session['sessionId']],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',bufsize=1,creationflags=subprocess.CREATE_NO_WINDOW)
 serial=0
 def rpc(method,params=None):
  global serial
  serial+=1;host.stdin.write(json.dumps({'jsonrpc':'2.0','id':serial,'method':method,'params':params or {}},ensure_ascii=False)+'\n');host.stdin.flush();reply=json.loads(host.stdout.readline());assert reply['id']==serial;return reply
 def tool(name,args=None,error=False,raw=False):
  reply=rpc('tools/call',{'name':name,'arguments':args or {}});assert 'error' not in reply,reply
  result=reply['result'];assert result.get('isError',False)==error,result
  if raw:return result
  return result['content'][0]['text'] if error else json.loads(result['content'][0]['text'])
 assert rpc('initialize',{'protocolVersion':'2025-11-25'})['result']['serverInfo']['version']=='0.0.15'
 host.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');host.stdin.flush()
 tools=rpc('tools/list')['result']['tools'];assert len(tools)==23
 context=tool('get_project');rev=context['revision'];assert context['environments']==[]
 tool('import_assets',{'paths':[str(model),str(bad)],'expectedRevision':rev},error=True);assert tool('get_project')['assets']==[]
 imported=tool('import_assets',{'paths':[str(model),str(image)],'expectedRevision':rev});assert len(imported['assets'])==2
 model_id=next(x['id'] for x in imported['assets'] if x['type']=='sceneModel');image_id=next(x['id'] for x in imported['assets'] if x['type']=='image')
 inspected=tool('inspect_scene_asset',{'assetId':model_id});assert inspected['bounds']['size']==[1,1,1] and inspected['triangles']==12
 assert tool('inspect_scene_asset',{'assetId':image_id})['pixels']==[64,32]
 rev=tool('get_project')['revision'];created=tool('create_environment',{'name':'MCP校园','expectedRevision':rev});env=created['environment'];eid=env['id']
 operations=[{'op':'settings','background':'#96bcdf','camera':{'position':[0,3.5,10],'target':[0,1,-2],'fov':42},'lighting':{'intensity':2,'ambientIntensity':.4}},{'op':'add','kind':'model','ref':'building','assetId':model_id,'name':'教学楼','position':[0,0,-5],'scale':[6,3,2]},{'op':'add','kind':'model','ref':'left','assetId':model_id,'name':'左侧楼','position':[-4,0,-3],'scale':[1.5,2.5,4]},{'op':'add','kind':'model','ref':'right','assetId':model_id,'name':'右侧楼','position':[4,0,-3],'scale':[1.5,2.5,4]},{'op':'group','nodeIds':['building','left','right'],'ref':'school','name':'校园建筑'},{'op':'add','kind':'imagePlane','assetId':image_id,'name':'远景图片墙','position':[0,4,-12],'width':22,'height':11},{'op':'add','kind':'light','name':'庭院灯','position':[0,4,2],'intensity':6,'distance':15,'castShadow':True},{'op':'add','kind':'sky','color':'#96bcdf'}]
 arranged=tool('edit_environment',{'environmentId':eid,'expectedRevision':created['revision'],'expectedEnvironmentRevision':env['revision'],'operations':operations});assert arranged['undoSteps']==1
 env=arranged['environment'];assert next(n for n in env['nodes'] if n['id']==arranged['refs']['left'])['worldPosition']==[-4,0,-3]
 before=json.dumps(env,sort_keys=True)
 tool('edit_environment',{'environmentId':eid,'expectedRevision':arranged['revision'],'expectedEnvironmentRevision':env['revision'],'operations':[{'op':'settings','name':'不应留下'},{'op':'add','kind':'model','assetId':'missing'}]},error=True)
 assert json.dumps(tool('get_environment',{'environmentId':eid})['environment'],sort_keys=True)==before
 tool('edit_environment',{'environmentId':eid,'expectedRevision':0,'expectedEnvironmentRevision':env['revision'],'operations':[{'op':'settings','name':'不可覆盖'}]},error=True)
 tool('undo',{'expectedRevision':arranged['revision']});context=tool('get_project');assert len(tool('get_environment',{'environmentId':eid})['environment']['nodes'])==1
 redone=tool('redo',{'expectedRevision':context['revision']});assert len(tool('get_environment',{'environmentId':eid})['environment']['nodes'])==len(env['nodes'])
 assigned=tool('set_environment_reference',{'target':'act','actId':'test-act','environmentId':eid,'expectedRevision':redone['revision']});assert tool('get_act',{'actId':'test-act'})['act']['steps'][0]['text']==project['acts'][0]['steps'][0]['text']
 assigned=tool('set_environment_reference',{'target':'title','environmentId':eid,'expectedRevision':assigned['revision']})
 assert tool('open_environment',{'environmentId':eid})['opened']
 captured=tool('capture_environment',{'environmentId':eid,'view':'game'},raw=True);picture=next(x for x in captured['content'] if x['type']=='image');(out/'mcp-arranged.png').write_bytes(base64.b64decode(picture['data']));assert picture['mimeType']=='image/png'
 # Clean open window must refresh for a subsequent MCP mutation and undo/redo.
 read=tool('get_environment',{'environmentId':eid});edited=tool('edit_environment',{'environmentId':eid,'expectedRevision':read['revision'],'expectedEnvironmentRevision':read['environment']['revision'],'operations':[{'op':'update','nodeId':arranged['refs']['left'],'patch':{'rotationDegrees':[0,10,0]}},{'op':'snap','nodeIds':[arranged['refs']['left']],'gridSize':.01}]})
 assert tool('get_environment',{'environmentId':eid})['environment']['revision']==edited['environment']['revision']
 undone=tool('undo',{'expectedRevision':edited['revision']});tool('redo',{'expectedRevision':undone['revision']})
 Path(str(report)+'.agent-window-edit').write_text('test');author=wait_file(Path(str(report)+'.agent-window-edit.json'));assert author['ok']
 current=tool('get_environment',{'environmentId':eid});assert current['unsavedInEnvironmentEditor'] and current['environment']['name'].endswith('作者未保存')
 tool('edit_environment',{'environmentId':eid,'expectedRevision':current['revision'],'expectedEnvironmentRevision':current['environment']['revision'],'operations':[{'op':'settings','name':'不能丢弃作者修改'}]},error=True)
 assert tool('get_environment',{'environmentId':eid})['environment']['name']==current['environment']['name']
 tool('sync_environment_editor');current=tool('get_environment',{'environmentId':eid});assert not current['unsavedInEnvironmentEditor'] and current['environment']['name'].endswith('作者未保存')
 tool('save',{'expectedRevision':current['revision']});assert not tool('get_project')['dirty']
 captured=tool('capture_environment',{'environmentId':eid,'view':'game'},raw=True);(out/'mcp-final.png').write_bytes(base64.b64decode(next(x for x in captured['content'] if x['type']=='image')['data']))
 exported=out/'exported-game';tool('export_game',{'directory':str(exported),'expectedRevision':current['revision']});saved=json.loads((exported/'game/project.json').read_text(encoding='utf-8-sig'));assert saved['environments'][0]['name'].endswith('作者未保存') and saved['acts'][0]['environmentId']==eid
 archives=list((out/'archives').glob('*.vrmg'));assert len(archives)==1
 with zipfile.ZipFile(archives[0])as z:assert all(x.flag_bits&1 and x.compress_type==99 for x in z.infolist())
 assert hashlib.sha256(model.read_bytes()).hexdigest()==original
 records={'ok':True,'protocolTools':len(tools),'glbImport':True,'invalidGlbBatchRejected':True,'realBounds':True,'pngDimensions':True,'atomicEdits':True,'staleWriteRejected':True,'batchUndoRedo':True,'worldPositionPreserved':True,'actAndTitleReference':True,'dialoguePreserved':True,'mcpImageContent':True,'openWindowRefresh':True,'pendingAuthorEditsPreserved':True,'windowSync':True,'encryptedArchiveSaved':True,'exportedGame':str(exported),'sourcePreserved':True,'environmentId':eid,'archive':str(archives[0]),'nodeCount':len(saved['environments'][0]['nodes'])}
finally:
 Path(str(report)+'.agent-done').write_text('done')
 if host:
  host.stdin.close()
  try:host.wait(timeout=5)
  except subprocess.TimeoutExpired:host.terminate()
 if editor:
  try:editor.wait(timeout=20)
  except subprocess.TimeoutExpired:editor.terminate()
 (out/'checks.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False))
