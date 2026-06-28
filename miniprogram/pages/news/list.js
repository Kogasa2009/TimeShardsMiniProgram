const app = getApp();
const { formatTime, getTempUrls } = require('../../utils/errorHandler');
Page({
  // 页面初始数据
  data: {
    newsList: [],                                   // 全部公告列表
    loading: false,                                 // 是否正在加载
  },

  // onLoad 页面加载时触发
  onLoad: function () {
    this.loadAllNews();                             // 加载全部公告
  },

  // onPullDownRefresh 下拉刷新
  onPullDownRefresh: function () {
    this.loadAllNews();
  },

  // loadAllNews: 通过云函数加载全部公告，按时间倒序
  loadAllNews: function () {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'getNews', where: {} }
    }).then(res => {
      const newsList = (res.result.data || [])
        .sort((a, b) => {
          const ta = Number(a.createTime);
          const tb = Number(b.createTime);
          if (isNaN(ta) && isNaN(tb)) return 0;
          if (isNaN(ta)) return 1;
          if (isNaN(tb)) return -1;
          return tb - ta;
        })
        .map(item => {
          item.createTime = formatTime(item.createTime);
          return item;
        });
      // 转换 coverUrl 的 cloud:// 链接为 HTTPS 临时链接
      const cloudCoverIds = newsList
        .filter(item => item.coverUrl && item.coverUrl.indexOf('cloud://') === 0)
        .map(item => item.coverUrl);
      if (cloudCoverIds.length > 0) {
        getTempUrls(cloudCoverIds).then(urlMap => {
          newsList.forEach(item => {
            if (urlMap[item.coverUrl]) item.coverUrl = urlMap[item.coverUrl];
          });
          this.setData({ newsList: newsList, loading: false });
        });
      } else {
        this.setData({ newsList: newsList, loading: false });
      }
      wx.stopPullDownRefresh();
    }).catch(err => {
      console.log(err);
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    });
  },

  // goToDetail: 点击某条公告跳转到详情页
  goToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/news/detail?id=' + id });
  }
});
