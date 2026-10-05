# 0.0.15 · MCP 环境场景布置

现在可以通过连接的 Agent 布置三维环境：导入 GLB / 图片，查看模型大小，批量摆放、旋转、缩放、分组、吸附，设置地面、远景、灯光、天空球和游戏镜头，再指定给幕或标题。

- 新增 9 个环境接口，总计 23 个 MCP 工具；原来的剧情功能保留。
- 新增“复制场景布置任务”按钮；MCP 能返回实际环境窗口 PNG。
- 每批布置支持一次撤销；错误整批取消，保护作者未保存修改。
- 环境随原工程包保存，重新打开和导出游戏正常。
- 保留 VRM 肩部实时头像、自动保存、天空描边修复与既有功能。

**[完整图文说明和使用步骤](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/MCP环境布置_v0.0.15.md)**

![实际 MCP 布置窗口](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v015/mcp-environment.png)

17 组源码检查、Windows 构建、真实 MCP 双窗口操作、加密工程重开、独立游戏验证通过。

完整解压新版。MCP 配置需要指向新版文件夹里的 `VRMGalgame.Agent.exe`。本次场景导入使用贴图内嵌 GLB 和图片，FBX/OBJ 场景请先转 GLB。
