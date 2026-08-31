# WordQuest 部署到 CloudBase 免费环境（公网 + App + 小程序）

本文件是从「本地开发」走到「公网可访问」的逐步操作手册。后端已重写为云函数 `wqapi`（用云数据库替代 SQLite），前端已支持可配置 `API_BASE`。

> 范围：公网网站 + PWA App（同一个网址，加到主屏即 App）+ 微信小程序（web-view 嵌公网链接）。
> 免费环境每账号 1 个、3000 资源点/月。**小程序发布后免费环境第 15 天到期**——有用户就升付费续命，没用户随它过期。

---

## 第 0 步：准备账号
1. 注册腾讯云：https://cloud.tencent.com （用你的 +86 手机号即可）。
2. 完成**实名认证**（个人实名即可）。
3. 开通 **CloudBase（云开发）**：https://console.cloud.tencent.com/tcb → 新建环境 → 选「免费体验版」→ 记住**环境 ID**（形如 `wordquest-1gabcde`）。

> ### ⚠️ 建环境最关键的一步：数据库类型选「云数据库」
> 新建环境时有**数据库类型**选项，必须选 **「云数据库」（NoSQL FlexDB / 文档型）**，**不要选 PostgreSQL**。
> - 两种类型**互斥且建完不可改**。官方说明：「创建环境时，支持选择云数据库（默认）或 PostgreSQL 数据库作为环境的数据库类型」，其中**「文档型数据库」仅在「云数据库」类型下支持**，PostgreSQL 类型下明确「不支持」。
> - 本项目的云函数 `wqapi` 用 `@cloudbase/node-sdk` 的 `db.collection()`（文档型 API），**在 PostgreSQL 环境里会直接报错、跑不起来**。
> - 已建错成 PostgreSQL 的：看下面「免费环境数量限制」处理。
>
> ### 免费环境数量限制：每账号同时 1 个
> 官方规则（2026-01-16 起）：每个云开发账号可创建 **1 个**免费体验版环境，3000 资源点/月。
> 原文：「正在使用云开发免费套餐的账号，不支持创建新的免费体验环境，**原免费体验活动到期付费/销毁后，才可以创建新免费体验环境**。」
> → 顺序必须是：**先销毁旧环境 → 再新建**（反过来会失败，因为同时不能存在两个免费环境）。销毁会释放名额，**之后可重新免费创建，无等待期**。

## 第 1 步：装 CloudBase CLI 并登录
```bash
npm install -g @cloudbase/cli
tcb login            # 浏览器扫码登录你的腾讯云账号
tcb env list         # 确认能看到第 0 步的环境 ID
```

## 第 2 步：建云数据库集合
在控制台 **CloudBase → 数据库** 新建两个集合（集合名区分大小写）：
- `users`（存账号）
- `saves`（存档）

> ⚠️ 认准**文档型「云数据库」**的集合页面（集合/文档），**不是**左侧的「SQL 型数据库 / PostgreSQL 管理」。
> 如果你的环境里只有「SQL 型数据库」，说明第 0 步数据库类型选成了 PostgreSQL → 回第 0 步按说明销毁重建。

> 文档型数据库没有 SQL 唯一约束，去重逻辑已在 `wqapi` 里用「先查后插」保证。
> 建议给 `users` 的 `usernameLower`、`phone` 各建一个**单字段索引**（非唯一即可），提升查重/登录速度。

## 第 3 步：填配置文件的环境 ID
打开仓库根 **`cloudbaserc.json`**（注意是 `cloudbaserc` 带 rc 后缀，不是 `cloudbase.json`），
把 `"envId"` 改成你的真实环境 ID。

> ⚠️ **文件名必须是 `cloudbaserc.json`**：CLI 3.x 的 `fn deploy` 明确只读 `cloudbaserc.json`
> （官方 help 原文：`Auto reads cloudbaserc.json`）。写成 `cloudbase.json` 会报「未找到配置文件」，
> 然后 CLI 改为**从当前目录打包**，导致上传的 zip 根层没有 `index.js`，云端构建报
> `zip code format error / filename not matched: index.js` 而部署失败。

## 第 4 步：部署云函数（必须用 `--dir` + `--httpFn`）
在**仓库根目录**执行：
```bash
cd ~/WorkBuddy/开发小程序
tcb fn deploy wqapi \
  --dir cloudbase/functions/wqapi \
  -e wordgame-1-d7gx6qvym115a8f41 \
  --runtime Nodejs20.19 \
  --httpFn \
  --install-dependency true \
  --force
```

