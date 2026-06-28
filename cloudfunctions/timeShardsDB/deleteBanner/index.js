// ============================================================
// 删除轮播图模块——需管理员权限
// 删除数据库记录的同时清理云存储中的图片文件
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const auth = await checkAdmin.main();                // 验证管理员身份
  if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
  try {
    // 先查询获取图片 fileID
    const res = await db.collection('banners').doc(event.id).get();
    const imageUrl = res.data.imageUrl;
    // 删除数据库中的轮播图记录
    await db.collection('banners').doc(event.id).remove();
    // 如果有 cloud:// 格式的图片，清理云存储文件
    if (imageUrl && imageUrl.startsWith('cloud://')) {
      await cloud.deleteFile({ fileList: [imageUrl] }).catch(() => {}); // 忽略删除失败（文件可能已不存在）
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
