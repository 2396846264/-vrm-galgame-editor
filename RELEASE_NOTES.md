# 0.0.12 · GLB 场景动画、对白触发与声音

环境里的 GLB 现在可以播放自带动画。每一句对白分别设置动作、是否播放、延迟秒数和声音，适合大炮后坐、开门、机械转动等场景。

- 读取 GLB 内实际存在的动画；本幕没有动画模型时自动隐藏按钮。
- “场景动画”小窗：勾选播放、选择动作、输入延迟、选择声音、试播与保存。
- 相同模型的多个物体分别设置，不占人物位置。
- 声音提前加载，在动作开始时播放；游戏菜单同时暂停动作、计时和声音。
- 切句时取消旧的延迟动作和声音，恢复模型原始姿势。
- 支持撤销、重做、复制对白、工程压缩包和独立游戏。

**[完整图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/GLB场景动画_v0.0.12.md)**

![动画设置窗口](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v012/animation-settings.png)

![小炮动画实际播放](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v012/cannon-playback.png)

Windows 编辑器、工程重新打开、独立游戏实际验证通过，包含真实音频播放与暂停。12 组源码检查通过。完整解压新版后打开原工程即可。

模型需要事先包含动画；静态 GLB 不会自动生成开火动作。本次不包含粒子烟雾或物理碰撞。程序包不附带第三方人物与模型文件。
