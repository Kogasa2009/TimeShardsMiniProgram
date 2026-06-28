// ============================================================
// TimeShards 云函数统一入口
// 所有小程序端写操作和批量读操作均通过此入口分发到 20 个子模块
// 通过 event.type 字段路由到对应的子模块处理函数
// ============================================================

// 引入微信云开发服务端 SDK
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });     // 使用当前小程序关联的云环境

// ---- 引入 20 个子功能模块 ----
const login = require('./login/index');               // 登录——获取微信上下文
const getCards = require('./getCards/index');         // 查询卡牌——支持搜索/筛选/排序
const addCard = require('./addCard/index');           // 新增卡牌（管理员）
const updateCard = require('./updateCard/index');     // 更新卡牌（管理员）
const deleteCard = require('./deleteCard/index');     // 删除卡牌并替换为占位符（管理员）
const getDecks = require('./getDecks/index');         // 查询套牌
const addDeck = require('./addDeck/index');           // 新增套牌（含服务端规则校验）
const updateDeck = require('./updateDeck/index');     // 更新套牌（创作者或管理员）
const deleteDeck = require('./deleteDeck/index');     // 删除套牌及关联数据
const getNews = require('./getNews/index');           // 查询公告
const addNews = require('./addNews/index');           // 新增公告（管理员）
const updateNews = require('./updateNews/index');     // 更新公告（管理员）
const deleteNews = require('./deleteNews/index');     // 删除公告及关联云存储图片
const toggleFavorite = require('./toggleFavorite/index'); // 切换收藏状态
const getBanners = require('./getBanners/index');     // 查询轮播图
const addBanner = require('./addBanner/index');       // 新增轮播图（管理员）
const deleteBanner = require('./deleteBanner/index'); // 删除轮播图及云存储图片
const updateBannerSort = require('./updateBannerSort/index'); // 更新轮播图排序
const toggleLike = require('./toggleLike/index');     // 切换点赞状态
const checkAdmin = require('./utils/checkAdmin');     // 管理员身份验证工具

