/* ==========================================================================
   小虫记 — 交互
   页面形态：一本摊开的书
     左页 = 条目卡片墙（逸闻纪事式立绘卡，点击选中）
     右页 = 该条目的照片墙（照片错落摆放，点一张才弹出全屏大图）
     书外 = 跟随当前图片虚化的背景
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------ 数据 */

  var friends = (typeof FRIENDS !== 'undefined' ? FRIENDS : []).slice();

  /* ------------------------------------------------------------ DOM */

  var gridEl  = document.getElementById('grid');
  var stageEl = document.getElementById('stage');
  var statEl  = document.getElementById('statCount');
  var backBtn = document.getElementById('backBtn');

  var lightbox = document.getElementById('lightbox');
  var lbImg    = document.getElementById('lbImg');
  var lbCap    = document.getElementById('lbCap');

  // 背景双层，交替淡入实现平滑切换
  var backdrops = [document.getElementById('backdropA'), document.getElementById('backdropB')];
  var backdropTop = 0;

  /* ---------------------------------------------------------- 状态 */

  var currentId    = null;
  var gallery      = [];   // 当前好友的图片列表
  var galleryTitle = '';

  /* 当前右页的照片墙与自适应函数（换条目时整体换新引用，
     resize 监听只挂一次，始终操作最新的一组） */
  var shotsEl    = null;
  var fitShotsFn = null;
  var shotsRO    = null;   // 容器尺寸监听，换条目时换新

  /* ---------------------------------------------------------- 工具 */

  function findFriend(id) {
    for (var i = 0; i < friends.length; i++) {
      if (friends[i].id === id) return friends[i];
    }
    return null;
  }

  /** 头像：优先取 avatar 字段，缺省时用第一张图片 */
  function avatarOf(f) {
    if (f.avatar) return f.avatar;
    if (f.images && f.images.length) return f.images[0];
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
   * 以 seed 为基准取一组错落参数，写进元素的 CSS 变量。
   * @param {number} order 第几张（0 起）
   * @param {number} total 该好友一共几张
   */
  function scatter(el, seed, order, total) {
    var rot = hash01(seed + 'rot');
    var wid = hash01(seed + 'wid');
    var dx  = hash01(seed + 'dx');
    var dy  = hash01(seed + 'dy');
    var my  = hash01(seed + 'my');
    var mx  = hash01(seed + 'mx');
    var z   = hash01(seed + 'z');
    var ar  = hash01(seed + 'ar');
    var sc  = hash01(seed + 'sc');

    var aspects = ['16 / 9', '4 / 3', '3 / 2'];

    // 角度只在 ±5° 内摆：参考图那样"随手一放"，而不是东倒西歪
    el.style.setProperty('--rot', ((rot * 2 - 1) * 5).toFixed(2) + 'deg');
    el.style.setProperty('--dx',  ((dx * 2 - 1) * 10).toFixed(1) + 'px');
    el.style.setProperty('--dy',  ((dy * 2 - 1) * 9).toFixed(1) + 'px');
    el.style.setProperty('--sc',  (0.96 + sc * 0.08).toFixed(3));
    // 层级随顺序递增（右边的压在左边上），标牌才不会互相遮住
    el.style.setProperty('--z',   String(order * 4 + Math.round(z * 3) + 1));
    el.style.setProperty('--ar',  aspects[Math.floor(ar * aspects.length) % aspects.length]);

    if (total === 2) {
      // 两张：左右并排，一高一低斜着摆。
      // 宽度压在半页内才放得进同一行，纵向大幅错开把页面填满。
      el.style.setProperty('--w',  (46 + wid * 4).toFixed(1) + '%');
      var low = (order === 0) === (hash01(seed + 'stag') > 0.5);
      el.style.setProperty('--mt', (low ? 208 + my * 92 : 40 + my * 68).toFixed(1) + 'px');
      el.style.setProperty('--my', '12px');
      // 左边留一点正边距，行首照片不会往左漂出页面；右边取负，靠重叠产生错落感
      el.style.setProperty('--ml', (2 + mx * 4).toFixed(1) + 'px');
      el.style.setProperty('--mr', (-(14 + mx * 28)).toFixed(1) + 'px');
    } else {
      // 一张整体放大；三张以上压到半页以内，两两并排成两行
      var wMin = total >= 3 ? 42 : 70;
      var wMax = total >= 3 ? 49 : 86;
      el.style.setProperty('--w',  (wMin + wid * (wMax - wMin)).toFixed(1) + '%');
      // 纵向留白一致，给照片左下角的标牌腾地方，行与行不互相叠压
      var m = ((my * 2 - 1) * 5 + 13).toFixed(1) + 'px';
      el.style.setProperty('--mt', m);
      el.style.setProperty('--my', m);
      el.style.setProperty('--ml', (2 + mx * 4).toFixed(1) + 'px');
      el.style.setProperty('--mr', (-(7 + mx * 25)).toFixed(1) + 'px');
    }
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

  /* ------------------------------------------ 右页：好友图片小图 */

  function renderPlate(f) {
    // 该条目的图片；blank 条目右页留白不摆照片，
    // 其余没有图片时退回头像，保证右页不会空着
    gallery = (f.blank
      ? []
      : (f.images && f.images.length ? f.images.slice() : [avatarOf(f)])
    ).filter(Boolean);
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

    /* --- 紧凑头部：右页只保留姓名 --- */
    var head = make('div', 'plate__head');
    head.appendChild(make('h2', 'plate__title', f.name));

    plate.appendChild(head);

    /* --- 照片墙：错落摆放的小照片，点任意一张才出全屏大图 --- */
    var shots = make('div', 'plate__grid');

    // 一前一后两个隐形垫子：前垫把不满一页的照片顶到垂直居中；
    // 后垫在内容下面永远垫出约小半页的余量，右页随时都能下滑
    var lead = make('i', 'plate__lead');
    var fill = make('i', 'plate__fill');
    shots.appendChild(lead);

    gallery.forEach(function (src, i) {
      var btn = make('button', 'shot');
      btn.type = 'button';
      btn.title = '点击查看大图';
      scatter(btn, f.id + '|' + i + '|' + src, i, gallery.length);

      var img = make('img');
      img.setAttribute('src', src);
      img.alt = f.name + ' 图 ' + (i + 1);
      img.loading = 'lazy';
      btn.appendChild(img);

      // 可选：data.js 里给了 captions 才显示照片下方的小字
      var cap = f.captions && f.captions[i];
      if (cap) btn.appendChild(make('span', 'shot__cap', cap));

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

    /* 布局：量照片实际高度，写入两个垫子的尺寸。
       提示（hintB / hintT）挂在 .plate 上而不是滚动容器里，不然会跟着内容一起滚走 */
    function layoutShots() {
      if (shotsEl !== shots) return;   // 已经切到别的条目，作废

      // 1) 先把垫子清零，量照片本身有多高（offsetTop 相对本容器，不受滚动影响）
      lead.style.height = '0px';
      fill.style.height = '0px';

      var viewH = shots.clientHeight;
      var cs    = window.getComputedStyle(shots);
      var pt    = parseFloat(cs.paddingTop)  || 0;
      var pb    = parseFloat(cs.paddingBottom) || 0;

      var bottom = 0;
      Array.prototype.forEach.call(shots.children, function (n) {
        if (n === lead || n === fill) return;
        bottom = Math.max(bottom, n.offsetTop + n.offsetHeight);
      });

      // 2) 前垫：照片不满一页时顶到视觉居中；放不下时归零（顶部对齐）
      var area  = viewH - pt - pb;          // 可视内容区高
      var leadH = 0;
      if (bottom && bottom + pb + pt <= viewH) {
        leadH = Math.max(0, Math.floor((viewH - bottom - pb - pt) / 2));
      }
      lead.style.height = leadH + 'px';

      // 3) 后垫：先把内容补足到一整屏，再多垫出一小段行程。
      //    这样无论照片几张、哪怕一张都没有，下滑量都一样，只是轻轻推一下
      var travel = Math.min(300, Math.max(140, Math.round(viewH * 0.35)));
      var used   = leadH + bottom;
      fill.style.height = (Math.max(0, area - used) + travel) + 'px';

      // 4) 顶边渐隐落在姓名牌下方：两者叠在一起时页签会被渐变冲淡
      hintT.style.top = (head.offsetTop + head.offsetHeight) + 'px';

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

    stageEl.appendChild(plate);

    // 背景取该好友的第一张，作为氛围底
    setBackdrop(gallery[0]);
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

  function openLightbox(src) {
    if (!src) return;
    lbImg.setAttribute('src', src);
    lbImg.alt = galleryTitle;
    lbCap.textContent = galleryTitle;
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    lbImg.setAttribute('src', '');
    if (gallery.length) setBackdrop(gallery[0]);
  }

  // 点击图片以外的任何位置（即遮罩本身）即关闭大图
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  // 点图片本身也能关（点击体验更顺滑）
  lbImg.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
  });

  /* ------------------------------------------------------ 返回列表 */

  backBtn.addEventListener('click', function () {
    document.body.classList.remove('is-detail');
    if (/^#\/friend\//.test(location.hash)) location.hash = '';
  });

  /* -------------------------------------------------------- 启动 */

  window.addEventListener('hashchange', routeFromHash);

  // 窗口缩放后重新量一遍照片墙（监听只挂一次，操作的是当前条目的墙）
  window.addEventListener('resize', function () {
    if (fitShotsFn) fitShotsFn();
  });

  // 整页资源载入完成后重量一次（字体/图片会把行高和容器高度顶一下）
  window.addEventListener('load', function () {
    if (fitShotsFn) fitShotsFn();
  });

  renderGrid();

  var m = /^#\/friend\/(.+)$/.exec(location.hash);
  if (m) {
    select(decodeURIComponent(m[1]), false, true);
  } else if (friends.length) {
    // 默认选中第一位好友：宽屏两页都在，窄屏停留在头像页
    select(friends[0].id, false, false);
  }
})();