> ⚠️ **两个必不可少的参数**：
> - **`--dir cloudbase/functions/wqapi`**：显式指定函数目录，保证 zip 根层就有 `index.js`。
>   不指定的话 CLI 会打包当前目录 → 云端报 `filename not matched: index.js`。
> - **`--httpFn`**：不加则函数按**事件类型**部署，**无法通过 URL 访问**（官方 help：
>   `without this flag, defaults to Event type and cannot be accessed via HTTP URL`）。
>
> 可选：`--path /api` 用于指定 HTTP 访问路径；本项目的函数按**路径后缀**路由（`/register`、`/login`…），
> 任何前缀都能命中，所以**不需要**加 `--path`。

看到 `wqapi 部署成功` 即 OK。部署后在控制台 **云函数/托管 → wqapi** 能看到函数的 **HTTP 访问 URL**，
形如 `https://wordgame-1-xxxx.api.tcloudbase.com/wqapi`，**复制它**，第 6 步要用。

## 第 5 步：设置 JWT_SECRET（关键）
控制台 **wqapi → 函数配置 → 环境变量**，新增：
- Key：`JWT_SECRET`
- Value：本地生成一串随机密钥后粘贴
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

> ⚠️ 不设的话云函数会用临时密钥，每次冷启动老 token 全部失效，用户会被强制登出。
> ⚠️ **不要把 JWT_SECRET 写进 `cloudbaserc.json` 的 `envVariables`**——CLI 每次部署都会用配置文件里的值
> **覆盖**控制台设置，等于每次部署把所有用户踢下线。密钥只在控制台设，配置文件里留空。

## 第 6 步：构建公网版前端
```bash
cp .env.production.example .env.production
# 编辑 .env.production，把 VITE_API_BASE 改成第 4 步拿到的函数 HTTP 访问 URL
npm run build        # 产物在 dist/，已内联 API_BASE
```

## 第 7 步：部署静态网站（前端 + PWA）
```bash
tcb hosting deploy dist -e <你的环境ID>
```
部署完成后，控制台 **静态网站托管** 里会显示访问域名，形如：
```
https://<环境ID>.tcloudbase.com
```
这个域名自带 **HTTPS**，打开即可用；手机浏览器「添加到主屏」就是 App（PWA 已内置 manifest + service worker）。

✅ 到此公网网站 + App 已上线。

## 第 8 步（可选）：发微信小程序
小程序 = 一个 `web-view` 页面嵌第 7 步的静态网站域名，业务代码零改动。
1. 注册微信小程序账号（mp.weixin.qq.com），拿到 AppID。
2. 小程序后台 **开发 → 开发管理 → 业务域名**，把 `https://<环境ID>.tcloudbase.com` 加进去（需下载校验文件放到该域名的根路径——CloudBase 静态托管支持直接上传文件，把校验文件传上去即可）。
3. 小程序代码里用一个 `web-view` 指向该域名。或用微信开发者工具「公众号网页 / 第三方」模板最快。
> 注意：用 CloudBase 默认 `*.tcloudbase.com` 域名作业务域名通常可直接校验；若微信不认，需自己绑一个 ICP 备案域名到 CloudBase 静态托管。

---

## 本地联调（不改云，照常开发）
- 前端：`npm run dev`（vite，`API_BASE` 为空 → `/api` 走 proxy → 本地 `server/` 后端 8787）。
- `server/` 仍是本地 dev 后端（SQLite），生产不用它。
- 想本地模拟云函数：直接 `node server/index.js` 起本地后端即可，接口路径一致。

## 验证清单
- [ ] `tcb fn deploy wqapi` 成功
- [ ] 控制台能看到 wqapi 的 HTTP 触发 URL
- [ ] `curl <函数URL>/api/health` 返回 `{"ok":true}`
- [ ] 静态网站域名 HTTPS 可打开、能注册/登录/刷新不丢存档
- [ ] 手机「添加到主屏」后作为 App 可离线壳打开
- [ ] （小程序）业务域名校验通过、web-view 能打开

## 常见问题
- **环境里只有「SQL 型数据库 / PostgreSQL 管理」，找不到「云数据库」集合页面**：第 0 步数据库类型选成了 PostgreSQL，该环境**没有文档型数据库**，`wqapi` 会跑不起来。按第 0 步说明**先销毁该环境再重建**（数据库类型选「云数据库」）。销毁会释放免费名额，可重新免费创建。
- **云函数报 `db.collection is not a function` 或连不上数据库**：同上，多半是 PostgreSQL 环境的文档型 API 不可用。
- **登录后刷新被强制登出**：JWT_SECRET 没设或每次都变 → 回第 5 步设固定环境变量。
- **注册提示网络错误**：检查 HTTP 触发 URL 是否填对、函数是否部署成功、`curl /api/health` 通不通。
- **CORS 报错**：函数已返回 `Access-Control-Allow-Origin: *`，正常不会出现；若出现多为 URL 拼错（多了/少了 `/api`）。
- **免费环境到期**：Web 不受影响（仅小程序触发 15 天规则）；升「基础版/个人版」即可长期使用。
