# 0.0.52：文字显示修复与 Agent 场景搭建

## 使用

运行 `VRMGalgame.exe`。打开 `Agent二次元场景示例_0.0.52.vrmg`，进入场景环境编辑器，通过“打开”选择“Agent几何体港口”或“Agent花园住宅”。港口已经绑定第一幕，庭院作为独立场景文件保存在同一工程中。

载具零件卡片按完整名称、说明自动撑开；底部区域可滚动。幕列表标题与按钮分开，四个新增按钮保持单行文字。

## Agent 专用能力

开启工程的本地 Agent/MCP 接口后，Agent 可以调用 `build_environment_geometry`，不需要模型导入即可搭建彩色立体场景。

1. `get_capabilities` 查看支持的形状、限制及版本。
2. `create_environment` 新建场景，或通过 `get_environments` 选择已有场景。
3. `open_environment` 打开指定场景编辑器。窗口必须空闲；用户尚未保存的编辑先用 `sync_environment_editor` 保存，随后重新读取版本。
4. `get_environment` 读取环境版本；调用 `build_environment_geometry` 时同时提供工程的 `expectedRevision`、环境的 `expectedEnvironmentRevision`。
5. 用 `capture_environment` 检查实际构图，再调整。使用 `set_environment_reference` 指定幕或标题场景，最后 `save` 保存。

每次几何体写入都会短暂独占指定场景编辑器，操作结束交还控制。未打开指定场景、正在操作、存在未保存编辑或版本过期时，写入被拒绝。普通用户界面没有块体创建、形状选择、单块配色入口；用户仍可查看、整体移动、复制和删除生成的整组场景。

支持 `box`、`sphere`、`cylinder`、`cone`、`pyramid`、`wedge`、`capsule`、`torus`、`arch`。`position` 是几何体中心，`size` 为包围尺寸，单位米；`rotationDegrees` 是 XYZ 欧拉角，单位度。每个几何体独立设置 `#RRGGBB` 颜色。整组也有独立位置、旋转、缩放，可放入已有分组。

`mode` 包含 `create`（新建）、`append`（追加）、`replace`（替换整组内容）、`update`（按块体 ID 修改）、`remove`（按块体 ID 移除）。返回整组 ID 与数量摘要。`get_environment_geometry` 分页读取块体，默认100个、最多500个。

批量铺设示例：

```json
{
  "environmentId": "读取到的环境ID",
  "expectedRevision": 12,
  "expectedEnvironmentRevision": 0,
  "mode": "create",
  "name": "棋盘草地",
  "gridSize": 0.25,
  "primitives": [{
    "shape": "box",
    "position": [-10, 0, -10],
    "size": [0.5, 0.25, 0.5],
    "repeat": {
      "count": [40, 1, 40],
      "spacing": [0.5, 0, 0.5],
      "colorPalette": ["#789269", "#84996f"],
      "colorMode": "checker"
    }
  }]
}
```

每次最多2000份定义；每个场景总计最多30000个几何体、200万三角面。重复定义可一次生成大量块体，实例渲染按形状合并。每次修改是一个可撤销操作，参数验证失败时整批取消。工程保存、重新打开、游戏预览与导出共用同一套场景数据。

## 参考场景

参考来自吉卜力公开的官方静止画：港口参考《虞美人盛开的山坡》，庭院参考《借东西的小人阿莉埃蒂》。示例是提取布局和色彩的原创几何体练习，不含原画、外部模型或贴图。

具体对照结果见 `scene-comparison.md`。这是可编辑的风格化几何体场景；目前还没有手绘背景的纹理、轮廓线与复杂植被细节。
