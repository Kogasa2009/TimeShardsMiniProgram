// ============================================================
// 删除套牌模块——创作者或管理员可删除
// 级联删除：同时清理 favorites 和 deckLikes 中的关联记录
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;                     // 服务端获取真实 openId

  try {
    // 查询套牌归属
    const deckRes = await db.collection('decks').doc(event.id).get();

    // 权限验证：非创作者则需要管理员权限
    if (deckRes.data.creatorOpenId !== openId) {
      const auth = await checkAdmin.main();
      if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
    }

    // 级联删除：先清理 favorites 和 deckLikes 中的关联记录
    await db.collection('favorites').where({ deckId: event.id }).remove();
    await db.collection('deckLikes').where({ deckId: event.id }).remove();
    // 最后删除套牌本身
    await db.collection('decks').doc(event.id).remove();

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
