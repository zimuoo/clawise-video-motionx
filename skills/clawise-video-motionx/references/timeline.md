# MotionX Timeline

MotionX 是本项目独立实现的确定性时间轴，面向本地模板和逐帧导出。它不是通用动画库的完整兼容实现。不要把其他库的插件、ticker、嵌套时间轴、repeat/yoyo 或 callback 事件序列当成这里的 API。

```js
const tl = MotionX.timeline({ paused: true, defaults: { ease: 'power3.out' } });
tl.addLabel('scene:intro', 0)
  .fromTo('.title', { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: .8 }, .2)
  .to({}, { duration: 1 }, 2);
window.__timelines = { film: tl };
```

- `timeline({paused, defaults})`；链式 `to(target, vars, position)`、`from`、`fromTo(target, fromVars, toVars, position)`、`set`、`addLabel`。
- 目标可以是 CSS 选择器、DOM 元素、元素数组/NodeList 或普通数值对象。常用属性：x/y/z、xPercent/yPercent、scale/scaleX/scaleY、rotation、opacity、left/top、transformOrigin；其他 CSS 能力先查实现和测试。渐变、复杂 path、颜色插值使用 `MX.clock` 自己按时间计算。
- `duration` 以秒计，`stagger` 用数值秒。位置用非负秒数、标签、`label+=0.2`、`+=0.2`、`-=0.2`、`<` 或 `>`。
- 缓动：`none`、`power2.in/out/inOut`、`power3.in/out/inOut`、`expo.in/out/inOut`、`sine.in/out/inOut`、`back.out(1.5)`，或纯函数 `p => …`；弹簧可用 `MX.spring(bounce)`。
- `from/fromTo` 默认立即显示起点；需要开始前保持原态时显式 `immediateRender:false`。不同场景独立隐藏，不用有历史依赖的 CSS class 切换。
- `seek(time, suppressEvents=true)` 重算状态；`false` 执行 `onUpdate`，静默 seek 仍调用代理 setter。`pause`、`play`、`time`、`duration`、`labels`、`getChildren` 提供预览和检查接口。
- 数字计数器在 `onUpdate` 中更新文字。Canvas/WebGL 使用 `MX.clock`，不要自己跑 requestAnimationFrame 或 setInterval。

修改后在首帧、中间、尾帧、倒序 seek 以及两次不同历史后的同一时间点检查结果。预览可播放不代表逐帧渲染一定正确。
