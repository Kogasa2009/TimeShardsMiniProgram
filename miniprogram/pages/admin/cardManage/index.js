// 获取全局 App 实例（使用 globalData 中的阵营列表和管理员状态）
const app = getApp();

// Page() 注册管理员卡牌管理页——按阵营浏览/搜索/新增/编辑/删除卡牌
Page({
  // data 页面初始数据
  data: {
    allCards: [],                                   // 服务端返回的全部卡牌（预留字段）
    cards: [],                                      // 当前显示的卡牌列表（过滤+排序后）
    factions: app.globalData.factions.concat(['中立']), // 六阵营 + "中立"（从全局配置获取并追加）
    selectedFaction: 0,                             // 当前选中的阵营索引（默认第一个）
    searchKey: '',                                  // 搜索关键词
    loading: false,                                 // 是否正在加载数据
  },

  // onLoad 页面首次加载——先检查管理员权限，无权限则弹窗并返回
  onLoad: function () {
    if (!app.globalData.isAdmin) {                  // 非管理员拦截
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,                          // 不显示取消按钮，强制确认
        success: () => wx.navigateBack()            // 用户确认后返回上一页
      });
      return;
    }
    this.loadCards();                               // 权限通过后加载卡牌列表
  },

  // onShow 每次页面显示时触发——再次检查权限并刷新数据
  onShow: function () {
    if (!app.globalData.isAdmin) {                  // 每次进入都检查（以防权限变更）
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    this.loadCards();                               // 每次显示都刷新（编辑完卡牌返回后自动更新）
  },

  // onPullDownRefresh 下拉刷新——重新加载卡牌列表
  onPullDownRefresh: function () {
    this.loadCards();
  },

  // switchFaction 切换阵营标签筛选
  switchFaction: function (e) {
    const index = parseInt(e.currentTarget.dataset.index); // 从 data-index 获取阵营索引
    this.setData({ selectedFaction: index });
    this.loadCards();                               // 按新阵营重新加载
  },

  // loadCards 通过云函数加载卡牌——支持阵营筛选、搜索、排序
  loadCards: function () {
    this.setData({ loading: true });                // 显示加载状态
    const faction = this.data.factions[this.data.selectedFaction]; // 当前选中的阵营名称
    // 构建云函数参数：type 路由 + 查询条件
    const cloudData = {
      type: 'getCards',                             // 路由到 getCards 子模块
      limit: 500,                                   // 一次性拉取最多 500 条（服务端无 20 条限制）
      orderBy: ['cost', 'asc'],                     // 按费用升序排列
      includeDisabled: true                         // 管理员可查看已禁用的卡牌
    };
    if (faction !== '全部') {                        // 筛选特定阵营
      cloudData.where = { faction: faction };
    }
    if (this.data.searchKey) {                      // 有搜索关键词时附加
      cloudData.search = this.data.searchKey;
    }
    wx.cloud.callFunction({                          // 调用统一云函数入口
      name: 'timeShardsDB',
      data: cloudData
    }).then(res => {
      // 服务端返回 data 数组，直接设置到 cards
      this.setData({ cards: res.result.data || [], loading: false });
      wx.stopPullDownRefresh();                     // 停止下拉刷新动画
    }).catch(err => {
      console.log(err);                             // 记录错误日志
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    });
  },

  // onSearchInput 搜索框输入事件——实时更新搜索关键词并重新加载
  onSearchInput: function (e) {
    this.setData({ searchKey: e.detail.value });
    this.loadCards();                               // 每次输入都触发搜索（服务端处理）
  },

  // clearSearch 清除搜索关键词——恢复显示全部卡牌
  clearSearch: function () {
    this.setData({ searchKey: '' });
    this.loadCards();
  },

  // addCard 跳转到新增卡牌页面（不带 id 参数 = 新建模式）
  addCard: function () {
    wx.navigateTo({ url: '/pages/admin/cardEdit/index' });
  },

  // editCard 跳转到编辑卡牌页面（带 id 参数 = 编辑模式）
  editCard: function (e) {
    const id = e.currentTarget.dataset.id;          // 从 data-id 获取卡牌 _id
    wx.navigateTo({ url: '/pages/admin/cardEdit/index?id=' + id });
  },

  // deleteCard 删除指定卡牌——弹窗确认后通过云函数删除
  deleteCard: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这张卡牌吗？',
      success: res => {
        if (res.confirm) {                          // 用户点击了"确认"
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'timeShardsDB',                   // 统一云函数入口
            data: { type: 'deleteCard', id: id },   // 路由到 deleteCard 子模块
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功' });
              this.loadCards();                     // 刷新列表
            },
            fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // goBack 返回上一页
  goBack: function () {
    wx.navigateBack();
  }
});
