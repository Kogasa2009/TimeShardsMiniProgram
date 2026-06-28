// ============================================================
// 查询套牌模块——支持搜索 / 排序 / 分页
// 自动将 cloud:// 封面链接转为 HTTPS 临时链接
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  try {
    let where = event.where || {};                     // 默认空条件 = 查询全部
    // 如果有搜索关键词，用正则模糊匹配套牌名称
    if (event.search) {
      where.name = db.RegExp({ regexp: event.search, options: 'i' });
    }
    let query = db.collection('decks').where(where);   // 构建查询
    // 按指定字段排序，未指定时默认按创建时间降序（最新在前）
    if (event.orderBy) {
      query = query.orderBy(event.orderBy[0], event.orderBy[1]);
    } else {
      query = query.orderBy('createTime', 'desc');
    }
    if (event.limit) query = query.limit(event.limit); // 限制返回数量
    if (event.skip) query = query.skip(event.skip);    // 分页偏移
    const result = await query.get();                  // 执行查询

    // 将 cloud:// 封面链接转为 HTTPS 临时链接（真机需要）
    const fileIDs = [];
    result.data.forEach(deck => {
      if (deck.coverUrl && deck.coverUrl.startsWith('cloud://')) fileIDs.push(deck.coverUrl);
    });
    if (fileIDs.length > 0) {
      const tempRes = await cloud.getTempFileURL({ fileList: fileIDs }); // 批量转换
      const urlMap = {};                               // fileID → tempFileURL 映射
      tempRes.fileList.forEach(f => {
        if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
      // 直接替换 coverUrl 为 HTTPS 临时链接
      result.data.forEach(deck => {
        if (urlMap[deck.coverUrl]) deck.coverUrl = urlMap[deck.coverUrl];
      });
    }
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
