const { formatTime, getTempUrls } = require('../../utils/errorHandler');
Page({
  data: {
    news: null,
  },

  onLoad: function (options) {
    this.loadNews(options.id);
  },

  // loadNews: 从数据库加载指定 id 的公告详情
  loadNews: function (id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();
    var that = this;
    db.collection('news')
      .doc(id)
      .get().then(res => {
        const news = res.data;
        news.createTime = formatTime(news.createTime);
        // 转换公告图片的 cloud:// 链接为 HTTPS 临时链接（真机需要）
        var ids = [];
        if (news.coverUrl && news.coverUrl.indexOf('cloud://') === 0) ids.push(news.coverUrl);
        if (news.images) news.images.forEach(function (img) {
          if (img && img.indexOf('cloud://') === 0) ids.push(img);
        });
        if (ids.length > 0) {
          getTempUrls(ids).then(function (urlMap) {
            if (urlMap[news.coverUrl]) news.coverUrl = urlMap[news.coverUrl];
            if (news.images) news.images = news.images.map(function (img) { return urlMap[img] || img; });
            that.setData({ news: news });
          });
        } else {
          that.setData({ news: news });
        }
        wx.hideLoading();
      }).catch(err => {
        console.log(err);
        wx.hideLoading();
        wx.showToast({ title: '公告不存在', icon: 'none' }); // 记录不存在时提示
      });
  },

  // previewImage: 点击公告中的图片时全屏预览
  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;        // 获取点击图片的 URL
    wx.previewImage({
      urls: [src],                                  // 预览图片列表
      current: src                                  // 当前显示的图片
    });
  }
});
