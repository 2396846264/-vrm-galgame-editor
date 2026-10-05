# 0.0.16 · FBX 自动生成静态头像

FBX 人物没有头像时，现在会自动拍成一张透明 PNG。拍摄方向、头肩范围和显示尺寸与 VRM 一样。**FBX 头像是静态图片，不跟随动作变化；VRM 原来的实时头像保持原样。**

- 新建角色、选择 FBX 模型或打开旧工程时，自动补上缺少的头像。
- 角色页新增“重新生成 FBX 头像”，支持先选身体动作和定格帧再拍照。
- 自动生成保留手动上传的 PNG；主动重拍可以替换当前头像。
- 头像跟随工程包保存，导出的游戏使用同一张图片。
- 保留 0.0.15 的 MCP 环境布置及已有功能。

**[完整图文说明](https://github.com/2396846264/-vrm-galgame-editor/blob/main/docs/FBX静态头像_v0.0.16.md)**

![FBX 头像和重新生成按钮](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v016/editor-fbx-portrait.png)

![独立游戏中的静态头像](https://raw.githubusercontent.com/2396846264/-vrm-galgame-editor/main/docs/images/v016/player-fbx-portrait.png)

用“贝当元帅.fbx”验证了自动生成、手动图片保护、重拍、工程重开和独立游戏。18 组源码检查、网页与 Windows 构建通过。

完整解压新版，双击 `VRMGalgame.exe`，打开原工程即可。旧的独立游戏需重新导出。下载包不包含示例人物、Mixamo 动作或用户工程。
