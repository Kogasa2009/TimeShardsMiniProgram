// ============================================================
// 登录模块——获取当前用户的微信上下文信息
// 在云函数中调用 cloud.getWXContext() 安全获取 openId（前端不可伪造）
// ============================================================

// 引入微信云开发服务端 SDK
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });       // 使用当前云环境

// exports.main 返回用户微信身份信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();              // 服务端获取微信调用上下文
  return {
    openid: wxContext.OPENID,                         // 用户在小程序内的唯一标识
    appid: wxContext.APPID,                           // 小程序的 AppID
    unionid: wxContext.UNIONID,                       // 微信开放平台统一 ID（需绑定开放平台）
    env: wxContext.ENV,                               // 当前云环境 ID
  };
};
