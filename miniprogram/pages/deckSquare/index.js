// 获取全局 App 实例——使用 factions 阵营列表
const app = getApp();
// 引入公共工具函数
const { formatTime, getTempUrls } = require('../../utils/errorHandler');

// Page() 注册套牌广场页——按阵营浏览公开套牌
Page({
  // data 页面初始数据
  data: {
    factions: app.globalData.factions,               // 六大阵营列表（引用全局数据）
    activeFaction: 0,                                // 当前选中阵营索引（0 = 全部/第一个）
    decks: [],                                       // 套牌列表
    searchKey: '',                                   // 搜索关键词
    sortBy: 'time',                                  // 排序方式：time（最新）/ likes（最热）
    loading: false,                                  // 是否正在加载
  },

  // onLoad 页面加载——首次拉取套牌
  onLoad: function () { this.loadDecks(); },
  // onShow 每次页面显示时刷新
  onShow: function () { this.loadDecks(); },
  // onPullDownRefresh 下拉刷新
  onPullDownRefresh: function () { this.loadDecks(); },

  // switchFaction 切换阵营标签
  switchFaction: function (e) {
    var index = e.currentTarget.dataset.index;       // 获取点击的标签索引
    this.setData({ activeFaction: index, decks: [] }); // 更新选中 + 清空旧列表
    this.loadDecks();                                // 按新阵营重新加载
  },

  // switchSort 切换排序方式
  switchSort: function (e) {
    var sort = e.currentTarget.dataset.sort;         // 获取排序方式标识
    this.setData({ sortBy: sort, decks: [] });       // 更新排序 + 清空旧列表
    this.loadDecks();                                // 按新排序重新加载
  },

  // onSearchInput 搜索框输入事件（300ms 防抖）
  onSearchInput: function (e) {
    this.setData({ searchKey: e.detail.value });     // 更新搜索词
    if (this._searchTimer) clearTimeout(this._searchTimer); // 清除上次定时器
    var that = this;
    this._searchTimer = setTimeout(function () {
      that.loadDecks();                              // 300ms 后执行查询
    }, 300);
  },

  // loadDecks 通过云函数加载套牌列表
  loadDecks: function () {
    this.setData({ loading: true });                 // 开启加载状态
    var faction = this.data.factions[this.data.activeFaction]; // 当前选中阵营名
    var cloudData = {
      type: 'getDecks',                              // 路由到 getDecks 子模块
      limit: 500,                                    // 取上限（云函数不受 20 条限制）
      orderBy: this.data.sortBy === 'likes' ? ['likes', 'desc'] : ['createTime', 'desc'] // 排序字段
    };
    // 如果不是"全部"阵营，添加阵营过滤条件
    if (faction !== '全部') {
      cloudData.where = { faction: faction };
    }
    // 如果有搜索词，传给云函数做服务端 RegExp 模糊匹配
    if (this.data.searchKey) {
      cloudData.search = this.data.searchKey;
    }

    var that = this;
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: cloudData
    }).then(function (res) {
      // 格式化每副套牌的创建时间
      var decks = (res.result.data || []).map(function (item) {
        item.createTime = formatTime(item.createTime);
        return item;
      });
      // 收集需要转换的 cloud:// 封面链接
      var ids = [];
      decks.forEach(function (d) { if (d.coverUrl && d.coverUrl.indexOf('cloud://') === 0) ids.push(d.coverUrl); });
      if (ids.length > 0) {
        // 批量转换为 HTTPS 临时链接
        getTempUrls(ids).then(function (urlMap) {
          decks.forEach(function (d) { if (urlMap[d.coverUrl]) d.coverUrl = urlMap[d.coverUrl]; });
          that.setData({ decks: decks, loading: false });
        });
      } else {
        that.setData({ decks: decks, loading: false });
      }
      wx.stopPullDownRefresh();                      // 停止下拉刷新动画
    }).catch(function () {
      that.setData({ loading: false });
      wx.stopPullDownRefresh();
    });
  },

  // goToDeckDetail 点击套牌卡片——跳转到套牌详情页
  goToDeckDetail: function (e) {
    wx.navigateTo({ url: '/pages/deckDetail/index?id=' + e.currentTarget.dataset.id });
  }
});
