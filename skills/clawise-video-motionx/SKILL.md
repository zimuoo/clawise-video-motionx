---
name: clawise-video-motionx
description: Use for editable motion graphics, product launch videos, animated explainers, UI demonstrations, kinetic typography and short loops; 动效视频、产品发布片、动画解说、动态图文、视频片头、指着画面改，或将 Clawise 生图、TTS 配音与山谦 AI 视频素材编排成可编辑短片。
license: MIT; bundled fonts and third-party notices retain their respective licenses.
---

# Clawise Video MotionX

把用户的内容变成可编辑、可预览、可导出的动画。默认使用真实产品素材和本地资源，交付工程与成片。

需要图片、声音、AI 视频时，读取 [multimedia.md](references/multimedia.md)：Clawise 图片插件生图，Clawise TTS 配音，已安装的 `shanqian-ai` 生成视频、数字人或混剪素材，MotionX 负责统一编排。按用户指定的能力执行；这些能力是可选协作项，不随安装器复制或自动启用。

## 入口和边界

- 当前技能目录记为 `<skill>`。通过 `node "<skill>/bin/motionx" <command>` 运行完整随包引擎；以下用 `motionx` 表示这条命令。始终把路径作为独立参数并引用含空格的路径。
- 先运行 `motionx doctor`。Node.js 22+，本机 Chrome/Chromium/Edge、FFmpeg、ffprobe 为必需环境；`MOTIONX_CHROME` 可指定浏览器。缺失时给出具体缺项及可继续做的源文件工作。
- 此技能负责代码动效和画面修改。用户明确要求 Remotion，或要长口播、复杂剪辑与现有 Remotion 工程时，使用对应技能；不要擅自迁移现有工程。
- 技能已包含模板、字体、时间轴和运行工具。不要自动安装外部技能、npm 包、模型或音色。安装损坏时重新安装完整包，不回退到其他作者的工具。
- 产品、工作台、生成说明均使用 Clawise 品牌；客户片内使用客户品牌。默认没有平台水印或强制片尾署名。版权与第三方声明保留在随包许可证文件中。

## 默认决策

信息不足时先从现有上下文、项目、截图和品牌资源推断并继续：产品短片默认 16:9、1920×1080、30 fps、约 12 秒；循环默认 5 秒且静音；竖屏社交内容用 1080×1920。写下假设。只有缺少关键素材、事实或授权导致无法继续时才询问。

已有工程先读 `index.html` 和 `.motionx/`，保留上一版有效修改。仅修改反馈涉及的内容。

## 制作流程

1. **理解内容并收集素材。** 明确一个观看后应记住的信息。`motionx grab <project-folder|url> <film-folder>` 可收集产品材料；优先项目中已有的 logo、UI 截图、录屏、图标、字体。产品功能、客户评价、数值均应有来源。缺素材时用明确标注的占位，不伪造真实截图或指标。
2. **定方向和分镜。** 阅读 [director.md](references/director.md) 和 [craft.md](references/craft.md)。直接选择适合内容的一套视觉方向，记录到工程的 `direction.md`；用户要比较时再出多个方向。用 3–5 个关键帧列出信息、主体、动作、镜头和时长。先确定构图，再加运动。
3. **建立工程。** `motionx templates` 查看可用模板；`motionx new <film-folder> --template <name>` 不覆盖已有 `index.html`。按内容选用 blank、keynote-ui、talking-head、kinetic-type、math-explainer、finance-chart、flat-science、editorial-collage、whiteboard、ui-space、object-3d 或 clawise-launch。模板是结构起点，替换其示例文案和素材。`motionx demo <folder> --no-open` 展示自带 Clawise 示例。
4. **生成并归档所需素材。** 插画、背景图用当前可用的 `image_generate`；先读取工具 schema，沿用 Clawise 已配置的图片模型。图生视频、数字人等读取实际安装的 `shanqian-ai/SKILL.md` 及相应参考，使用它自己的 helper。异步任务必须成功并取得实际本地文件，才能执行 `motionx asset <folder> --file <file> --id <name> --source <source>`。来源取 `clawise-image`、`clawise-tts` 或 `shanqian-ai`。命令返回相对路径和媒体信息，写入 `assets/media.json`；它归档素材，不自动改画面。详情及故障处理见 [multimedia.md](references/multimedia.md)。
5. **实现可编辑画面。** 阅读 [contract.md](references/contract.md)。用户会修改的标题、数值、颜色与停留时间声明成 composition variables；可点击对象设稳定 `data-mx-id`；分镜设 `scene:` labels。`motionx set title=… <folder>` 可改变量。使用 `asset` 返回的相对路径加入画面，并显式设置视频的片内起点、素材起点和时长；不依赖 CDN。
6. **先预览和检查。** `motionx studio <folder> --no-open` 启动本机预览，保留进程并给用户实际返回的 URL。运行 `motionx still <folder> --at 0.5,3,7`，用可用的图像查看工具检查实际图片；选时间应覆盖每个场景，不能只看首尾。运行 `motionx check <folder>`，处理错误；对剩余警告说明证据。不要把机械检查通过等同于创意完成。
7. **处理音频。** 优先使用用户录音；需合成时用 `clawise_tts_list_voices` 选择实际音色，再调用 `clawise_tts_synthesize`，读取其 `outputPath`。山谦克隆音色和数字人需求交由已安装的山谦技能处理，不假定它有独立的通用 TTS 动作。用 `motionx voice <folder> --audio <file> --text <script.txt> --asr off` 导入。只有允许片长跟随配音时才加 `--fit`；固定时长先校对实际音频长度与分镜，不能截断口播。`--asr off` 是估算词时间，必须试听修正。接口例子见 [voice.md](references/voice.md)。无配音的短片可用 `motionx sound <folder>` 本地合成配乐；静音循环用 `motionx sound <folder> --off`，渲染加 `--silent`。
8. **导出和交付。** 修改后重新 `check`，运行 `motionx render <folder> --workers 2`，再对实际视频运行 `motionx qa <folder>`。按需使用 `--blur`、`--format webm|mov|gif`；透明叠加用 `--transparent`。交付已存在的成片绝对路径、工程路径、预览地址、使用的素材来源和未解决的问题。只有用户需要分享材料时运行 `motionx share <folder>` 或 `motionx export html <folder>`；这些命令只生成本地文件。对外发布或上传需遵循用户授权。

