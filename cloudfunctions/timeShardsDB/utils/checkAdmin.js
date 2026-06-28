// ============================================================
// 管理员身份验证工具
// 从云函数上下文中获取真实 openId，查询 admin 集合验证管理员身份
// 前端不可伪造——openId 由微信服务端在云函数中安全注入
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

// exports.main 验证当前调用者是否为管理员
exports.main = async () => {
  const wxContext = cloud.getWXContext();              // 获取微信调用上下文（服务端安全获取 openId）
  const openId = wxContext.OPENID;                     // 当前用户的唯一标识
  const res = await db.collection('admin')             // 查询 admin 集合
    .where({ openId })                                 // 查找是否匹配
    .get();
  return {
    authorized: res.data.length > 0,                  // 存在记录 = 是管理员
    openId
  };
};
