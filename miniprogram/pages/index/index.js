// 获取全局 App 实例
const app = getApp();
// 引入公共工具函数——formatTime 时间格式化 / getTempUrls 图片链接转换
const { formatTime, getTempUrls } = require('../../utils/errorHandler');

// Page() 注册首页——轮播图 + 最新公告
Page({
  // data 页面初始数据
  data: {
    banners: [],                                     // 轮播图数组（从 banners 集合查询）
    newsList: [],                                    // 最新公告列表（前 3 条）
  },

  // onShow 每次页面显示时触发——刷新轮播图和公告
  onShow: function () {
    this.loadBanners();                              // 加载轮播图
    this.loadNews();                                 // 加载最新公告
  },

  // loadBanners 通过云函数加载轮播图
  loadBanners: function () {
    var that = this;
    wx.cloud.callFunction({
      name: 'timeShardsDB',                          // 统一云函数入口
      data: { type: 'getBanners' }                   // 路由到 getBanners 子模块
    }).then(function (res) {
      // 成功返回后更新轮播图数据
      if (res.result.success) that.setData({ banners: res.result.data });
    });
  },

  // loadNews 加载最新公告（直连数据库取最新 20 条，客户端排序取前 3）
  loadNews: function () {
    var that = this;
    var db = wx.cloud.database();                    // 获取数据库实例
    db.collection('news')                            // 查询 news 集合
      .limit(20)                                     // 最多取 20 条
      .get().then(function (res) {
        // 客户端排序 + 截取 + 格式化时间
        var list = (res.data || [])
          .sort(function (a, b) {
            // 按 createTime 数字降序（最新在前）
            var ta = Number(a.createTime), tb = Number(b.createTime);
            if (isNaN(ta) && isNaN(tb)) return 0;     // 两个都无效则保持原序
            if (isNaN(ta)) return 1;                  // a 无效则 a 排后面
            if (isNaN(tb)) return -1;                 // b 无效则 b 排后面
            return tb - ta;                           // 降序
          })
          .slice(0, 3)                               // 只取前 3 条
          .map(function (item) {
            item.createTime = formatTime(item.createTime); // 格式化时间戳
            return item;
          });
        // 收集需要转换的 cloud:// 封面链接
        var ids = [];
        list.forEach(function (n) { if (n.coverUrl && n.coverUrl.indexOf('cloud://') === 0) ids.push(n.coverUrl); });
        if (ids.length > 0) {
          // 有 cloud:// 链接则批量转换为 HTTPS 临时链接
          getTempUrls(ids).then(function (urlMap) {
            list.forEach(function (n) { if (urlMap[n.coverUrl]) n.coverUrl = urlMap[n.coverUrl]; });
            that.setData({ newsList: list });
          });
        } else {
          that.setData({ newsList: list });           // 没有 cloud:// 链接直接设置
        }
      });
  },

  // goToNewsList 点击"更多"——跳转到全部公告列表
  goToNewsList: function () {
    wx.navigateTo({ url: '/pages/news/list' });
  },

  // goToNewsDetail 点击某条公告——跳转到公告详情页
  goToNewsDetail: function (e) {
    wx.navigateTo({ url: '/pages/news/detail?id=' + e.currentTarget.dataset.id }); // 传公告 _id
  },
});
