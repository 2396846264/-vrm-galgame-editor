# VRM Galgame 编辑器 · 公开版 0.0.3

[简体中文](README.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

把自己准备的角色、图片、声音和文字，做成可以玩的 Windows 故事游戏。当前公开版 **0.0.3** 包含本地 **v0.7.11** 的功能。

**第一次使用？先看 [图文说明书](docs/新手说明书.md)。** 它从下载、准备素材到导出游戏一步一步讲清楚。

## 下载

到 [Releases 下载最新版](https://github.com/2396846264/-vrm-galgame-editor/releases/latest)，下载 `VRMGalgame-0.0.3-win-x64.zip`。把 ZIP **完整解压**，再双击文件夹里的 `VRMGalgame.exe`。适用于 Windows 10/11 x64，需要 Microsoft Edge WebView2 Runtime；下载包自带 .NET 运行环境。

> 公开包不附带示例人物、背景、Mixamo 动作或故事工程。下列图片是**示例与效果图**，展示做出来可以是什么样子；请使用自己有权使用的素材。

## 示例与效果图

**剧情编辑：**左边排故事，右边改细节，中间看画面。

![剧情编辑示例与效果图](docs/images/editor-story.png)

**标题画面：**玩家打开游戏时看到的菜单。

![标题画面示例与效果图](docs/images/title-screen.png)

**游玩画面：**角色、背景和对白放在一起。

![游玩画面示例与效果图](docs/images/gameplay.png)

**新版白色编辑器：**角色鉴赏、头像和动作定格时间都能在角色页设置。

![新版角色页面示例与效果图](docs/images/character-gallery-v0711.png)

更多步骤和截图：[打开图文说明书](docs/新手说明书.md)。

## 这版增加了什么

- 阴影从脚边开始；站着说话时可以固定脚掌，较大的动作也不会随意把人物带离站位。
- “渲染”里增加油画笔触，可同时处理人物和背景；不需要时可以关掉。
- 可以建立只有头像、没有 VRM 模型的角色。场外人物说话时只显示头像、名字和台词。
- 有 VRM 的角色可以自动拍透明的头肩头像；头像会跟随角色鉴赏选定的动作及**动作定格时间**更新，手动上传的头像不会被覆盖。
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
