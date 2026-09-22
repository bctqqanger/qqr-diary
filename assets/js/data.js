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
   captions 与 images 一一对应的照片标题，点开全屏大图时显示在图片下方；
            留空数组或删掉这个字段，放大层就退回显示好友名
   together 可选。与站主一起拍摄的照片相册，格式为：
            { images: [], captions: [], dims: {}, plate: '可选底图', masonry: false }
   images  该条目的全部图片
   dims    可选。图片/视频的真实宽高（键 = images 里的文件名，值 = [宽, 高]）。
           写了就不等图片下载完、一建 DOM 就按真实比例摆好，加载全程零跳动。
           新图可以不写，加载后仍会自动修正，只是首屏会有一次小小的撑高
   墙内缩略图（自动启用，不用配置）：把与原图同名、同后缀的文件放到
           assets/img/album/thumb/ 即可；没有缩略图的图自动退回原图。
           视频 poster：与视频同名、后缀 -poster.jpg（如 guli-01-poster.jpg）

   提示：名字与图片均为占位，换成自己的内容即可。
   ========================================================================== */

const FRIENDS = [
  {
    id: 'friend-02',
    name: '陨星',
    avatar: 'assets/img/avatars/yunxing.jpg',
    plate: 'assets/img/plate/yunxing.jpg',
    images: [
      'assets/img/album/yunxing-04.jpg',
      'assets/img/album/yunxing-05.jpg',
      'assets/img/album/yunxing-06.jpg',
      'assets/img/album/yunxing-07.jpg',
      'assets/img/album/yunxing-08.jpg'
    ],
    dims: {
      'yunxing-04.jpg': [960, 504],
      'yunxing-05.jpg': [1920, 868],
      'yunxing-06.jpg': [1920, 868],
      'yunxing-07.jpg': [1920, 868],
      'yunxing-08.jpg': [1920, 868]
    },
    captions: [],
    together: {
      images: [
        'assets/img/album/yunxing-memory-01.png',
        'assets/img/album/yunxing-memory-02.png',
        'assets/img/album/yunxing-memory-03.png'
      ],
      dims: {
        'yunxing-memory-01.png': [2560, 1600],
        'yunxing-memory-02.png': [2560, 1600],
        'yunxing-memory-03.png': [2560, 1600]
      },
      captions: []
    }
  },
  {
    id: 'friend-01',
    name: '爱与诚',
    avatar: 'assets/img/avatars/aicheng.jpg',
    images: [
      'assets/img/album/aicheng-01.jpg',
      'assets/img/album/aicheng-02.jpg',
      'assets/img/album/aicheng-03.jpg'
    ],
    dims: {
      'aicheng-01.jpg': [2400, 1080],
      'aicheng-02.jpg': [2400, 1080],
      'aicheng-03.jpg': [1800, 810]
    },
    captions: []
  },
  {
    id: 'friend-03',
    name: '落叶',
    avatar: 'assets/img/avatars/luoye.jpg',
    badge: 'assets/img/leaf-apple.png',
    plate: 'assets/img/plate/luoye.jpg',
    images: [
      'assets/img/album/luoye-01.jpg',
      'assets/img/album/luoye-02.jpg',
      'assets/img/album/luoye-03.jpg',
      'assets/img/album/luoye-04.jpg'
    ],
    dims: {
      'luoye-01.jpg': [1915, 821],
      'luoye-02.jpg': [1847, 852],
      'luoye-03.jpg': [1846, 852],
      'luoye-04.jpg': [2340, 1080]
    },
    captions: [],
    together: {
      images: [
        'assets/img/album/luoye-memory-01.jpg',
        'assets/img/album/luoye-memory-02.jpg',
        'assets/img/album/luoye-memory-03.jpg',
        'assets/img/album/luoye-memory-01.mp4'
      ],
      dims: {
        'luoye-memory-01.jpg': [1440, 900],
        'luoye-memory-02.jpg': [1440, 900],
        'luoye-memory-03.jpg': [1440, 900],
        'luoye-memory-01.mp4': [1728, 1080]
      },
      captions: ['', '', '', '索敌']
    }
  },
  /* —— 故里：暂时隐藏，配置保留，需要时取消注释即可恢复 ——
  {
    id: 'friend-04',
    name: '故里',
    avatar: 'assets/img/avatars/guli.png',
    images: [],
    captions: [],
    together: {
      images: ['assets/img/album/guli-memory-01.mp4'],
      dims: {
        'guli-memory-01.mp4': [1280, 800]
      },
      captions: ['尘世闲游']
    }
  },
  */
  {
    id: 'friend-04',
    name: '江亱',
    avatar: 'assets/img/avatars/jiangdan.jpg',
    plate: 'assets/img/plate/jiangdan.jpg',
    images: [
      'assets/img/album/jiangdan-01.jpg',
      'assets/img/album/jiangdan-02.jpg',
      'assets/img/album/jiangdan-03.jpg',
      'assets/img/album/jiangdan-04.jpg',
      'assets/img/album/jiangdan-05.jpg'
    ],
    dims: {
      'jiangdan-01.jpg': [1920, 864],
      'jiangdan-02.jpg': [1920, 864],
      'jiangdan-03.jpg': [1920, 864],
      'jiangdan-04.jpg': [1920, 864],
      'jiangdan-05.jpg': [1920, 864]
    },
    captions: []
  },
  {
    id: 'friend-05',
    name: '空白',
    avatar: 'assets/img/avatars/kongbai.jpg',
    plate: 'assets/img/plate/kongbai.jpg',
    images: [],
    captions: []
  },
  {
    id: 'friend-06',
    name: '枫叶の诗',
    avatar: 'assets/img/avatars/fengye.jpg',
    plate: 'assets/img/plate/fengye.jpg',
    images: [
      'assets/img/album/fengye-01.png',
      'assets/img/album/fengye-02.png',
      'assets/img/album/fengye-03.png',
      'assets/img/album/fengye-04.png',
      'assets/img/album/fengye-05.png',
      'assets/img/album/fengye-06.png',
      'assets/img/album/fengye-07.png'
    ],
    dims: {
      'fengye-01.png': [2560, 1600],
      'fengye-02.png': [2560, 1600],
      'fengye-03.png': [2560, 1600],
      'fengye-04.png': [2560, 1600],
      'fengye-05.png': [2560, 1600],
      'fengye-06.png': [2560, 1600],
      'fengye-07.png': [2560, 1600]
    },
    captions: []
  }
];

/* 站主本人「小虫」：与其他角色同样式的形象照卡片，放在品牌区右上角 */
const ME = {
  id: 'me',
  name: '小虫',
  avatar: 'assets/img/avatars/xiaochong.png',
  masonry: true,   /* PC 端照片墙双列瀑布流：长图只撑自己那列 */
  images: [
    'assets/img/album/xiaochong-01.png',
    'assets/img/album/xiaochong-02.jpg',
    'assets/img/album/xiaochong-03.png',
    'assets/img/album/xiaochong-04.jpg'
  ],
  dims: {
    'xiaochong-01.png': [2560, 1600],
    'xiaochong-02.jpg': [1179, 2556],
    'xiaochong-03.png': [2560, 1600],
    'xiaochong-04.jpg': [4032, 3024]
  },
  captions: []
};
