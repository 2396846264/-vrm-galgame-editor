# VRM Galgame 编辑器 · 公开版 0.0.5

[简体中文](README.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

把自己准备的角色、图片、声音和文字，做成可以玩的 Windows 故事游戏。当前公开版 **0.0.5** 包含本地 **v0.7.13** 的功能。

**第一次使用？先看 [图文说明书](docs/新手说明书.md)。** 它从下载、准备素材到导出游戏一步一步讲清楚。

## 下载

到 [Releases 下载最新版](https://github.com/2396846264/-vrm-galgame-editor/releases/latest)，下载 `VRMGalgame-0.0.5-win-x64.zip`。把 ZIP **完整解压**，再双击文件夹里的 `VRMGalgame.exe`。适用于 Windows 10/11 x64，需要 Microsoft Edge WebView2 Runtime；下载包自带 .NET 运行环境。

> 公开包不附带示例人物、背景、Mixamo 动作或故事工程。下列图片是**示例与效果图**，展示做出来可以是什么样子；请使用自己有权使用的素材。

## 示例与效果图

**剧情编辑：**左边排故事，右边改细节，中间看画面。

![剧情编辑示例与效果图](docs/images/editor-story.png)

**标题画面：**玩家打开游戏时看到的菜单。

![标题画面示例与效果图](docs/images/title-screen.png)

**游玩画面：**角色、背景和对白放在一起。

![游玩画面示例与效果图](docs/images/gameplay.png)

**白色编辑器示例：**这张截图拍摄于上一版；最新版把“定格时间”改成了“定格帧”。

![新版角色页面示例与效果图](docs/images/character-gallery-v0711.png)

**最新版控件示意图：**阴影高度统一调节；动作可拖动滑块或输入帧号。

![阴影高度与定格帧功能示意图](docs/images/shadow-frame-controls.svg)

更多步骤和截图：[打开图文说明书](docs/新手说明书.md)。

## 这版增加了什么

- 素材库固定在预览画面下方，内容多时在素材库里滚动；图片直接显示缩略图。
- 游戏中的按钮有点击声，可在标题画面选择自己的音效；每句对白也能配一个场景音效。玩家可在游戏设置里调节音效音量。
- 对白逐字出现，玩家可在游戏设置里调节出现速度。点一下先显示全句，再点一下才进入下一句。
- 用户提供的 64 个示例素材留在本地交付工程包中，公开版不包含这些素材。
- “渲染 → 角色阴影”增加统一的阴影水平高度滑块。脚底和影子隔开时可以抬高影子；旧工程保持原来的高度。
- 角色动作改为按“第几帧”定格，显示总帧数，还可以直接输入帧号。旧工程中的秒数会自动换算。
- 阴影从脚边开始；站着说话时可以固定脚掌，较大的动作也不会随意把人物带离站位。
- “渲染”里增加油画笔触，可同时处理人物和背景；不需要时可以关掉。
- 可以建立只有头像、没有 VRM 模型的角色。场外人物说话时只显示头像、名字和台词。
- 有 VRM 的角色可以自动拍透明的头肩头像；头像会跟随角色鉴赏选定的动作及**动作定格帧**更新，手动上传的头像不会被覆盖。
- 保留白色界面、夜间模式、人物加载转圈、内置 HarmonyOS Sans SC，以及原来的默认对白框。

完整变化见 [更新记录](CHANGELOG.md)。

## 素材小抄

| 想放什么 | 允许的文件 |
| --- | --- |
| 3D 人物 | `.vrm` |
| 动作 | `.vrma`、Mixamo `.fbx` |
| 背景、头像等图片 | `.png`、`.jpg`、`.jpeg`、`.webp` |
| 音乐、音效 | `.mp3`、`.wav`、`.ogg` |
| 视频背景 | `.mp4`、`.webm` |
| 编辑器工程 | `.vrmg`（由编辑器创建和保存） |

推荐尺寸、命名方法、注意事项和常见问题都在 [图文说明书](docs/新手说明书.md)。

## 从源码构建

需要 Windows、Node.js、npm 和 .NET 10 SDK。在仓库根目录运行：

```powershell
npm ci
npm run build
dotnet publish Desktop/Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
Copy-Item -Recurse dist publish/web
```

保留 `publish` 中的 EXE、`WebView2Loader.dll` 和 `web` 文件夹。字体的授权文件见 [HarmonyOS Sans SC 授权](public/fonts/HarmonyOS_Sans_SC_LICENSE.txt)。第三方依赖遵循各自的许可；本仓库未对项目源码另附再授权许可。

作者 B 站：[尸工U5十三世的个人空间](https://b23.tv/krcyQ8I)
