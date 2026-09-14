/* ==========================================================================
   QQR's diary — 好友数据
   --------------------------------------------------------------------------
   新增一位好友 = 在这个数组里加一个对象。字段说明：

   id      唯一标识，用于链接 #/friend/<id>，不可重复
   name    好友名（显示在头像上，以及右侧信息条）
   avatar  头像路径；可以省略，省略时自动取 images 的第一张
   note    一句话备注，显示在右侧信息条
   tags    标签数组，可以留空 []
   images  该好友的全部图片；第一张作为右侧大图默认显示

   提示：下面的名字与内容都是占位，换成你自己的好友昵称即可。
   ========================================================================== */

const FRIENDS = [
  {
    id: 'friend-01',
    name: '温迪',
    avatar: 'assets/img/avatars/av-01.svg',
    note: '在风起地认识的诗人，琴弹得好，名字大概是现编的。',
    tags: ['蒙德', '风元素'],
    images: [
      'assets/img/ph-01.svg',
      'assets/img/ph-05.svg',
      'assets/img/ph-08.svg'
    ]
  },
  {
    id: 'friend-02',
    name: '钟离',
    avatar: 'assets/img/avatars/av-02.svg',
    note: '知识面广得离谱，聊起来能讲一下午璃月的老故事。',
    tags: ['璃月', '岩元素'],
    images: [
      'assets/img/ph-02.svg',
      'assets/img/ph-06.svg'
    ]
  },
  {
    id: 'friend-03',
    name: '影',
    avatar: 'assets/img/avatars/av-03.svg',
    note: '约在鸣神大社躲了一场雨，之后就成了固定搭档。',
    tags: ['稻妻', '雷元素'],
    images: [
      'assets/img/ph-03.svg',
      'assets/img/ph-07.svg',
      'assets/img/ph-01.svg'
    ]
  },
  {
    id: 'friend-04',
    name: '纳西妲',
    avatar: 'assets/img/avatars/av-04.svg',
    note: '带着我在化城郭转了一早上，熟得像本地导游。',
    tags: ['须弥', '草元素'],
    images: [
      'assets/img/ph-04.svg',
      'assets/img/ph-02.svg'
    ]
  },
  {
    id: 'friend-05',
    name: '芙宁娜',
    avatar: 'assets/img/avatars/av-05.svg',
    note: '枫丹廷水下那片断柱就是她带我去的，胆子比我大得多。',
    tags: ['枫丹', '水元素'],
    images: [
      'assets/img/ph-05.svg',
      'assets/img/ph-08.svg'
    ]
  },
  {
    id: 'friend-06',
    name: '玛薇卡',
    avatar: 'assets/img/avatars/av-06.svg',
    note: '爬火山口的时候全程走在最前面，还嫌我慢。',
    tags: ['纳塔', '火元素'],
    images: [
      'assets/img/ph-06.svg',
      'assets/img/ph-03.svg',
      'assets/img/ph-04.svg'
    ]
  }
];
