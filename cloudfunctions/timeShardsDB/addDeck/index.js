// ============================================================
// 新增套牌模块——含身份验证和服务端规则校验
// 验证 creatorOpenId 与调用者一致 + 套牌规则（40张/稀有度上限）
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { validate } = require('../utils/validateDeck'); // 套牌规则校验工具

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;                     // 服务端获取真实 openId

  // 身份验证：传入的 creatorOpenId 必须与真实 openId 一致（防止伪造）
  if (event.data.creatorOpenId !== openId) {
    return { success: false, msg: '身份验证失败', code: 403 };
  }

  // 服务端套牌规则校验（双重保险——前端已校验，此处再次确认）
  const validation = validate(event.data);
  if (!validation.valid) {
    return { success: false, msg: validation.msg };
  }

  try {
    const result = await db.collection('decks').add({ data: event.data }); // 插入数据库
    return { success: true, _id: result._id };         // 返回新套牌 _id
  } catch (err) {
    return { success: false, error: err.message };
  }
};
