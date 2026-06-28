// Page() 注册欢迎页——品牌展示 + 引导用户进入登录
Page({
  // data 页面初始数据
  data: {
    isReady: false,                                 // 控制入场动画触发时机
  },

  // onLoad 页面加载——延时触发入场动画
  onLoad: function () {
    // 延迟 100ms 设置 isReady 为 true，触发 CSS 过渡动画
    setTimeout(() => { this.setData({ isReady: true }); }, 100);
  },

  // handleEnter 点击"立即进入"按钮
  handleEnter: function () {
    // 如果设备支持振动，给予轻触反馈
    if (wx.canIUse('vibrateShort')) wx.vibrateShort({ type: 'light' });
    // 跳转到登录页
    wx.navigateTo({ url: '/pages/login/index' });
  }
});
