// 获取全局 App 实例（检查管理员权限）
const app = getApp();

// Page() 注册管理员公告编辑页——新增/编辑公告（标题 + 摘要 + 正文 + 封面图 + 正文多图）
Page({
  // data 页面初始数据
  data: {
    newsId: null,                                   // 编辑模式下的公告 _id，新建时为 null
    editing: false,                                 // 是否处于编辑模式
    title: '',                                      // 公告标题
    summary: '',                                    // 公告摘要
    content: '',                                    // 公告正文（长文本）
    coverList: [],                                  // 封面图片列表（仅一张）
    imageList: [],                                  // 正文图片列表（可多张）
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
    this._ready = false;                            // 防抖标记：初始化完成前忽略输入事件
    if (options.id) {                                // 带 id = 编辑模式
      this.setData({ newsId: options.id, editing: true });
      this.loadNews(options.id);                     // 加载已有公告数据填充表单
    } else {
      // 新建模式：短延迟后标记就绪（防止 setData 与 onInput 竞争）
      setTimeout(() => { this._ready = true; }, 150);
    }
  },

  // loadNews 从数据库加载指定公告的全部字段，填充到表单
  loadNews: function (id) {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();                 // 获取云数据库实例
    db.collection('news')                           // 查询 news 集合
      .doc(id)                                      // 定位到指定 _id 的记录
      .get().then(res => {
        const news = res.data;                      // 获取公告完整数据
        this.setData({
          title: news.title || '',                  // 标题
          summary: news.summary || '',              // 摘要
          content: news.content || '',              // 正文
          coverList: news.coverUrl ? [news.coverUrl] : [], // 有封面 URL 则放入预览列表
          imageList: news.images || [],             // 正文图片数组
        });
        wx.hideLoading();
        setTimeout(() => { this._ready = true; }, 200); // 延迟标记就绪
      }).catch(err => {
        console.log(err);
        wx.hideLoading();
        setTimeout(() => { this._ready = true; }, 200);
      });
  },

  // onInput 通用输入监听——通过 data-field 区分字段，带防抖保护
  onInput: function (e) {
    if (!this._ready) return;                       // 初始化未完成时忽略（防止加载时覆盖已填充数据）
    const field = e.currentTarget.dataset.field;    // 从 data-field 获取字段名
    this.setData({ [field]: e.detail.value });      // 动态设置对应字段
  },

  // chooseCover 选择封面图片（仅一张）
  chooseCover: function () {
    const that = this;
    wx.chooseImage({
      count: 1,                                     // 封面只需一张
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        that.setData({ coverList: res.tempFilePaths }); // 保存本地临时路径
      }
    });
  },

  // removeCover 移除已选择的封面图片
  removeCover: function () {
    this.setData({ coverList: [] });
  },

  // chooseImages 选择正文图片（可多选，最多 9 张）
  chooseImages: function () {
    const that = this;
    wx.chooseImage({
      count: 9,                                     // 微信单次最多选 9 张
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        // 合并已有图片和新选图片
        const merged = that.data.imageList.concat(res.tempFilePaths);
        that.setData({ imageList: merged });
      }
    });
  },

  // removeImage 从正文图片列表中移除指定索引的图片
  removeImage: function (e) {
    const idx = e.currentTarget.dataset.index;      // 获取要删除的图片索引
    this.data.imageList.splice(idx, 1);             // 从数组中移除
    this.setData({ imageList: this.data.imageList }); // 更新视图
  },

  // previewImage 全屏预览指定图片
  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;        // 从 data-src 获取图片 URL
    wx.previewImage({ urls: [src], current: src });  // 微信原生图片预览
  },

  // saveNews 保存公告——校验 → 上传封面 → 上传正文图片 → 写入数据库
  saveNews: function () {
    // 标题为必填字段
    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入公告标题', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '上传中...' });

    // 组装公告数据对象
    const newsData = {
      title: this.data.title,                       // 必填
      summary: this.data.summary || '',             // 摘要
      content: this.data.content || '',             // 正文
      updateTime: Date.now(),                       // 更新时间戳
    };

    // doSave 通过云函数执行数据库写入
    const doSave = () => {
      if (this.data.editing) {                       // 编辑模式：更新
        wx.cloud.callFunction({
          name: 'timeShardsDB',
          data: { type: 'updateNews', id: this.data.newsId, data: newsData },
        }).then(finish).catch(fail);
      } else {                                       // 新建模式：添加
        newsData.createTime = Date.now();            // 新建需要创建时间
        wx.cloud.callFunction({
          name: 'timeShardsDB',
          data: { type: 'addNews', data: newsData },
        }).then(finish).catch(fail);
      }
    };

    // finish 保存成功回调
    const finish = () => {
      wx.hideLoading();
      wx.showToast({ title: '上传成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);     // 1.5 秒后返回列表页
    };

    // fail 保存失败回调
    const fail = (err) => {
      wx.hideLoading();
      console.log(err);
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    };

    // 判断封面是否需要上传——本地临时路径（非 cloud://）需先上传到云存储
    if (this.data.coverList.length > 0 && this.data.coverList[0].indexOf('cloud://') !== 0) {
      this.setData({ uploading: true });
      wx.cloud.uploadFile({                          // 上传封面到云存储
        filePath: this.data.coverList[0],            // 本地临时文件路径
        cloudPath: 'TimeShardsInfo/' + Date.now() + this.data.coverList[0].match(/\.[^.]+?$/)[0], // 云存储路径
        success: res => {
          newsData.coverUrl = res.fileID;            // 获取 cloud:// 文件 ID
          this.uploadImagesThenSave(newsData, doSave); // 继续处理正文图片
        },
        fail: () => {
          this.setData({ uploading: false });
          wx.hideLoading();
          wx.showToast({ title: '封面上传失败', icon: 'none' });
        }
      });
    } else {
      // 无新封面或已是云存储 URL
      newsData.coverUrl = this.data.coverList[0] || '';
      this.uploadImagesThenSave(newsData, doSave);
    }
  },

  // uploadImagesThenSave 上传正文中的新图片（本地临时路径），全部完成后执行 doSave
  uploadImagesThenSave: function (newsData, doSave) {
    // 筛选出需要上传的本地图片（排除已有的 cloud:// URL）
    const localImages = this.data.imageList.filter(img => img.indexOf('cloud://') !== 0);
    if (localImages.length === 0) {                  // 没有需要上传的新图片
      newsData.images = this.data.imageList;         // 保留已有的 cloud:// URL
      this.setData({ uploading: false });
      doSave();                                      // 直接保存
      return;
    }

    // 已有 cloud:// 图片保留不重新上传
    const cloudUrls = this.data.imageList.filter(img => img.indexOf('cloud://') === 0);
    let uploaded = 0;                                // 已完成上传计数
    localImages.forEach((filePath, i) => {
      const ext = filePath.match(/\.[^.]+?$/);       // 提取文件扩展名
      wx.cloud.uploadFile({                          // 逐个上传本地图片
        filePath: filePath,
        cloudPath: 'TimeShardsInfo/' + Date.now() + '_' + i + (ext ? ext[0] : ''), // 唯一文件名
        success: res => {
          cloudUrls.push(res.fileID);                // 将新 cloud:// URL 加入数组
          uploaded++;
          if (uploaded === localImages.length) {     // 全部上传完成
            newsData.images = cloudUrls;             // 最终图片数组 = 老 cloud URL + 新 cloud URL
            this.setData({ uploading: false });
            doSave();                                // 写入数据库
          }
        },
        fail: () => {
          uploaded++;                                // 上传失败也计数，避免卡死
          if (uploaded === localImages.length) {     // 全部处理完（含失败）
            newsData.images = cloudUrls;             // 用已成功的部分
            this.setData({ uploading: false });
            doSave();                                // 即使有失败也继续保存
          }
        }
      });
    });
  },
});