// exports.main 云函数入口——根据 event.type 分发到对应子模块
exports.main = async (event, context) => {
  switch (event.type) {                               // 按 type 字段路由请求
    // ---- 用户相关 ----
    case 'login':                                     // 登录——返回微信 openId 等上下文
      return await login.main(event, context);
    case 'updateProfile': {                           // 更新用户资料（头像/昵称）——内联处理
      const db = cloud.database();
      const wxContext = cloud.getWXContext();
      const realOpenId = wxContext.OPENID;             // 从服务端获取真实 openId（不可伪造）
      const userRes = await db.collection('user').where({ openId: realOpenId }).get();
      if (userRes.data.length === 0) return { success: false, msg: '用户不存在' };
      const updateData = {};                           // 仅更新传来的字段
      if (event.avatarUrl !== undefined) updateData.avatarUrl = event.avatarUrl;
      if (event.nickName !== undefined) updateData.nickName = event.nickName;
      if (Object.keys(updateData).length === 0) return { success: false, msg: '无可更新字段' };
      await db.collection('user').doc(userRes.data[0]._id).update({ data: updateData });
      return { success: true };
    }

    // ---- 卡牌管理（管理员） ----
    case 'getCards':                                  // 查询卡牌——支持阵营筛选/搜索/排序
      return await getCards.main(event, context);
    case 'addCard':                                   // 新增卡牌——需管理员权限
      return await addCard.main(event, context);
    case 'updateCard':                                // 更新卡牌——需管理员权限
      return await updateCard.main(event, context);
    case 'deleteCard':                                // 删除卡牌——替换为占位符
      return await deleteCard.main(event, context);
    case 'toggleCardAble': {                          // 切换卡牌启用/禁用——内联处理
      const db = cloud.database();
      const _ = db.command;
      const auth = await checkAdmin.main();            // 验证管理员身份
      if (!auth.authorized) return { success: false, msg: 'Unauthorized', code: 403 };
      const cardRes = await db.collection('cards').doc(event.id).get();
      const currentEnabled = cardRes.data.able !== false;
      const newEnabled = !currentEnabled;              // 取反切换
      await db.collection('cards').doc(event.id).update({ data: { able: newEnabled } });

      // 禁用卡牌时：将套牌中该卡牌的所有引用替换为"卡牌残片"占位符
      if (!newEnabled) {
        const PLACEHOLDER = {
          name: '卡牌残片', faction: '中立', cost: 0, level: '', rarity: '纸',
          type: '奇物', subtype: '', atk: 0, hp: 0,
          description: '原卡牌已被禁用或移除', flavor: '', able: false, imageUrl: '', createTime: Date.now(),
        };
        let placeholderId = null;
        // 查找或创建占位符卡牌
        const pHolderRes = await db.collection('cards').where({ name: '卡牌残片' }).limit(1).get();
        if (pHolderRes.data.length > 0) {
          placeholderId = pHolderRes.data[0]._id;
          if (pHolderRes.data[0].imageUrl) PLACEHOLDER.imageUrl = pHolderRes.data[0].imageUrl;
        } else {
          const createRes = await db.collection('cards').add({ data: PLACEHOLDER });
          placeholderId = createRes._id;
        }
        // 在所有引用该卡牌的套牌中替换
        const decksRes = await db.collection('decks').where({ cards: _.in([event.id]) }).get();
        for (const deck of decksRes.data) {
          const newCards = (deck.cards || []).map(id => id === event.id ? placeholderId : id);
          const newCardDetails = (deck.cardDetails || []).map(c => {
            if (c._id === event.id) return Object.assign({}, PLACEHOLDER, { _id: placeholderId });
            return c;
          });
          await db.collection('decks').doc(deck._id).update({
            data: { cards: newCards, cardDetails: newCardDetails }
          });
        }
      }
      return { success: true, able: newEnabled };
    }

    // ---- 套牌管理 ----
    case 'getDecks':                                  // 查询套牌——支持搜索/排序
      return await getDecks.main(event, context);
    case 'addDeck':                                   // 新增套牌——含服务端规则校验
      return await addDeck.main(event, context);
    case 'updateDeck':                                // 更新套牌——创作者或管理员
      return await updateDeck.main(event, context);
    case 'deleteDeck':                                // 删除套牌——级联删除收藏/点赞
      return await deleteDeck.main(event, context);

    // ---- 公告管理（管理员） ----
    case 'getNews':                                   // 查询公告——按时间降序
      return await getNews.main(event, context);
    case 'addNews':                                   // 新增公告——需管理员权限
      return await addNews.main(event, context);
    case 'updateNews':                                // 更新公告——需管理员权限
      return await updateNews.main(event, context);
    case 'deleteNews':                                // 删除公告——含云存储图片清理
      return await deleteNews.main(event, context);

    // ---- 收藏/点赞 ----
    case 'toggleFavorite':                            // 切换收藏——add/remove
      return await toggleFavorite.main(event, context);
    case 'toggleLike':                                // 切换点赞——含原子增减 likes 计数
      return await toggleLike.main(event, context);

    // ---- 轮播图管理（管理员） ----
    case 'getBanners':                                // 查询轮播图——按 sortOrder 升序
      return await getBanners.main(event, context);
    case 'addBanner':                                 // 新增轮播图——含自动编号
      return await addBanner.main(event, context);
    case 'deleteBanner':                              // 删除轮播图——含云存储图片清理
      return await deleteBanner.main(event, context);
    case 'updateBannerSort':                          // 更新轮播图排序值
      return await updateBannerSort.main(event, context);

    // ---- 工具/维护操作（内联处理） ----
    case 'getTempUrls': {                             // cloud:// → HTTPS 临时链接批量转换
      const ids = event.fileIDs || [];
      if (ids.length === 0) return { success: true, urlMap: {} };
      const result = await cloud.getTempFileURL({ fileList: ids });
      const urlMap = {};                               // 构建 fileID → tempFileURL 映射
      (result.fileList || []).forEach(f => {
        if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });
      return { success: true, urlMap: urlMap };
    }
    case 'fixCorruptedCoverUrls': {                   // 修复被 HTTPS URL 污染的封面——数据迁移脚本
      const db = cloud.database();
      // 查找 coverUrl 以 https:// 开头的套牌（已损坏的数据）
      const decksRes = await db.collection('decks')
        .where({ coverUrl: db.RegExp({ regexp: '^https?://', options: 'i' }) })
        .limit(100)
        .get();
      const decks = decksRes.data || [];
      if (decks.length === 0) return { success: true, msg: '没有需要修复的封面', fixed: 0 };
      let fixed = 0;
      for (const deck of decks) {
        try {
          const url = deck.coverUrl;
          // 从 HTTPS URL 提取文件名
          const pathMatch = url.match(/\/([^\/?]+\.(png|jpg|jpeg|gif|webp))/i);
          if (!pathMatch) continue;
          const filename = pathMatch[1];
          // 在 cards 集合中查找同名图片的 cloud:// URL
          const cardRes = await db.collection('cards').where({
            imageUrl: db.RegExp({ regexp: filename + '$', options: 'i' })
          }).limit(1).get();
          if (cardRes.data.length > 0 && cardRes.data[0].imageUrl) {
            await db.collection('decks').doc(deck._id).update({
              data: { coverUrl: cardRes.data[0].imageUrl }
            });
            fixed++;
          }
          // 同时修复 cardDetails 中可能被污染的 imageUrl
          if (deck.cardDetails && deck.cardDetails.length > 0) {
            let detailsChanged = false;
            for (const card of deck.cardDetails) {
              if (card.imageUrl && card.imageUrl.startsWith('https://')) {
                const m = card.imageUrl.match(/\/([^\/?]+\.(png|jpg|jpeg|gif|webp))/i);
                if (m) {
                  const cr = await db.collection('cards').where({
                    imageUrl: db.RegExp({ regexp: m[1] + '$', options: 'i' })
                  }).limit(1).get();
                  if (cr.data.length > 0 && cr.data[0].imageUrl) {
                    card.imageUrl = cr.data[0].imageUrl;
                    detailsChanged = true;
                  }
                }
              }
            }
            if (detailsChanged) {
              await db.collection('decks').doc(deck._id).update({ data: { cardDetails: deck.cardDetails } });
            }
          }
        } catch (e) { /* 跳过无法修复的记录 */ }
      }
      return { success: true, msg: '修复完成', fixed: fixed, total: decks.length };
    }
    case 'migrateAble': {                             // 批量迁移——将旧卡牌标记为 able: true
      const db = cloud.database();
      let updated = 0;
      const countRes = await db.collection('cards').count();
      const total = countRes.total;
      const batchSize = 100;                           // 分批处理避免超时
      const batches = Math.ceil(total / batchSize);
      for (let i = 0; i < batches; i++) {
        const res = await db.collection('cards').skip(i * batchSize).limit(batchSize).get();
        for (const card of res.data) {
          if (card.able !== true) {                    // 仅更新未标记为 true 的卡牌
            await db.collection('cards').doc(card._id).update({ data: { able: true } });
            updated++;
          }
        }
      }
      return { success: true, msg: '迁移完成', updated, total };
    }

    // ---- 未知操作 ----
    default:
      return { success: false, msg: 'Unknown operation type' };
  }
};
