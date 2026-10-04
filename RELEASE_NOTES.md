# 0.0.11 · 修复 Mixamo 动作姿势

导入 Mixamo 的跪姿瞄准动作时，旧版会额外改变 FBX 手臂角度，并把第一帧的腰部高度抬回站姿。本版修复这两处动作转换问题，保留作者的物品绑定设置。

- FBX 使用正确的骨骼绑定基准，避免重复修正手臂、手掌角度。
- FBX / VRM 保留跪姿、坐姿的初始腰部高度。
- 保留另一类导出文件的局部骨骼方向，以及手掌、手指的物品跟随。
- 旧工程、逐句人物设置、多人标题与环境编辑器继续可用。

实际核对同一人物的跪姿瞄准、敬礼和坐姿鼓掌动作。瞄准动作的 1,312 个旋转关键点，最大差异小于 0.001 度。Windows 实际渲染、物品绑定及 11 组源码检查通过。

**[完整图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/Mixamo动作修复_v0.0.11.md)**

修复前：

![旧版手臂姿势](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v011/editor-before.png)

修复后，同一 FBX 人物与同一段动作：

![修复后的 FBX 动作](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v011/fbx-after.png)

VRM 也保留跪姿高度：

![VRM 动作](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v011/vrm-after.png)

完整解压新版，打开原工程即可，已有动作无需重新下载。若以前为了错误姿势调整过枪的位置，动作恢复后可在角色页重新微调。另一只手仍需配合合适的持物动作。

程序包不附带示例人物、武器或第三方动作文件。
