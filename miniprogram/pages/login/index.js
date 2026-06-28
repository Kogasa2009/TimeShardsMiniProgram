// 获取全局 App 实例——共享 globalData 中的用户信息和登录态
const app = getApp();

// Page() 注册登录页——用户设置昵称后进入小程序
Page({
  // data 页面初始数据
  data: {
    avatarUrl: '/images/default-avatar.png',         // 头像（默认占位图）
    nickName: '',                                    // 昵称输入值
    canLogin: false,                                 // 是否满足登录条件（昵称非空）
  },

  // onLoad 页面加载——尝试从缓存恢复上次的昵称和头像
  onLoad: function () {
    try {
      var cached = wx.getStorageSync('userInfo');    // 读取本地缓存
      if (cached) {
        this.setData({
          avatarUrl: cached.avatarUrl || '/images/default-avatar.png',
          nickName: cached.nickName || '',
        });
        this.updateCanLogin();                       // 更新 canLogin 状态
      }
    } catch (e) {}                                   // 缓存读取失败静默忽略
  },

  // onChooseAvatar 微信头像选择回调（电脑端暂不支持）
  onChooseAvatar: function (e) {
    this.setData({ avatarUrl: e.detail.avatarUrl }); // e.detail.avatarUrl 为临时路径
    this.updateCanLogin();                           // 重新检查登录条件
  },

  // onNicknameInput 昵称输入实时监听
  onNicknameInput: function (e) {
    this.setData({ nickName: e.detail.value });      // 更新输入值
    this.updateCanLogin();                           // 实时检查登录条件
  },

  // onNicknameBlur 昵称输入框失焦——trim 去除首尾空格
  onNicknameBlur: function (e) {
    var val = (e.detail.value || '').trim();         // 获取值并去除空格
    if (val) this.setData({ nickName: val });        // 非空时更新
    this.updateCanLogin();                           // 重新检查登录条件
  },

  // updateCanLogin 检查是否满足登录条件
  // 电脑端暂不要求头像，只需昵称非空即可登录
  updateCanLogin: function () {
    var hasName = this.data.nickName && this.data.nickName.trim().length > 0; // 昵称非空
    this.setData({ canLogin: !!hasName });           // 转为布尔值设置
  },

  // doLogin 执行登录——保存用户资料到云数据库
  doLogin: function () {
    if (!this.data.canLogin) return;                 // 条件不满足则直接返回（按钮已置灰）
    var that = this;
    wx.showLoading({ title: '登录中...', mask: true }); // 显示加载遮罩

    var nickName = this.data.nickName.trim();        // 取昵称（去空格）
    // 电脑端无法选择头像，使用默认头像
    var avatarUrl = this.data.avatarUrl;
    if (!avatarUrl || avatarUrl === '/images/default-avatar.png') {
      avatarUrl = '/images/default-avatar.png';
    }

    this.saveProfile(avatarUrl, nickName);           // 调用保存流程
  },

  // saveProfile 通过云函数将用户资料写入 user 集合并缓存登录态
  saveProfile: function (avatarUrl, nickName) {
    var that = this;
    var oldAvatarUrl = app.globalData.userInfo.avatarUrl; // 保存旧头像 URL（用于后续清理）

    // 调用云函数 updateProfile 写入 user 表
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'updateProfile', avatarUrl: avatarUrl, nickName: nickName },
      success: function () {
        // 如果旧头像是云存储文件，删除以释放空间
        if (oldAvatarUrl && oldAvatarUrl.indexOf('cloud://') === 0) {
          wx.cloud.deleteFile({ fileList: [oldAvatarUrl] }).catch(function () {});
        }
        // 更新全局数据
        app.globalData.userInfo.avatarUrl = avatarUrl;
        app.globalData.userInfo.nickName = nickName;
        // 写入本地缓存——下次启动时跳过登录页
        wx.setStorageSync('userInfo', { avatarUrl: avatarUrl, nickName: nickName, openId: app.globalData.userInfo.openId });
        wx.setStorageSync('isLogin', true);          // 标记已登录
        wx.hideLoading();
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
        // 1 秒后跳转到首页
        setTimeout(function () { wx.switchTab({ url: '/pages/index/index' }); }, 1000);
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    });
  }
});
