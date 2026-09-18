/* ==========================================================================
   小虫友记 — 条目数据
   --------------------------------------------------------------------------
   新增一个条目 = 在这个数组里加一个对象。字段说明：

   id      唯一标识，用于链接 #/friend/<id>，不可重复
   name    名称（显示在左侧卡片姓名牌，以及右侧页签）
   avatar  立绘路径；可以省略，省略时自动取 images 的第一张。
           还没画好立绘的条目，可以先指向 assets/img/avatars/placeholder.svg
           （一张暖色风景占位卡，比灰底剪影好看，也不至于让人以为是图挂了）
   plate   右页底图路径；省略时用默认的奶油底衬（纸屑 + 太阳 + 气球），
           给了图就整页铺这张图，并自动压一层浅色蒙版让它不喧宾夺主
   note    一句话备注（当前页面未展示，留着备查）
   tags    标签数组，可以留空 []（当前页面未展示）
   captions 与 images 一一对应的照片标题，点开全屏大图时显示在图片下方；
            留空数组或删掉这个字段，放大层就退回显示好友名
   images  该条目的全部图片

   提示：名字与图片均为占位，换成自己的内容即可。
   ========================================================================== */

const FRIENDS = [
  {
    id: 'friend-01',
    name: '爱与诚',
    avatar: 'assets/img/avatars/placeholder.svg',
    note: '占位：爱与诚。',
    tags: [],
    images: [],
    captions: []
  },
  {
    id: 'friend-02',
    name: '陨星',
    avatar: 'assets/img/avatars/yunxing.png',
    note: '占位：陨星。',
    tags: [],
    images: [
      'assets/img/album/yunxing-01.jpg',
      'assets/img/album/yunxing-02.jpg',
      'assets/img/album/yunxing-03.jpg'
    ],
    captions: []
  },
  {
    id: 'friend-03',
    name: '落叶',
    avatar: 'assets/img/avatars/luoye.png',
    plate: 'assets/img/plate/luoye.jpg',
    note: '占位：落叶。',
    tags: [],
    images: [
      'assets/img/album/luoye-01.jpg',
      'assets/img/album/luoye-02.jpg',
      'assets/img/album/luoye-03.jpg'
    ],
    captions: ['出土芙蓉', '对望', '那个女孩']
  },
  {
    id: 'friend-04',
    name: '故里',
    avatar: 'assets/img/avatars/guli.png',
    note: '占位：故里。',
    tags: [],
    images: [
      'assets/img/album/guli-01.mp4'
    ],
    captions: ['尘世闲游']
  },
  {
    id: 'friend-05',
    name: '空白',
    avatar: 'assets/img/avatars/placeholder.svg',
    note: '占位：空白。',
    tags: [],
    images: [],
    captions: []
  }
];

/* 站主本人「小虫」：与其他角色同样式的形象照卡片，放在品牌区右上角 */
const ME = {
  id: 'me',
  name: '小虫',
  avatar: 'assets/img/avatars/xiaochong.png',
  note: '站主本人。',
  images: [
    'assets/img/album/xiaochong-01.jpg',
    'assets/img/album/xiaochong-02.jpg',
    'assets/img/album/xiaochong-03.jpg',
    'assets/img/album/xiaochong-04.jpg'
  ],
  captions: []
};
