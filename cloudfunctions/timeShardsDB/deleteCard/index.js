// ============================================================
// 删除卡牌模块——需管理员权限
// 删除卡牌的同时，在所有引用该卡牌的套牌中将其替换为"卡牌残片"占位符
// 这样已有套牌的导入代码不会因卡牌被删而失效
// ============================================================

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const checkAdmin = require('../utils/checkAdmin');     // 管理员验证工具

// 占位符卡牌模板——被删除的卡牌在套牌中统一替换为此
const PLACEHOLDER = {
  name: '卡牌残片',
  faction: '中立',
  cost: 0,
  level: '',
  rarity: '纸',
  type: '奇物',
  subtype: '',
  atk: 0,
  hp: 0,
  description: '原卡牌已被移除',
  flavor: '',
  able: false,                                        // 占位符不可单独使用
  imageUrl: '',
  createTime: Date.now(),
};

exports.main = async (event, context) => {
  const auth = await checkAdmin.main();                // 验证管理员身份
  if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
  try {
    const cardId = event.id;                           // 要删除的卡牌 _id

    // Step 1: 查找或创建"卡牌残片"占位符
    let placeholderId = null;
    const pHolderRes = await db.collection('cards').where({ name: '卡牌残片' }).limit(1).get();
    if (pHolderRes.data.length > 0) {
      placeholderId = pHolderRes.data[0]._id;           // 复用已有占位符
      if (pHolderRes.data[0].imageUrl) {
        PLACEHOLDER.imageUrl = pHolderRes.data[0].imageUrl;
      }
    } else {
      const createRes = await db.collection('cards').add({ data: PLACEHOLDER }); // 自动创建占位符
      placeholderId = createRes._id;
    }

    // Step 2: 从 cards 集合中删除该卡牌
    await db.collection('cards').doc(cardId).remove();

    // Step 3: 在所有包含该卡牌的套牌中替换为占位符
    const decksRes = await db.collection('decks').where({
      cards: db.command.in([cardId])                   // 查询 cards[] 中包含该 _id 的套牌
    }).get();
    for (const deck of decksRes.data) {
      // 替换 cards[] 数组中的 _id
      const newCards = (deck.cards || []).map(id => id === cardId ? placeholderId : id);
      // 替换 cardDetails[] 中的完整卡牌对象
      const newCardDetails = (deck.cardDetails || []).map(c => {
        if (c._id === cardId) return Object.assign({}, PLACEHOLDER, { _id: placeholderId });
        return c;
      });
      await db.collection('decks').doc(deck._id).update({
        data: { cards: newCards, cardDetails: newCardDetails }
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
