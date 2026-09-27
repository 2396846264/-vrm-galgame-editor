# VRM Galgame 编辑器 · 0.0.1

[简体中文](README.md) · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md)

![VRM Galgame 编辑器功能示意图](docs/images/overview.svg)

用 VRM 3D 角色制作视觉小说的 Windows 编辑器。你可以安排人物、对白、动作、背景和音乐，在独立窗口试玩，再把作品导出成可游玩的游戏。上图是**功能示意图**，不是程序截图。

> **0.0.1 是本项目的公开版本号。**下载包现已更新到本地版 v0.7.7 的功能。公开版没有附带 VRM 人物、Mixamo 动作和示例故事素材；请导入你有权使用的素材。

本次更新：编辑器改为白色界面并可切换夜间模式；人物加载时显示转圈动画；人物鉴赏页把角色名字放进“角色详情”，长名字不会挡住人物；内置 HarmonyOS Sans SC 字体。默认对白框保留原样。

## 能做什么

| 功能 | 简单说明 |
| --- | --- |
| 角色与舞台 | 导入 VRM，设置登场位置、前后距离、动作、表情和镜头 |
| 剧情编辑 | 按“幕”组织对白、人物和背景，随时预览与试玩 |
| 声画素材 | 导入图片、视频背景、音乐和音效 |
| 画面效果 | 调整渲染效果；可开启所有角色共用的脚下阴影 |
| 保存与导出 | 把工程保存为单个 `.vrmg` 文件，导出可游玩的 Windows 游戏 |
| 玩家功能 | 游戏存档、自动存档、游玩进度和鉴赏内容 |

## 示例和效果图

下面是编辑器、标题画面和游玩画面的示例和效果图。图中的示例人物、背景等素材**不包含在公开下载包中**。

**剧情编辑示例**：在同一页安排幕、对白、人物与背景。

![剧情编辑示例和效果图](docs/images/editor-story.png)

**标题画面效果图**：展示作品打开时的菜单与 VRM 人物。

![标题画面示例和效果图](docs/images/title-screen.png)

**游玩画面效果图**：展示人物、背景与对白的组合效果。

![游玩画面示例和效果图](docs/images/gameplay.png)

![从素材到游戏的流程图](docs/images/workflow.svg)

## 下载与开始

1. 到 [GitHub Releases](https://github.com/2396846264/-vrm-galgame-editor/releases) 下载 `VRMGalgame-0.0.1-win-x64.zip`。
2. **解压整个压缩包**，双击里面的 `VRMGalgame.exe`。
3. 点击“新建”创建工程，或打开已有的 `.vrmg` 文件。
4. 在“素材”中导入你自己的 VRM、动作、图片和声音，再到“角色”和“剧情”里使用。
5. 点击“试玩”检查效果，完成后点击“导出游戏”。

系统要求：Windows 10/11 x64、Microsoft Edge WebView2 Runtime。程序包自带 .NET 运行环境。第一次运行时，请保留压缩包内的文件夹结构。

## 素材格式

| 用途 | 格式 |
| --- | --- |
| 角色 | `.vrm` |
| 动作 | `.vrma`、Mixamo `.fbx` |
| 图片 | `.png`、`.jpg`、`.jpeg`、`.webp` |
| 声音 | `.mp3`、`.wav`、`.ogg` |
| 视频背景 | `.mp4`、`.webm` |

公开版不内置第三方人物或动作素材。`.vrmg` 是包含剧情与素材的工程包，复制这一个文件即可转移工程。

界面使用 HarmonyOS Sans SC 字体，版权归 Huawei Device Co., Ltd.；完整授权文件在 `public/fonts/HarmonyOS_Sans_SC_LICENSE.txt`，下载包中位于 `web/fonts/`。

## 从源码构建

需要 Node.js、npm 和 .NET 10 SDK（Windows）。在仓库根目录运行：

```powershell
npm ci
npm run build
dotnet publish Desktop/Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
Copy-Item -Recurse dist publish/web
```

然后运行 `publish/VRMGalgame.exe`。需要 WebView2 Runtime；如果发布结果包含 `WebView2Loader.dll`，也请保留在 EXE 旁边。源码没有附带第三方 VRM、FBX 或示例游戏资源。

## 关于项目

这个仓库公开的是编辑器源码和说明。第三方依赖各自遵循原作者的许可；仓库没有附带第三方人物与动作，也没有在此提供项目源码的再授权许可。

作者 B 站：[尸工U5十三世的个人空间](https://b23.tv/krcyQ8I)


