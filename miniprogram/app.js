// 获取微信云开发 SDK 实例
const cloud = wx.cloud;

// App() 注册小程序应用——整个小程序的入口
App({
  // globalData 全局共享数据，所有页面通过 getApp() 获取
  globalData: {
    userInfo: {
      openId: null,           // 微信用户唯一标识，由云函数 login 获取
      nickName: null,         // 用户昵称
      avatarUrl: null,        // 用户头像 URL
      lastLoginTime: Date.now(), // 最后登录时间（毫秒时间戳）
    },
    isAdmin: false,           // 是否为管理员，启动后由 checkAdmin 检测
    factions: ['银翼之羽', '永恒沙丘', '劫掠风暴', '橡木氏族', '百景古都', '不休锻炉'], // 六大阵营列表
    rarities: ['纸', '锡', '铂', '晶'], // 四种稀有度（升序）
    rarityLimits: { '纸': 4, '锡': 3, '铂': 2, '晶': 1 }, // 同名稀有度卡牌携带上限
  },

  // onLaunch 小程序启动时触发——初始化云环境
  onLaunch: function () {
    // 检查是否支持云开发能力（基础库版本需 ≥ 2.2.3）
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      // 初始化云开发环境
      wx.cloud.init({
        env: 'cloud1-d3gkqep8526ab4876', // 云环境 ID
        traceUser: true,                  // 在云函数中追踪用户访问
      });
    }
  },

  // onShow 小程序从后台切换到前台时触发
  onShow: function () {
    // 如果还没有获取 openId，则调用登录获取
    if (!this.globalData.userInfo.openId) {
      this.getOpenId();
    }
  },

  // getOpenId 通过云函数获取当前用户的 openId
  getOpenId: function () {
    var that = this; // 保存 this 引用，回调中作用域不同
    // 调用统一的云函数入口 timeShardsDB，type='login' 获取微信上下文
    cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'login' }, // 路由到 login 子模块
      success: res => {
        // 将服务端返回的 openid 存入全局数据
        that.globalData.userInfo.openId = res.result.openid;
        // 获取 openId 后立即检查管理员权限
        that.checkAdmin();
      },
      fail: err => {
        console.log(err);
        // 获取失败时弹窗提示重试
        wx.showModal({
          title: '提示',
          content: '获取用户信息失败，请重试',
          success: function (modalRes) {
            // 用户点击确认后递归重试
            if (modalRes.confirm) that.getOpenId();
          }
        });
      }
    });
  },

  // checkAdmin 检查当前用户是否为管理员
  checkAdmin: function () {
    var that = this;
    const db = wx.cloud.database(); // 获取数据库实例
    // 在 admin 表中查找当前 openId
    db.collection('admin').where({ openId: this.globalData.userInfo.openId }).get().then(res => {
      // 如果 admin 表中有记录，则标记为管理员
      if (res.data.length > 0) this.globalData.isAdmin = true;
      // 无论是否为管理员，继续导航流程
      that.navigateAfterLogin();
    }).catch(() => {
      // 查询失败也继续导航（默认为非管理员）
      that.navigateAfterLogin();
    });
  },

  // navigateAfterLogin 根据用户是否已完成登录资料决定跳转到哪个页面
  navigateAfterLogin: function () {
    // 尝试从本地缓存读取用户资料
    var cached = null;
    try { cached = wx.getStorageSync('userInfo'); } catch (e) {}
    // 如果缓存中有昵称和头像，说明已完成登录，直接进入首页
    if (cached && cached.nickName && cached.avatarUrl) {
      this.globalData.userInfo.nickName = cached.nickName;
      this.globalData.userInfo.avatarUrl = cached.avatarUrl;
      wx.switchTab({ url: '/pages/index/index' }); // Tab 页必须用 switchTab
    } else {
      // 首次使用或资料不完整——跳转欢迎页，引导登录
      wx.redirectTo({ url: '/pages/welcome/index' });
    }
  }
});
