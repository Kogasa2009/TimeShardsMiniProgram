// 获取全局 App 实例，用于读取用户信息和管理员状态
const app = getApp();
// 引入 cloud:// → HTTPS 临时链接转换工具
const { getTempUrls } = require('../../utils/errorHandler');

// Page() 注册用户中心（"我的"）页面——个人资料 + 功能菜单 + 收藏列表
Page({
  // data 页面初始数据
  data: {
    userInfo: {},                                   // 当前用户信息（从 app.globalData.userInfo 同步）
    isAdmin: false,                                 // 是否为管理员（控制管理菜单项是否可见）
    favorites: [],                                  // 收藏记录原始数据（favorites 集合文档数组）
    favoriteDecks: [],                              // 收藏的套牌详情（从 decks 集合关联查询得到）
    settings: [                                     // 主菜单配置数组
      { icon: '📋', text: '我的收藏', key: 'favorites' },
      { icon: '⚙️', text: '卡牌管理', key: 'admin', admin: true },   // 仅管理员可见
      { icon: '📰', text: '公告管理', key: 'news', admin: true },     // 仅管理员可见
      { icon: '🖼️', text: '轮播图管理', key: 'banner', admin: true }, // 仅管理员可见
      { icon: 'ℹ️', text: '关于TimeShards', key: 'about' },
    ],
    showTab: 'main',                                // 当前子页面：'main' 主菜单 / 'favorites' 收藏列表
  },

  // onShow 每次页面显示时触发——刷新用户信息并重新加载收藏数据
  onShow: function () {
    // 从全局数据浅拷贝用户信息（避免直接修改全局对象）
    const userInfo = Object.assign({}, app.globalData.userInfo);
    this.setData({
      userInfo: userInfo,
      isAdmin: app.globalData.isAdmin,              // 同步管理员状态
    });
    // 如果头像 URL 是 cloud:// 格式，转换为 HTTPS 临时链接
    if (userInfo.avatarUrl && userInfo.avatarUrl.indexOf('cloud://') === 0) {
      const that = this;
      getTempUrls([userInfo.avatarUrl]).then(function (urlMap) {
        if (urlMap[userInfo.avatarUrl]) {
          that.setData({ 'userInfo.avatarUrl': urlMap[userInfo.avatarUrl] }); // 更新为 HTTPS URL
        }
      });
    }
    this.loadFavorites();                           // 每次显示时刷新收藏列表
  },

  // onPullDownRefresh 下拉刷新——重新加载收藏数据
  onPullDownRefresh: function () {
    this.loadFavorites();
  },

  // loadFavorites 从数据库加载当前用户的收藏记录
  loadFavorites: function () {
    const db = wx.cloud.database();                 // 获取云数据库实例
    db.collection('favorites')                      // 查询 favorites 集合
      .where({
        openId: app.globalData.userInfo.openId      // 只查当前用户的收藏记录
      })
      .orderBy('createTime', 'desc')                // 按收藏时间降序排列（最新在前）
      .get().then(res => {
        this.setData({ favorites: res.data });      // 保存原始收藏记录
        if (res.data.length > 0) {
          this.loadFavoriteDecks(res.data);         // 有收藏时，根据 deckId 加载套牌详情
        } else {
          this.setData({ favoriteDecks: [] });      // 无收藏时清空套牌列表（修复：之前未清空导致旧数据残留）
        }
        wx.stopPullDownRefresh();                   // 停止下拉刷新动画
      }).catch(err => {
        console.log(err);                           // 记录错误日志
        wx.stopPullDownRefresh();                   // 出错也要停止刷新动画
      });
  },

  // loadFavoriteDecks 根据收藏记录中的 deckId 批量查询套牌详情
  loadFavoriteDecks: function (favorites) {
    const db = wx.cloud.database();
    const deckIds = favorites.map(f => f.deckId);   // 提取所有收藏的 deckId
    db.collection('decks')                          // 查询 decks 集合
      .where({
        _id: db.command.in(deckIds)                 // 使用 in 操作符批量查询（最多 20 条）
      })
      .get().then(res => {
        const decks = res.data;                     // 获取套牌详情数组
        // 收集所有 cloud:// 格式的封面 URL，批量转换为 HTTPS
        const ids = [];
        decks.forEach(d => {
          if (d.coverUrl && d.coverUrl.indexOf('cloud://') === 0) ids.push(d.coverUrl);
        });
        if (ids.length > 0) {
          const that = this;
          getTempUrls(ids).then(function (urlMap) {
            // 替换每个 deck 的 coverUrl 为 HTTPS 临时链接
            decks.forEach(d => {
              if (urlMap[d.coverUrl]) d.coverUrl = urlMap[d.coverUrl];
            });
            that.setData({ favoriteDecks: decks }); // 更新页面数据
          });
        } else {
          this.setData({ favoriteDecks: decks });   // 无 cloud:// URL 时直接设置
        }
      });
  },

  // navigateTo 菜单项点击处理——根据 data-key 路由到不同功能
  navigateTo: function (e) {
    const key = e.currentTarget.dataset.key;        // 获取菜单项的 key 标识
    switch (key) {
      case 'favorites':                             // 我的收藏——在当前页内切换到收藏子页面
        this.setData({ showTab: 'favorites' });
        break;
      case 'admin':                                 // 卡牌管理——跳转到管理员页面
        if (!app.globalData.isAdmin) {              // 非管理员拦截
          wx.showToast({ title: '无权限访问', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/admin/cardManage/index' });
        break;
      case 'news':                                  // 公告管理——跳转到管理员页面
        if (!app.globalData.isAdmin) {
          wx.showToast({ title: '无权限访问', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/admin/newsManage/index' });
        break;
      case 'banner':                                // 轮播图管理——跳转到管理员页面
        if (!app.globalData.isAdmin) {
          wx.showToast({ title: '无权限访问', icon: 'none' });
          return;
        }
        wx.navigateTo({ url: '/pages/admin/bannerManage/index' });
        break;
      case 'about':                                 // 关于——使用原生模态弹窗显示版本信息
        wx.showModal({
          title: '关于TimeShards',
          content: 'TimeShards 组卡平台 v1.0\n\n一款TCG卡牌组卡工具\n支持多阵营卡组构建与分享',
          showCancel: false                         // 仅显示确认按钮
        });
        break;
    }
  },

  // goToDeckDetail 点击收藏的套牌条目——跳转到套牌详情页
  goToDeckDetail: function (e) {
    const id = e.currentTarget.dataset.id;          // 获取套牌 _id
    wx.navigateTo({ url: '/pages/deckDetail/index?id=' + id });
  },

  // removeFavorite 取消收藏——调用云函数删除 favorites 记录
  removeFavorite: function (e) {
    const deckId = e.currentTarget.dataset.id;      // 获取要取消收藏的 deckId
    wx.cloud.callFunction({
      name: 'timeShardsDB',                         // 统一云函数入口
      data: {
        type: 'toggleFavorite',                     // 路由到 toggleFavorite 子模块
        action: 'remove',                           // 执行删除操作
        deckId: deckId,
        openId: app.globalData.userInfo.openId      // 当前用户标识
      },
      success: (res) => {
        // 检查云函数返回结果（修复：之前未检查 result.success，静默失败）
        if (res.result.success) {
          wx.showToast({ title: '已取消收藏', icon: 'none' });
          this.loadFavorites();                     // 重新加载收藏列表以更新 UI
        } else {
          wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' }); // 显示服务端错误信息
        }
      },
      fail: () => {
        wx.showToast({ title: '操作失败', icon: 'none' }); // 网络/调用失败
      }
    });
  },

  // onChooseAvatar 微信头像选择回调——上传新头像到云存储并更新用户资料
  onChooseAvatar: function (e) {
    const avatarUrl = e.detail.avatarUrl;           // 微信返回的临时头像路径
    wx.showLoading({ title: '上传中...' });
    wx.cloud.uploadFile({                           // 上传到云存储
      cloudPath: 'avatars/' + app.globalData.userInfo.openId + '_' + Date.now() + '.png', // 唯一文件名
      filePath: avatarUrl                           // 本地临时文件路径
    }).then(res => {
      const fileID = res.fileID;                    // 获取 cloud:// 格式的文件 ID
      wx.cloud.callFunction({                       // 调用云函数更新用户资料
        name: 'timeShardsDB',
        data: { type: 'updateProfile', avatarUrl: fileID },
        success: () => {
          // 同步更新全局数据和页面数据
          app.globalData.userInfo.avatarUrl = fileID;
          this.setData({ 'userInfo.avatarUrl': fileID });
          wx.hideLoading();
          wx.showToast({ title: '头像已更新', icon: 'success' });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' }); // 上传失败（网络问题等）
    });
  },

  // onNicknameBlur 昵称输入框失去焦点时保存新昵称
  onNicknameBlur: function (e) {
    const nickName = e.detail.value;                // 获取输入的昵称
    // 未修改或空值时不调用云函数（避免无效请求）
    if (!nickName || nickName === app.globalData.userInfo.nickName) return;
    app.globalData.userInfo.nickName = nickName;     // 更新全局数据
    this.setData({ 'userInfo.nickName': nickName }); // 更新页面显示
    wx.cloud.callFunction({                          // 调用云函数持久化昵称
      name: 'timeShardsDB',
      data: { type: 'updateProfile', nickName: nickName }
    });
  },

  // backToMain 从收藏子页面返回主菜单
  backToMain: function () {
    this.setData({ showTab: 'main' });
  },

  // logout 退出登录——清除本地存储和全局状态，跳转到登录页
  logout: function () {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {                          // 用户确认退出
          wx.clearStorageSync();                    // 清除所有本地缓存
          // 重置全局用户信息为空
          app.globalData.userInfo = { openId: null, nickName: null, avatarUrl: null, lastLoginTime: Date.now() };
          wx.redirectTo({ url: '/pages/login/index' }); // 重定向到登录页（不可返回）
        }
      }
    });
  },
});