## 指着画面改

工作台里点画面可标注对象、时间和修改意见。用 `motionx inbox <folder> --json` 查看待办，`motionx look <comment-id> <folder>` 获取原帧与局部图。对照源文件改完后重新截图与检查，`motionx done <comment-id> <folder> --note "具体改动"` 回写处理说明。

只有用户要求持续协作时才轮询评论；每次等待不超过 30 秒：`motionx inbox <folder> --wait --timeout 30`。超时退出码 3 表示没有新评论。不要无限阻塞等待，先交付当前结果并保持预览可用。`motionx undo <folder>` 可恢复上一版保存。

## 动效规则

- 时间是唯一输入：任意 seek 顺序都得到相同画面。使用暂停的 `MotionX.timeline`、`MX.clock`、`MX.space`；禁止依赖 wall clock、随机计时器或历史累积状态驱动成片。
- 同屏信息有主次，动作服务于理解：变化、关系、因果、反馈。留足阅读和结尾停留时间，避免全画面持续抖动。
- 不把截图裁到无法识别，不遮挡关键文字；长句优先重排布局，不能只缩小字号。
- 在内容可读与模型效果之间，优先可读性。复杂 3D 先证明单个镜头与任意 seek 可用。
- MotionX 时间轴只实现随包模板需要的能力；见 [timeline.md](references/timeline.md)。不要引用其他动画库或猜测不存在的 API。

## 按需读取

| 任务 | 参考 |
|---|---|
| 工程、变量、场景、对象选择 | [contract.md](references/contract.md) |
| 时间轴能力与限制 | [timeline.md](references/timeline.md) |
| Clawise 生图、TTS、山谦视频协作与素材归档 | [multimedia.md](references/multimedia.md) |
| 产品演示连续性 | [product-demo-continuity.md](references/product-demo-continuity.md) |
| 视觉方向和构图 | [visual-direction.md](references/visual-direction.md)、[library/README.md](references/library/README.md) |
| 口播字幕、音频导入 | [voice.md](references/voice.md)、[talking-head.md](references/talking-head.md) |
| 配乐与音效 | [sound.md](references/sound.md) |
| 节奏、色彩、3D 相机 | [rhythm.md](references/rhythm.md)、[colour.md](references/colour.md)、[depth.md](references/depth.md) |
| 导出验收 | [verification.md](references/verification.md) |

用户明确表达偏好时，可用 `motionx learn add` 记录原话与证据；不要把某次项目的猜测写成全局规则。个人数据默认保存在所选 Clawise state 的 `motionx/` 中，不进入发布包。
