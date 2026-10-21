# GitHub 写实海面与水下效果调研

调研日期：2026-10-21。只读取公开仓库说明、代码入口和许可证，没有把外部水面代码或素材接入发行包，也没有在本软件中测这些项目的帧率。以下效果清单来自项目自身说明；适配优先级是结合本软件代码作出的判断。

当前软件使用 Three.js 0.180、WebGLRenderer、Windows WebView2；海战现有水面、舰船尾迹、水中弹、航母甲板和舰队 AI 都已有独立实现。海平面及炮弹入水判定目前以 Y=0 为基准，舰船浮高也不是按波浪实时采样。升级真实几何波浪时必须统一视觉海面高度、浮力、入水检测和移动甲板高度，否则会出现船漂浮、海浪穿甲板、炮弹在错误位置入水。

| 项目 | 自述能力 | 代码许可 | 对本软件的判断 |
| --- | --- | --- | --- |
| [OceanThreejs](https://github.com/achrefelouafi/OceanThreejs) | Three.js r185 / WebGL2；FFT 加 Gerstner 涌浪、波峰泡沫、HDR 天空反射、深度折射 | [MIT](https://github.com/achrefelouafi/OceanThreejs/blob/main/LICENSE) | **优先做海战海面原型验证**。波浪、材质、计算拆成模块，容易逐项比较；需要浮点渲染目标扩展，并检查 r185 到本软件 r180 的 API 差异。没有船只、天气或玩法，不能直接替代现有海战系统。 |
| [ABYSSAL](https://github.com/squall01337/abyssal-ocean) | Three.js / WebGL2；三层 FFT、持续泡沫、屏幕空间反射、海底焦散、水下雾与斯涅尔窗口、浮标 | [MIT](https://github.com/squall01337/abyssal-ocean/blob/main/LICENSE) | **海面加水下效果的重点参考**。作者列出的默认配置为每层 512² FFT、共三层，径向网格 480×720，不能直接假定适合多舰多机战斗。单 HTML 演示需要拆模块、降档、重做资源生命周期。 |
| [Three.js 官方 Water](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water.js) | 平面反射、法线水纹、菲涅耳与太阳高光 | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | **接入成本较低的保底路线**。当前 node_modules 中已有同系组件，可先改善反射和水色，再自行加低成本几何波浪。它本身不是完整 FFT 海洋，也不提供舰船浮力或完整水下体积。引用 dev 页面仅作技术入口，实际接入应使用本项目锁定版本。 |
| [jbouny/fft-ocean](https://github.com/jbouny/fft-ocean) | WebGL / Three.js FFT 位移与法线贴图，屏幕空间投影海面网格 | [MIT](https://github.com/jbouny/fft-ocean/blob/master/LICENSE) | 可研究投影网格及 FFT 海面组织方式；代码入口是旧式 Three.js demo，需要迁移旧 API。仓库列出的船模、天空盒和声音不要未经逐项确认就随代码带入发行包。 |
| [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water) | Evan Wallace 水体演示的 Three.js 移植；交互波纹、焦散、反射折射、池体形状、GLTF、简化浮力 | [MIT](https://github.com/jeantimex/threejs-water/blob/main/LICENSE) | 更适合池塘、港口近景与小范围交互研究。其 README 明确说明部分物体光学使用包围球近似，不应把“raytraced”理解为任意复杂战舰的完整精确光追。 |
| [martinRenou/threejs-caustics](https://github.com/martinRenou/threejs-caustics) | Three.js 焦散计算及配套演示 | [BSD-3-Clause](https://github.com/martinRenou/threejs-caustics/blob/master/LICENSE.txt) | 可单独研究水底亮斑；不应当成完整远洋方案。其许可是 BSD-3-Clause，不是 MIT。 |
| [Poseidon](https://github.com/owenyuwono/poseidon) | Three.js / WebGPU / TSL；三层 Tessendorf FFT 与水体光学 | [MIT](https://github.com/owenyuwono/poseidon/blob/main/LICENSE) | 作为后续 WebGPU 路线参考。README 明确写了 WebGPU-only、没有 WebGL 回退；当前不宜为了海面单独更换整个渲染后端。天空图片还另列了素材许可。 |

## 建议的下一步

先以 **OceanThreejs** 做单独的 WebGL2 海战验证场景，与当前青蓝色水面同镜位比较；重点验证多舰、多机、炮弹、水柱和尾迹同时存在时的 GPU 时间、显存和 WebView2 稳定性。再从 ABYSSAL 研究水下吸收雾、焦散、泡沫累计与水面内外过渡，避免一次性照搬其整套天空、后处理和高精度网格。

保留现有风格水面作为低配置选项。若 FFT 预算过高，可先用官方 Water 的反射方案配合少量 Gerstner 波，实现中档质量。以上是代码与架构上的适配判断，尚未构成性能验证或最终选型。

许可文件已逐项查看；若后续实际采用，需记录采用的提交、保留许可证和来源声明，并单独确认演示素材的使用范围。此次仅调研，不新增任何第三方依赖。
