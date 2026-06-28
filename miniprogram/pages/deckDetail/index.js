// 获取全局 App 实例
const app = getApp();
// 引入公共工具函数
const { formatTime, getTempUrls } = require('../../utils/errorHandler');

// Page() 注册套牌详情页——展示法力曲线、卡组构成、收藏/点赞/排序
Page({
  // data 页面初始数据
  data: {
    deck: null,                                      // 套牌完整数据对象
    cards: [],                                       // 套牌中包含的卡牌详情列表
    editable: false,                                 // 当前用户是否可编辑此套牌（自己的套牌）
    isAdmin: false,                                  // 当前用户是否为管理员
    isFavorited: false,                              // 当前用户是否已收藏此套牌
    isLiked: false,                                  // 当前用户是否已点赞此套牌
    curveData: [0, 0, 0, 0, 0, 0, 0, 0],            // 法力曲线数据——索引 0-6 对应费用 0-6，索引 7 对应 7+ 费
    curveHeights: [0, 0, 0, 0, 0, 0, 0, 0],         // 对应柱状图高度（rpx），已按比例缩放
    sortedCards: [],                                 // 排序后的卡牌列表（按费用）
    cardGroups: [],                                  // 去重后的卡牌分组 [{card, count}]
    sortType: 'cost',                                // 当前排序方式：cost / rarity / name
  },

  // onLoad 页面加载——解析 URL 参数并加载数据
  onLoad: function (options) {
    this.setData({
      editable: options.editable === 'true',          // 是否可编辑模式
      isAdmin: app.globalData.isAdmin                // 管理员权限
    });
    this.loadDeck(options.id);                       // 加载套牌数据
    this.checkFavorite(options.id);                  // 检查收藏状态
    if (options.id) this.checkLiked(options.id);     // 检查点赞状态
  },

  // loadDeck 从数据库加载套牌及其包含的卡牌
  loadDeck: function (id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();                  // 获取数据库实例
    db.collection('decks').doc(id).get().then(res => {
      const deck = res.data;                         // 套牌数据
      deck.createTime = formatTime(deck.createTime); // 格式化创建时间
      this.setData({ deck: deck });
      // 优先使用 cardDetails（完整卡牌对象），否则用 cards[]（_id 数组）再去查询
      if (deck.cardDetails && deck.cardDetails.length > 0) {
        this.processCards(deck.cardDetails);          // 直接处理已有详情
      } else if (deck.cards && deck.cards.length > 0) {
        this.loadCardDetails(deck.cards);             // 根据 _id 批量查询卡牌详情
      }
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }).catch(err => {
      console.log(err);
      wx.hideLoading();
    });
  },

  // loadCardDetails 根据卡牌 _id 数组批量查询卡牌的完整信息
  loadCardDetails: function (cardIds) {
    const db = wx.cloud.database();
    db.collection('cards').where({
      _id: db.command.in(cardIds)                    // 使用 in 操作符批量查询
    }).get().then(res => {
      this.processCards(res.data);                   // 处理查询结果
    });
  },

  // processCards 处理卡牌数据——计算法力曲线 + 编译去重分组
  processCards: function (cards) {
    // 过滤掉 _id 为空的幽灵卡牌（数据已损坏）
    const validCards = cards.filter(c => c && c._id);
    if (validCards.length < cards.length) {
      wx.showToast({ title: '部分卡牌数据已失效', icon: 'none' });
    }
    const curve = new Array(8).fill(0);              // 初始化 8 个费用槽
    const groups = [], seen = {};
    // 遍历有效卡牌
    validCards.forEach(c => {
      // 标记占位符/已禁用卡牌
      if (c.name === '卡牌残片' || c.able === false) {
        c._isPlaceholder = true;
      }
      // 统计法力曲线：0-6 费分槽，7+ 归入最后一个槽
      const cost = parseInt(c.cost) || 0;
      if (cost >= 0 && cost <= 6) curve[cost]++;
      else if (cost >= 7) curve[7]++;
      // 去重分组
      if (!seen[c.name]) {
        seen[c.name] = { card: c, count: 0 };
        groups.push(seen[c.name]);
      }
      seen[c.name].count++;
    });
    // 按费用排序
    const sorted = [...validCards].sort((a, b) => (a.cost || 0) - (b.cost || 0));
    groups.sort((a, b) => (a.card.cost || 0) - (b.card.cost || 0));
    // 计算柱状图高度——最大值为 150rpx，其余按比例缩放
    const maxCount = Math.max(...curve, 1);           // 防止除以 0
    const curveHeights = curve.map(v => v > 0 ? Math.max(8, (v / maxCount) * 150) : 0); // 最少 8rpx
    this.setData({
      cards: validCards,
      curveData: curve,                              // 法力曲线数据
      curveHeights: curveHeights,                    // 柱状图高度
      sortedCards: sorted,                           // 按费用排序的卡牌
      cardGroups: groups,                            // 去重分组
    });
    // 转换 cloud:// 图片链接为 HTTPS 临时链接
    var ids = [];
    var deck = this.data.deck;
    if (deck && deck.coverUrl && deck.coverUrl.indexOf('cloud://') === 0) ids.push(deck.coverUrl);
    validCards.forEach(function (c) {
      if (c.imageUrl && c.imageUrl.indexOf('cloud://') === 0) ids.push(c.imageUrl);
    });
    if (ids.length > 0) {
      var that = this;
      getTempUrls(ids).then(function (urlMap) {
        if (deck && urlMap[deck.coverUrl]) {
          that.setData({ 'deck.coverUrl': urlMap[deck.coverUrl] }); // 更新封面为 HTTPS
        }
        var changed = false;
        validCards.forEach(function (c) {
          if (urlMap[c.imageUrl]) { c.imageUrl = urlMap[c.imageUrl]; changed = true; }
        });
        if (changed) {
          // 图片更新后重建分组和排序（引用已变更）
          var newGroups = [], newSeen = {};
          validCards.forEach(function (c) {
            if (!newSeen[c.name]) { newSeen[c.name] = { card: c, count: 0 }; newGroups.push(newSeen[c.name]); }
            newSeen[c.name].count++;
          });
          var newSorted = validCards.slice().sort(function (a, b) { return (a.cost || 0) - (b.cost || 0); });
          newGroups.sort(function (a, b) { return (a.card.cost || 0) - (b.card.cost || 0); });
          that.setData({ sortedCards: newSorted, cardGroups: newGroups });
        }
      });
    }
  },

  // checkFavorite 检查当前用户是否已收藏该套牌
  checkFavorite: function (deckId) {
    const db = wx.cloud.database();
    db.collection('favorites').where({
      openId: app.globalData.userInfo.openId,         // 当前用户
      deckId: deckId                                  // 目标套牌
    }).get().then(res => {
      this.setData({ isFavorited: res.data.length > 0 }); // 有记录 = 已收藏
    });
  },

  // toggleFavorite 切换收藏/取消收藏状态
  toggleFavorite: function () {
    const action = this.data.isFavorited ? 'remove' : 'add'; // 当前状态取反
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: {
        type: 'toggleFavorite',
        action: action,
        deckId: this.data.deck._id,
        openId: app.globalData.userInfo.openId
      },
      success: res => {
        if (res.result.success) {
          this.setData({ isFavorited: action === 'add' }); // 更新本地状态
          wx.showToast({ title: res.result.msg, icon: 'none' });
        } else {
          wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    });
  },

  // toggleLike 切换点赞/取消点赞
  toggleLike: function () {
    var that = this;
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: {
        type: 'toggleLike',
        deckId: this.data.deck._id,
        openId: app.globalData.userInfo.openId
      },
      success: function (res) {
        if (res.result.success) {
          var deck = that.data.deck;
          // 根据服务端返回的 action 更新点赞数
          deck.likes = (deck.likes || 0) + (res.result.action === 'added' ? 1 : -1);
          that.setData({
            deck: deck,
            isLiked: res.result.action === 'added'   // 更新本地点赞状态
          });
          wx.showToast({ title: res.result.action === 'added' ? '已点赞' : '已取消点赞', icon: 'none' });
        }
      }
    });
  },

  // checkLiked 检查当前用户是否已点赞该套牌
  checkLiked: function (deckId) {
    var that = this;
    var db = wx.cloud.database();
    db.collection('deckLikes').where({
      openId: app.globalData.userInfo.openId,         // 当前用户
      deckId: deckId                                  // 目标套牌
    }).get().then(function (res) {
      that.setData({ isLiked: res.data.length > 0 }); // 有记录 = 已点赞
    });
  },

  // sortCards 轮换排序方式——费用 → 稀有度 → 名称 → 费用...
  sortCards: function () {
    const types = ['cost', 'rarity', 'name'];          // 排序方式列表
    const idx = types.indexOf(this.data.sortType);     // 当前排序索引
    const next = types[(idx + 1) % types.length];      // 下一个（循环）
    const sortNames = { cost: '费用', rarity: '稀有度', name: '名称' };

    let sorted = [...this.data.cardGroups];            // 浅拷贝分组数组
    if (next === 'cost') sorted.sort((a, b) => (a.card.cost || 0) - (b.card.cost || 0)); // 按费用升序
    else if (next === 'rarity') {
      const order = { '纸': 0, '锡': 1, '铂': 2, '晶': 3 }; // 稀有度权重
      sorted.sort((a, b) => (order[a.card.rarity] || 0) - (order[b.card.rarity] || 0));
    } else {
      sorted.sort((a, b) => (a.card.name || '').localeCompare(b.card.name || '')); // 按名称字典序
    }
    this.setData({ cardGroups: sorted, sortType: next });
    wx.showToast({ title: '排序: ' + sortNames[next], icon: 'none', duration: 1000 });
  },

  // copyDeckCode 将所有卡牌 _id 直接拼接为十六进制套牌代码
  copyDeckCode: function () {
    var code = this.data.cards.map(function (c) { return c._id; }).join(''); // 拼接所有 _id
    wx.setClipboardData({
      data: code,
      success: function () { wx.showToast({ title: '套牌代码已复制', icon: 'success' }); }
    });
  },

  // goToCardDetail 点击卡牌后跳转到卡牌详情页（只读模式）
  goToCardDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/cardDetail/index?id=' + id }); // 不传 fromDeck = 只读
  },

  // editDeck 跳转到套牌编辑页修改套牌
  editDeck: function () {
    wx.navigateTo({ url: '/pages/deckEdit/index?id=' + this.data.deck._id });
  },

  // deleteDeck 删除当前套牌（仅所有者或管理员可操作）
  deleteDeck: function () {
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除该套牌吗？',
      success: res => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'timeShardsDB',
            data: { type: 'deleteDeck', id: this.data.deck._id },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已删除', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 800); // 0.8 秒后返回
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // goToCardDetailByAdd 跳转到卡牌详情页（组牌模式——显示"加入卡组"按钮）
  goToCardDetailByAdd: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/cardDetail/index?id=' + id + '&fromDeck=true' });
  }
});
