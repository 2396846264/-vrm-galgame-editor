from pathlib import Path
import shutil,json,os,zipfile,hashlib,re
root=Path.cwd();evidence=Path(os.environ['AGENT_EVIDENCE']);app=Path(os.environ['AGENT_APP']);release=root/'新版_v0.7.29_剧情助手与Agent'
assert not release.exists(),'Release exists; inspect rather than overwrite.'
checks=json.loads((evidence/'checks.json').read_text(encoding='utf-8'));assert checks['ok']
player=json.loads((evidence/'generated-player.menu-agent-player.json').read_text(encoding='utf-8'));assert player['ok']
reopen=json.loads((evidence/'reopen.json').read_text(encoding='utf-8'));reopen=json.loads(reopen) if isinstance(reopen,str) else reopen;assert not reopen['stageError']
release.mkdir()
for name in ['VRMGalgame.exe','VRMGalgame.Agent.exe','WebView2Loader.dll','web.integrity.json']:shutil.copy2(app/name,release/name)
for name in ['web','preset-motions']:shutil.copytree(app/name,release/name)
shutil.copytree(root/'docs',release/'docs')
shutil.copytree(root/'新版_v0.7.28_反馈群与加密工程'/'licenses',release/'licenses')
for guide in root.glob('新功能说明_v*.md'):shutil.copy2(guide,release/guide.name)
shutil.copy2(root/'新功能说明_v0.7.29.md',release/'本版新功能说明.md');shutil.copy2(root/'README.md',release/'使用说明.md');shutil.copy2(root/'Agent粗稿格式示例.json',release/'Agent粗稿格式示例.json')
# A sample with no assets is intentionally importable into any fresh project.
(release/'小说大纲示例.txt').write_text('第一幕 雨中的港口\n绯音是港口的引路人，澄夏拿着一封神秘来信。雨越下越大，绯音催促澄夏离开。\n绯音：我们必须马上离开！\n澄夏：等一下，我还没有看完信。\n随后插入一条世界新闻：远方边境已经封锁，船只不得驶向北方。\n第二幕 客舱\n两人进入客舱，研究来信，发现这次封锁与一艘失踪的船有关。\n',encoding='utf-8-sig')
shutil.copy2(root/'新版_v0.7.28_反馈群与加密工程'/'世界新闻事件示例.vrmg',release/'世界新闻事件示例.vrmg')
(release/'启动编辑器.bat').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0VRMGalgame.exe"\r\n')
(release/'先看这里.txt').write_text('v0.7.29：剧情助手与 Agent 接口\n1. 双击 VRMGalgame.exe，先新建或打开工程。\n2. 顶部点击“剧情助手”，导入小说、大纲和素材。\n3. AI 编排需要连接你自己的 Agent；点击开启本地 Agent 接口，复制 MCP 配置到 Agent。\n4. 复制编排任务给 Agent，检查并采用粗稿，再试玩。\n5. 没有 Agent 时，可快速拆分剧本或导入 JSON 粗稿；快速拆分不是 AI。\n6. 详细操作见“本版新功能说明.md”。\n7. 需要完整解压，EXE、Agent 程序、DLL、web、web.integrity.json 和预制动作必须放在一起。\n',encoding='utf-8-sig')
for entry in ['index.html','player.html']:
    for path in re.findall(r'(?:src|href)="([^"]+)"',(release/'web'/entry).read_text(encoding='utf-8')):
        if path.startswith('./'):assert (release/'web'/path[2:]).is_file(),path
motions=json.loads((release/'preset-motions'/'manifest.json').read_text(encoding='utf-8'));assert len(motions)==79
with zipfile.ZipFile(release/'世界新闻事件示例.vrmg') as z:assert all(i.flag_bits&1 and i.compress_type==99 for i in z.infolist())
checks.update(version='0.7.29',generatedPlayer=player,encryptedProjectReopened=True,previousHistoryVoiceMouthTests=True,presetMotionCount=79)
(release/'本版检查结果.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
target=root/(release.name+'_完整包.zip');assert not target.exists()
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in release.rglob('*'):
        if f.is_file():z.write(f,release.name+'/'+f.relative_to(release).as_posix(),compress_type=zipfile.ZIP_STORED if f.suffix=='.vrmg' else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(target) as z:assert z.testzip() is None
print(json.dumps(dict(release=str(release),zip=str(target),bytes=target.stat().st_size,sha256=hashlib.file_digest(target.open('rb'),'sha256').hexdigest()),ensure_ascii=False))
