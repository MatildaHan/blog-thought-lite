# 免费评论区

文记、絮语详情页使用与 ThoughtLite Cloudflare 版本相同的极简线框布局，包含昵称留言、回复、表情、Markdown 预览、本地草稿、分页与排序。界面改编自 [ThoughtLite cloudflare 分支](https://github.com/tuyuritio/astro-theme-thought-lite/tree/cloudflare)，保留 GPL-3.0 授权和主题署名。

本站保留 Astro 静态构建，使用同一 Pages 项目的 Pages Functions + D1 + Turnstile 处理评论，无须迁移域名。支持昵称免登录留言及可选的 GitHub 登录。GitHub 登录同步公开头像、显示名称和 Bio，资料弹窗可设置个人主页；评论中的小房子链接指向该主页。博主标识按已验证的 GitHub 账号 ID 判断。未接入浏览器推送、邮件通知或独立管理后台，评论管理通过 Cloudflare D1 控制台完成。

输入框默认只显示浅色四角和较淡的工具栏；输入框或工具栏内的控件获得焦点后，四角延伸形成完整边框，文字与图标加深。焦点离开后恢复四角。输入区随内容增长，启用减少动态效果的系统设置时不播放边框动画。

## 开关

`site.config.ts`：

```ts
comment: {
  enabled: true, // false：隐藏全部评论区和跳转按钮，同时拒绝评论接口的读写
  maxLength: 500,
  github: { enabled: true } // 只关闭 GitHub 登录时改为 false，保留免登录留言
}
```

修改后重新构建部署。关闭不会删除已有评论。若需立即暂停生产接口，可在 Cloudflare Pages 的生产环境变量中设置 `COMMENTS_ENABLED=false` 并重新部署；此环境变量不会改变已经生成的静态页面。

## Cloudflare 免费配置

仅使用 Workers/Pages、D1、Turnstile 的免费方案，无须购买套餐或服务器。免费额度按账户共享，达到平台限制会影响请求；本文不保证无限使用，也不会自动升级付费套餐。

1. 使用 Wrangler 登录：`pnpm exec wrangler login`。
2. 创建数据库：`pnpm exec wrangler d1 create thought-lite-comments`。
3. 复制 `wrangler.example.toml` 为 `wrangler.toml`，填写返回的数据库 ID。确认 `name` 是自己已有的 Pages 项目名。
4. 执行 `pnpm db:migrate:remote`，创建生产数据表。
5. 在 Cloudflare Turnstile 新建 **Invisible（不可见）** 小组件，添加站点实际使用的主机名，例如 `blog-thought-lite.pages.dev` 及自定义域名。预览部署需要单独配置允许的主机名。
6. 在 Pages 项目的生产环境变量/Secrets 中配置 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY`。后者只保存在服务端 Secrets，不写入仓库，也不放进 `PUBLIC_*` 变量。
7. 如通过现有 Git 集成部署，在 Pages 设置中新增 D1 绑定：变量名 `COMMENTS_DB`，数据库选择上面创建的实例。若使用 `wrangler.toml` 部署，则由该文件定义绑定。
8. 执行 `pnpm build` 后运行 `pnpm deploy:pages`；也可以通过已有的 Pages Git 集成构建部署，构建命令为 `pnpm build`，产物目录 `dist`，根目录的 `functions/` 由 Pages 自动编译。
9. 打开一篇文记或絮语，确认评论可加载、校验通过、留言刷新后仍然存在，再验证回复和关闭开关。

`wrangler.toml`、`.dev.vars` 已忽略，不提交真实环境配置。`public/_routes.json` 仅让 `/api/comments` 和 `/api/auth/*` 使用 Function，其他静态页面和资源保持静态服务。

## 可选 GitHub 登录

1. 在 GitHub 的 **Settings → Developer settings → OAuth Apps** 注册应用，网站地址使用本站实际域名，精确回调地址为 `https://blog-thought-lite.pages.dev/api/auth/github/callback`。更换域名时同步更新，关闭回调通配符；不需要启用 Device Flow。
2. 在 Cloudflare Pages 生产环境配置 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`（Secret）及 `GITHUB_AUTHOR_ID`（博主的数字账号 ID）。环境变量只保存在 Cloudflare，不写进站点配置或前端。未配置客户端密钥时不显示登录入口。
3. 升级已有数据库时执行 `pnpm db:migrate:remote` 应用 `0002_github_login.sql`。迁移会新增账号、会话、登录事务表及可空的评论账号关联，不认领或改写旧匿名评论。
4. 重新构建部署，点击昵称旁的 GitHub 图标，授权后返回原文章。仅读取公开个人资料，不申请仓库或邮箱权限。
5. 点击登录后的头像/昵称打开资料弹窗，设置主页或退出。头像、昵称和简介以 GitHub 资料为准，点击同步会重新登录获取最新公开资料；自定义主页在重新登录后仍保留。

登录使用一次性、绑定浏览器的 state 和 PKCE；站点会话通过 HttpOnly Cookie 保持 14 天，生产 Cookie 使用 Secure 与 SameSite=Lax。D1 仅保存会话令牌摘要，退出立即撤销当前会话。GitHub 访问令牌只在回调中读取公开资料时使用，不存入数据库，刷新令牌也不持久化；应用可保留 GitHub 默认的访问令牌过期设置。

`comment.enabled=false` 同时关闭评论与登录；`comment.github.enabled=false` 仅关闭 GitHub 身份入口，已有账号评论资料仍可展示。生产环境还可设置 `GITHUB_LOGIN_ENABLED=false` 并重新部署，暂停 GitHub 登录。登录不自动提供通知、统一管理页或评论编辑/删除功能。

## 本地联调

```sh
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm build
pnpm preview:comments
```

本地预览使用独立本地 D1，不访问生产数据库。`.dev.vars.example` 中是 Cloudflare 官方公开测试密钥，仅供本机测试；服务端拒绝在非 localhost 环境使用该测试私钥。真实环境未配置数据库或 Turnstile 时，留言不会成功提交。

`pnpm dev` 和 `pnpm preview` 仍只启动 Astro，适合静态页面开发。完整评论联调请使用 `pnpm preview:comments`。

本地验证真实 GitHub 登录时，另建使用 `http://localhost:8788/api/auth/github/callback` 的开发应用，将其客户端配置填入 `.dev.vars`；生产应用只保留生产回调地址。

## 数据和保护

- 只为构建产物中存在的公开文记、絮语接受评论；草稿和不存在的页面不能通过 API 留言或查询评论。
- 评论内容存入 D1，读取按每页 20 条分页。客户端 Markdown 渲染丢弃 HTML，过滤危险链接，图片仅显示替代文字。
- 服务端检查内容与昵称长度、来源、回复所属页面，并验证 Turnstile 的主机名和 `comment` action。
- 每个 IP 每分钟最多接受 3 次通过人机校验的提交。数据库只保存按日加盐的 IP 摘要，用于短期限流，不保存原始 IP。过期记录随后续提交清理。
- 本机浏览器保存昵称和未发送草稿；清理浏览器存储会将其移除。
- 在 D1 控制台删除某条评论前，需先处理引用它的回复（`parent_id` 外键）。请按需导出备份，避免误删。
- GitHub 账号与旧匿名昵称不自动关联。登录后的昵称来自验证后的 GitHub 资料，客户端无法通过填写昵称获得博主标识。

检查命令：`pnpm test:comments`、`pnpm check`、`pnpm build`。
