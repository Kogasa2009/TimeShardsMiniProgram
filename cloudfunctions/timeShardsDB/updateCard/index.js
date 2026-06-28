// ============================================================
// 更新卡牌模块——需管理员权限
// 根据 _id 更新 cards 集合中单条卡牌的任意字段
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
    await db.collection('cards').doc(event.id).update({ data: event.data }); // 更新指定卡牌
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
