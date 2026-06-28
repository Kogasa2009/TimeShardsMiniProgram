// 获取全局 App 实例
const app = getApp();
// 引入公共工具函数
const { formatTime, getTempUrls } = require('../../utils/errorHandler');

// Page() 注册组牌页（Tab 页）——展示当前用户创建的所有套牌
Page({
  // data 页面初始数据
  data: {
    myDecks: [],                                     // 当前用户创建的套牌列表
    loading: false,                                  // 是否正在加载中
  },

  // onShow 每次页面显示时触发——拉取最新的套牌列表
  onShow: function () {
    this.loadMyDecks();                              // 加载当前用户的套牌
  },

  // onPullDownRefresh 下拉刷新
  onPullDownRefresh: function () {
    this.loadMyDecks();                              // 下拉刷新重新加载
  },

  // loadMyDecks 从数据库加载当前用户创建的所有套牌（直连 decks 表）
  loadMyDecks: function () {
    this.setData({ loading: true });                 // 开启加载状态
    const db = wx.cloud.database();                  // 获取数据库实例
    db.collection('decks')                           // 查询 decks 集合
      .where({
        creatorOpenId: app.globalData.userInfo.openId // 只查当前用户创建的套牌
      })
      .orderBy('createTime', 'desc')                 // 按创建时间降序
      .get().then(res => {
        // 格式化创建时间
        const myDecks = res.data.map(item => {
          item.createTime = formatTime(item.createTime);
          return item;
        });
        // 收集需要转为 HTTPS 的 cloud:// 封面链接
        var coverIds = [];
        myDecks.forEach(function (d) {
          if (d.coverUrl && d.coverUrl.indexOf('cloud://') === 0) coverIds.push(d.coverUrl);
        });
        var that = this;
        // finish 统一收尾——设置数据并停止下拉刷新
        function finish() {
          that.setData({ myDecks: myDecks, loading: false });
          wx.stopPullDownRefresh();                  // 停止下拉刷新动画
        }
        if (coverIds.length > 0) {
          // 批量转换 cloud:// → HTTPS 临时链接
          getTempUrls(coverIds).then(function (urlMap) {
            myDecks.forEach(function (d) {
              if (urlMap[d.coverUrl]) d.coverUrl = urlMap[d.coverUrl];
            });
            finish();
          });
        } else {
          finish();
        }
      }).catch(err => {
        console.log(err);
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      });
  },

  // goToDeckDetail 点击某副套牌——跳转到套牌详情页（可编辑模式）
  goToDeckDetail: function (e) {
    const id = e.currentTarget.dataset.id;           // 从 data-id 获取套牌 _id
    wx.navigateTo({ url: '/pages/deckDetail/index?id=' + id + '&editable=true' }); // 传 editable=true
  },

  // createNewDeck 创建新套牌——跳转到套牌编辑页（无 id = 新建模式）
  createNewDeck: function () {
    wx.navigateTo({ url: '/pages/deckEdit/index' });
  }
});
