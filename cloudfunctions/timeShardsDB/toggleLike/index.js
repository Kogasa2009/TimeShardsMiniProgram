// ============================================================
// 切换点赞状态模块
// 已点赞 → 取消：删除 deckLikes 记录，decks.likes 原子减 1
// 未点赞 → 点赞：新增 deckLikes 记录，decks.likes 原子加 1
// 使用 db.command.inc 保证并发安全
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();                          // 获取数据库实例

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const realOpenId = wxContext.OPENID;                 // 服务端获取真实 openId

  // 如果前端传了 openId，必须与服务端获取的一致（可选验证）
  if (event.openId && event.openId !== realOpenId) {
    return { success: false, msg: '身份验证失败', code: 403 };
  }

  try {
    // 检查是否已有该用户对该套牌的点赞记录
    const existing = await db.collection('deckLikes').where({
      openId: realOpenId,
      deckId: event.deckId
    }).get();

    if (existing.data.length > 0) {
      // 已点赞 → 取消：删除点赞记录
      await db.collection('deckLikes').doc(existing.data[0]._id).remove();
      const _ = db.command;
      // 原子操作：decks.likes 减 1（防止并发覆盖）
      await db.collection('decks').doc(event.deckId).update({
        data: { likes: _.inc(-1) }
      });
      return { success: true, action: 'removed' };     // 返回 removed 供前端判断
    } else {
      // 未点赞 → 点赞：新增点赞记录
      await db.collection('deckLikes').add({
        data: {
          openId: realOpenId,
          deckId: event.deckId,
          createTime: Date.now()
        }
      });
      const _ = db.command;
      // 原子操作：decks.likes 加 1
      await db.collection('decks').doc(event.deckId).update({
        data: { likes: _.inc(1) }
      });
      return { success: true, action: 'added' };       // 返回 added 供前端判断
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
};
