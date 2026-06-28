// ============================================================
// 更新轮播图排序模块——需管理员权限
// 更新单条轮播图的 sortOrder 字段值
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const auth = await checkAdmin.main();                // 验证管理员身份
  if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
  try {
    // 更新指定轮播图的 sortOrder 值
    await db.collection('banners').doc(event.id).update({
      data: { sortOrder: event.sortOrder }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
