# 语音、录音与字幕

优先使用用户已有录音或 Clawise 中当前可用且已配置的语音能力；本技能没有绑定一个云 TTS 厂商，也不保存 API key。取得实际音频文件后：

```sh
motionx voice ./film --audio ./voice.wav --text ./script.txt --asr off --fit
```

生成 `assets/voice.wav`、`assets/voice.words.json`、版本化 `.srt` 和 HTML 里的 `motionx-cues`。静音区间法是估算，需要试听核对。`MX.cue('词')` 可把画面锚定到已导入词时间。

本机可选项：

- macOS 已安装的 `say` 音色：`--text ./script.txt --voice say:Tingting`。不要在 Windows/Linux 假设可用。
- Kokoro：用户自备安装了 `kokoro-onnx` 和 `soundfile` 的 Python 环境，用 `MOTIONX_TTS_PYTHON` 指定可执行文件。模型放在 `<Clawise state>/motionx/cache/tts/`。中文音质需试听；不承诺适合正式中文口播。
- Whisper：需要本机 `whisper-cli`，用 `--asr on` 对录音识别。仍要检查转录与字幕。无模型时不会默默下载。
- 用户明确选择后，以上命令可增加 `--allow-download` 下载所需模型；大小约数百 MB，供应方条款适用。不要为安装技能而预先下载模型。

`MOTIONX_HOME` 可移动个人经验及缓存目录。Clawise state 优先 `CLAWISE_STATE_DIR`，其次 `OPENCLAW_STATE_DIR`，默认 `~/.clawise`。
