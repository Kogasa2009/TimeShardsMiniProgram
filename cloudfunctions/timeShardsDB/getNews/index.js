// ============================================================
// 查询公告模块——按创建时间降序排列
// 自动将公告的封面和正文图片 cloud:// 链接转为 HTTPS 临时链接
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  try {
    // 按创建时间降序查询（最新公告在前），where 条件由调用方传入
    const result = await db.collection('news').where(event.where || {}).orderBy('createTime', 'desc').get();

    // 收集所有 cloud:// 格式的图片链接（封面 + 正文图片）
    const fileIDs = [];
    result.data.forEach(news => {
      if (news.coverUrl && news.coverUrl.startsWith('cloud://')) fileIDs.push(news.coverUrl);
      if (news.images) news.images.forEach(img => {
        if (img && img.startsWith('cloud://')) fileIDs.push(img);
      });
    });
    // 批量转换为 HTTPS 临时链接
    if (fileIDs.length > 0) {
      const tempRes = await cloud.getTempFileURL({ fileList: fileIDs });
      const urlMap = {};                               // fileID → tempFileURL 映射
      tempRes.fileList.forEach(f => {
        if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
      // 替换公告内容中的图片链接
      result.data.forEach(news => {
        if (urlMap[news.coverUrl]) news.coverUrl = urlMap[news.coverUrl];
        if (news.images) news.images = news.images.map(img => urlMap[img] || img);
      });
    }
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
