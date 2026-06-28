// ============================================================
// 切换收藏状态模块
// add ——添加收藏记录（已收藏则跳过）
// remove ——删除收藏记录
// 验证 event.openId 与真实 openId 一致防止伪造
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const realOpenId = wxContext.OPENID;                 // 服务端获取真实 openId

  // 身份验证：传入的 openId 必须与服务端获取的一致
  if (event.openId !== realOpenId) {
    return { success: false, msg: '身份验证失败', code: 403 };
  }

  try {
    if (event.action === 'add') {                      // 添加收藏
      // 先验证套牌是否存在
      const deckRes = await db.collection('decks').doc(event.deckId).get();
      if (!deckRes.data) {
        return { success: false, msg: '套牌不存在' };
      }
      // 检查是否已收藏（防止重复）
      const existing = await db.collection('favorites').where({
        openId: realOpenId, deckId: event.deckId
      }).get();
      if (existing.data.length > 0) {
        return { success: true, msg: '已收藏', alreadyFavorited: true }; // 已收藏不报错
      }
      // 新建收藏记录
      await db.collection('favorites').add({
        data: { openId: realOpenId, deckId: event.deckId, createTime: Date.now() }
      });
      return { success: true, msg: '已收藏' };
    } else if (event.action === 'remove') {            // 取消收藏
      await db.collection('favorites').where({
        openId: realOpenId, deckId: event.deckId
      }).remove();                                     // 删除匹配的收藏记录
      return { success: true, msg: '已取消收藏' };
    }
    return { success: false, msg: '未知操作' };        // 无效的 action
  } catch (err) {
    return { success: false, error: err.message };
  }
};
