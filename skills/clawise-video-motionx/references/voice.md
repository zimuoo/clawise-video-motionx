# 语音、录音与字幕

优先使用用户已有录音。需要合成时，使用已启用的 Clawise TTS 插件；本技能不保存 API key。

1. 调用 `clawise_tts_list_voices`，按实际需要传 `locale: "zh-CN"`、语言、性别或风格过滤；从结果选择真实 `shortName`，不猜音色 id。
2. 调用 `clawise_tts_synthesize`，参数 `text` 为完整脚本，`voice` 为所选 shortName；`outputPath` 可指定工程内实际绝对输出路径。`rate`、`pitch`、`volume` 为百分比字符串，`style` 仅传音色实际支持值。先检查当前会话工具 schema。
3. 只接受 `ok: true` 且非空的 `outputPath` 文件作为成功。返回没有逐词时间戳，不能当成精准字幕。
4. 可用 `motionx asset ./film --file <outputPath> --id narration --source clawise-tts` 归档，再把返回相对路径传给 `voice`。

插件调用参数示例（不是 shell 命令）：

```json
{"text":"欢迎体验 Clawise。","voice":"<实际 shortName>","outputPath":"<工程绝对路径>/assets/narration.mp3","rate":"+0%"}
```

山谦克隆音色、数字人或混剪中的配音按 [multimedia.md](multimedia.md) 交给已安装的 `shanqian-ai`；不假设它存在独立 TTS 工具。

取得实际音频后，按归档返回的路径导入：

```sh
motionx voice ./film --audio ./film/assets/generated/narration-HASH.mp3 --text ./script.txt --asr off
```

生成 `assets/voice.wav`、`assets/voice.words.json`、版本化 `.srt` 和 HTML 里的 `motionx-cues`。静音区间法是估算，需要试听核对。`MX.cue('词')` 可把画面锚定到已导入词时间。

示例 HASH 用真实归档结果替换。只有允许片长跟随音频时才增加 `--fit`；用户指定固定时长时，先检查真实时长并调整文案或节奏，不能静默截断语音或改变片长。

本机可选项：

- macOS 已安装的 `say` 音色：`--text ./script.txt --voice say:Tingting`。不要在 Windows/Linux 假设可用。
- Kokoro：用户自备安装了 `kokoro-onnx` 和 `soundfile` 的 Python 环境，用 `MOTIONX_TTS_PYTHON` 指定可执行文件。模型放在 `<Clawise state>/motionx/cache/tts/`。中文音质需试听；不承诺适合正式中文口播。
- Whisper：需要本机 `whisper-cli`，用 `--asr on` 对录音识别。仍要检查转录与字幕。无模型时不会默默下载。
- 用户明确选择后，以上命令可增加 `--allow-download` 下载所需模型；大小约数百 MB，供应方条款适用。不要为安装技能而预先下载模型。

`MOTIONX_HOME` 可移动个人经验及缓存目录。Clawise state 优先 `CLAWISE_STATE_DIR`，其次 `OPENCLAW_STATE_DIR`，默认 `~/.clawise`。
