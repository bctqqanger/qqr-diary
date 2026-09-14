/* ==========================================================================
   QQR's diary — 交互
   页面形态：一本摊开的书
     左页 = 好友头像网格（每行多个矩形，点击选中）
     右页 = 该好友的图片小图网格（点小图才弹出全屏大图）
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
  var lbCount  = document.getElementById('lbCount');
  var lbClose  = document.getElementById('lbClose');
  var lbPrev   = document.getElementById('lbPrev');
  var lbNext   = document.getElementById('lbNext');

  // 背景双层，交替淡入实现平滑切换
  var backdrops = [document.getElementById('backdropA'), document.getElementById('backdropB')];
  var backdropTop = 0;

  /* ---------------------------------------------------------- 状态 */

  var currentId    = null;
  var gallery      = [];   // 当前好友的图片列表
  var imageIndex   = 0;    // 当前正在看第几张（大图用）
  var galleryTitle = '';

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
    // 该好友的图片；没有图片时退回头像，保证右页不会空着
    gallery = (f.images && f.images.length ? f.images.slice() : [avatarOf(f)]).filter(Boolean);
    galleryTitle = f.name;
    imageIndex = 0;

    stageEl.textContent = '';

    var plate = make('div', 'plate');

    /* --- 紧凑头部：右页的文字只剩这一小块 --- */
    var head = make('div', 'plate__head');
    head.appendChild(make('h2', 'plate__title', f.name));

    var meta = make('div', 'plate__meta');
    meta.appendChild(make('span', null, gallery.length + ' 张图片'));
    (f.tags || []).forEach(function (t) { meta.appendChild(make('span', 'tag', t)); });
    head.appendChild(meta);

    if (f.note) head.appendChild(make('p', 'plate__note', f.note));

    plate.appendChild(head);

    /* --- 小图网格：只放小图，点任意一张才出全屏大图 --- */
    var shots = make('div', 'plate__grid');
    gallery.forEach(function (src, i) {
      var btn = make('button', 'shot');
      btn.type = 'button';
      btn.title = '点击查看大图';

      var img = make('img');
      img.setAttribute('src', src);
      img.alt = f.name + ' 图 ' + (i + 1);
      img.loading = 'lazy';
      btn.appendChild(img);

      btn.addEventListener('click', function () { openLightbox(i); });

      shots.appendChild(btn);
    });
    plate.appendChild(shots);

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

  function clampIndex() {
    if (imageIndex < 0) imageIndex = 0;
    if (imageIndex > gallery.length - 1) imageIndex = gallery.length - 1;
  }

  function paintLightbox() {
    clampIndex();

    var src = gallery[imageIndex];
    if (!src) return;

    lbImg.setAttribute('src', src);
    lbImg.alt = galleryTitle + ' 图 ' + (imageIndex + 1);
    lbCap.textContent = galleryTitle;
    lbCount.textContent = (imageIndex + 1) + ' / ' + gallery.length;

    var single = gallery.length < 2;
    lbPrev.hidden = single;
    lbNext.hidden = single;
    lbCount.hidden = single;
  }

  function openLightbox(index) {
    if (!gallery.length) return;
    imageIndex = typeof index === 'number' ? index : imageIndex;
    paintLightbox();
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    lbImg.setAttribute('src', '');
    // 背景停在刚看过的那张
    setBackdrop(gallery[imageIndex]);
  }

  function stepLightbox(delta) {
    if (gallery.length < 2) return;
    imageIndex = (imageIndex + delta + gallery.length) % gallery.length;
    paintLightbox();
  }

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(-1); });
  lbNext.addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(1); });

  // 点击大图以外的任何位置（遮罩）即关闭
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      stepLightbox(-1);
    } else if (e.key === 'ArrowRight') {
      stepLightbox(1);
    }
  });

  /* ------------------------------------------------------ 返回列表 */

  backBtn.addEventListener('click', function () {
    document.body.classList.remove('is-detail');
    if (/^#\/friend\//.test(location.hash)) location.hash = '';
  });

  /* -------------------------------------------------------- 启动 */

  window.addEventListener('hashchange', routeFromHash);

  renderGrid();

  var m = /^#\/friend\/(.+)$/.exec(location.hash);
  if (m) {
    select(decodeURIComponent(m[1]), false, true);
  } else if (friends.length) {
    // 默认选中第一位好友：宽屏两页都在，窄屏停留在头像页
    select(friends[0].id, false, false);
  }
})();
