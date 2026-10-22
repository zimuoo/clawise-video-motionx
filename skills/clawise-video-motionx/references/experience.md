# 可核验的制作经验

这里只保存适用于当前 MotionX 引擎的一般检查方法；项目与用户偏好由 `motionx learn` 存在本机，不把其他人的偏好当作 Clawise 用户偏好。

## 时间轴 · topics: motion, rhythm, seek

- 同一个时间点应与此前拖动顺序无关。至少对比 0→中间 与 尾部→0→中间 的截图。
- 计数器依赖 onUpdate；Canvas/3D 的绘制依赖代理 setter。只看 timeline.duration 正确不能证明画面正确。
- 文字入场需要读完的停留时间；短片末帧也属于内容。

## 素材 · topics: launch, material, product

- 真实 UI、logo 与数据能确认产品身份。模板默认文案不能作为已完成的产品演示。
- 替换素材后核查长标题、竖屏和边缘裁切，不仅检查文件存在。

## 音频 · topics: sound, voice

- 用实际音频做最终对齐与试听，不能根据脚本文字数声称逐词精确。
- 静音 loop 明确关闭音轨；有音频的导出必须检查容器里确实有音轨。
