// ============================================================
// 更新套牌模块——创作者或管理员可修改
// 仅当更新卡牌内容（cards/cardDetails）时才做规则校验
// coverUrl 等元数据字段更新不受规则限制
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { validate } = require('../utils/validateDeck'); // 套牌规则校验工具
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;                     // 服务端获取真实 openId

  try {
    // 先查询套牌是否存在
    const existing = await db.collection('decks').doc(event.id).get();
    if (!existing.data) {
      return { success: false, msg: '套牌不存在' };
    }

    // 权限验证：套牌创作者 OR 管理员可修改
    const auth = await checkAdmin.main();
    if (existing.data.creatorOpenId !== openId && !auth.authorized) {
      return { success: false, msg: '无权限修改此套牌', code: 403 };
    }

    // 仅当更新了卡牌内容（cards 或 cardDetails）时才做规则校验
    // 封面 URL 等元数据字段不受此限制
    if (event.data.cards || event.data.cardDetails) {
      const validation = validate(event.data);
      if (!validation.valid) {
        return { success: false, msg: validation.msg };
      }
    }

    await db.collection('decks').doc(event.id).update({ data: event.data }); // 执行更新
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
