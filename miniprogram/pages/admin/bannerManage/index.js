// 获取全局 App 实例（检查管理员权限）
const app = getApp();

// Page() 注册管理员轮播图管理页——新增/删除/上下移动排序轮播图
Page({
  // data 页面初始数据
  data: {
    banners: []                                     // 轮播图列表（从服务端加载，含 _id, imageUrl, sortOrder）
  },

  // onShow 每次页面显示时触发——检查管理员权限并加载轮播图
  onShow: function () {
    if (!app.globalData.isAdmin) {                  // 非管理员拦截
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1500); // 1.5 秒后自动返回
      return;
    }
    this.loadBanners();                             // 权限通过后加载轮播图列表
  },

  // loadBanners 通过云函数加载所有轮播图
  loadBanners: function () {
    var that = this;
    wx.cloud.callFunction({                          // 调用统一云函数入口
      name: 'timeShardsDB',
      data: { type: 'getBanners' }                  // 路由到 getBanners 子模块
    }).then(function (res) {
      if (res.result.success) {                      // 确认服务端返回成功
        that.setData({ banners: res.result.data });  // 设置轮播图列表
      }
    });
  },

  // addBanner 新增轮播图——先选图 → 上传云存储 → 写数据库
  addBanner: function () {
    var that = this;
    wx.chooseImage({                                 // 调起微信图片选择
      count: 1,                                     // 每次只能添加一张
      sizeType: ['compressed'],                     // 压缩图片以节省流量和存储
      sourceType: ['album', 'camera'],              // 来源：相册或拍照
      success: function (res) {
        wx.showLoading({ title: '上传中...' });
        wx.cloud.uploadFile({                        // 上传到云存储
          cloudPath: 'TimeShardsInfo/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.png', // 随机唯一文件名
          filePath: res.tempFilePaths[0]             // 本地临时文件路径
        }).then(function (uploadRes) {
          // 图片上传成功后，调用云函数写入数据库
          wx.cloud.callFunction({
            name: 'timeShardsDB',
            data: { type: 'addBanner', imageUrl: uploadRes.fileID } // 路由到 addBanner 子模块
          }).then(function () {
            wx.hideLoading();
            wx.showToast({ title: '已添加', icon: 'success' });
            that.loadBanners();                      // 刷新列表
          });
        }).catch(function () {
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      }
    });
  },

  // deleteBanner 删除指定轮播图——弹窗确认后通过云函数删除
  deleteBanner: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;             // 获取轮播图 _id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复',
      success: function (res) {
        if (res.confirm) {                           // 用户确认删除
          wx.cloud.callFunction({
            name: 'timeShardsDB',
            data: { type: 'deleteBanner', id: id },  // 路由到 deleteBanner 子模块
            success: function () {
              wx.showToast({ title: '已删除', icon: 'success' });
              that.loadBanners();                    // 刷新列表
            }
          });
        }
      }
    });
  },

  // moveUp 将轮播图上移一位（sortOrder 交换）
  moveUp: function (e) {
    this.swapSort(e, -1);                           // direction = -1 = 向上
  },

  // moveDown 将轮播图下移一位
  moveDown: function (e) {
    this.swapSort(e, 1);                            // direction = 1 = 向下
  },

  // swapSort 与相邻轮播图交换 sortOrder 排序值——本地立即更新 UI + 后台异步同步
  swapSort: function (e, direction) {
    var that = this;
    var id = e.currentTarget.dataset.id;             // 获取要移动的轮播图 _id
    var banners = this.data.banners.slice();          // 浅拷贝数组，避免直接修改 data
    var idx = banners.findIndex(function (b) { return b._id === id; }); // 查找目标索引
    if (idx === -1) return;                          // 未找到，退出
    var targetIdx = idx + direction;                 // 计算目标位置
    if (targetIdx < 0 || targetIdx >= banners.length) return; // 超出边界，退出

    // 本地立即交换 sortOrder，UI 即时刷新（乐观更新）
    var a = banners[idx];                            // 当前项
    var b = banners[targetIdx];                      // 目标项
    var tmp = a.sortOrder;                           // 临时保存当前项的排序值
    a.sortOrder = b.sortOrder;                       // 当前项获得目标项的排序值
    b.sortOrder = tmp;                               // 目标项获得当前项的排序值
    banners[idx] = b;                                // 数组中交换位置
    banners[targetIdx] = a;
    that.setData({ banners: banners });              // 马上更新 UI

    // 后台异步同步到数据库（两次调用分别更新两条记录的 sortOrder）
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'updateBannerSort', id: a._id, sortOrder: a.sortOrder }, // 更新第一条
      success: function () {
        // 第一条更新成功后更新第二条
        wx.cloud.callFunction({
          name: 'timeShardsDB',
          data: { type: 'updateBannerSort', id: b._id, sortOrder: b.sortOrder } // 更新第二条
        });
      }
    });
  }
});
