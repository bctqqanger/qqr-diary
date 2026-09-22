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
  var lbCount  = document.getElementById('lbCount');

  var curtainLayer = document.getElementById('curtainLayer');
  var curtainRope  = document.getElementById('curtainRope');

  // 背景双层，交替淡入实现平滑切换
  var backdrops = [document.getElementById('backdropA'), document.getElementById('backdropB')];
  var backdropTop = 0;

  /* ---------------------------------------------------------- 状态 */

  var currentId       = null;
  var galleryMode     = 'own';  // own = 好友照片，together = 与站主的合影
  var gallery         = [];   // 当前好友的图片列表
  var galleryCaptions = [];   // 与 gallery 一一对应的照片标题
  var galleryTitle    = '';

  var curtainState = 'idle'; // idle = 静止，dropping/lifting = 过渡中
  var curtainTimer = null;
  var curtainDuration = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 80
    : 320;
  /* 幕布落定后的停留时长：遮住画面换内容，停一拍再收起 */
  var curtainHold = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 80
    : 200;
  var curtainToken = 0;

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

  /** 文件名（不含路径）：dims 表按文件名索引 */
  function baseOf(src) {
    return src.split('/').pop();
  }

  /** data.js 里预存的宽高 [w, h]；没写返回 null，交给加载后修正 */
  function dimsOf(f, src) {
    var d = f.dims && f.dims[baseOf(src)];
    return d && d[0] > 0 && d[1] > 0 ? d : null;
  }

  /** 墙内用缩略图（album/thumb/ 下同名文件）；缺失时由 onerror 退回原图。
      视频不用缩略图，走 poster 首帧 */
  function wallSrc(src) {
    return isVideo(src) ? src : src.replace(/([^\/]+)$/, 'thumb/$1');
  }

  /** 视频 poster：与视频同名、后缀 -poster.jpg；没有该文件就退回黑底 */
  function posterOf(src) {
    return src.replace(/\.[^.]+$/, '-poster.jpg');
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

  function updateCurtainLabel(mode) {
    if (!curtainRope) return;
    var activeMode = mode || galleryMode;
    curtainRope.setAttribute(
      'aria-label',
      activeMode === 'together' ? '返回个人照片' : '打开共同相册'
    );
    curtainRope.setAttribute('data-mode', activeMode);
    /* 图案按钮：两张叠放的照片小图标（不含文字），语义走 aria-label */
    curtainRope.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<rect x="2.8" y="5.8" width="13" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<rect x="9.2" y="9.4" width="12" height="9" rx="2" fill="#fcf7ec" stroke="currentColor" stroke-width="1.6"/>' +
      '</svg>';
    curtainRope.setAttribute(
      'aria-busy',
      curtainState === 'dropping' || curtainState === 'lifting' ? 'true' : 'false'
    );
  }

  function setCurtainState(next) {
    curtainState = next;
    if (!curtainLayer) return;
    curtainLayer.setAttribute('data-state', next);
    if (stageEl) stageEl.setAttribute('data-curtain-state', next);
    if (curtainRope) {
      var busy = next === 'dropping' || next === 'lifting';
      curtainRope.disabled = busy;
      updateCurtainLabel();
    }
  }

  function resetCurtain() {
    curtainToken += 1;
    if (curtainTimer) {
      window.clearTimeout(curtainTimer);
      curtainTimer = null;
    }
    setCurtainState('idle');
    if (curtainLayer) curtainLayer.setAttribute('data-mode', 'own');
    updateCurtainLabel('own');
  }

  function toggleCurtain() {
    if (!curtainLayer || !curtainRope) return;
    if (curtainState !== 'idle') return;

    var friend = findFriend(currentId);
    if (!friend) return;
    if (me && friend.id === me.id) return;

    var targetMode = galleryMode === 'together' ? 'own' : 'together';
    var token = ++curtainToken;

    setCurtainState('dropping');
    updateCurtainLabel(targetMode);

    curtainTimer = window.setTimeout(function () {
      curtainTimer = null;
      if (token !== curtainToken || curtainState !== 'dropping' || currentId !== friend.id) return;
      /* 遮住后先换好内容，停留一拍再收幕布 */
      renderPlate(friend, targetMode);
      if (curtainLayer) curtainLayer.setAttribute('data-mode', targetMode);
      curtainTimer = window.setTimeout(function () {
        curtainTimer = null;
        if (token !== curtainToken || curtainState !== 'dropping' || currentId !== friend.id) return;
        setCurtainState('lifting');
        updateCurtainLabel(targetMode);
        curtainTimer = window.setTimeout(function () {
          curtainTimer = null;
          if (token !== curtainToken || curtainState !== 'lifting' || currentId !== friend.id) return;
          setCurtainState('idle');
          if (curtainLayer) curtainLayer.setAttribute('data-mode', targetMode);
          updateCurtainLabel(targetMode);
        }, curtainDuration);
      }, curtainHold);
    }, curtainDuration);
  }

  /**
   * 设置照片墙的尺寸和间距。
   * 初始画幅统一 16:10 兜底（与现有照片/视频一致），媒体真实分辨率到达后
   * 由 applyNaturalAspect 按各自比例修正，避免长时间裁切。
   * @param {number} order 第几张（0 起）
   * @param {number} total 该好友一共几张
   */
  function styleShot(el, order, total) {
    // 统一宽度：等宽两列起排（单张时占列首）
    el.style.setProperty('--w', '41%');

    // 统一间距：只留正边距，行与行不叠压
    el.style.setProperty('--mt', '14px');
    el.style.setProperty('--my', '30px');
    el.style.setProperty('--ml', '0px');
    el.style.setProperty('--mr', '6%');
    // 两列布局里行末那张不吃右边距，照片整体才居中
    if (total >= 2 && (order + 1) % 2 === 0) {
      el.style.setProperty('--mr', '0px');
    }
    // 奇数张时最后一张独占一行，去掉右边距后由 flex 居中，
    // 还原旧版照片墙中底部视频/照片居中的排版。
    if (total % 2 === 1 && order === total - 1) {
      el.style.setProperty('--mr', '0px');
    }
  }

  /**
   * 媒体真实分辨率到达后，把内联 aspect-ratio 设为自身比例。
   * 内联 aspect-ratio 直接作用于媒体元素，外框比例与媒体一致后
   * cover 也不再裁切；再重量一次照片墙居中垫片。
   */
  function applyNaturalAspect(el, width, height) {
    if (!width || !height) return;
    el.style.aspectRatio = width + ' / ' + height;
    requestAnimationFrame(function () { if (fitShotsFn) fitShotsFn(); });
  }

  /* 页面底衬：整页铺一张底图。条目自带的 plate 优先，否则使用默认底图。 */
  function buildDeco(f) {
    var deco = make('div', 'plate__deco');

    // 注意用内联样式赋 URL：外链 CSS 里的相对路径是相对 css 文件解析的，
    // 内联样式才相对页面，data.js 里写的路径才作数
    deco.classList.add('plate__deco--photo');
    deco.style.backgroundImage = 'url("' + (f.plate || 'assets/img/plate/background-04.png') + '")';
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

      // 头顶小表情（如落叶的 🍂）：与站主 🐛 同款半重叠，纯装饰
      if (f.badge) {
        var badge = make('img', 'friend__bug');
        badge.setAttribute('src', f.badge);
        badge.alt = '';
        btn.appendChild(badge);
        btn.classList.add('has-badge');
      }

      var img = make('img', 'friend__avatar');
      img.setAttribute('src', avatarOf(f));
      img.alt = f.name;
      img.loading = 'lazy';
      var portrait = make('span', 'friend__portrait');
      portrait.appendChild(img);
      btn.appendChild(portrait);

      // 名字：带表情的角色（站主🐛/落叶🍂）以表情为名，不渲染文字；
      // 其余好友默认隐藏，悬停时在卡片上方渐显上升浮现
      if (!f.badge) {
        btn.appendChild(make('span', 'friend__name', f.name));
        btn.classList.add('has-name');
      }

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

  function renderPlate(f, mode) {
    // 切换好友前先暂停旧页的视频，免得躲在 DOM 里继续放
    pauseAllVideos();

    galleryMode = mode === 'together' ? 'together' : 'own';
    if (curtainLayer) curtainLayer.setAttribute('data-mode', galleryMode);
    var isMe = !!(me && f.id === me.id);
    if (curtainRope) {
      var hideCurtainControl = isMe && galleryMode === 'own';
      curtainRope.hidden = hideCurtainControl;
      curtainRope.setAttribute('aria-hidden', hideCurtainControl ? 'true' : 'false');
    }
    updateCurtainLabel(galleryMode);

    var together = f.together || {};
    var sourceImages = galleryMode === 'together'
      ? (together.images || [])
      : (f.images || []);
    var sourceCaptions = galleryMode === 'together'
      ? (together.captions || [])
      : (f.captions || []);
    var sourcePlate = galleryMode === 'together'
      ? (together.plate || 'assets/img/plate/background-04.png')
      : f.plate;
    var sourceData = galleryMode === 'together' ? together : f;

    // 好友自己的相册没有图片时退回头像；共同相册保持空白并显示提示。
    gallery = (sourceImages.length ? sourceImages.slice() : (galleryMode === 'own' ? [avatarOf(f)] : []))
      .filter(Boolean);
    galleryCaptions = sourceCaptions.slice();
    galleryTitle = galleryMode === 'together' ? ('我和' + f.name + '的合影') : f.name;

    // 幕布层独立挂在右页上方，过渡期间遮住内容，动画结束后回收离场。
    var oldPlate = stageEl.querySelector('.plate');
    if (oldPlate) oldPlate.remove();

    var plate = make('div', 'plate' + (galleryMode === 'together' ? ' plate--together' : ' plate--own'));

    /* --- 底衬：条目自带的底图，或默认底图 --- */
    var deco = buildDeco({ plate: sourcePlate });
    plate.appendChild(deco);

    /* --- 右页标题：只显示人物名（顶部）；共同相册不显示顶部文案 --- */
    if (galleryMode === 'own') {
      var head = make('header', 'plate__head');
      var headCopy = make('div', 'plate__head-copy');
      headCopy.appendChild(make('h2', 'plate__title', f.name));
      head.appendChild(headCopy);
      /* 右上角留给「共同相册」按钮；站主页没有按钮，保留 ✦ 装饰 */
      if (isMe) head.appendChild(make('span', 'plate__head-mark', '✦'));
      plate.appendChild(head);
    }

    /* --- 照片墙：点任意一张才出全屏大图 --- */
    var shots = make('div', 'plate__grid');

    // 双列瀑布流（masonry 条目专用）：两列各自独立堆叠，
    // 长图只撑自己那列，另一列的照片往上贴，不留行间空白
    var colL = null;
    var colR = null;
    var colHL = 0;   // 两列各自的累计高宽比（h/w）——列宽相同，可当相对高度用
    var colHR = 0;
    if (sourceData.masonry && gallery.length > 1) {
      shots.classList.add('plate__grid--cols');
      colL = make('div', 'plate__col');
      colR = make('div', 'plate__col');
      shots.appendChild(colL);
      shots.appendChild(colR);
    }

    // 隐形后垫：在内容下面永远垫出约小半页的余量，右页随时都能下滑。
    // 照片一律从页顶排起（与落叶的相册页一致），不做垂直居中
    var fill = make('i', 'plate__fill');

    gallery.forEach(function (src, i) {
      var btn = make('button', 'shot');
      btn.type = 'button';
      if (galleryMode === 'together') {
        btn.classList.add('shot--memory-' + ((i % 4) + 1));
      }
      // 有照片名（如 出土芙蓉）就让它当按钮说明；没有退回通用文案
      var cap = sourceCaptions[i] || '';
      var alt = cap || (galleryTitle + ' 图 ' + (i + 1));
      btn.title = cap ? '查看「' + cap + '」' : '点击查看大图';
      btn.setAttribute('aria-label', alt);
      styleShot(btn, i, gallery.length);

      var media;
      if (isVideo(src)) {
        btn.classList.add('shot--video');
        media = make('video');
        media.setAttribute('src', src);
        // poster 首帧：未播放时显示画面而不是一块黑底
        media.setAttribute('poster', posterOf(src));
        media.setAttribute('controls', '');
        media.setAttribute('loop', '');
        media.setAttribute('muted', '');
        media.setAttribute('playsinline', '');
        media.preload = 'metadata';
        // 与照片同一画幅（16:10）：创建即定框，不依赖元数据加载，
        // 避免元数据迟到时视频退回 16:9 兜底框而显得比照片小
        media.style.aspectRatio = '16 / 10';
        // 拿到真实分辨率后仍按视频自身比例修正（当前源即 16:10，无跳变）
        media.addEventListener('loadedmetadata', function () {
          applyNaturalAspect(media, media.videoWidth, media.videoHeight);
        });
      } else {
        media = make('img');
        media.setAttribute('src', wallSrc(src));
        media.alt = alt;
        media.loading = 'lazy';
        // 缩略图缺失时退回原图（换过一次就不再换，原图也挂了就不折腾）
        media.addEventListener('error', function () {
          if (media.getAttribute('src') !== src) media.setAttribute('src', src);
        });
        // 图片加载完按自身比例撑高外框；complete 分支兜住缓存命中（load 可能已错过）
        media.addEventListener('load', function () {
          applyNaturalAspect(media, media.naturalWidth, media.naturalHeight);
        });
        if (media.complete && media.naturalWidth) {
          applyNaturalAspect(media, media.naturalWidth, media.naturalHeight);
        }
      }
      btn.appendChild(media);

      // data.js 预存了真实宽高：建 DOM 即按真实比例定框，加载全程零跳动
      var dd = dimsOf(sourceData, src);
      if (dd) media.style.aspectRatio = dd[0] + ' / ' + dd[1];

      btn.addEventListener('click', function () { openLightbox(src); });

      if (colL) {
        // 按累计高度分列：哪列矮放哪列，两列底部更齐。
        // 宽高未知的按 16:10 估——全未知时退化为左右轮流，与旧奇偶分列一致
        var d = dimsOf(sourceData, src);
        var ratio = d ? d[1] / d[0] : 10 / 16;
        if (colHL <= colHR) { colL.appendChild(btn); colHL += ratio; }
        else                { colR.appendChild(btn); colHR += ratio; }
      } else {
        shots.appendChild(btn);
      }
    });

    if (!gallery.length) {
      // 空条目：给一句占位文案，免得右页像加载失败
      shots.appendChild(make(
        'div',
        'plate__empty',
        galleryMode === 'together' ? '还没有整理和小虫一起的照片~' : '还没有贴照片，先去别处逛逛吧~'
      ));
    }
    shots.appendChild(fill);

    plate.appendChild(shots);

    shotsEl = shots;

    /* 布局：量照片实际高度，写入后垫的尺寸 */
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

      updateHints();
    }

    /* 滚动档：只更新溢出状态，不重量尺寸避免抖动 */
    function updateHints() {
      if (shotsEl !== shots) return;
      var over = shots.scrollHeight - shots.clientHeight > 2;
      shots.classList.toggle('is-overflow', over);

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
    // 个人相册与共同相册文案不同
    plate.appendChild(make(
      'footer',
      'plate__foot',
      galleryMode === 'together' ? '我会好好保存。' : '世界，充满未解之谜...'
    ));

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
    if (changed || galleryMode !== 'own') {
      resetCurtain();
      renderPlate(f, 'own');
    }

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

    lbMedia.textContent = '';

    var el = make('img');   // 放大层只放图片，视频留在墙内播放
    el.setAttribute('src', src);
    el.alt = galleryTitle;
    lbMedia.appendChild(el);

    // 缩放作用对象换成这张新图，并把上一次的缩放/位移清零
    lbZoomImg = el;
    resetZoom();

    // 有照片名就显示照片名（如 出土芙蓉），没有就不显示
    lbCap.textContent = galleryCaptions[lbIndex] || '';

    // 视频留在照片墙中播放，因此计数只统计可放大的图片。
    var imageIndex = 0;
    var imageCount = 0;
    for (var ci = 0; ci < gallery.length; ci++) {
      if (!isVideo(gallery[ci])) {
        if (ci === lbIndex) imageIndex = imageCount;
        imageCount++;
      }
    }
    lbCount.textContent = (imageIndex + 1) + ' / ' + imageCount;

    // 相邻两张原图预取（视频跳过）：翻到时基本秒开
    for (var d = -1; d <= 1; d += 2) {
      var n = lbIndex + d;
      if (n >= 0 && n < gallery.length && !isVideo(gallery[n])) {
        (new Image()).src = gallery[n];
      }
    }

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
    // 缩放状态一并复位，下次打开从原图比例开始
    resetZoom();
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

  /* --- 放大层缩放：滚轮 / 双击 / 双指捏合再放大，放大后可拖拽平移 ---
     图片始终钉在正中，容器依旧不滚动；翻页或关闭时自动复位 */

  var lbZoom = 1, lbTx = 0, lbTy = 0;   // 当前倍率与位移
  var lbZoomImg = null;                 // 缩放作用的图片元素

  /** 把当前倍率/位移写回图片（pop 入场动画会锁 transform，缩放前先摘掉） */
  function applyZoom() {
    if (!lbZoomImg) return;
    if (lbZoomImg.style.animation !== 'none') lbZoomImg.style.animation = 'none';
    lbZoomImg.style.transform =
      'translate(' + lbTx + 'px, ' + lbTy + 'px) scale(' + lbZoom + ')';
    lbZoomImg.classList.toggle('is-zoomed', lbZoom > 1);
  }

  /** 平移限制在放大多出来的那圈空间里，图片拖不出画面 */
  function clampPan() {
    var mx = (lbZoom - 1) * lightbox.clientWidth / 2;
    var my = (lbZoom - 1) * lightbox.clientHeight / 2;
    lbTx = Math.max(-mx, Math.min(mx, lbTx));
    lbTy = Math.max(-my, Math.min(my, lbTy));
  }

  /** 复位：翻页 / 关闭时调用（新图由 renderLightbox 重新指给 lbZoomImg） */
  function resetZoom() {
    lbZoom = 1; lbTx = 0; lbTy = 0;
    if (lbZoomImg) {
      lbZoomImg.style.transform = '';
      lbZoomImg.classList.remove('is-zoomed', 'is-panning');
    }
  }

  /** 以某点（客户区坐标）为不动点缩放到指定倍率，PC 滚轮/双击、手机捏合共用 */
  function zoomTo(clientX, clientY, target) {
    var next = Math.max(1, Math.min(5, target));
    if (next === lbZoom) return;
    // 保持指点不动：t2 = p − (p − t1)·k（p 为该点相对视口中心的偏移）
    var px = clientX - lightbox.clientWidth / 2;
    var py = clientY - lightbox.clientHeight / 2;
    var k = next / lbZoom;
    lbTx = px - (px - lbTx) * k;
    lbTy = py - (py - lbTy) * k;
    lbZoom = next;
    if (lbZoom === 1) { lbTx = 0; lbTy = 0; }
    clampPan();
    applyZoom();
  }

  // 滚轮缩放（PC）：容器本身永不滚动，滚轮全部喂给缩放
  lightbox.addEventListener('wheel', function (e) {
    if (lightbox.hidden) return;
    if (e.target && e.target.tagName === 'VIDEO') return;
    e.preventDefault();
    zoomTo(e.clientX, e.clientY, lbZoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
  }, { passive: false });

  // 鼠标拖拽平移（放大后）：按下拖动看细节
  var panOffX = 0, panOffY = 0, panning = false, panMoved = false;

  lightbox.addEventListener('mousedown', function (e) {
    if (lightbox.hidden || lbZoom <= 1) return;
    if (e.target && e.target.tagName === 'VIDEO') return;
    panning = true;
    panMoved = false;
    panOffX = e.clientX - lbTx;
    panOffY = e.clientY - lbTy;
    if (lbZoomImg) lbZoomImg.classList.add('is-panning');
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!panning) return;
    lbTx = e.clientX - panOffX;
    lbTy = e.clientY - panOffY;
    clampPan();
    panMoved = true;
    applyZoom();
  });

  document.addEventListener('mouseup', function () {
    if (!panning) return;
    panning = false;
    if (lbZoomImg) lbZoomImg.classList.remove('is-panning');
  });

  // 单击关闭与双击缩放共存：单击延迟一小段才关，双击的第二次点击会取消它
  var closeTimer = null;

  lightbox.addEventListener('click', function (e) {
    if (lightbox.hidden) return;
    if (panMoved) { panMoved = false; return; }   // 拖拽平移后的松手不算点击
    if (e.detail > 1) return;                     // 双击的第二次点击，交给 dblclick
    if (e.target && e.target.tagName === 'VIDEO') return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(closeLightbox, 260);
  });

  lightbox.addEventListener('dblclick', function (e) {
    if (lightbox.hidden) return;
    if (e.target && e.target.tagName === 'VIDEO') return;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (lbZoom > 1) {
      resetZoom();
      applyZoom();
    } else {
      zoomTo(e.clientX, e.clientY, 2.5);
    }
  });

  // 放大层里禁止上下/左右滑动（含旧 iOS WebView 对 touch-action 支持不全的情况）。
  // 视频区域放行：拖动进度条等控件操作不应被拦；视频本身不可滚动，放行也不会带跑页面。
  lightbox.addEventListener('touchmove', function (e) {
    if (e.target && e.target.tagName === 'VIDEO') return;
    e.preventDefault();
  }, { passive: false });

  // 手机端手势：单指在原图态 = 左右滑翻页；放大态 = 拖动平移；双指 = 捏合缩放。
  // 视频区域放行（拖进度条不该翻页）。lightbox 自身 touchmove 已拦掉页面滚动
  var swipeX = 0, swipeY = 0, swipeId = null;
  var pinchDist = 0, pinchZoom = 1, pinching = false;
  var panOffTX = 0, panOffTY = 0, touchPanned = false;

  /** 两指间距（捏合缩放用） */
  function touchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lightbox.addEventListener('touchstart', function (e) {
    if (lightbox.hidden) return;
    if (e.target && e.target.tagName === 'VIDEO') return;
    if (e.touches.length === 2) {
      // 双指进入捏合，同时取消本次翻页判定
      pinching = true;
      swipeId = null;
      pinchDist = touchDist(e);
      pinchZoom = lbZoom;
      // 捏合全程关掉 transform 过渡：每帧直写紧跟手指，
      // 否则 0.22s 过渡逐帧重启动，画面会「追手」发肉
      if (lbZoomImg) lbZoomImg.classList.add('is-panning');
      return;
    }
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    swipeId = t.identifier;
    swipeX = t.clientX;
    swipeY = t.clientY;
    if (lbZoom > 1) {   // 放大态单指 = 平移
      touchPanned = false;
      panOffTX = lbTx - t.clientX;
      panOffTY = lbTy - t.clientY;
      if (lbZoomImg) lbZoomImg.classList.add('is-panning');
    }
  }, { passive: true });

  lightbox.addEventListener('touchmove', function (e) {
    if (lightbox.hidden) return;
    if (e.target && e.target.tagName === 'VIDEO') return;
    e.preventDefault();
    if (pinching && e.touches.length === 2) {
      var d = touchDist(e);
      if (pinchDist > 0 && d > 0) {
        var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomTo(midX, midY, pinchZoom * d / pinchDist);
      }
      return;
    }
    if (lbZoom > 1 && swipeId !== null && e.touches.length === 1) {
      var t = e.touches[0];
      lbTx = t.clientX + panOffTX;
      lbTy = t.clientY + panOffTY;
      clampPan();
      touchPanned = true;
      applyZoom();
    }
  }, { passive: false });

  lightbox.addEventListener('touchend', function (e) {
    if (pinching) {
      if (e.touches.length < 2) {
        pinching = false;
        pinchDist = 0;
        // 捏合结束恢复过渡，滚轮/双击等仍有平滑动画（松手瞬间无位移，无感）
        if (lbZoomImg) lbZoomImg.classList.remove('is-panning');
      }
      if (e.touches.length === 0) swipeId = null;
      return;
    }
    if (lbZoomImg) lbZoomImg.classList.remove('is-panning');
    if (swipeId === null) return;
    var t = null;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === swipeId) { t = e.changedTouches[i]; break; }
    }
    swipeId = null;
    if (!t) return;
    if (touchPanned) { touchPanned = false; return;   // 平移过就不翻页
    }
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
    resetCurtain();
    document.body.classList.remove('is-detail');
    if (/^#\/friend\//.test(location.hash)) location.hash = '';
  }

  backBtn.addEventListener('click', collapseHome);

  if (curtainRope) curtainRope.addEventListener('click', toggleCurtain);

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
