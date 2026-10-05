# 0.0.17 · 下一幕预加载与小号 FPS

在本幕最后三句提前准备下一幕，按玩家当前实际帧数自动调整：**高于 55 完整、30～55 部分、低于 30 不开始预加载。** 不读取电脑硬件配置。

- 左上角用很小、半透明的数字显示 FPS，预加载转圈放在旁边。
- 部分预加载优先环境和开场人物、动作、物品、声音；完整预加载继续准备后续对白资源。
- 帧数下降暂停后续任务，恢复后继续；已准备资源在换幕时直接复用。
- 预加载不改变当前人物、镜头、环境或声音。分支目标不确定时不猜路线。
- 保留 FBX 静态头像、VRM 实时头像、MCP 环境布置和既有功能。

**[完整图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/按帧数预加载_v0.0.17.md)**

![FPS 与预加载提示](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v017/player-preloading.png)

![切换后的场景和小号 FPS](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v017/player-fps.png)

19 组源码检查、Windows 构建、真实模型准备与复用、工程重开、独立游戏通过。大型素材或快速点击仍可能存在剩余等待。完整解压新版打开原工程，旧游戏需重新导出。
