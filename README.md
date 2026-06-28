# TimeShards 组卡小程序

TCG 卡牌游戏组卡平台，支持多阵营卡组构建、分享、收藏与管理。

## 项目结构

```
0_TimeShards/
├── project.config.json
├── miniprogram/
│   ├── app.js                       # 入口：云环境初始化 → 登录 → 管理员检测
│   ├── app.json                     # 路由注册 / TabBar 配置
│   ├── app.wxss                     # 全局样式（暗黑主题 + 稀有度色 + 通用组件）
│   ├── utils/
│   │   └── errorHandler.js          # 工具：formatTime / callWithLoading / handleCloudError / getTempUrls
│   └── pages/
│       ├── welcome/                 # 欢迎页：品牌展示 → 引导进入登录
│       ├── login/                   # 登录页：昵称输入 + 头像设置（微信原生组件）
│       ├── index/                   # 首页：动态轮播图 + 最新公告
│       ├── deckSquare/              # 套牌广场：按阵营浏览 + 服务端搜索 + 排序
│       ├── deckBuild/               # 组牌入口：我的套牌列表
│       ├── deckEdit/                # 套牌编辑器：双栏（卡牌库 + 卡组）+ 导入导出
│       ├── deckDetail/              # 套牌详情：法力曲线 + 卡组构成 + 收藏/点赞/排序/复制
│       ├── cardDetail/              # 单卡详情：全属性展示 + 批量添加到卡组
│       ├── news/                    # 公告列表 + 公告详情
│       ├── user/                    # 我的：头像昵称编辑 + 收藏列表 + 管理员入口
│       └── admin/
│           ├── cardManage/          # 卡牌管理：阵营筛选 + 搜索 + 增删改 + 启用/禁用
│           ├── cardEdit/            # 卡牌编辑：11字段表单 + 图片上传
│           ├── newsManage/          # 公告管理列表
│           ├── newsEdit/            # 公告编辑：富文本 + 封面图 + 多图上传（最多9张）
│           └── bannerManage/        # 轮播图管理：上传 + 排序 + 删除
└── cloudfunctions/
    └── timeShardsDB/                # 主云函数（20个子模块 + 2个工具）
        ├── index.js                 # 入口：根据 type 字段路由到子模块
        ├── utils/
        │   ├── checkAdmin.js        # 服务端管理员鉴权（cloud.getWXContext）
        │   └── validateDeck.js      # 套牌规则服务端验证
        ├── login/                   # 获取微信 openId
        ├── getCards/                # 查询卡牌（服务端搜索 + 排序 + 分页 + displayImageUrl）
        ├── addCard/                 # 新增卡牌（admin）
        ├── updateCard/              # 更新卡牌（admin）
        ├── deleteCard/              # 删除卡牌（admin + 级联替换引用套牌为占位符）
        ├── getDecks/                # 查询套牌（服务端搜索 + 排序）
        ├── addDeck/                 # 新增套牌（身份校验 + 规则验证）
        ├── updateDeck/              # 更新套牌（所有权校验 + 规则验证）
        ├── deleteDeck/              # 删除套牌（admin/所有者 + 级联清理收藏和点赞）
        ├── getNews/                 # 查询公告
        ├── addNews/                 # 新增公告（admin）
        ├── updateNews/              # 更新公告（admin）
        ├── deleteNews/              # 删除公告（admin + 清理云存储图片）
        ├── toggleFavorite/          # 收藏/取消收藏（身份校验 + 防重复）
        ├── toggleLike/              # 点赞/取消点赞（身份校验 + deckLikes 计数同步）
        ├── getBanners/              # 查询轮播图（按 sortOrder 排序）
        ├── addBanner/               # 新增轮播图（admin + 自动分配排序号）
        ├── deleteBanner/            # 删除轮播图（admin + 清理云存储文件）
        └── updateBannerSort/        # 更新轮播图排序（admin）
```

**内置路由（云函数入口 index.js 内联处理）：**
- `updateProfile` — 更新用户昵称/头像（身份校验）
- `getTempUrls` — 批量 cloud:// → HTTPS 临时链接转换
- `toggleCardAble` — 启用/禁用卡牌（admin，禁用时级联替换为占位符）
- `fixCorruptedCoverUrls` — 修复被污染的 HTTPS 封面链接还原为 cloud://
- `migrateAble` — 批量迁移卡牌 able 字段

