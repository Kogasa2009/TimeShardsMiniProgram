// 获取全局 App 实例——使用阵营列表和稀有度上限
const app = getApp();
// 引入带 loading 封装的云函数调用工具
const { callWithLoading } = require('../../utils/errorHandler');

// Page() 注册套牌编辑器——整个小程序核心交互最复杂的页面
Page({
  // data 页面初始数据
  data: {
    deckId: null,                                    // 编辑模式下的套牌 _id，新建时为 null
    deckName: '',                                    // 套牌名称
    selectedFaction: 0,                              // 当前选中的阵营在 factions 中的索引
    factions: app.globalData.factions,               // 六阵营列表
    searchKey: '',                                   // 卡牌搜索关键词
    allCards: [],                                    // 全部卡牌数据（从云函数加载）
    filteredCards: [],                               // 按阵营+搜索词过滤后的卡牌列表
    deckCards: [],                                   // 卡组中已添加的卡牌（平铺数组，含重复）
    cardCount: {},                                   // 卡组中每种卡牌名称的计数 {name: count}
    deckCardGroups: [],                              // 去重后的卡牌分组 [{card, count}]，用于右侧列表渲染
    coverUrl: '',                                    // 套牌封面（取自某张卡牌的 imageUrl）
    totalCards: 0,                                   // 卡组中卡牌总数
    editing: false,                                  // 是否为编辑模式
    loading: false,                                  // 是否正在加载
    showImport: false,                               // 是否显示导入代码弹层
    importCode: '',                                  // 导入代码输入内容
  },

  // onLoad 页面加载时触发
  onLoad: function (options) {
    if (options.id) {                                // 如果有 id 参数，则为编辑已有套牌
      this.setData({ deckId: options.id, editing: true }); // 标记为编辑模式
      this.loadDeckData(options.id);                 // 加载要编辑的套牌数据
    }
    this.loadAllCards();                             // 加载所有可选卡牌
  },

  // loadDeckData 加载已有套牌的数据，填充到编辑表单
  loadDeckData: function (id) {
    const db = wx.cloud.database();                  // 获取数据库实例
    db.collection('decks').doc(id).get().then(res => {
      const deck = res.data;                         // 套牌完整数据
      this.setData({
        deckName: deck.name,                         // 套牌名称
        selectedFaction: this.data.factions.indexOf(deck.faction), // 阵营名→索引
        deckCards: deck.cardDetails || deck.cards || [], // cardDetails 优先（完整卡牌对象）
        coverUrl: deck.coverUrl || '',               // 封面 URL
      });
      this.recalcCounts();                           // 重新统计卡组
    });
  },

  // loadAllCards 通过云函数加载全部卡牌（突破客户端 20 条限制）
  loadAllCards: function () {
    this.setData({ loading: true });                 // 显示加载状态
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'getCards', limit: 500 }         // 取 500 条（通常卡牌总数不超过此值）
    }).then(res => {
      const cards = res.result.data || [];
      this.setData({ allCards: cards, loading: false });
      this.applyFilters();                           // 加载完成后立即应用过滤
    }).catch(err => {
      console.log(err);
      this.setData({ loading: false });
    });
  },

  // applyFilters 按阵营 + 搜索词过滤卡牌库
  applyFilters: function () {
    const faction = this.data.factions[this.data.selectedFaction]; // 当前选中阵营名
    const key = this.data.searchKey.toLowerCase();    // 搜索词转小写（不区分大小写）
    // 过滤条件：阵营匹配（含中立）+ 排除"卡牌残片"占位符
    let filtered = this.data.allCards.filter(c => (c.faction === faction || c.faction === '中立') && c.name !== '卡牌残片');
    if (key) {
      // 有搜索词时进一步过滤——名称包含关键词
      filtered = filtered.filter(c => c.name && c.name.toLowerCase().includes(key));
    }
    // 排序：本阵营卡牌在前，中立卡牌在后
    filtered.sort((a, b) => {
      const aNeutral = a.faction === '中立' ? 1 : 0; // 中立卡排后
      const bNeutral = b.faction === '中立' ? 1 : 0;
      return aNeutral - bNeutral;
    });
    this.setData({ filteredCards: filtered });
  },

  // onSearchInput 监听搜索框输入——实时过滤卡牌列表
  onSearchInput: function (e) {
    this.setData({ searchKey: e.detail.value });     // 更新搜索词
    this.applyFilters();                             // 立即过滤（客户端，无延迟）
  },

  // onFactionChange 监听阵营选择变化
  onFactionChange: function (e) {
    this.setData({ selectedFaction: parseInt(e.detail.value) }); // picker 返回字符串，转整数
    this.applyFilters();                             // 按新阵营重新过滤
  },

  // onDeckNameInput 监听套牌名称输入
  onDeckNameInput: function (e) {
    this.setData({ deckName: e.detail.value });
  },

  // addToDeck 将一张卡牌添加到卡组（含数量限制和总数上限检查）
  addToDeck: function (e) {
    const cardId = e.currentTarget.dataset.id;       // 获取卡牌 _id
    const card = this.data.allCards.find(c => c._id === cardId); // 在全部卡牌中查找
    if (!card) return;                               // 找不到则忽略

    const result = this.tryAddCard(card);            // 尝试添加（带校验）
    if (result.ok) {
      wx.showToast({ title: '已添加', icon: 'success', duration: 1000 });
    } else {
      wx.showToast({ title: result.msg, icon: 'none' }); // 显示失败原因
    }
  },

  // tryAddCard 尝试添加一张卡牌——返回 {ok, msg}，不显示 toast
  tryAddCard: function (card) {
    const rarity = card.rarity || '纸';              // 默认稀有度为"纸"
    const limit = app.globalData.rarityLimits[rarity] || 4; // 获取该稀有度上限
    const currentCount = this.data.cardCount[card.name] || 0; // 当前已有同名卡牌数

    // 校验 1：同名稀有度上限
    if (currentCount >= limit) {
      return { ok: false, msg: `同名${rarity}卡最多携带${limit}张` };
    }
    // 校验 2：卡组总数上限 40
    if (this.data.deckCards.length >= 40) {
      return { ok: false, msg: '卡组已满40张' };
    }
    // 通过校验——添加到卡组末尾
    this.data.deckCards.push(card);
    this.setData({ deckCards: this.data.deckCards }); // 更新视图
    this.recalcCounts();                             // 重新统计
    return { ok: true };
  },

  // addToDeckBatch 批量添加卡牌（供 cardDetail 页面调用）
  addToDeckBatch: function (cardId, quantity) {
    const card = this.data.allCards.find(c => c._id === cardId); // 查找卡牌
    if (!card) return 0;                             // 找不到返回 0
    let added = 0;
    for (let i = 0; i < quantity; i++) {
      if (!this.tryAddCard(card).ok) break;           // 达到上限则停止
      added++;
    }
    return added;                                    // 返回实际添加数量
  },

  // removeFromDeck 从卡组中移除一张指定名称的卡牌（找到第一张同名卡删除）
  removeFromDeck: function (e) {
    const name = e.currentTarget.dataset.name;       // 获取卡牌名
    const idx = this.data.deckCards.findIndex(c => c.name === name); // 找到第一张同名卡
    if (idx !== -1) {
      this.data.deckCards.splice(idx, 1);            // 从数组中移除
      this.setData({ deckCards: this.data.deckCards });
      this.recalcCounts();                           // 重新统计
    }
  },

  // setCover 将指定卡牌的 imageUrl 设为套牌封面
  setCover: function (e) {
    const name = e.currentTarget.dataset.name;       // 获取卡牌名
    const card = this.data.deckCards.find(c => c.name === name); // 在卡组中查找
    if (card && card.imageUrl) {
      this.setData({ coverUrl: card.imageUrl });     // 设为封面
      wx.showToast({ title: '已设为封面', icon: 'success', duration: 1000 });
    } else {
      wx.showToast({ title: '该卡牌无图片', icon: 'none' });
    }
  },

  // recalcCounts 重新统计卡组中每种卡牌的数量和总数，编译去重分组列表
  recalcCounts: function () {
    const counts = {};                               // {卡牌名: 数量}
    const groups = [];                               // [{card, count}]
    const seen = {};                                 // 去重标记 {卡牌名: true}
    // 遍历卡组中每张卡牌
    this.data.deckCards.forEach(c => {
      counts[c.name] = (counts[c.name] || 0) + 1;    // 累加计数
      if (!seen[c.name]) {                           // 首次遇到该卡牌名
        seen[c.name] = true;
        groups.push({ card: c, count: counts[c.name] }); // 新增分组
      } else {
        // 已存在——更新对应分组的 count
        const g = groups.find(g => g.card.name === c.name);
        if (g) g.count = counts[c.name];
      }
    });
    this.setData({
      cardCount: counts,                             // 计数映射
      totalCards: this.data.deckCards.length,         // 总卡数
      deckCardGroups: groups                          // 去重分组
    });
  },

  // saveDeck 保存套牌——客户端校验 + 云函数写入（服务端二次校验）
  saveDeck: function () {
    // 校验 1：名称非空
    if (!this.data.deckName.trim()) {
      wx.showToast({ title: '请输入套牌名称', icon: 'none' });
      return;
    }
    // 校验 2：卡组恰好 40 张
    if (this.data.deckCards.length !== 40) {
      wx.showToast({ title: '卡组必须恰好40张', icon: 'none' });
      return;
    }

    // 确定封面 URL——优先用用户设置的，否则取第一张有 cloud:// 图片的卡牌
    let coverUrl = this.data.coverUrl;
    if (!coverUrl) {
      const cardWithImage = this.data.deckCards.find(c => c.imageUrl && c.imageUrl.indexOf('cloud://') === 0);
      if (cardWithImage) coverUrl = cardWithImage.imageUrl;
    }

    // 组装套牌数据对象
    const deckData = {
      name: this.data.deckName,                      // 套牌名称
      faction: this.data.factions[this.data.selectedFaction], // 阵营
      coverUrl: coverUrl,                            // 封面图片 URL
      cards: this.data.deckCards.map(c => c._id),     // 卡牌 _id 数组（用于快速引用）
      cardDetails: this.data.deckCards,               // 卡牌详情数组（完整对象）
      totalCards: this.data.deckCards.length,         // 总卡数
      creatorOpenId: app.globalData.userInfo.openId,  // 创建者 openId
      creatorName: app.globalData.userInfo.nickName || ('用户' + app.globalData.userInfo.openId.slice(-6)), // 创建者昵称
      updateTime: Date.now(),                        // 更新时间（毫秒时间戳）
    };

    // 区分新建/编辑模式
    const action = this.data.editing ? 'updateDeck' : 'addDeck';
    const cloudData = { type: action, data: deckData };
    if (this.data.editing) {
      cloudData.id = this.data.deckId;               // 编辑模式需传套牌 _id
    } else {
      deckData.createTime = Date.now();              // 新建模式添加创建时间
      deckData.likes = 0;                            // 新建模式初始化点赞数
    }

    // 通过封装工具调用云函数（自动 loading + 结果检查）
    callWithLoading('timeShardsDB', cloudData, {
      loadingMsg: '保存中...',
      successMsg: this.data.editing ? '更新成功' : '创建成功',
      onSuccess: () => setTimeout(() => wx.navigateBack(), 1500), // 成功后 1.5 秒返回
      errorMsg: '保存失败，请重试'
    });
  },

  // viewCardDetail 查看卡牌详情（从组牌上下文跳转，可添加）
  viewCardDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/cardDetail/index?id=' + id + '&fromDeck=true' }); // 传 fromDeck 参数
  },

  // showImportPanel 显示导入代码弹层
  showImportPanel: function () {
    this.setData({ showImport: true, importCode: '' }); // 显示弹层并清空输入
  },

  // hideImportPanel 隐藏导入代码弹层
  hideImportPanel: function () {
    this.setData({ showImport: false });
  },

  // onImportInput 监听导入代码输入
  onImportInput: function (e) {
    this.setData({ importCode: e.detail.value });
  },

  // confirmImport 解析十六进制套牌代码并导入卡组
  confirmImport: function () {
    var that = this;
    // 去除非十六进制字符（空格、换行等）
    var code = this.data.importCode.trim().replace(/[^0-9a-fA-F]/g, '');
    if (!code) {
      wx.showToast({ title: '请粘贴套牌代码', icon: 'none' });
      return;
    }
    // 校验代码长度——每个卡牌 _id 为 32 位十六进制字符
    if (code.length % 32 !== 0) {
      wx.showToast({ title: '无效的套牌代码', icon: 'none' });
      return;
    }
    // 每 32 位切分一个 _id
    var ids = [];
    for (var i = 0; i < code.length; i += 32) {
      ids.push(code.substring(i, i + 32));
    }
    // 在全部卡牌中匹配 _id
    var newCards = [];
    ids.forEach(function (id) {
      var card = that.data.allCards.find(function (c) { return c._id === id; });
      if (card) newCards.push(card);                 // 匹配成功则加入
    });
    if (newCards.length === 0) {
      wx.showToast({ title: '未找到匹配卡牌', icon: 'none' });
      return;
    }
    // 直接替换卡组（不逐个校验规则——导入后用户可自行调整）
    that.setData({ deckCards: newCards, showImport: false, coverUrl: '' });
    that.recalcCounts();                             // 重新统计
    wx.showToast({ title: '已导入 ' + newCards.length + ' 张', icon: 'success' });
  },

  // clearDeck 一键清空当前卡组
  clearDeck: function () {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空当前卡组吗？',
      success: res => {
        if (res.confirm) {
          // 重置所有卡组相关数据
          this.setData({
            deckCards: [],
            cardCount: {},
            deckCardGroups: [],
            totalCards: 0,
            coverUrl: ''
          });
        }
      }
    });
  }
});
