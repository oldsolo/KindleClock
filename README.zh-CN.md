# KindleClock

一个给 Kindle 内置浏览器用的极简挂钟。只显示北京时间的 `HH:MM`，铺满屏幕，
在整分钟边界更新。

纯 HTML + CSS + ES5 JavaScript，无构建步骤、无第三方依赖。

**在线体验：** <https://oldsolo.github.io/KindleClock/>

**English version: [README.md](README.md)**

---

## 为什么这个项目有点特殊

Kindle 浏览器是大约 2009 年的 WebKit（Safari 4 时代）。绝大多数现代 web 默认行为在它上面
都是错的：

| 特性 | 状态 |
|---|---|
| `<meta name="viewport">` | **被忽略** |
| `documentElement.clientWidth` | 等于物理像素；`devicePixelRatio` 恒为 1 |
| `flexbox`、`grid` | 不支持 |
| `position: fixed`、`position: sticky` | 失效（被当成 static） |
| `Promise`、箭头函数、`const`/`let`、`fetch` | 不支持 |
| `Intl.DateTimeFormat` | 不存在 |
| `mouse*` / `touch*` 事件 | 都是 `click` 的别名 —— 只能绑 `click` |
| `orientationchange` | 从不触发（`resize` 可用） |

已在 **Kindle 7（Kindle 499，600×800）** 和 **Kindle 10 代**（Paperwhite，1072×1448）
上实测通过。

---

## 功能

