# 站点说明

## 评论

评论公开显示昵称、内容、发表时间及回复关系。免登录昵称由访客自行填写；GitHub 登录的评论会显示该账号的公开头像、显示名称、简介及设置的主页链接。请勿在评论中填写密码、联系方式等不希望公开的信息。

评论数据保存在本站使用的 Cloudflare D1 数据库中。免登录留言使用 Cloudflare Turnstile 人机验证；发表时，验证令牌和访客 IP 会发送给 Cloudflare 进行服务端校验。本站评论数据库不保存原始 IP，仅短期保存按日加盐的请求身份摘要以限制重复提交。Cloudflare 仍可能按其自身政策处理访问日志和请求数据。

选择 GitHub 登录时，浏览器会跳转到 GitHub 授权。本站保存验证后的 GitHub 账号 ID、公开账号名、显示名称、头像地址和简介，用于关联新发表的评论；头像由 GitHub 的头像服务加载。旧匿名评论不会根据同名昵称自动归属到账号。本站不长期保存 GitHub 访问令牌或刷新令牌，不申请仓库或邮箱权限。

GitHub 登录状态使用 HttpOnly Cookie 保持，默认有效期 14 天。数据库仅保存站点会话令牌摘要，退出登录会撤销当前会话；退出不会删除已经发表的评论。

浏览器会在本机保存昵称及未发送的评论草稿，供下次继续编辑。清除本站的浏览器存储即可移除这些本地记录。

管理员关闭评论区后，已有评论仍保留在数据库中。评论管理和删除由站点管理员处理。

## 技术与署名

本站使用 Astro、Svelte 和 ThoughtLite 主题。评论界面改编自 ThoughtLite 的 Cloudflare 版本，服务端通过 Cloudflare Pages Functions 提供。

第三方服务的数据处理说明可查阅 [Cloudflare 隐私政策](https://www.cloudflare.com/privacypolicy/)、[Turnstile 隐私附录](https://www.cloudflare.com/en-gb/turnstile-privacy-policy/) 和 [GitHub 隐私声明](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)。
