// ============================================================
// 删除公告模块——需管理员权限
// 删除公告的同时清理云存储中的封面和正文图片（避免残留文件）
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
    // Step 1: 先查询公告获取图片 fileID 列表（删除前需要先读数据）
    const res = await db.collection('news').doc(event.id).get();
    const news = res.data;
    // 收集所有 cloud:// 格式的图片链接
    const fileIds = [];
    if (news.coverUrl && news.coverUrl.startsWith('cloud://')) {
      fileIds.push(news.coverUrl);                     // 封面图片
    }
    if (news.images && news.images.length > 0) {
      news.images.forEach(img => {
        if (img.startsWith('cloud://')) fileIds.push(img); // 正文图片
      });
    }
    // Step 2: 先删除云存储中的图片文件
    if (fileIds.length > 0) {
      await cloud.deleteFile({ fileList: fileIds });   // 批量删除云存储文件
    }
    // Step 3: 再删除数据库中的公告记录
    await db.collection('news').doc(event.id).remove();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
