/* ==========================================================================
   小虫记 — 条目数据
   --------------------------------------------------------------------------
   新增一个条目 = 在这个数组里加一个对象。字段说明：

   id      唯一标识，用于链接 #/friend/<id>，不可重复
   name    名称（显示在左侧卡片姓名牌，以及右侧页签）
   avatar  立绘路径；可以省略，省略时自动取 images 的第一张
   plate   右页底图路径；省略时用默认的奶油底衬（纸屑 + 太阳 + 气球），
           给了图就整页铺这张图，并自动压一层浅色蒙版让它不喧宾夺主
   blank   设为 true 时右页完全不摆照片，只留姓名与底衬（"空白"页）
   note    一句话备注（当前页面未展示，留着备查）
   tags    标签数组，可以留空 []（当前页面未展示）
   captions 与 images 一一对应的照片标题，显示在右侧照片左下角的小白牌上；
            留空数组或删掉这个字段，照片就不带标题
   images  该条目的全部图片

   提示：名字与图片均为占位，换成自己的内容即可。
   ========================================================================== */

const FRIENDS = [
  {
    id: 'friend-01',
    name: '落叶',
    avatar: 'assets/img/avatars/luoye.png',
    plate: 'assets/img/plate/luoye.jpg',
    note: '占位：落叶。',
    tags: [],
    images: [
      'assets/img/album/luoye-01.jpg',
      'assets/img/album/luoye-02.jpg',
      'assets/img/album/luoye-03.jpg'
    ]
  },
  {
    id: 'friend-02',
    name: '故里',
    avatar: 'assets/img/avatars/av-08.svg',
    note: '占位：故里。',
    tags: [],
    images: [
      'assets/img/ph-02.svg',
      'assets/img/ph-05.svg'
    ]
  },
  {
    id: 'friend-03',
    name: '空白',
    avatar: 'assets/img/avatars/blank.svg',
    blank: true,
    note: '占位：空白。',
    tags: [],
    images: []
  }
];