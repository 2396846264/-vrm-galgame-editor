# 公民文艺生产综合自动化系统

当前 Windows 版本为 **0.0.89**，前端版本为 0.7.89。下载便携发行包请前往 [GitHub Releases](https://github.com/2396846264/-vrm-galgame-editor/releases/latest)。

本版包含航母编队出生、补给后再次起飞及源码结构整理。功能、使用和已知问题见 [发行说明](RELEASE_NOTES.md)、[0.0.89 说明](docs/release-0.0.89.md) 和 [航母操作](docs/carrier-0.0.89.md)。

## 开发与 Agent 规范

修改前必须阅读 [AGENTS.md](AGENTS.md)、[代码开发规范](代码开发规范.md) 和 [开发维护说明](docs/DEVELOPMENT.md)。结构整理记录见 [重构说明](docs/refactoring-2026-10-22.md)。

`src` 是前端与运行时，`Desktop` 是 Windows 宿主，`AgentHost` 是 MCP/Agent 接口；`scripts` 保留构建和回归工具。`legal`、`licenses` 和 `public/fonts` 是发行必要资源。

## 公开源码构建

准备 Node.js 22+、.NET SDK 10 和 Python 3。安装依赖后运行 `npm run check`、`npm run format:check`；`scripts/build-windows.ps1` 可生成独立开发身份并构建开发便携包。

开发身份与正式发行身份分开。开发包不能保证打开正式版加密工程；使用正式兼容程序请下载 Releases，保留自己的开发身份以便重开自己的开发工程。不要把私人构建资料、密钥或生成的 ProtectedBuildConstants.cs 提交到仓库。

原作者为“尸工U5十三世”。保留作者入口、署名和来源，第三方组件继续遵守各自许可；详见 [署名与二次开发约定](docs/AUTHOR_ATTRIBUTION.md)。
