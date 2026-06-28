// ============================================================
// 新增公告模块——需管理员权限
// 向 news 集合插入新公告数据
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
    const result = await db.collection('news').add({ data: event.data }); // 插入数据库
    return { success: true, _id: result._id };         // 返回新公告 _id
  } catch (err) {
    return { success: false, error: err.message };
  }
};