## 技术栈

- 微信云开发 (CloudBase)
- 云函数 (wx-server-sdk)
- 云数据库 (8 个集合)
- 云存储 (图片上传与管理)
- 微信小程序原生框架

## 数据库设计

| 集合 | 用途 | 字段 |
|------|------|------|
| `user` | 用户信息 | openId, nickName, avatarUrl, lastLoginTime, createTime |
| `admin` | 管理员白名单 | openId |
| `cards` | 卡牌数据 | name, faction, cost, level, rarity, type, subtype, atk, hp, description, flavor, able, imageUrl |
| `decks` | 套牌数据 | name, faction, cards[], cardDetails[], coverUrl, creatorOpenId, creatorName, featured, likes, totalCards, createTime, updateTime |
| `news` | 公告文章 | title, summary, content, coverUrl, images[], createTime, updateTime |
| `favorites` | 收藏记录 | openId, deckId, createTime |
| `deckLikes` | 点赞记录 | openId, deckId, createTime |
| `banners` | 首页轮播图 | imageUrl, sortOrder, createTime |

## 功能清单

### 用户端流程

**欢迎页 → 登录页 → Tab 首页**
- 首次进入展示品牌欢迎页，点击"立即进入"跳转登录
- 登录页通过微信原生 `chooseAvatar` + `type="nickname"` 组件设置头像和昵称
- 登录信息缓存到 Storage，后续启动自动跳过欢迎/登录页
- 用户信息通过云函数 `updateProfile` 写入 `user` 集合

### 用户端（Tab 栏 4 页）

**首页**
- 动态轮播图（从 `banners` 集合按 sortOrder 加载，4 秒间隔自动播放，首尾衔接）
- 最新公告展示（按创建时间取前 3 条，客户端数值排序）
- "更多"进入全部公告列表

**套牌广场**
- 6 阵营标签栏横向滚动切换
- 服务端 `db.RegExp` 模糊搜索
- 双列网格卡片展示，支持按最新/最热排序
- 点击进入套牌详情

**组牌**
- 展示当前用户创建的所有套牌
- 点击进入套牌详情（可编辑模式）
- "＋ 新建套牌" 进入编辑器

**我的**
- 用户头像/昵称（可点击修改） + 管理员标识
- 我的收藏（支持取消收藏）
- 管理员入口：卡牌管理 / 公告管理 / 轮播图管理
- 关于 TimeShards
- 退出登录

### 套牌编辑器（核心交互）

- 双栏布局：左侧卡牌库 + 右侧当前卡组
- 卡牌库按阵营过滤（含中立）、实时搜索、中立卡排后
- 卡组规则实时校验：纸 ≤ 4 / 锡 ≤ 3 / 铂 ≤ 2 / 晶 ≤ 1 / 总数 = 40
- 点击设封面（标记 ★）
- 一键清空卡组
- **导出套牌代码**：所有卡牌 `_id` 拼接为十六进制字符串
- **导入套牌代码**：解析十六进制代码还原卡组
- 保存通过云函数写入（服务端二次验证规则 + 身份校验）
- 编辑模式下加载已有套牌数据回填

### 套牌详情

- 封面图 + 名称 + 阵营 + 创作者 + 时间
- **法力曲线柱状图**（0-7+ 费，高度按比例缩放）
- 卡组构成去重展示，3 种排序轮换（费用/稀有度/名称）
- 收藏/取消收藏（通过云函数 + 服务端身份校验）
- 点赞/取消点赞（独立 `deckLikes` 集合 + `decks.likes` 计数同步）
- 复制套牌代码到剪贴板
- 自己的套牌：编辑 + 删除
- 管理员：任意套牌删除 + 精选切换

### 单卡详情

- 卡牌图片全屏预览
- 全属性展示：名称、稀有度、费用、阵营、类型、副类型、攻击力、生命值、描述、背景故事
- 批量添加到卡组（数量选择器 1~稀有度上限）

### 公告系统

- 全部公告列表（按时间倒序）
- 公告详情（正文 + 多图全屏预览）

### 管理员端

