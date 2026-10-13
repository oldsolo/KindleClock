(function() {
  var h1 = document.getElementById('h1');
  var h2 = document.getElementById('h2');
  var m1 = document.getElementById('m1');
  var m2 = document.getElementById('m2');
  var clock = document.getElementById('clock');

  function getParam(name) {
    var q = window.location.search;
    if (!q || q.length < 2) return null;
    var parts = q.substring(1).split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      var k = (eq < 0) ? parts[i] : parts[i].substring(0, eq);
      if (k === name) {
        return decodeURIComponent(eq < 0 ? '' : parts[i].substring(eq + 1));
      }
    }
    return null;
  }

  // 默认显示北京时间(UTC+8)。
  // 原因：Kindle 把时区藏起来了 —— JS 里的 getHours()/getTimezoneOffset() 恒为 UTC，
  // 设备虽已设成北京时间但不会告诉浏览器，所以必须显式加 8 小时才对得上系统时钟。
  //   ?tz=<小时数>  指定固定时区，如 ?tz=9 / ?tz=-5
  //   ?tz=local    直接用 JS 可见的本地时间（Kindle 上等于 UTC）
  var tzParam = getParam('tz');
  var useFixedTz = true;
  var tzHours = 8; // Beijing
  if (tzParam === 'local') {
    useFixedTz = false;
  } else if (tzParam !== null && !isNaN(parseFloat(tzParam))) {
    tzHours = parseFloat(tzParam);
  }
  var fineOffsetMs = parseFloat(getParam('ofs'));
  if (isNaN(fineOffsetMs)) fineOffsetMs = 0;
  var darkMode = (getParam('tm') === 'dark');

  // ---- 墨水屏残影：每个整点整屏刷一次 ------------------------------
  // 成因：时钟每分钟只改一两个数字，控制器因此永远选局部波形，而局部波形
  // 不会去驱动「自上次刷新以来没有变化」的像素 —— 残影不是没刷干净，是压根没刷。
  // 唯一有效的手段是让每个像素都发生一次变化。
  //   ?flash=<n>     开关，传非 0 值即启用；缺省或 0 为关闭（关闭时行为完全不变）
  //   ?flashms=<毫秒> 中间态的停留时长，默认 800
  // 两个阶段必须落在两次独立重绘里：同一任务内改完立刻改回，浏览器只合成最终
  // 那一帧，中间态从未存在，效果等于零。
  var flashParam = getParam('flash');
  var flashOn = (flashParam !== null && flashParam !== '0' && !isNaN(parseFloat(flashParam)));
  var flashMs = parseFloat(getParam('flashms'));
  if (isNaN(flashMs) || flashMs < 100) flashMs = 800;
  var flashing = false;

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function setText(el, txt) {
    if (!el) return;
    if (el.firstChild && el.firstChild.nodeValue === txt) return;
    el.innerHTML = txt;
  }

  // 取当前应显示的时分。render() 与整点刷白判定共用同一个时间基准，
  // 否则 ?ofs 微调之后两者会脱节。
  function displayHM() {
    var t = (new Date()).getTime() + fineOffsetMs;
    if (useFixedTz) {
      // 固定时区：加偏移后必须按 UTC 读（加一次偏移、换一次坐标系，不能重复换算）
      var dd = new Date(t + tzHours * 3600000);
      return { hh: pad2(dd.getUTCHours()), mm: pad2(dd.getUTCMinutes()) };
    }
    // ?tz=local：JS 可见的本地时间，Kindle 上等于 UTC
    var d = new Date(t);
    return { hh: pad2(d.getHours()), mm: pad2(d.getMinutes()) };
  }

  function render() {
    var hm = displayHM();
    setText(h1, hm.hh.charAt(0));
    setText(h2, hm.hh.charAt(1));
    setText(m1, hm.mm.charAt(0));
    setText(m2, hm.mm.charAt(1));
  }

  // ---- 视口测量 ----------------------------------------------------
  // Kindle 浏览器忽略 <meta viewport>，且 clientWidth 即 CSS 像素（devicePixelRatio 恒为 1），
  // 因此直接读竖屏视口尺寸即可，无需任何 DPR 换算，也无需按机型分支。
  // 安全系数：预留浏览器 UI（工具栏/滚动条）占用的空间。
  // Kindle 7 老浏览器上实测偏保守导致时钟略小，可用 ?safe=0.99 覆盖。
  var SAFE = 0.97;
  var safeParam = parseFloat(getParam('safe'));
  if (!isNaN(safeParam) && safeParam > 0.3 && safeParam <= 1) SAFE = safeParam;
  var debugMode = (getParam('debug') === '1');
  // 手工微调（当浏览器边框导致偏移、且无法自动探测时的兜底）
  var nudgeX = parseFloat(getParam('ox')); if (isNaN(nudgeX)) nudgeX = null;
  var nudgeY = parseFloat(getParam('oy')); if (isNaN(nudgeY)) nudgeY = null;
  // 自动补偿浏览器 chrome：Kindle 的工具栏是 overlay（盖在页面上而非挤压布局），
  // 所以可见区比布局视口大出 (screen - client) 那么多，居中时应偏移其一半。
  // 滚动条同理贴在右/下侧，故水平方向取负号。默认关闭，各机型 overlay 行为不一致。
  var autoChrome = (getParam('autochrome') === '1');

  function screenSize() {
    var w = 0, h = 0;
    try {
      if (window.screen) { w = window.screen.width || 0; h = window.screen.height || 0; }
    } catch (e) {}
    if (!w) w = document.documentElement.clientWidth || 0;
    if (!h) h = document.documentElement.clientHeight || 0;
    return { w: w, h: h };
  }

  function chromeOffset() {
    var ox = 0, oy = 0;
    try {
      if (autoChrome) {
        var s = screenSize();
        var cw = document.documentElement.clientWidth || 0;
        var ch = document.documentElement.clientHeight || 0;
        if (s.w > cw) ox = -Math.floor((s.w - cw) / 2); // 右侧常驻滚动条
        if (s.h > ch) oy = Math.floor((s.h - ch) / 2);  // 顶部工具栏 overlay
      }
    } catch (e) {}
    if (nudgeX !== null) ox = nudgeX; // 显式参数优先
    if (nudgeY !== null) oy = nudgeY;
    return { x: ox, y: oy };
  }

  // 测量失败时（老浏览器返回 0 或离谱值）使用的机型兜底表。
  // 以「竖屏物理像素」为键精确匹配，先把 screen 尺寸归一化为竖屏（短边在前），
  // 避免横竖屏上报差异导致误匹配。仅在运行时测量失败时才会读到。
  var FALLBACK_BY_SCREEN = {
    '600x800':    { w: 600,  h: 699  },  // Kindle 499 / Kindle 7（真机实测 vp 600x699）
    '1072x1448':  { w: 1072, h: 1268 },  // Paperwhite 3/4/5, Basic, Scribe
    '1236x1648':  { w: 1236, h: 1556 },  // Paperwhite 11, Colorsoft
    '1264x1680':  { w: 1264, h: 1500 },  // Oasis
    '758x1024':   { w: 758,  h: 950  },  // Kindle Keyboard DX
    '600x1000':   { w: 582,  h: 906  }   // 早期 6" Kindle
  };
  var FALLBACK_DEFAULT = { w: 600, h: 699 }; // 完全未知：保守用最小屏

  function normScreen(w, h) {
    // 归一化为竖屏：短边在前
    if (w > h) { var t = w; w = h; h = t; }
    return w + 'x' + h;
  }

  function measureViewport() {
    var w = 0;
    var h = 0;
    try {
      var de = document.documentElement;
      if (de) {
        w = de.clientWidth || 0;
        h = de.clientHeight || 0;
      }
      // window.innerWidth 需 body{width:100%} 才有非零值，这里只作补充
      if (!w && window.innerWidth) w = window.innerWidth;
      if (!h && window.innerHeight) h = window.innerHeight;
    } catch (e) {}

    if (w > 200 && h > 200) return { w: w, h: h };

    // 兜底：按屏幕物理像素查表
    var sw = 0;
    var sh = 0;
    try {
      sw = (window.screen && window.screen.width) || 0;
      sh = (window.screen && window.screen.height) || 0;
    } catch (e2) {}
    if (sw > 0 && sh > 0) {
      var hit = FALLBACK_BY_SCREEN[normScreen(sw, sh)];
      if (hit) return { w: hit.w, h: hit.h };
    }
    return { w: FALLBACK_DEFAULT.w, h: FALLBACK_DEFAULT.h };
  }

  var container = clock ? clock.parentNode : null; // .container
  var grpH = document.getElementById('grpH');      // 竖屏时的小时分组
var debugEl = null;

  // 旋转状态：90(横屏,默认) -> 0(竖屏) -> -90 -> 180 -> 90 ...
  // 每点一次减 90°。用 rotDeg 记录，wrap 到 (-180, 180]。
  var rotDeg = 90;

  function normalizeAngle(a) {
    var x = a % 360;
    if (x > 180) x -= 360;
    if (x <= -180) x += 360;
    return x;
  }

  // 容器按角度显式定尺寸，绕自身中心旋转。
  // 规则：旋转后的包围盒必须恰好等于视口。矩形(cw,ch) 旋转 ±90° 后包围盒变为 (ch,cw)，
  // 旋转 0/180° 后不变。因此：
  //     0/180  ->  容器 = vp.w x vp.h
  //     ±90    ->  容器 = vp.h x vp.w
  // 这与「点击旋转」功能之前的写法（width=vp.h, origin left top）几何等价，
  // 但对四个角度统一成立，无需 translateY(-100%) 之类的锚点技巧。
  function applyLayout() {
    try {
      var vp = measureViewport();
      if (!vp) return false;
      var upright = (rotDeg === 0 || rotDeg === 180);
      if (container) {
        container.style.width = (upright ? vp.w : vp.h) + 'px';
        container.style.height = (upright ? vp.h : vp.w) + 'px';
        // 交换后的容器尺寸与视口不同，用 left/top 把它的中心对到视口中心。
        // 不要用 translate 做这件事：transform-origin(50% 50%) 会让「先平移再旋转」
        // 产生额外位移（实测偏 57px = 容器长宽差）。left/top 在变换前生效，无此问题。
        container.style.left = ((vp.w - container.offsetWidth) / 2) + 'px';
        container.style.top = ((vp.h - container.offsetHeight) / 2) + 'px';
        var off = chromeOffset();
        // translate 排在 rotate 之前 => off 作用于旋转后的屏幕坐标系，四朝向通用。
        var tr = 'translate(' + off.x + 'px,' + off.y + 'px) rotate(' + rotDeg + 'deg)';
        // 老 WebKit 只认 -webkit-transform
        container.style.webkitTransform = tr;
        container.style.transform = tr;
        // 0/180° 用「上小时 / 中间隔 / 下分钟」的竖排布局；±90° 保持单行
        if (clock) {
          var cls = (rotDeg === 0 || rotDeg === 180) ? 'clock stacked' : 'clock';
          if (cls !== clock.className) clock.className = cls;
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // 文字始终沿容器「局部 x 轴」排布，所以可用长度就是容器自身的宽度，
  // 与当前旋转角无关 —— 容器已按角度调好尺寸，横屏时宽=vp.h(长边)，竖屏时宽=vp.w。
  // 不要在这里按 upright 再交换一次，那样会取错轴导致字号偏小。
  // 字号用测量法：先按 100px 量出真实包围盒，再等比缩放到容器内。
  // 容器旋转后恰好覆盖视口，所以「块不超出容器」=「屏幕上放得下」。
  // 两种布局包围盒不同（横屏一行、竖屏两行），必须实测而不能套公式。
  //   横屏：.clock 收缩包裹，直接量 .clock 即可。0.995 系数保留原数值，
  //         以免改变横屏既有观感。
  //   竖屏：.clock 铺满容器宽（否则两段左右对齐看不出差别），
  //         offsetWidth 恒等于容器宽、没有信息量，改为量一组数字的实际宽度。
  function fit() {
    try {
      if (!clock) return;
      applyLayout();

      var cw = container ? container.offsetWidth : 0;
      var ch = container ? container.offsetHeight : 0;
      if (!cw || !ch) return;

      clock.style.fontSize = '100px';
      var bw = clock.offsetWidth;   // 整块的本地宽度
      var bh = clock.offsetHeight;  // 整块的本地高度
      if (!bw || !bh) return;

      if (isStacked() && grpH) {
        var ds = grpH.getElementsByTagName('span');
        var gw = 0;
        for (var k = 0; k < ds.length; k++) gw += ds[k].offsetWidth;
        if (gw) bw = gw;
      }

      var scale = Math.min((cw * SAFE * 0.995) / bw, (ch * SAFE) / bh);
      var size = Math.floor(100 * scale);
      if (size < 10) size = 10;
      clock.style.fontSize = size + 'px';
      if (debugMode) renderDebug();
    } catch (e) {}
  }

  function isStacked() {
    return clock && clock.className && clock.className.indexOf('stacked') >= 0;
  }

  // ?debug=1：显示实测数据 + 校准图形，用于真机排查浏览器边框造成的偏移。
  // 红色边框 = JS 认为的布局视口边界；绿色十字 = 屏幕几何中心。
  // 若红线与屏幕边缘不重合、且绿十字不在红线中心，就说明布局视口与可见区不一致，
  // 这类偏移无法从JS 探测，需要用 ?ox= / ?oy= 手工补偿。
  function renderDebug() {
    try {
      if (!debugEl) {
        debugEl = document.createElement('div');
        var ds = debugEl.style;
        ds.position = 'absolute';
        ds.left = '0';
        ds.top = '0';
        ds.zIndex = '99';
        ds.fontSize = '9px';
        ds.lineHeight = '1.25';
        ds.color = '#000';
        ds.background = '#fff';
        ds.padding = '2px';
        ds.border = '1px solid #000';
        ds.whiteSpace = 'pre';
        if (document.body) document.body.appendChild(debugEl);

        // 布局视口边框（挂在容器上，随容器一起旋转）
        container.style.outline = '2px solid #f00';

        // 屏幕中心十字（挂在 body 上，不随容器旋转）
        var h = document.createElement('div');
        var hs = h.style;
        hs.position = 'absolute'; hs.left = '0'; hs.top = '50%';
        hs.width = '100%'; hs.height = '1px'; hs.background = '#0a0'; hs.zIndex = '98';
        var v = document.createElement('div');
        var vs = v.style;
        vs.position = 'absolute'; vs.left = '50%'; vs.top = '0';
        vs.height = '100%'; vs.width = '1px'; vs.background = '#0a0'; vs.zIndex = '98';
        document.body.appendChild(h);
        document.body.appendChild(v);
      }
      var de = document.documentElement;
      var vp = measureViewport();
      var cw = container ? container.offsetWidth : 0;
      var ch = container ? container.offsetHeight : 0;
      debugEl.innerHTML =
        'vp ' + de.clientWidth + 'x' + de.clientHeight +
        ' scr ' + vp.w + 'x' + vp.h +
        ' cont ' + cw + 'x' + ch +
        ' fs ' + clock.style.fontSize +
        ' rot ' + rotDeg;
    } catch (e) {}
  }

  // 点击屏幕 -> 逆时针再转 90°（角度递减），循环播放四个朝向
  function rotateStep() {
    rotDeg = normalizeAngle(rotDeg - 90);
    fit();
  }

  // 距离下一个整分钟的毫秒数。
  // 每次都按当前墙上时钟重算，因此单次回调的延迟不会累积到下一次。
  function msToNextMinute() {
    var delay = 60000 - ((new Date()).getTime() % 60000);
    if (delay < 150) delay += 60000; // 边界保护：防止抢跑或立即重排
    return delay;
  }

  // 整屏刷白：把背景翻到与常态相反的颜色，数字随即隐身 —— 浅色模式是黑字黑底、
  // 暗色模式是白字白底，于是每一个像素都发生了变化，控制器必须做一次全屏更新。
  // 停留后再清掉行内样式，背景翻回常态，数字重新显现，页面回到刷洗前的外观。
  // 这里不需要隐藏 .clock：正文与圆点的颜色恰好就是背景要翻过去的那个颜色，
  // 背景一变它们就看不见了，再加 visibility 属于多余动作。
  function doFullClear() {
    try {
      if (!clock || flashing) return;
      flashing = true;
      document.body.style.background = darkMode ? '#ffffff' : '#000000';
      setTimeout(function () {
        document.body.style.background = ''; // 回到 CSS 类（.dark 等）的常态配色
        flashing = false;
      }, flashMs);
    } catch (e) {
      flashing = false;
    }
  }

  function tick() {
    render();
    // 每个整点刷一次。tick() 本就落在分钟边界上，因此只需判断分钟数是否为 00。
    // 用显示时间而非设备时间：?ofs 是显示层的微调，整点应以用户看到的为准。
    if (flashOn && !flashing && displayHM().mm === '00') doFullClear();
    setTimeout(tick, msToNextMinute());
  }

  function init() {
    try {
      if (darkMode) {
        document.body.className = 'dark';
      }
      fit();
      if (window.addEventListener) {
        window.addEventListener('resize', fit, false);
      } else {
        window.onresize = fit;
      }
      render();
      setTimeout(tick, msToNextMinute());

      // Kindle 浏览器只有 click 可用；mouse*/touch* 都是 click 的别名，
      // 若一并绑定会导致一次点击触发多次旋转。
      if (document.addEventListener) {
        document.addEventListener('click', rotateStep, false);
      } else if (document.attachEvent) {
        document.attachEvent('onclick', rotateStep);
      } else {
        document.onclick = rotateStep;
      }
    } catch (e) {}
  }

  init();
})();
