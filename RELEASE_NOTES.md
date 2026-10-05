# 0.0.13 · 天空描边修复、自动保存与实时头像

修复打开任意程度描边后天空球变黑的问题；增加环境编辑器自动保存，改善暗场景人物光照，把 VRM 对话头像改成同步嘴型与表情的实时模型。

- 天空球跳过描边，保留纯色天空与全景贴图；人物和场景物体继续描边。
- 环境编辑器每 10 分钟自动保存：倒计时、提前 5 秒提示、保存动画和失败重试。
- 工程包后台压缩；等待拖拽和输入结束再自动保存，保存期间保护文件操作。
- 移除旧的背景自动配光选项，人物跟随 3D 灯光；环境中增加“补光亮度”。
- VRM 实时头像拍摄同一个模型，同步嘴型、眨眼和表情；FBX 保留图片头像。
- 保留旧工程、GLB 场景动画、Mixamo 动作修复、物品绑定、逐句登场与多人标题。

**[完整图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/天空描边与实时头像_v0.0.13.md)**

![打开描边后天空保持正常](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v013/sky-outline.png)

![独立游戏的实时头像](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v013/live-portrait.png)

![保存时的提示](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v013/autosave-saving.png)

15 组源码检查、网页和 Windows 构建通过。实际验证纯色/贴图天空四档描边、真实嘴型变化、暗场景、约 118 MB 工程后台自动保存、工程包重开与独立游戏。

完整解压新版，再打开原工程即可。以前导出的游戏需要用新版重新导出。公开包不包含第三方人物与模型文件。
