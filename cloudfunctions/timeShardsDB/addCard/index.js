// ============================================================
// 新增卡牌模块——需管理员权限
// 向 cards 集合插入新卡牌数据
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const auth = await checkAdmin.main();                // 验证管理员身份
  if (!auth.authorized) {
    return { success: false, msg: 'Unauthorized', code: 403 };
  }
  try {
    // 合并传入数据，确保 able 字段默认值为 true（新卡默认启用）
    const cardData = { ...event.data, able: event.data.able !== undefined ? event.data.able : true };
    const result = await db.collection('cards').add({ data: cardData }); // 插入数据库
    return { success: true, _id: result._id };         // 返回新卡牌 _id
  } catch (err) {
    return { success: false, error: err.message };
  }
};
