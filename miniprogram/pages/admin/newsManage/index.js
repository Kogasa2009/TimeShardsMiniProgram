// 获取全局 App 实例（检查管理员权限）
const app = getApp();
// 引入时间格式化工具函数
const { formatTime } = require('../../../utils/errorHandler');

// Page() 注册管理员公告管理页——浏览/新增/编辑/删除公告
Page({
  // data 页面初始数据
  data: {
    newsList: [],                                   // 当前显示的公告列表（从服务端加载并排序后）
    loading: false,                                 // 是否正在加载数据
  },

  // onLoad 页面首次加载——检查管理员权限
  onLoad: function () {
    if (!app.globalData.isAdmin) {                  // 非管理员拦截
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    this.loadNewsList();                            // 权限通过后加载公告列表
  },

  // onShow 每次页面显示时触发——再次检查权限并刷新数据
  onShow: function () {
    if (!app.globalData.isAdmin) {                  // 每次进入都检查
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    this.loadNewsList();                            // 每次显示都刷新（编辑完公告返回后自动更新）
  },

  // onPullDownRefresh 下拉刷新
  onPullDownRefresh: function () {
    this.loadNewsList();
  },

  // loadNewsList 通过云函数加载所有公告，客户端按创建时间降序排列
  loadNewsList: function () {
    this.setData({ loading: true });
    wx.cloud.callFunction({                          // 调用统一云函数入口
      name: 'timeShardsDB',
      data: { type: 'getNews', where: {} }          // 路由到 getNews 子模块，空条件 = 获取全部
    }).then(res => {
      // 客户端排序：按 createTime 降序（最新在前）
      const newsList = (res.result.data || [])
        .sort((a, b) => {
          const ta = Number(a.createTime);           // 转为数字进行比较
          const tb = Number(b.createTime);
          if (isNaN(ta) && isNaN(tb)) return 0;      // 两者都无效时保持原序
          if (isNaN(ta)) return 1;                    // a 无效，a 排到后面
          if (isNaN(tb)) return -1;                   // b 无效，b 排到后面
          return tb - ta;                             // 降序：大的在前
        })
        .map(item => {
          item.createTime = formatTime(item.createTime); // 时间戳格式化为可读字符串
          return item;
        });
      this.setData({ newsList: newsList, loading: false });
      wx.stopPullDownRefresh();                     // 停止下拉刷新动画
    }).catch(err => {
      console.log(err);
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    });
  },

  // addNews 跳转到新增公告页面（不带 id = 新建模式）
  addNews: function () {
    wx.navigateTo({ url: '/pages/admin/newsEdit/index' });
  },

  // editNews 跳转到编辑公告页面（带 id = 编辑模式）
  editNews: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/newsEdit/index?id=' + id });
  },

  // deleteNews 删除指定公告——弹窗确认后通过云函数删除
  deleteNews: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这条公告吗？',
      success: res => {
        if (res.confirm) {                          // 用户确认删除
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'timeShardsDB',                   // 统一云函数入口
            data: { type: 'deleteNews', id: id },   // 路由到 deleteNews 子模块
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功' });
              this.loadNewsList();                  // 刷新列表
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
});
