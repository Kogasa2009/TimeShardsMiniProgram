// ===========================
// 公共工具函数模块
// 提供时间格式化、云函数调用封装、图片链接转换等功能
// 所有页面通过 require('../../utils/errorHandler') 引入
// ===========================

// pad 补零函数——个位数前补 0
// 参数 n: 数字
// 返回: 字符串，< 10 时补零
function pad(n) { return n < 10 ? '0' + n : n; }

// formatTime 时间戳格式化——毫秒数字时间戳 → YYYY/MM/DD HH:MM
// 参数 ts: 数字毫秒时间戳 或 数字字符串
// 返回: 格式化后的日期时间字符串；无效输入返回空字符串或原值
function formatTime(ts) {
  if (!ts) return '';                              // 空值直接返回空字符串
  var d = new Date(typeof ts === 'string' ? parseInt(ts) : ts); // 字符串先转数字再构造 Date 对象
  if (!(d.getTime() > 0)) return String(ts);      // 无效时间戳返回原值（避免返回 NaN 字符串）
  // 拼接 YYYY/MM/DD HH:MM 格式
  return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// handleCloudError 统一处理云函数调用错误
// 参数 err: 错误对象
// 参数 fallbackMsg: 降级错误提示文字
// 参数 onFinally: 最终回调（无论成功失败都执行）
function handleCloudError(err, fallbackMsg, onFinally) {
  console.error(err);                              // 控制台输出错误详情，便于调试
  wx.showToast({ title: fallbackMsg || '操作失败，请重试', icon: 'none' }); // 弹出用户友好的错误提示
  if (onFinally) onFinally();                      // 执行最终回调（如 wx.hideLoading）
}

// callWithLoading 带 loading 动画的云函数调用封装
// 参数 name: 云函数名称（固定为 'timeShardsDB'）
// 参数 data: 传给云函数的数据对象（含 type 字段用于路由）
// 参数 options: { loadingMsg, successMsg, errorMsg, onSuccess, onError, onFinally }
function callWithLoading(name, data, options) {
  // 如果有加载提示文字则显示 loading
  if (options.loadingMsg) wx.showLoading({ title: options.loadingMsg, mask: true });

  // 调用云函数
  wx.cloud.callFunction({ name, data })
    .then(res => {
      wx.hideLoading();                            // 先隐藏 loading
      if (res.result.success) {                    // 检查业务结果是否成功
        if (options.successMsg) wx.showToast({ title: options.successMsg, icon: 'success' });
        if (options.onSuccess) options.onSuccess(res.result); // 执行成功回调
      } else {
        // 业务失败——显示服务端返回的错误信息
        wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' });
        if (options.onError) options.onError(res.result);     // 执行错误回调
      }
    })
    .catch(err => {
      wx.hideLoading();                            // 网络错误也隐藏 loading
      handleCloudError(err, options.errorMsg, options.onFinally); // 统一错误处理
    });
}

// getTempUrls 将 cloud:// 格式的文件 ID 批量转换为 HTTPS 临时链接
// 微信真机环境中 cloud:// 链接无法直接渲染图片，需要通过 cloud.getTempFileURL 换取临时链接
// 参数 fileIDs: cloud:// 文件 ID 数组
// 返回: Promise，resolve 为 { fileID: tempUrl } 映射表
function getTempUrls(fileIDs) {
  return new Promise(function (resolve) {
    // 空数组或无效输入直接返回空映射
    if (!fileIDs || fileIDs.length === 0) { resolve({}); return; }
    // 过滤出 cloud:// 开头的有效文件 ID
    var ids = fileIDs.filter(function (id) { return id && id.indexOf('cloud://') === 0; });
    if (ids.length === 0) { resolve({}); return; }
    // 去重——避免相同 fileID 重复请求
    var unique = [];
    var seen = {};
    ids.forEach(function (id) { if (!seen[id]) { seen[id] = true; unique.push(id); } });
    // 调用云函数内联的 getTempUrls 路由
    wx.cloud.callFunction({
      name: 'timeShardsDB',
      data: { type: 'getTempUrls', fileIDs: unique }
    }).then(function (res) {
      // 返回 urlMap 映射表 { fileID: tempUrl }
      resolve(res.result.urlMap || {});
    }).catch(function () {
      resolve({});                                 // 失败时返回空映射，不阻断渲染
    });
  });
}

// 导出模块——供其他页面 require 使用
module.exports = { formatTime, handleCloudError, callWithLoading, getTempUrls };
