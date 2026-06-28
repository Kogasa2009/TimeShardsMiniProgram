// ============================================================
// 套牌规则校验工具
// 验证套牌数据是否符合游戏规则：
//   1. 套牌名称非空
//   2. 阵营必须在 6 阵营范围内
//   3. 卡组必须恰好 40 张
//   4. 同名牌数量不超过该稀有度的携带上限（纸≤4/锡≤3/铂≤2/晶≤1）
// ============================================================

// 六阵营固定列表（与前端 app.globalData.factions 保持一致）
const FACTIONS = ['银翼之羽', '永恒沙丘', '劫掠风暴', '橡木氏族', '百景古都', '不休锻炉'];
// 稀有度 → 同名携带上限映射
const RARITY_LIMITS = { '纸': 4, '锡': 3, '铂': 2, '晶': 1 };
const REQUIRED_TOTAL = 40;                             // 套牌总卡牌数要求

// exports.validate 返回 { valid: boolean, msg?: string } 格式的校验结果
exports.validate = (deckData) => {
  // 规则 1：套牌名称不能为空或全空白
  if (!deckData.name || !deckData.name.trim()) {
    return { valid: false, msg: '套牌名称不能为空' };
  }
  // 规则 2：阵营必须在有效范围内
  if (!FACTIONS.includes(deckData.faction)) {
    return { valid: false, msg: '无效的阵营' };
  }
  // 规则 3：卡组必须恰好 40 张
  const cardDetails = deckData.cardDetails || [];
  if (cardDetails.length !== REQUIRED_TOTAL) {
    return { valid: false, msg: `卡组必须恰好${REQUIRED_TOTAL}张卡牌，当前${cardDetails.length}张` };
  }
  // 规则 4：同名牌不允许超过该稀有度的携带上限
  const nameCounts = {};                               // name → count 统计
  for (const card of cardDetails) {
    nameCounts[card.name] = (nameCounts[card.name] || 0) + 1;
  }
  for (const [name, count] of Object.entries(nameCounts)) {
    const card = cardDetails.find(c => c.name === name); // 找到该卡牌取稀有度
    const rarity = card.rarity || '纸';                 // 非标准稀有度默认按纸卡处理
    const limit = RARITY_LIMITS[rarity] || 4;           // 查稀有度上限
    if (count > limit) {
      return { valid: false, msg: `"${name}"(${rarity})最多携带${limit}张，当前${count}张` };
    }
  }
  return { valid: true };                              // 全部通过
};
