import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(process.argv[2]||'');
if(!process.argv[2]||target===source)throw Error('Provide a fresh staged release directory');
const nuget=process.env.NUGET_PACKAGES||path.resolve(source,'../开发工具/nuget-packages');
const rows=[],licenses=path.join(target,'licenses');fs.mkdirSync(licenses,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function add(name,version,license,repository,files){
 const saved=[];
 for(const [input,relative]of files){
  const bytes=fs.readFileSync(input),output=path.join(licenses,relative);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  saved.push({file:relative.replaceAll('\\','/'),sha256:sha(bytes)});
 }
 rows.push({name,version,license,repository,files:saved});
}
const bundle=JSON.parse(fs.readFileSync(path.join(target,'web/third-party-components.json'),'utf8'));
for(const item of bundle.components){
 const dir=path.join(source,'node_modules',item.name),meta=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
 if(meta.version!==item.version||!['MIT','Apache-2.0'].includes(meta.license))throw Error('Unreviewed license: '+item.name);
 const legal=fs.readdirSync(dir).filter(f=>/^(LICENSE|NOTICE)(\.|$)/i.test(f));
 if(!legal.some(f=>/^LICENSE/i.test(f)))throw Error('Missing license: '+item.name);
 const repo=typeof meta.repository==='string'?meta.repository:meta.repository?.url||meta.homepage;
 add(item.name,item.version,meta.license,repo,legal.map(f=>[path.join(dir,f),'npm/'+item.name.replaceAll('/','_')+'/'+f]));
}
for(const [name,version,license,repo,file]of [
 ['fflate','0.8.2','MIT','https://github.com/101arrowz/fflate/tree/v0.8.2','fflate-0.8.2-LICENSE.txt'],
 ['SharpZipLib','1.4.2','MIT','https://github.com/icsharpcode/SharpZipLib/tree/v1.4.2','SharpZipLib-1.4.2-LICENSE.txt'],
 ['Ammo.js','via ammojs-typed 1.1.0','Zlib','https://github.com/kripken/ammo.js','ammo.js-LICENSE.txt'],
 ['Bullet Physics','via ammojs-typed 1.1.0','Zlib','https://github.com/bulletphysics/bullet3','Bullet-LICENSE.txt'],
 ['apple-design-skill','development design reference','MIT','https://github.com/dayviwong/apple-design-skill','apple-design-skill-LICENSE.txt']])
 add(name,version,license,repo,[[path.join(source,'legal/upstream',file),'upstream/'+file]]);
const deps=JSON.parse(fs.readFileSync(path.join(source,'Desktop/bin/Release/net10.0-windows/win-x64/VRMGalgame.deps.json'),'utf8'));
for(const prefix of ['runtimepack.Microsoft.NETCore.App.Runtime.win-x64/','runtimepack.Microsoft.WindowsDesktop.App.Runtime.win-x64/','Microsoft.Web.WebView2/']){
 const key=Object.keys(deps.libraries).find(k=>k.startsWith(prefix));if(!key)throw Error('Missing native component: '+prefix);
 const [rawName,version]=key.split('/'),name=rawName.replace('runtimepack.',''),dir=path.join(nuget,name.toLowerCase(),version);
 const files=fs.readdirSync(dir).filter(f=>/^(LICENSE|NOTICE|THIRD-PARTY-NOTICES)(\.|$)/i.test(f));
 if(!files.length)throw Error('Native license missing: '+name);
 add(name,version,name.includes('WebView2')?'BSD-3-Clause':'MIT',name.includes('WebView2')?'https://learn.microsoft.com/microsoft-edge/webview2/':'https://github.com/dotnet',files.map(f=>[path.join(dir,f),'native/'+name+'/'+f]));
}
add('AMD FidelityFX FSR','1 / GLSL adaptation','MIT','https://github.com/GPUOpen-Effects/FidelityFX-FSR',[[path.join(source,'licenses/AMD-FidelityFX-FSR.txt'),'AMD-FidelityFX-FSR.txt']]);
add('HarmonyOS Sans SC','1.0 / unmodified Regular and Bold','HarmonyOS Sans Fonts License','https://developer.huawei.com/consumer/en/design/resource/',[[path.join(source,'public/fonts/HarmonyOS_Sans_SC_LICENSE.txt'),'fonts/HarmonyOS_Sans_SC_LICENSE.txt']]);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const pdf=path.join(target,'web/pdf-resources');
for(const file of walk(pdf).filter(f=>/LICENSE/i.test(path.basename(f)))){
 const relative=path.relative(pdf,file).replaceAll('\\','/');
 add('PDF.js bundled resource: '+relative,'pdfjs-dist '+bundle.components.find(c=>c.name==='pdfjs-dist').version,'See original license','https://github.com/mozilla/pdf.js/tree/v6.3.289/external',[[file,'pdf/'+relative]]);
}
const index=['公民文艺生产综合自动化系统 0.0.70 — 第三方声明与许可',
 '本软件包含下列允许按相应条件商业分发的第三方作品。各项版权归原权利人所有。',
 '本软件的项目代码许可不得限制第三方许可赋予的权利；用户导入的模型、动作和媒体不在本清单授权范围。',
 '字体与 PDF：HarmonyOS 字体保持原样；标准西文字体由 Windows 提供。未附带 Liberation 字体或 QuickJS 沙箱。',
 '',...rows.map(r=>`${r.name} | ${r.version} | ${r.license}\n${r.repository}\n${r.files.map(f=>'licenses/'+f.file).join('\n')}`),'','以下为上述作品的许可与通知原文：'];
const seen=new Set();for(const row of rows)for(const file of row.files){if(seen.has(file.sha256))continue;seen.add(file.sha256);index.push('\n==================== '+file.file+' ====================\n',fs.readFileSync(path.join(licenses,file.file),'utf8').replaceAll('\0',''));}
fs.writeFileSync(path.join(licenses,'THIRD_PARTY_NOTICES.txt'),index.join('\n'));
fs.writeFileSync(path.join(licenses,'components.json'),JSON.stringify({release:'0.0.70',components:rows},null,2));
fs.writeFileSync(path.join(licenses,'icon-origin.json'),JSON.stringify({asset:'Desktop/app.ico (embedded in executable)',sha256:sha(fs.readFileSync(path.join(source,'Desktop/app.ico'))),source:'Publisher supplied GPT-generated artwork',evidence:'Publisher confirmation in this conversation on 2026-10-16',scope:'Publisher asset, not covered by third-party software licenses'},null,2));
const guide=`# 公民文艺生产综合自动化系统\n\nWindows 0.0.70\n\n运行 VRMGalgame.exe。请保留整个程序目录。首次运行需要 Microsoft Edge WebView2 Runtime。\n\n## 开始创作\n\n新建或打开 .vrmg 工程，导入自己有权使用的模型、动作、图片、声音与 PDF。工程内容和素材保存在工程包中，建议定期另存为备份。\n\n支持 VRM、FBX、PMX/PMD 人物与 VRMA、FBX、VMD 动作；可编排人物、表情、口型、自动眨眼和视线、对白、语音、音乐、选项、物品奖励及消耗。\n\n通过“编辑器”选择剧情、角色、场景、渲染、载具等页面。场景可使用灯光、模型、图片平面、天气及水面；载具按文件分别编辑，支持方块机体、预制功能组件、对称建造与空战试玩。\n\n剧情可插入新闻、事件、过场视频和空战幕；可配置标题、鉴赏、章节进度与 PDF 书库。玩家可使用存读档、自动播放与背包。文字默认每秒 5 字，Windows 游戏默认全屏，可从设置切回窗口。\n\n## 游戏 UI\n\n通过“游戏 UI”打开独立编辑器，可选“液态玻璃”“粉白星光”“青柠浅色”或“青柠深色”。所有皮肤共用同一布局、头像和操作功能，只改变按钮、对白框、滑动条等控件的外观。选择后立即预览，点击“保存并应用到工程”设置工程默认皮肤，保存重开及导出游戏均保留。\n\n游戏设置右上可即时切换皮肤，玩家偏好按工程保存在本机。主编辑区也预览实际游戏 UI，右下角拖动调整大小，双击恢复默认；保留 16:9，只显示一个缩放控件。姓名不设胶囊，设置分组标题不带深色底条。青柠皮肤使用绿色消息气泡、绿色按钮与滑动条，提供浅灰白色和深灰两种外观。\n\n## 自动幕名开场\n\n普通剧情幕开始时，场景加载完成后自动显示幕名条：从左侧带曲线缓动滑入，停留 0.8 秒，再沿原路向左退场，结束后才显示第一句对白并播放语音。开场条自动匹配当前皮肤，无需作者配置。连点不会跳过开场；幕内下一句不重复显示，读档直接恢复对白，返回标题或重新开始会清理旧动画。\n\n## 角色姓名颜色与头像\n\n在角色编辑器的角色设置中调整“姓名颜色”，每个角色单独保存并随游戏导出。默认粉色。头像侧身朝右，在原尺寸基础上放大约 10%，整体向右留出画面宽度 4% 的边距，靠近姓名并避开对白框圆角，不设垫底。对白框延伸到屏幕左边，底部占画面高度 26%，下方两个角为直角且无底边线，直接贴齐屏幕底部；头像顶部高出对白框；绘制范围独立保留头发和动作，实时头像画布向左扩至屏幕边缘，不改变头像大小或位置。资料库使用容纳完整标题与解锁说明的圆角长方形卡片。\n\n## 空战编排、弹道与机炮音效\n\n空战幕右侧与普通幕一样逐句选择对白，左侧只设置角色、名字、台词、配音与场外头像动作；“空战设置”固定在全部对白后。新增、复制、删除、上下移动对白均保留，角色无需放到场景。选中对白可直接预览实时模型头像，空台词也保持云中悬停；“试玩本幕”会按完整对白顺序进入空战。\n\n双方出生区相距 10 公里，同阵营每架飞机横向间隔至少 2 公里，数量较多时横向展开。敌机标签只显示与玩家的公里距离；命中反馈只显示“命中”。\n\n机枪、机炮和自卫炮塔的每发弹药显示白色轨迹，最大飞行距离 7 公里，并有轻微下坠。载具编辑器右侧按机炮型号设置当前飞机的开火音效，可从音效素材选择、上传和试听。每架飞机独立保存；同机同型号挂载共用音效，其他飞机互不影响。副炮仅在目标距离不超过 2 公里时开火，前向机炮弹道仍为 7 公里。\n\n“导出当前飞机”可生成携带机炮音效的 .vrmair 文件，其他作者可用“导入飞机文件”复用；导入会分配新的飞机和音效 ID。分享文件只是可选导出，日常工程和全部素材始终保存在一个 .vrmg 工程包中。\n\n每架方块飞机必须且只能安装一个驾驶员方块，位于机体中线 X=0，不会镜像复制。旧飞机会在原驾驶舱附近迁入驾驶员方块；新建空白飞机需自行安装。驾驶员方块被击毁立即坠机；原始整机方块损失（含脱落）达到 35% 也会坠毁。受损后重新检查机体连接，断开的机翼、尾段及所挂附件脱离并下落，坠机后的残骸继续下坠。\n\n对话未结束时飞机位置、AI、射击、碰撞与任务时间暂停，螺旋桨和云雾继续更新。最后一句退出后返还操纵，云雾在约 0.7 秒内散去，再进入战斗。空战读档仍从幕级检查点重新进入。第一人称建造的尖锥、棱锥和三角斜面体继续按摄像机方向放置，保留 R/T/Y 调整。\n\n## 编辑器语言\n\n在编辑器设置中选择简体中文、English 或日本語，立即生效并同步到打开的编辑器窗口。语言偏好保存在本机，重开后保留；工程名称、角色、对白、素材名称和游戏内容保持原文。\n\n## 试玩与导出\n\n“试玩”打开独立临时游戏窗口。“导出游戏”生成 Windows 游戏文件夹，分享时复制整个目录。第三方许可随游戏一起导出，不要删除 licenses。旧工程中的已导入动作继续可用；本发行版不附送第三方动作或人物素材库。\n\nPDF 文档的嵌入字体正常读取；缺省西文字体使用 Windows 系统字体，未启用 PDF JavaScript 或 XFA 脚本表单。\n\n## Agent 创作接口\n\n软件附带 VRMGalgame.Agent.exe，可供用户自行连接 Agent/MCP 服务。是否使用云端模型取决于用户选择的外部服务，程序不内置生成模型。场景批量几何体建造仅在 Agent 接管场景窗口时开放。\n\n## 许可\n\n欢迎页、编辑器设置和游戏设置均可打开“第三方声明与许可”。详细清单、版本、许可全文见 licenses/THIRD_PARTY_NOTICES.txt 和 licenses/components.json。\n\n程序图标由发行者确认使用 GPT 生成；其来源确认单见 licenses/icon-origin.json。导入素材的商业使用和再分发权需由制作者自行确认。\n`;
fs.writeFileSync(path.join(target,'使用说明.md'),guide+'\n\n'+fs.readFileSync(new URL('../docs/naval70-guide.md',import.meta.url),'utf8'));
fs.writeFileSync(path.join(target,'公民文艺生产综合自动化系统.bat'),'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0VRMGalgame.exe"\r\n');
console.log(`Commercial release notices prepared for ${rows.length} component entries.`);
