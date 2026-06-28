// 获取全局 App 实例，用于读取 rarityLimits 等全局配置
const app = getApp();
// 引入 cloud:// → HTTPS 临时链接转换工具
const { getTempUrls } = require('../../utils/errorHandler');

// Page() 注册卡牌详情页——展示单张卡牌的完整信息、支持批量加入卡组
Page({
  // data 页面初始数据
  data: {
    card: null,                                     // 当前卡牌的完整数据对象（从数据库加载）
    fromDeck: false,                                // 是否从组牌页面跳转过来（控制"加入卡组"按钮显示）
    quantity: 1,                                    // 批量添加数量（步进器当前值）
  },

  // onLoad 页面加载时触发，options 携带页面跳转时传入的 URL 参数
  onLoad: function (options) {
    // 解析 fromDeck 为布尔值：为 true 时显示底部"加入卡组"按钮
    this.setData({ fromDeck: options.fromDeck === 'true' });
    this.loadCard(options.id);                      // 根据传入的 _id 加载卡牌数据
  },

  // loadCard 从云数据库加载指定 _id 的卡牌详情
  loadCard: function (id) {
    wx.showLoading({ title: '加载中...' });          // 显示加载中提示
    const db = wx.cloud.database();                 // 获取云数据库实例
    var that = this;                                // 保存 this 引用，供嵌套回调使用
    db.collection('cards')                          // 指定 cards 集合
      .doc(id)                                      // 定位到指定 _id 的单条记录
      .get().then(res => {
        var card = res.data;                        // 获取卡牌数据
        // 如果图片是 cloud:// 格式，需转换为 HTTPS 临时链接（真机无法直接访问 cloud://）
        if (card.imageUrl && card.imageUrl.indexOf('cloud://') === 0) {
          getTempUrls([card.imageUrl]).then(function (urlMap) {
            if (urlMap[card.imageUrl]) card.imageUrl = urlMap[card.imageUrl]; // 替换为 HTTPS URL
            that.setData({ card: card });           // 更新页面数据
          });
        } else {
          // 图片已是 HTTPS 链接或没有图片，直接设置
          that.setData({ card: card });
        }
        wx.hideLoading();                           // 隐藏加载提示
      }).catch(err => {
        console.log(err);                           // 记录错误日志
        wx.hideLoading();                           // 确保关闭加载提示
        wx.showToast({ title: '卡牌不存在', icon: 'none' }); // 查无此卡时提示用户
      });
  },

  // qtyMinus 减少批量添加数量（最小为 1，不允许减到 0）
  qtyMinus: function () {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  // qtyPlus 增加批量添加数量（最大为该稀有度的同名携带上限）
  qtyPlus: function () {
    const app = getApp();
    const rarity = this.data.card.rarity || '纸';    // 默认按纸卡处理
    const limit = app.globalData.rarityLimits[rarity] || 4; // 从全局配置读取该稀有度上限
    if (this.data.quantity < limit) {
      this.setData({ quantity: this.data.quantity + 1 });
    }
  },

  // addToDeck 批量添加卡牌到上一页（组牌页面）的卡组中
  addToDeck: function () {
    const pages = getCurrentPages();                 // 获取页面栈
    const prevPage = pages[pages.length - 2];        // 上一页（应为 deckEdit）
    // 检查上一页是否提供了 addToDeckBatch 方法（安全调用）
    if (prevPage && prevPage.addToDeckBatch) {
      const added = prevPage.addToDeckBatch(this.data.card._id, this.data.quantity); // 调用批量添加
      if (added > 0) {
        wx.showToast({ title: `已添加 ×${added}`, icon: 'success', duration: 1000 });
        setTimeout(() => wx.navigateBack(), 800);     // 0.8 秒后自动返回上一页
      } else {
        wx.showToast({ title: '已达携带上限或卡组已满', icon: 'none' }); // 验证失败提示
      }
    } else {
      wx.showToast({ title: '请在组牌页面添加卡牌', icon: 'none' }); // 非组牌来源时提示
    }
  },

  // previewCardImage 全屏预览卡牌大图（微信原生图片预览）
  previewCardImage: function () {
    if (this.data.card && this.data.card.imageUrl) { // 确保有图片 URL 才执行
      wx.previewImage({
        urls: [this.data.card.imageUrl],            // 可预览的图片 URL 列表
        current: this.data.card.imageUrl            // 当前显示的图片（即唯一那张）
      });
    }
  }
});
