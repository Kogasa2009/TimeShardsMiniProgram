// ============================================================
// 查询卡牌模块——支持阵营筛选 / 搜索 / 排序 / 分页
// 自动将 cloud:// 图片链接转为 HTTPS 临时链接（存入 displayImageUrl 字段）
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  try {
    let where = event.where || {};                     // 默认空条件 = 查询全部
    // 未指定 includeDisabled 时，默认只返回已启用的卡牌（able !== false）
    if (!event.includeDisabled) {
      where.able = db.command.neq(false);              // 不等于 false = 已启用或未设置
    }
    // 如果有搜索关键词，用正则模糊匹配卡牌名称（不区分大小写）
    if (event.search) {
      where.name = db.RegExp({ regexp: event.search, options: 'i' });
    }
    let query = db.collection('cards').where(where);   // 构建查询
    if (event.limit) query = query.limit(event.limit); // 限制返回数量
    if (event.skip) query = query.skip(event.skip);    // 分页偏移
    if (event.orderBy) query = query.orderBy(event.orderBy[0], event.orderBy[1]); // 排序 [字段, 方向]
    const result = await query.get();                  // 执行查询

    // 为 cloud:// 图片链接生成 HTTPS 临时链接（真机需要，存入 displayImageUrl 不覆盖原值）
    const fileIDs = [];
    result.data.forEach(card => {
      if (card.imageUrl && card.imageUrl.startsWith('cloud://')) fileIDs.push(card.imageUrl);
    });
    if (fileIDs.length > 0) {
      const tempRes = await cloud.getTempFileURL({ fileList: fileIDs }); // 批量转临时链接
      const urlMap = {};                               // fileID → tempFileURL 映射
      tempRes.fileList.forEach(f => {
        if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
      result.data.forEach(card => {
        card.displayImageUrl = urlMap[card.imageUrl] || card.imageUrl; // 存入新字段供前端展示
      });
    } else {
      // 无 cloud:// 链接时，displayImageUrl 直接等于 imageUrl
      result.data.forEach(card => { card.displayImageUrl = card.imageUrl; });
    }
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
