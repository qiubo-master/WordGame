# WordQuest 部署到 CloudBase 免费环境（公网 + App + 小程序）

本文件是从「本地开发」走到「公网可访问」的逐步操作手册。后端已重写为云函数 `wqapi`（用云数据库替代 SQLite），前端已支持可配置 `API_BASE`。

> 范围：公网网站 + PWA App（同一个网址，加到主屏即 App）+ 微信小程序（web-view 嵌公网链接）。
> 免费环境每账号 1 个、3000 资源点/月。**小程序发布后免费环境第 15 天到期**——有用户就升付费续命，没用户随它过期。

---

## 第 0 步：准备账号
1. 注册腾讯云：https://cloud.tencent.com （用你的 +86 手机号即可）。
2. 完成**实名认证**（个人实名即可）。
3. 开通 **CloudBase（云开发）**：https://console.cloud.tencent.com/tcb → 新建环境 → 选「免费环境 / 按量计费（有免费额度）」→ 记住**环境 ID**（形如 `wordquest-1gabcde`）。

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

> 文档型数据库没有 SQL 唯一约束，去重逻辑已在 `wqapi` 里用「先查后插」保证。
> 建议给 `users` 的 `usernameLower`、`phone` 各建一个**单字段索引**（非唯一即可），提升查重/登录速度。

## 第 3 步：填 cloudbase.json 的环境 ID
打开仓库根 `cloudbase.json`，把 `"envId": "YOUR_ENV_ID"` 改成你的真实环境 ID。
（函数名 `wqapi`、handler `index.main` 不要改；`JWT_SECRET` 占位稍后在第 5 步设真实值。）

## 第 4 步：部署云函数
```bash
tcb fn deploy wqapi -e <你的环境ID>
```
部署时 CLI 会读取 `cloudbase/functions/wqapi/package.json` 安装依赖并上传。
看到 `wqapi 部署成功` 即 OK。

## 第 5 步：开启 HTTP 触发 + 设置 JWT_SECRET（关键）
1. 控制台 **CloudBase → 云函数 → wqapi → 触发管理 → 新建触发 → 类型选「HTTP 触发」**。
   创建后会得到一个公开 URL，形如：
   ```
   https://<环境ID>.api.tcloudbase.com/wqapi
   ```
   复制这个 URL，第 7 步要用。
2. **必须设置 JWT_SECRET**：控制台 **wqapi → 函数配置 → 环境变量**，新增
   `JWT_SECRET = <一段你自己生成的随机串，建议 32 位以上十六进制>`。
   ```bash
   # 本地生成一串随机密钥
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   ⚠️ 不设的话云函数会用临时密钥，每次冷启动老 token 全部失效，用户会被强制登出。

## 第 6 步：构建公网版前端
```bash
cp .env.production.example .env.production
# 编辑 .env.production，把 VITE_API_BASE 改成第 5 步拿到的 HTTP 触发 URL
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
- **登录后刷新被强制登出**：JWT_SECRET 没设或每次都变 → 回第 5 步设固定环境变量。
- **注册提示网络错误**：检查 HTTP 触发 URL 是否填对、函数是否部署成功、`curl /api/health` 通不通。
- **CORS 报错**：函数已返回 `Access-Control-Allow-Origin: *`，正常不会出现；若出现多为 URL 拼错（多了/少了 `/api`）。
- **免费环境到期**：Web 不受影响（仅小程序触发 15 天规则）；升「基础版/个人版」即可长期使用。
