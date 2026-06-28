// 获取全局 App 实例（使用 globalData 中的阵营、稀有度列表）
const app = getApp();

// Page() 注册管理员卡牌编辑页——新增/编辑单张卡牌的全部字段
Page({
  // data 页面初始数据
  data: {
    cardId: null,                                   // 编辑模式下的卡牌 _id，新建时为 null
    editing: false,                                 // 是否处于编辑模式（有 id 则为 true）
    factions: app.globalData.factions.concat(['中立']), // 六阵营 + 中立
    rarities: app.globalData.rarities,              // 稀有度列表：['纸', '锡', '铂', '晶']
    types: ['单位', '法术', '建筑', '奇物'],         // 卡牌类型固定列表
    selectedFaction: 0,                             // 当前选中的阵营索引
    selectedRarity: 0,                              // 当前选中的稀有度索引
    selectedType: 0,                                // 当前选中的类型索引
    imageList: [],                                  // 卡牌图片路径列表（本地临时路径或云存储 URL）
    uploading: false,                               // 是否正在上传图片
  },

  // onLoad 页面加载——先检查管理员权限，有 id 参数则为编辑模式
  onLoad: function (options) {
    if (!app.globalData.isAdmin) {                  // 非管理员拦截
      wx.showModal({
        title: '无权限',
        content: '您不是管理员，无法访问此页面',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    if (options.id) {                                // URL 带有 id 参数 = 编辑模式
      this.setData({ cardId: options.id, editing: true });
      this.loadCard(options.id);                     // 加载已有卡牌数据填充表单
    }
  },

  // loadCard 从数据库加载指定卡牌的全部字段，填充到表单
  loadCard: function (id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();                 // 获取云数据库实例
    db.collection('cards')                          // 查询 cards 集合
      .doc(id)                                      // 定位到指定 _id 的单条记录
      .get().then(res => {
        const card = res.data;                      // 获取卡牌完整数据
        this.setData({
          card_name: card.name,                     // 卡牌名称
          faction: card.faction,                    // 阵营（字符串）
          cost: card.cost,                          // 费用
          level: card.level,                        // 科技等级
          type: card.type,                          // 类型
          subtype: card.subtype,                    // 副类型（可选）
          rarity: card.rarity,                      // 稀有度
          atk: card.atk,                            // 攻击力
          hp: card.hp,                              // 生命值
          description: card.description,            // 描述文本
          flavor: card.flavor,                      // 背景故事（风味文字）
          ableText: typeof card.able === 'string' ? card.able : '', // 关键词字段（兼容旧数据格式）
          selectedFaction: this.data.factions.indexOf(card.faction), // 根据阵营字符串反查选择器索引
          selectedRarity: this.data.rarities.indexOf(card.rarity),   // 根据稀有度字符串反查索引
          selectedType: this.data.types.indexOf(card.type),          // 根据类型字符串反查索引
          imageList: card.imageUrl ? [card.imageUrl] : [], // 有图片 URL 则放入预览列表
        });
        wx.hideLoading();
      }).catch(err => {
        console.log(err);                           // 记录错误日志
        wx.hideLoading();
      });
  },

  // onInput 通用输入监听——通过 data-field 属性区分当前编辑的是哪个字段
  onInput: function (e) {
    const field = e.currentTarget.dataset.field;    // 从 data-field 获取字段名（如 'card_name', 'cost'）
    const value = e.detail.value;                   // 用户输入的值（均为字符串）
    this.setData({ [field]: value });               // ES6 计算属性名——动态设置对应 data 字段
  },

  // onPickerChange 通用选择器变化监听——通过 data-field 区分阵营/稀有度/类型
  onPickerChange: function (e) {
    const field = e.currentTarget.dataset.field;    // 获取选择器对应的 data 字段名
    this.setData({ [field]: parseInt(e.detail.value) }); // picker 返回值是字符串，转为整数索引
  },

  // chooseImage 调用微信 API 从相册或相机选择卡牌图片
  chooseImage: function () {
    var that = this;
    wx.chooseImage({
      count: 1,                                     // 每次只能选一张（卡牌图片只需一张）
      mediaType: ['image'],                         // 只允许图片
      sourceType: ['album', 'camera'],              // 来源：相册 + 拍照
      success: res => {
        that.setData({ imageList: res.tempFilePaths }); // 保存本地临时文件路径用于预览
      }
    });
  },

  // removeImage 移除已选择的卡牌图片（回到空状态）
  removeImage: function () {
    this.setData({ imageList: [] });
  },

  // previewImage 全屏预览已选择的卡牌图片
  previewImage: function () {
    wx.previewImage({
      urls: this.data.imageList,                    // 可预览的图片列表
      current: this.data.imageList[0]               // 当前显示的图片
    });
  },

  // saveCard 保存卡牌——校验必填字段 → 上传图片（如需） → 通过云函数写入数据库
  saveCard: function () {
    // 卡牌名称为必填字段
    if (!this.data.card_name || !this.data.card_name.trim()) {
      wx.showToast({ title: '请输入卡牌名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    // 从表单各字段组装卡牌数据对象
    const cardData = {
      name: this.data.card_name,                    // 必填
      faction: this.data.factions[parseInt(this.data.selectedFaction) || 0], // 数组索引 → 阵营字符串
      cost: parseInt(this.data.cost) || 0,          // 字符串转整数，非法输入默认为 0
      level: parseInt(this.data.level) || 0,        // 科技等级
      type: this.data.types[parseInt(this.data.selectedType) || 0],         // 类型字符串
      subtype: this.data.subtype || '',             // 副类型（可选）
      rarity: this.data.rarities[parseInt(this.data.selectedRarity) || 0],  // 稀有度字符串
      atk: parseInt(this.data.atk) || 0,            // 攻击力
      hp: parseInt(this.data.hp) || 0,              // 生命值
      description: this.data.description || '',     // 描述文本
      flavor: this.data.flavor || '',               // 背景故事
      able: true,                                   // 新卡默认启用
      updateTime: Date.now(),                       // 更新时间戳
    };

    // saveData 通过云函数执行数据库写入（新增或更新）
    const saveData = () => {
      if (this.data.editing) {                       // 编辑模式：调用 updateCard
        wx.cloud.callFunction({
          name: 'timeShardsDB',
          data: { type: 'updateCard', id: this.data.cardId, data: cardData }
        }).then(finish).catch(fail);
      } else {                                       // 新建模式：调用 addCard
        cardData.createTime = Date.now();            // 新建才需要创建时间
        wx.cloud.callFunction({
          name: 'timeShardsDB',
          data: { type: 'addCard', data: cardData }
        }).then(finish).catch(fail);
      }
    };

    // finish 保存成功回调——提示并延迟返回上一页
    const finish = () => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);     // 1.5 秒后返回列表页
    };

    // fail 保存失败回调——提示用户重试
    const fail = (err) => {
      wx.hideLoading();
      console.log(err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    };

    // 判断是否需要上传新图片——本地临时路径（非 cloud://）需要先上传到云存储
    if (this.data.imageList.length > 0 && this.data.imageList[0].indexOf('cloud://') !== 0) {
      wx.cloud.uploadFile({                          // 上传到云存储
        filePath: this.data.imageList[0],            // 本地临时文件路径
        cloudPath: 'cards/' + Date.now() + this.data.imageList[0].match(/\.[^.]+?$/)[0], // 云存储路径：cards/时间戳.扩展名
        success: res => {
          cardData.imageUrl = res.fileID;            // 上传成功，获得 cloud:// 文件 ID
          saveData();                                // 再写入数据库
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '图片上传失败', icon: 'none' });
        }
      });
    } else {
      // 无新图片或已是云存储 URL，直接保存数据库
      cardData.imageUrl = this.data.imageList[0] || '';
      saveData();
    }
  }
});
