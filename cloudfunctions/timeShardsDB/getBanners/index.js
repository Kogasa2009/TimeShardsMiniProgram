// ============================================================
// 查询轮播图模块——按 sortOrder 升序排列
// 自动将 cloud:// 图片链接转为 HTTPS 临时链接
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  try {
    // 按 sortOrder 升序查询所有轮播图（sortOrder 小的在前）
    const res = await db.collection('banners').orderBy('sortOrder', 'asc').get();

    // 将 cloud:// 图片链接转为 HTTPS 临时链接
    const fileIDs = res.data.map(b => b.imageUrl).filter(id => id && id.startsWith('cloud://'));
    if (fileIDs.length > 0) {
      const tempRes = await cloud.getTempFileURL({ fileList: fileIDs }); // 批量转换
      const urlMap = {};                               // fileID → tempFileURL 映射
      tempRes.fileList.forEach(f => {
        if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
      res.data.forEach(b => {
        if (urlMap[b.imageUrl]) b.imageUrl = urlMap[b.imageUrl]; // 替换为 HTTPS URL
      });
    }
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
