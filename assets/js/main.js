/* ==========================================================================
   小虫友记 — 交互
   页面形态：一本摊开的书
     左页 = 条目卡片墙（逸闻纪事式立绘卡，点击选中）
     右页 = 该条目的照片墙（照片错落摆放，点一张才弹出全屏大图）
     书外 = 跟随当前图片虚化的背景
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------ 数据 */

  var friends = (typeof FRIENDS !== 'undefined' ? FRIENDS : []).slice();
  var me      = (typeof ME !== 'undefined' ? ME : null);

  /* ------------------------------------------------------------ DOM */

  var gridEl  = document.getElementById('grid');
  var stageEl = document.getElementById('stage');
  var statEl  = document.getElementById('statCount');
  var backBtn = document.getElementById('backBtn');

  var lightbox = document.getElementById('lightbox');
  var lbMedia  = document.getElementById('lbMedia');
  var lbCap    = document.getElementById('lbCap');

  // 背景双层，交替淡入实现平滑切换
  var backdrops = [document.getElementById('backdropA'), document.getElementById('backdropB')];
  var backdropTop = 0;

  /* ---------------------------------------------------------- 状态 */

  var currentId       = null;
  var gallery         = [];   // 当前好友的图片列表
  var galleryCaptions = [];   // 与 gallery 一一对应的照片标题
  var galleryTitle    = '';

  /* 当前右页的照片墙与自适应函数（换条目时整体换新引用，
     resize 监听只挂一次，始终操作最新的一组） */
  var shotsEl    = null;
  var fitShotsFn = null;
  var shotsRO    = null;   // 容器尺寸监听，换条目时换新

  /* ---------------------------------------------------------- 工具 */

  function findFriend(id) {
    if (me && me.id === id) return me;
    for (var i = 0; i < friends.length; i++) {
      if (friends[i].id === id) return friends[i];
    }
    return null;
  }

  /** 视频后缀判定（用于照片墙与放大层选择 <video> 渲染） */
  function isVideo(src) {
    return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(src);
  }

  /** 头像：优先取 avatar 字段，缺省时用第一张图片（跳过视频，<img> 撑不住视频源） */
  function avatarOf(f) {
    if (f.avatar) return f.avatar;
    if (f.images && f.images.length) {
      for (var i = 0; i < f.images.length; i++) {
        if (!isVideo(f.images[i])) return f.images[i];
      }
      return f.images[0];   // 全是视频时退回第一张，由调用方承担
    }
    return '';
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * 稳定伪随机（FNV-1a）：同一个字符串永远得到同一个 0~1 的数。
   * 用途：照片墙的倾角 / 尺寸 / 位移。刷新页面不会跳动，
   * 换一张好友才重新排一次，看起来就是"手工贴上去的"。
   */
  function hash01(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  /**
   * 规整排版：统一尺寸、统一间距、不旋转、不位移。
   * 所有照片同一宽度、同一行高，像贴整齐的相册页。
   * 初始画幅统一 16:10 兜底（与现有照片/视频一致），媒体真实分辨率到达后
   * 由 applyNaturalAspect 按各自比例修正，避免长时间裁切。
   * @param {number} order 第几张（0 起）
   * @param {number} total 该好友一共几张
   */
  function scatter(el, seed, order, total) {
    el.style.setProperty('--rot', '0deg');
    el.style.setProperty('--dx',  '0px');
    el.style.setProperty('--dy',  '0px');
    el.style.setProperty('--sc',  '1');
    el.style.setProperty('--z',   '1');
    el.style.setProperty('--ar',  '16 / 10');

    // 统一宽度：与落叶的相册页同一套排版，等宽两列起排（单张时占列首）
    el.style.setProperty('--w', '38%');

    // 统一间距：只留正边距，行与行不叠压
    el.style.setProperty('--mt', '14px');
    el.style.setProperty('--my', '30px');
    el.style.setProperty('--ml', '0px');
    el.style.setProperty('--mr', '6%');
    // 两列布局里行末那张不吃右边距，照片整体才居中
    if (total >= 2 && (order + 1) % 2 === 0) {
      el.style.setProperty('--mr', '0px');
    }
  }

  /**
   * 媒体真实分辨率到达后，把内联 aspect-ratio 设为自身比例。
   * 内联 aspect-ratio 直接作用于属性，能压过 .shot 的 --ar
   * （含手机端 !important 那条——important 只挂在变量上），
   * 外框比例与媒体一致后 cover 也不再裁切；再重量一次照片墙居中垫片。
   */
  function applyNaturalAspect(el, width, height) {
    if (!width || !height) return;
    el.style.aspectRatio = width + ' / ' + height;
    requestAnimationFrame(function () { if (fitShotsFn) fitShotsFn(); });
  }

  /* 页面底衬：几片淡彩纸屑 + 左下暖阳 + 右上气球，纯氛围不抢内容 */
  var SCRAP_TONES = ['#dbe8f6', '#f7dfe2', '#f6eec6', '#d9ecdd', '#e6e0f4', '#f2e6d4', '#dcecf0', '#f4e3ec', '#e4eef2'];

  function buildDeco(f) {
    var seed = f.id;
    var deco = make('div', 'plate__deco');

    // 条目自带底图：整页铺这张图（浅色蒙版交给 CSS），
    // 纸屑与气球就不再加了，免得和实景图打架。
    // 注意用内联样式赋 URL：外链 CSS 里的相对路径是相对 css 文件解析的，
    // 内联样式才相对页面，data.js 里写的路径才作数。
    if (f.plate) {
      deco.classList.add('plate__deco--photo');
      deco.style.backgroundImage = 'url("' + f.plate + '")';
      return deco;
    }

    // 纸屑铺满整页（顶部让开姓名条那一条）
    SCRAP_TONES.forEach(function (tone, i) {
      var s = hash01(seed + 'scrap' + i);
      var t = hash01(seed + 'scrT' + i);
      var u = hash01(seed + 'scrU' + i);
      var v = hash01(seed + 'scrV' + i);

      var scrap = make('i', 'scrap');
      scrap.style.setProperty('--tone', tone);
      scrap.style.setProperty('--x',  (2 + s * 76).toFixed(1) + '%');
      scrap.style.setProperty('--y',  (7 + t * 84).toFixed(1) + '%');
      scrap.style.setProperty('--sw', (9 + u * 20).toFixed(1) + '%');
      scrap.style.setProperty('--sh', (5 + v * 12).toFixed(1) + '%');
      scrap.style.setProperty('--rot', ((s * 2 - 1) * 15).toFixed(2) + 'deg');
      deco.appendChild(scrap);
    });

    deco.appendChild(make('i', 'sun'));

    // 两只气球，颜色一蓝一淡紫
    [['#cfe0f2', 5, 3, 52], ['#e3d9f4', 16, 12, 38]].forEach(function (b, i) {
      var bal = make('i', 'balloon');
      bal.style.setProperty('--tone', b[0]);
      bal.style.setProperty('--y', b[1] + '%');
      bal.style.setProperty('--x', b[2] + '%');
      bal.style.setProperty('--bw', b[3] + 'px');
      deco.appendChild(bal);
    });

    return deco;
  }

  /* -------------------------------------------------------- 背景 */

  function setBackdrop(src) {
    if (!src || !backdrops[0]) return;
    // 视频不做虚化背景：用 <img> 撑不住视频源，且耗性能，
    // 直接保留当前背景（通常是该好友上一张图片或兜底深色）
    if (isVideo(src)) return;

    var cur = backdrops[backdropTop];
    var next = backdrops[1 - backdropTop];
    var shown = next.getAttribute('src');

    if (cur.getAttribute('src') === src) return;

    // 目标图已在另一层备好，直接交换可见性即可
    if (shown !== src) next.setAttribute('src', src);

    next.classList.add('is-on');
    cur.classList.remove('is-on');
    backdropTop = 1 - backdropTop;
  }

  /* -------------------------------------------- 左页：好友头像网格 */

  function renderGrid() {
    gridEl.textContent = '';

    friends.forEach(function (f) {
      var btn = make('button', 'friend');
      btn.type = 'button';
      btn.dataset.id = f.id;
      btn.title = f.name;

      var img = make('img', 'friend__avatar');
      img.setAttribute('src', avatarOf(f));
      img.alt = f.name;
      img.loading = 'lazy';
      btn.appendChild(img);

      btn.appendChild(make('span', 'friend__name', f.name));

      btn.addEventListener('click', function () { select(f.id, true, true); });

      gridEl.appendChild(btn);
    });

    statEl.textContent = String(friends.length);
  }

  function syncActive() {
    Array.prototype.forEach.call(gridEl.children, function (node) {
      node.classList.toggle('is-active', node.dataset.id === currentId);
    });
  }

  /* 主页整页下滑：量品牌区 + 网格的实际高度，写入底部后垫。
     内容不满一屏时先补齐到整屏、再多垫一段行程，随时都能轻拉往下看 */
  var scrollEl = document.getElementById('pageScroll');
  var fillEl   = document.getElementById('pageFill');

  function layoutList() {
    if (!scrollEl || !fillEl) return;
    fillEl.style.height = '0px';

    var bottom = 0;
    Array.prototype.forEach.call(scrollEl.children, function (n) {
      if (n === fillEl) return;
      bottom = Math.max(bottom, n.offsetTop + n.offsetHeight);
    });

    var area   = scrollEl.clientHeight;   // 滚动容器自身无内边距
    var travel = Math.min(300, Math.max(140, Math.round(scrollEl.clientHeight * 0.35)));
    fillEl.style.height = (Math.max(0, area - bottom) + travel) + 'px';
  }

  /* ------------------------------------------ 右页：好友图片小图 */

  function renderPlate(f) {
    // 切换好友前先暂停旧页的视频，免得躲在 DOM 里继续放
    pauseAllVideos();

    // 该条目的图片；没有图片时退回头像，保证右页不会空着
    gallery = (f.images && f.images.length ? f.images.slice() : [avatarOf(f)])
      .filter(Boolean);
    galleryTitle = f.name;

    stageEl.textContent = '';

    var plate = make('div', 'plate');

    /* --- 底衬：默认奶油底（淡彩纸屑 / 暖阳 / 气球），或条目自带的底图 --- */
    var deco = buildDeco(f);
    plate.appendChild(deco);

    /* 底衬纸片的滚动视差：下滑时轻轻上移，有一点"纸片被带起来"的反馈。
       没有照片的页面全靠这个才看得出确实在滑 */
    var parEls = [];
    if (!f.plate) {
      Array.prototype.forEach.call(deco.children, function (n, i) {
        parEls.push({ el: n, k: 0.10 + (i % 4) * 0.05 });
      });
    }

    /* --- 照片墙：错落摆放的小照片，点任意一张才出全屏大图 --- */
    var shots = make('div', 'plate__grid');

    // 隐形后垫：在内容下面永远垫出约小半页的余量，右页随时都能下滑。
    // 照片一律从页顶排起（与落叶的相册页一致），不做垂直居中
    var fill = make('i', 'plate__fill');

    gallery.forEach(function (src, i) {
      var btn = make('button', 'shot');
      btn.type = 'button';
      btn.title = '点击查看大图';
      scatter(btn, f.id + '|' + i + '|' + src, i, gallery.length);

      var media;
      if (isVideo(src)) {
        btn.classList.add('shot--video');
        media = make('video');
        media.setAttribute('src', src);
        media.setAttribute('controls', '');
        media.setAttribute('loop', '');
        media.setAttribute('muted', '');
        media.setAttribute('playsinline', '');
        media.preload = 'metadata';
        media.alt = f.name + ' 图 ' + (i + 1);
        // 与照片同一画幅（16:10）：创建即定框，不依赖元数据加载，
        // 避免元数据迟到时视频退回 16:9 兜底框而显得比照片小
        media.style.aspectRatio = '16 / 10';
        // 拿到真实分辨率后仍按视频自身比例修正（当前源即 16:10，无跳变）
        media.addEventListener('loadedmetadata', function () {
          applyNaturalAspect(media, media.videoWidth, media.videoHeight);
        });
      } else {
        media = make('img');
        media.setAttribute('src', src);
        media.alt = f.name + ' 图 ' + (i + 1);
        media.loading = 'lazy';
        // 图片加载完按自身比例撑高外框；complete 分支兜住缓存命中（load 可能已错过）
        media.addEventListener('load', function () {
          applyNaturalAspect(media, media.naturalWidth, media.naturalHeight);
        });
        if (media.complete && media.naturalWidth) {
          applyNaturalAspect(media, media.naturalWidth, media.naturalHeight);
        }
      }
      btn.appendChild(media);

      btn.addEventListener('click', function () { openLightbox(src); });

      shots.appendChild(btn);
    });
    shots.appendChild(fill);

    plate.appendChild(shots);

    /* --- 滚动提示：照片墙放不下时，页脚一条渐隐"纸边"提示可以下滑 ---
       hintB = 底边（下面还有），hintT = 顶边（上面被滑走了）
       两个都挂在 .plate 上而不是滚动容器里，不然会跟着内容一起滚走 */
    var hintB = make('i', 'plate__hint');
    var hintT = make('i', 'plate__hint plate__hint--top');
    plate.appendChild(hintT);
    plate.appendChild(hintB);

    shotsEl = shots;

    /* 布局：量照片实际高度，写入后垫的尺寸。
       提示（hintB / hintT）挂在 .plate 上而不是滚动容器里，不然会跟着内容一起滚走 */
    function layoutShots() {
      if (shotsEl !== shots) return;   // 已经切到别的条目，作废

      // 1) 先把垫子清零，量照片本身有多高（offsetTop 相对本容器，不受滚动影响）
      fill.style.height = '0px';

      var viewH = shots.clientHeight;
      var cs    = window.getComputedStyle(shots);
      var pt    = parseFloat(cs.paddingTop)  || 0;
      var pb    = parseFloat(cs.paddingBottom) || 0;

      var bottom = 0;
      Array.prototype.forEach.call(shots.children, function (n) {
        if (n === fill) return;
        bottom = Math.max(bottom, n.offsetTop + n.offsetHeight);
      });

      // 2) 后垫：先把内容补足到一整屏，再多垫出一小段行程。
      //    这样无论照片几张、哪怕一张都没有，下滑量都一样，只是轻轻推一下
      var area  = viewH - pt - pb;          // 可视内容区高
      var travel = Math.min(300, Math.max(140, Math.round(viewH * 0.35)));
      fill.style.height = (Math.max(0, area - bottom) + travel) + 'px';

      // 4) 顶边渐隐直接贴住页顶（右页已没有姓名页签）
      hintT.style.top = '0px';

      updateHints();
    }

    /* 提示：单独一档，滚动时只更新它，不重量尺寸避免抖动 */
    function updateHints() {
      if (shotsEl !== shots) return;
      var over = shots.scrollHeight - shots.clientHeight > 2;
      shots.classList.toggle('is-overflow', over);
      hintB.classList.toggle('is-on', over && shots.scrollTop + shots.clientHeight < shots.scrollHeight - 4);
      hintT.classList.toggle('is-on', over && shots.scrollTop > 4);

      // 底衬视差：用独立的 translate 属性，不碰纸片自己的 rotate
      for (var i = 0; i < parEls.length; i++) {
        var t = Math.min(64, shots.scrollTop * parEls[i].k);
        parEls[i].el.style.translate = '0 ' + (-t).toFixed(1) + 'px';
      }
    }

    fitShotsFn = layoutShots;
    shots.addEventListener('scroll', updateHints, { passive: true });

    // 容器尺寸一变就重量（窄屏切页的过渡、窗口缩放都走这里，
    // 比"渲染后两帧量一次"可靠——那时过渡还没走完，量到的高度偏小）
    if (shotsRO) shotsRO.disconnect();
    if (window.ResizeObserver) {
      shotsRO = new ResizeObserver(function () { layoutShots(); });
      shotsRO.observe(shots);
    }

    // 图片载入完成后高度可能微调，启动处的 load 监听会再量一次
    // 两帧之后布局稳定再量一次（图片带 aspect-ratio，加载前高度就已确定）
    requestAnimationFrame(function () { requestAnimationFrame(layoutShots); });

    // 右页页脚。字体/分割线样式参考左页 .page__foot
    plate.appendChild(make('footer', 'plate__foot', '世界，充满未解之谜...'));

    stageEl.appendChild(plate);

    // 背景取该好友第一张图片（视频跳过），作为氛围底
    var firstImg = '';
    for (var k = 0; k < gallery.length; k++) {
      if (!isVideo(gallery[k])) { firstImg = gallery[k]; break; }
    }
    setBackdrop(firstImg);
  }

  /* -------------------------------------------------------- 选中 */

  /**
   * @param {string}  id
   * @param {boolean} pushHash    是否同步地址栏为 #/friend/<id>
   * @param {boolean} enterDetail 是否进入"图片页"（窄屏下用于覆盖头像页）
   */
  function select(id, pushHash, enterDetail) {
    var f = findFriend(id) || friends[0];
    if (!f) return;

    var changed = currentId !== f.id;
    currentId = f.id;

    syncActive();
    if (changed) renderPlate(f);

    if (enterDetail) document.body.classList.add('is-detail');

    var hash = '#/friend/' + f.id;
    if (pushHash !== false && location.hash !== hash) {
      location.hash = hash;
    }
  }

  /* -------------------------------------------------------- 路由 */

  function routeFromHash() {
    var m = /^#\/friend\/(.+)$/.exec(location.hash);
    if (m) {
      select(decodeURIComponent(m[1]), false, true);
    } else {
      document.body.classList.remove('is-detail');
    }
  }

  /* -------------------------------------------------- 全屏大图 */

  /* --- 放大层翻页：照片墙布局不变，在这里补充左右浏览能力 ---
     PC 端左右圆钮 + 键盘方向键；手机端左右滑动手势（按钮隐藏） */

  var lbIndex = 0;   // 当前放大层显示的是 gallery 里第几张

  function makeNavBtn(cls, label) {
    var b = make('button', 'lightbox__nav ' + cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.appendChild(make('i'));
    return b;
  }

  var lbPrev = makeNavBtn('lightbox__nav--prev', '上一张');
  var lbNext = makeNavBtn('lightbox__nav--next', '下一张');

  // 点击按钮不要冒泡到遮罩，否则大图会被顺手关掉
  lbPrev.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(-1); });
  lbNext.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(1); });
  lightbox.appendChild(lbPrev);
  lightbox.appendChild(lbNext);

  /** 按当前 lbIndex 重画放大层（媒体 + 标题 + 按钮状态） */
  function renderLightbox() {
    var src = gallery[lbIndex];
    if (!src) return;

    pauseAllVideos(lbMedia);
    lbMedia.textContent = '';

    var el = make('img');   // 放大层只放图片，视频留在墙内播放
    el.setAttribute('src', src);
    el.alt = galleryTitle;
    lbMedia.appendChild(el);

    // 有照片名就显示照片名（如 出土芙蓉），没有则退回好友名
    lbCap.textContent = galleryCaptions[lbIndex] || galleryTitle;

    // 只有一张时不显示按钮；到端点时对应按钮置灰
    var single = gallery.length < 2;
    lbPrev.hidden = single;
    lbNext.hidden = single;
    lbPrev.disabled = lbIndex <= 0;
    lbNext.disabled = lbIndex >= gallery.length - 1;
  }

  /** 翻一张：-1 上一张 / +1 下一张，跳过视频（不进放大层），到端点就停 */
  function stepLightbox(delta) {
    var next = lbIndex + delta;
    while (next >= 0 && next <= gallery.length - 1 && isVideo(gallery[next])) {
      next += delta;
    }
    if (next < 0 || next > gallery.length - 1) return;
    lbIndex = next;
    renderLightbox();
  }

  function openLightbox(src) {
    if (!src || isVideo(src)) return;   // 视频不进放大层：手机端表现异常，墙内直接播放
    lbIndex = gallery.indexOf(src);
    if (lbIndex < 0) lbIndex = 0;
    renderLightbox();
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    // 暂停放大层里的视频（点关闭通常是想离开，不该继续放）
    pauseAllVideos(lbMedia);
    lbMedia.textContent = '';
    if (gallery.length) {
      // 背景恢复：找该好友第一张图片（视频跳过）
      var firstImg = '';
      for (var i = 0; i < gallery.length; i++) {
        if (!isVideo(gallery[i])) { firstImg = gallery[i]; break; }
      }
      setBackdrop(firstImg || gallery[0]);
    }
  }

  // 点击遮罩或媒体本体都关闭大图（caption 已 pointer-events:none，穿透到遮罩）
  lightbox.addEventListener('click', closeLightbox);

  // 放大层里禁止上下/左右滑动（含旧 iOS WebView 对 touch-action 支持不全的情况）。
  // 视频区域放行：拖动进度条等控件操作不应被拦；视频本身不可滚动，放行也不会带跑页面。
  lightbox.addEventListener('touchmove', function (e) {
    if (e.target && e.target.tagName === 'VIDEO') return;
    e.preventDefault();
  }, { passive: false });

  // 手机端左右滑动翻页：横向位移明显大于纵向才算一次，避免误伤上下滑动意图；
  // 视频区域放行（拖进度条不该翻页）。lightbox 自身 touchmove 已拦掉页面滚动
  var swipeX = 0, swipeY = 0, swipeId = null;

  lightbox.addEventListener('touchstart', function (e) {
    if (e.target && e.target.tagName === 'VIDEO') return;
    var t = e.changedTouches[0];
    swipeId = t.identifier;
    swipeX = t.clientX;
    swipeY = t.clientY;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (e) {
    if (swipeId === null) return;
    var t = null;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === swipeId) { t = e.changedTouches[i]; break; }
    }
    swipeId = null;
    if (!t) return;
    var dx = t.clientX - swipeX;
    var dy = t.clientY - swipeY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      stepLightbox(dx < 0 ? 1 : -1);   // 往左滑 = 看下一张
    }
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') stepLightbox(-1);
    else if (e.key === 'ArrowRight') stepLightbox(1);
  });

  /* ------------------------------------------------------ 返回列表 */

  /** 暂停当前右页里的全部视频
   *  返回列表 / 切换好友 / 关闭放大层时都要调，
   *  不然视频会躲在 DOM 里继续放声音 */
  function pauseAllVideos(root) {
    var scope = root || stageEl;
    var vids = scope.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) {
      vids[i].pause();
    }
  }

  /* 收起照片墙回首页：窄屏「返回」、PC「✕」、点击标题「这次又会遇见谁？」共用 */
  function collapseHome() {
    pauseAllVideos();
    document.body.classList.remove('is-detail');
    if (/^#\/friend\//.test(location.hash)) location.hash = '';
  }

  backBtn.addEventListener('click', collapseHome);

  // 左页标题「这次又会遇见谁？」：点击回到首页（不真正跳转，平滑收起）
  var homeLink = document.getElementById('homeLink');
  if (homeLink) {
    homeLink.addEventListener('click', function (e) {
      e.preventDefault();
      collapseHome();
    });
  }

  /* -------------------------------------------------------- 启动 */

  window.addEventListener('hashchange', routeFromHash);

  // 窗口缩放后重新量一遍照片墙（监听只挂一次，操作的是当前条目的墙）
  window.addEventListener('resize', function () {
    if (fitShotsFn) fitShotsFn();
    layoutList();
  });

  // 整页资源载入完成后重量一次（字体/图片会把行高和容器高度顶一下）
  window.addEventListener('load', function () {
    if (fitShotsFn) fitShotsFn();
    layoutList();
  });

  renderGrid();
  layoutList();
  // 字体载入会把行高顶一下，稳定后再量一次
  requestAnimationFrame(function () { requestAnimationFrame(layoutList); });

  // 品牌区右上角的「小虫」形象照卡片：点击进入自己的照片页
  var meBtn = document.getElementById('meBtn');
  if (meBtn && me) {
    meBtn.addEventListener('click', function () { select(me.id, true, true); });
  }

  // 网格容器尺寸一变就重量（窄屏旋转、窗口缩放都走这里）
  if (window.ResizeObserver) {
    new ResizeObserver(layoutList).observe(gridEl);
  }

  var m = /^#\/friend\/(.+)$/.exec(location.hash);
  if (m) {
    select(decodeURIComponent(m[1]), false, true);
  } else if (friends.length) {
    // 默认选中第一位好友：宽屏两页都在，窄屏停留在头像页
    select(friends[0].id, false, false);
  }
})();