- **默认显示北京时间（UTC+8）** —— 原因见[时间处理](#时间处理)
- **点击旋转** —— 循环四个朝向，横屏与竖屏使用不同布局（见下）
- **任意朝向、任意机型都铺满屏幕**
- **整分钟边界更新**，误差不累积
- 横屏用两个圆点作分隔符，竖屏两段紧接、无间隔
- 可选暗色模式
- 可选每小时清除墨水屏残影 —— 参见[墨水屏残影](#墨水屏残影)。

---


---

## 实物照片

真机实拍（Kindle Paperwhite）。点击屏幕一次即切换到下一个朝向。

| 横屏（默认） | 竖屏 |
|:---:|:---:|
| ![横屏模式](img/kclock_90.png) | ![竖屏模式](img/kclock_00.png) |

| 角度 | 布局 |
|---|---|
| `±90°` 横屏 | 单行 `10:41`，整体旋转，设备需侧放 |
| `0° / 180°` 竖屏 | `10` 靠左上、`42` 靠右下，两段紧接无间隔 |

横屏那张照片里 Kindle 是侧放的 —— 这正是横屏的使用方式；页面内容对阅读者始终是正立的。

---

## 运行方式

三种方式，任选其一。页面是完全自包含的（只用相对路径引用 `style.css` / `app.js`，
没有网络请求，也没有用 `localStorage`），所以三种方式行为完全一致。

### 方式 A — GitHub Pages（什么都不用装）

页面已发布在 <https://oldsolo.github.io/KindleClock/>，直接在 Kindle 浏览器地址栏输入
即可。它从 `main` 分支的仓库根目录提供，因此每次 push 都会自动更新线上版本。

查询参数在这里同样有效：

```
https://oldsolo.github.io/KindleClock/?tm=dark
https://oldsolo.github.io/KindleClock/?safe=0.99
```

> **老设备可能连不上。** GitHub 要求 TLS 1.2，而 Kindle 7 上 2009 年的 WebKit 只能协商
> 很老的 TLS 版本。如果页面在那台设备上打不开，请改用方式 B。10 代实测可用。

### 方式 B — 直接复制到 Kindle（最可靠）

1. 用 USB 连接 Kindle，等电脑识别并挂载。
2. 把三个文件（`index.html`、`style.css`、`app.js`）复制到设备上的一个目录，
   例如 `/mnt/us/kindleclock/`。
3. 安全弹出，打开 Kindle 浏览器。
4. 在地址栏输入：

```
file:///mnt/us/kindleclock/index.html
```

Kindle 浏览器的地址栏**是可以输入 `file://` 地址的**，并且能渲染 `/mnt/us` 下的 `.html`
文件。查询参数在这里同样有效，例如
`file:///mnt/us/kindleclock/index.html?tm=dark`。

做床头挂钟的话推荐这种方式 —— 完全不需要网络，而且文件拷进设备后，Kindle 就不再依赖
你的电脑了。

### 方式 C — 局域网伺服

```bash
python -m http.server 8000
```

然后在 Kindle 上打开浏览器，输入 `http://<电脑IP>:8000/`。改文件时用这个更方便，
因为在电脑上编辑比在设备上方便得多。

> **缓存提示**：Kindle 浏览器缓存很顽固。改完文件后请在 URL 后加 `?v=2` 之类的参数，
> 否则可能一直在加载旧版本。用方式 B 时也可以直接删掉再重新拷贝。

### 关闭休眠屏保

JavaScript 无法阻止息屏。需要在设备层面关闭：

- 在搜索框输入 `~ds`，或
- 创建空文件 `/mnt/us/TESTD_PREVENT_SCREENSAVER` 后重启，或
- （越狱）`lipc-set-prop -i com.lab126.powerd preventScreenSaver 1`

不关闭的话，息屏后浏览器会挂起定时器，时钟就停止更新。另外，Kindle 系统自带的工具栏
由操作系统绘制，不越狱的话页面无法隐藏它。

---

## 点击旋转

每点一次，旋转角减 90°。**横屏与竖屏使用不同布局：**

| 点击次数 | 旋转角 | 布局 |
|---|---|---|
| 0 | `90°` | 横屏 —— 单行 `17 ●● 08`，整体旋转（默认） |
| 1 | `0°` | 竖屏 —— 小时靠左上、分钟靠右下，两段紧接无间隔 |
| 2 | `-90°` | 横屏（顺序镜像） |
| 3 | `180°` | 竖屏（上下顺序镜像） |
| 4 | `90°` | 回到横屏 |

两种布局共用同一套 markup：每位数字的两个字符包在 `.grp` 里，横屏时它是 `display:inline`
（渲染结果与不包裹完全等价），竖屏时切成 `display:block` 堆叠成两行。只靠 `.clock` 上的
`stacked` 类切换。

竖屏时时钟铺满容器宽度，否则两段等宽、`text-align` 看不出效果。`#grpH` 左对齐、`#grpM`
右对齐，分隔符整体 `display: none`（不能只藏圆点 —— 它作为 `inline-block` 仍会占
`0.28em` 宽度与 `0.72em` 行高，中间会留出空隙）。

**只绑 `click`**。Kindle 上 `mouse*` 和 `touch*` 都是 `click` 的别名，一并绑定会导致
点一次转多次。

---

## 时间处理

**默认是北京时间（UTC+8），而不是设备本地时间。** 这不是风格选择，而是 Kindle 隐藏时区
逼出来的：

- 系统时钟显示 `13:00` 的 Kindle，`getHours()` 返回 `5` —— 正好差 8 小时
- `getTimezoneOffset()` 恒为 `0`，WebKit 531 上也没有 `Intl`
- 设备「设成北京时间」这个信息**永远传不到 JS**，那个偏移是个隐藏设置

所以时区在 JS 里是**不可推断**的，只能显式指定。即使联网也不行 —— HTTP `Date` 头只能
告诉你「现在是几点」，不能告诉你「你想看哪里的几点」。想看长版推导可以参考
[Layout notes（英文）](README.md#layout-notes) 里引用的研究资料。

固定时区那条路径是 `epoch + tz*3600000` 配 `getUTC*` 读取。这个配对很重要：

> 加了偏移就用 `getUTC*` 读；没加偏移就用本地 getter。混用会把偏移算两遍。

`?tz=local` 切换到 JS 可见的本地时间 —— 在 Kindle 上就是 UTC。

### 整分钟边界更新

`setInterval(render, 60000)` 看起来对，但会漂移：每次定时都是基于上一次推算的，
定时器误差会累积。这里用的是**递归 `setTimeout`**，每一轮都按当前墙上时钟重新算剩余
时间，因此某一次的延迟会在下一次被抵消掉：

```js
function msToNextMinute() {
  var delay = 60000 - ((new Date()).getTime() % 60000);
  if (delay < 150) delay += 60000;   // 防止在边界前抢跑
  return delay;
}
function tick() { render(); setTimeout(tick, msToNextMinute()); }
```

用一个「每次都迟到 350ms」的定时器模拟：

| 方案 | 3 小时后的偏差 |
|---|---|
| `setInterval` | **3000 ms**（线性增长） |
| 递归 `setTimeout` | **350 ms**（有界） |

`delay < 150` 那个保护比看起来更重要：早触发几毫秒就会读到上一分钟，显示整整慢一分钟。

注意这里对齐的是**设备**时钟，不是网络时间源。

---

## 墨水屏残影

墨水屏会留下上一次画面的淡淡残影。成因是波形选择：**局部**刷新只驱动真正发生变化的
像素，所以一个每分钟只改 4 个数字里 2 个的时钟，永远不会把其余像素推回静止态 ——
残影不是刷新不干净留下的，而是压根没被刷新过。

唯一的解法是让**每一个像素都至少变化一次**。`?flash=1` 每小时在整点做一次：

`14:00  ->  整屏全黑 800 毫秒  ->  14:00`

做法是把页面背景翻到与当前模式相反的颜色 —— 浅色模式翻成黑底，暗色模式翻成白底。数字
和分隔符圆点的颜色，恰好就是背景要翻过去的那个颜色，所以它们会自己消失，不需要任何
`visibility` 花招：此时每个像素都与上一帧不同，控制器只能做一次全屏更新。`?flashms`
之后颜色被显式写回。

这段代码里有**三处写法是实机验证过的，不要"优化"**：

- 用 `backgroundColor` **长写法**。`background` 简写会重置全部 `background-*` 长写属性，
  实测刷不出有效刷新。
- 用 `setTimeout` 的**字符串**形式，不是函数形式。两者都能跑，但只有字符串形式在真机上
  实测能刷出刷新并消除残影。
- 用三位色值 `#000` / `#FFF`。

打开 `?debug=1`，角落读数会多出 `fl <次数>/<毫秒>` 一栏 —— 靠它可以区分「代码根本没跑」
和「跑了但屏幕没理」。

两点需要知道：

- **这不是真正的全刷。** 重新加载页面或翻页会触发 `GC16` 波形，黑白黑反复驱动，把每个
  像素彻底复位。本方案是两次全区域局部刷新：能消除绝大部分残影，但严格来说不保证归零。
  重载确实更彻底 —— 但它也会把朝向打回默认横屏，因为角度只是一个没有持久化的普通变量。
  这个取舍是有意的。
- **`?flashms` 调节停留时长。** 间隔必须长于屏幕完成一次整屏刷新的耗时；残影若仍有残留，
  可试 `?flashms=1500` 或 `2000`。

默认关闭；代价是每小时一次可见的闪屏。

---

## 查询参数

| 参数 | 默认 | 作用 |
|---|---|---|
| `?tz=<小时数>` | `8` | 固定时区，如 `?tz=9`、`?tz=-5` |
| `?tz=local` | — | JS 可见的本地时间（Kindle 上等于 UTC） |
| `?ofs=<毫秒>` | `0` | 叠加到 epoch 的微调量 |
| `?tm=dark` | 关 | 暗色模式 |
| `?safe=<0.3..1>` | `0.97` | 占满程度 —— 用多少屏幕 |
| `?debug=1` | 关 | 实测数据显示 + 校准图形 |
| `?autochrome=1` | 关 | 自动补偿浏览器边框（见下） |
| `?ox=<px>` / `?oy=<px>` | `0` | 手工位置微调；优先级高于 `autochrome` |
| `?flash=1` | 关 | 每小时在整点清除一次墨水屏残影（见下文） |
| `?flashms=<ms>` | `800` | 每小时清除时中间态的停留时长 |

示例：

```
/                    北京时间，横屏
/?tz=9               东京
/?tz=local           设备可见时间
/?tm=dark            暗色模式
/?safe=0.99          更占满屏幕
/?debug=1            显示视口实测数据
/?flash=1            每小时清除墨水屏残影
```

### 排查显示问题

**`?debug=1`** 会显示左上角数据，并画出校准图形：

- 容器上的**红色边框** —— JS 认为的布局视口边界
- body 上的**绿色十字** —— 屏幕几何中心

```
vp 600x699 scr 600x699 cont 600x699 fs 256px rot 90
```

如果红边没有贴住屏幕物理边缘，或者绿十字不在红框中心，说明**布局视口和可见区域不一致**。
这是 Kindle 上 JS 唯一探测不到的偏差 —— 工具栏是**覆盖层**（overlay），盖在页面上方，
而不是压缩布局视口。

`?autochrome=1` 会按设备算出补偿：

```
oy = (screen.height - clientHeight) / 2
ox = -(screen.width - clientWidth) / 2
```

**默认关闭**，因为 overlay 行为各机型不同 —— 10 代不开就已经是对的。在 Kindle 7 上它会算出
`oy=50`。那里 `ox` 仍是 `0`，因为常驻的右侧滚动条同样是 overlay，不减少 `clientWidth`；
如果右边看着比左边空，手动调 `ox` 即可。

---

## 布局说明

没有任何硬编码像素，所有尺寸都来自运行时测量。

### 旋转不变量

容器绕自身中心旋转，尺寸按角度选取，使得**旋转后的包围盒恰好等于视口**。矩形 `(w, h)`
在 ±90° 下包围盒变为 `(h, w)`，在 0/180° 下不变，因此：

| 角度 | 容器尺寸 |
|---|---|
| `0°`、`180°` | `vp.w × vp.h` |
| `±90°` | `vp.h × vp.w` |

写反了照样正立、照样居中，只是把时钟压到屏幕的 82% —— 属于**静默失败**。

### 两个花了实际调试时间的坑

**交换后的容器必须用 `left`/`top` 居中，不能用 `translate`。** 因为
`transform-origin: 50% 50%` 位于**平移之前**的中心，`translate(...) rotate(...)`
这个链条会让盒子额外位移一个容器长宽差（实测 57px）。

**不要换两次轴。** 文字沿容器局部 x 轴排布，所以 `len = container.offsetWidth`、
`cross = container.offsetHeight`，**不再加 `upright` 判断**。上面的按角度定尺寸已经把长边
放到 local-x 上了；在这里再换一次会悄悄让字号变小。

### 分隔符圆点

圆点用绝对 `em` 偏移（`left: 0.07em`、`top: 0.16em / 0.44em`），`.sep` 有真实高度。
**这里绝对不能用百分比 `left`** —— 老 WebKit 对零高包含块里的 `left: 50%` 解析会退化，
把圆点甩到最左边。竖屏时 `.sep` 整体隐藏，两段之间不留间隔。

### 字号测量法

`fit()` 是「量」出来的，不是「算」出来的：先设 `font-size: 100px`，读出整块真实的
`offsetWidth`/`offsetHeight`，再等比缩放填入容器。这一点很重要 —— 两种布局的包围盒
完全不同（横屏是一行，竖屏是两个满宽块），手写公式必然会在其中一种上出错。竖屏时
经过设计，旋转后恰好覆盖视口，所以「放得进容器」等价于「屏幕放得下」。

### 视口测量

`measureViewport()` 读 `documentElement.clientWidth/clientHeight`。在 Kindle 上它们等于
物理像素且 `devicePixelRatio` 恒为 1，所以不需要任何 DPR 换算，也不需要按机型分支。

只有当实时读数被判为无效（≤ 200px）时才会查兜底表。该表以**竖屏物理像素精确值**为键，
而不是 `minW`/`minH` 阈值 —— 阈值会把 Oasis（1264×1680）错配到 Paperwhite 11 那一条。

真机实测：

| 机型 | 屏幕 | 视口 |
|---|---|---|
| Kindle 499 / Kindle 7 | 600×800 | 600×699 |
| Paperwhite 3/4/5、Scribe | 1072×1448 | 1072×1268 |

---

## 项目结构

```
KindleClock/
├── index.html   14 行   结构 + 脚本引用
├── style.css   118 行   布局、两种朝向、分隔符圆点、暗色模式
├── app.js      391 行   视口、旋转、时间、定时器
├── img/                 两种朝向的实机照片
├── AGENTS.md            平台约束与踩坑记录
├── README.md            英文版
├── README.zh-CN.md     本文件
└── LICENSE              MIT

GitHub Pages 直接从仓库根目录发布 —— 没有构建步骤，也没有 `gh-pages` 分支，
GitHub 原样伺服这些文件。
```

---

## 参考资料

上面关于 Kindle 浏览器的行为主要依据：

- [Documentation for the Kindle Paperwhite 3 (2015) Web Browser](https://thorgalle.me/notes/documentation-for-the-kindle-browser) —— 视口尺寸、ES5 特性矩阵、事件怪癖
- [martin-at-ipal/kindle-web-tools](https://github.com/martin-at-ipal/kindle-web-tools) —— 确认 *"For JavaScript, the Kindle's timezone is almost always UTC"*

## 许可

[MIT](LICENSE) © 2026 oldsolo
