// ============================================================
// 新增轮播图模块——需管理员权限
// 自动分配 sortOrder 值（当前最大 sortOrder + 1）
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const auth = await checkAdmin.main();                // 验证管理员身份
  if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
  try {
    // 查询当前最大 sortOrder 值，新记录的 sortOrder = max + 1
    const maxRes = await db.collection('banners').orderBy('sortOrder', 'desc').limit(1).get();
    const nextOrder = (maxRes.data.length > 0 ? maxRes.data[0].sortOrder : 0) + 1;
    // 插入新轮播图记录
    const result = await db.collection('banners').add({
      data: {
        imageUrl: event.imageUrl,                      // cloud:// 格式的图片文件 ID
        sortOrder: nextOrder,                          // 自动编号
        createTime: Date.now()
      }
    });
    return { success: true, _id: result._id };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