**卡牌管理**
- 7 阵营筛选（含中立）+ 服务端搜索
- 按费用升序排列
- 新增 / 编辑（11 字段表单） / 删除（弹窗确认）
- 卡牌图片上传到云存储 `cards/`
- 卡牌启用/禁用：禁用时所有引用套牌中的该卡牌自动替换为"卡牌残片"占位符
- 删除卡牌时级联替换所有引用套牌中的该卡牌为"卡牌残片"占位符（保留套牌结构完整性）

**公告管理**
- 公告列表 + 新增 / 编辑 / 删除
- 编辑页：标题 + 摘要 + 正文（textarea 去除字数限制 + auto-height）
- 封面上传 + 正文多图上传（最多 9 张），上传到 `TimeShardsInfo/`
- 删除公告时自动清理云存储中的封面和配图文件

**轮播图管理**
- 轮播图列表展示
- 新增：选择图片上传到云存储 `TimeShardsInfo/`
- 排序：↑↓ 按钮调整显示顺序，即时同步到服务端
- 删除：弹窗确认 + 清理云存储文件

## 权限模型

- **服务端鉴权**：所有管理员写入操作（addCard/updateCard/deleteCard/addNews/updateNews/deleteNews/deleteDeck/addBanner/deleteBanner/updateBannerSort/toggleCardAble）在云函数内通过 `checkAdmin.js` 验证调用者 `openId` 是否在 `admin` 表中
- **前端鉴权**：非管理员访问 `/pages/admin/*` 页面弹窗强制返回（UX 层）
- **所有权校验**：`addDeck` 校验 `creatorOpenId` 匹配调用者；`updateDeck` 校验套牌创建者身份或管理员权限
- **收藏防伪**：`toggleFavorite` 服务端对比 `event.openId` 与 `cloud.getWXContext().OPENID`
- **点赞防伪**：`toggleLike` 服务端对比 `event.openId` 与 `cloud.getWXContext().OPENID`

## 数据完整性

- 删除套牌 → 同时清理 `favorites` 和 `deckLikes` 表中关联记录
- 删除卡牌 → 同时替换所有引用套牌中 `cards[]` 和 `cardDetails[]` 的对应条目为"卡牌残片"占位符
- 禁用卡牌 → 同上，套牌中引用该卡牌的位置自动替换为占位符（可通过重新启用恢复，但替换不可逆）
- 删除公告 → 同时清理云存储中 `coverUrl` 和 `images[]` 的文件
- 删除轮播图 → 同时清理云存储中对应的图片文件
- 套牌详情 → 过滤 `_id` 为空的幽灵卡牌条目，标记占位符卡牌
- 封面链接修复 → `fixCorruptedCoverUrls` 可将被污染的 HTTPS 临时链接还原为 `cloud://` 格式

## 卡组规则

```
同名纸卡  ≤ 4 张
同名锡卡  ≤ 3 张
同名铂卡  ≤ 2 张
同名晶卡  ≤ 1 张
卡组总数  = 40 张（严格等于）
```

规则在客户端（`deckEdit.js` `tryAddCard`）和服务端（`validateDeck.js`）双重校验。

## 阵营

银翼之羽 / 永恒沙丘 / 劫掠风暴 / 橡木氏族 / 百景古都 / 不休锻炉

## 部署步骤

1. 微信开发者工具打开 `0_TimeShards` 目录
2. 修改 `project.config.json` 中的 `appid` 为你的 AppID
3. 修改 `miniprogram/app.js` 中的 `env` 为你的云环境 ID
4. 云开发控制台创建数据库集合：`user`, `admin`, `cards`, `decks`, `news`, `favorites`, `deckLikes`, `banners`
5. 上传并部署云函数 `timeShardsDB`（包含所有子模块和 utils 依赖）
6. 上传云存储素材：
   - `TimeShardsInfo/` — 公告封面和配图、轮播图（通过管理后台上传）
   - `cards/` — 卡牌图片（通过管理后台上传）
   - `avatars/` — 用户头像（通过登录页上传）
7. 在 `admin` 表中添加管理员记录（字段 `openId`）
8. 在 `news` 表中添加初始公告（`createTime` 使用 `Date.now()` 数字格式）
9. 通过轮播图管理页面上传首页轮播图（支持排序调整）

## 时间戳规范

所有 `createTime` / `updateTime` / `lastLoginTime` 使用 **数字毫秒时间戳**（`Date.now()`）。前端通过 `formatTime()` 工具函数统一格式化为 `YYYY/MM/DD HH:MM`。
