# 0.0.10 · 物品绑定、逐句登场与多人标题

VRM 和 Mixamo FBX 人物现在可以绑定 GLB 物品。每句对白独立安排左、中、右人物，标题画面可以添加更多人物，并可完全隐藏左边的 Logo 标题板。

- 角色页选择物品和骨骼；位置、旋转、缩放都有数字输入、粗调和细调。
- 支持手掌和左右手各手指关节，提供中文名字，只显示模型实际有的骨骼。
- 绑定时使用大画面旋转、平移、缩放视角，直接放大绑定部位；微调物品时保持当前镜头。
- 在每句对话里勾选物品是否显示，物品会跟着人物动作移动并参与场景阴影。
- 每句对白各自设置在场人物、动作和位置，移除原来的重复人物控制。
- 标题可以同时使用多个 VRM / FBX，并分别调整动作、位置、大小与物品。
- Logo 新增“不显示（留空）”，隐藏整块左侧标题板，保留底部菜单。
- 旧工程的站位和单个标题人物会转换保留；保存与导出支持新版设置。

完整步骤：[物品绑定与多人标题图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/物品绑定与多人标题_v0.0.10.md)。

![多人标题与留空 Logo](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v010/title-actors.png)

![FBX 绑定物品与粗调细调](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v010/fbx-prop.png)

![逐句设置在场人物](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v010/dialogue-cast.png)

![近看手掌绑定位置](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v010/binding-view.png)

![VRM 绑定物品](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v010/vrm-prop.png)

检查了实际人物与物品、十组源码检查、网页和 Windows 编译、工程保存重新打开、以及导出的独立游戏。绑定不会自动摆手指或自动让双手握枪，需要搭配合适动作。

下载 `VRMGalgame-0.0.10-win-x64.zip` 后完整解压，运行 `VRMGalgame.exe`。适用于 Windows 10/11 x64，需要 WebView2 Runtime，包内自带 .NET 环境。公开包不含截图中的第三方模型、动作和示例工程。
