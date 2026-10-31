# 中文博客

基于 Astro、Svelte、TypeScript 与 Tailwind CSS 的中文个人博客，保留 ThoughtLite 原有的简洁布局、亮色与深色模式。首页的英文手写体引言保持原样，其余展示文案为中文。

项目仓库：[MatildaHan/blog-thought-lite](https://github.com/MatildaHan/blog-thought-lite)。协作与交付规范见 [AGENTS.md](AGENTS.md)。

## 本地运行

使用 `package.json` 指定的 pnpm 版本（当前为 `11.3.0`）。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

| 命令 | 用途 |
| --- | --- |
| `pnpm new` | 交互式创建中文文记、篇章、瞬间、纪年或序文 |
| `pnpm check` | 检查类型与内容 |
| `pnpm build` | 生成静态站点到 `dist/` |
| `pnpm preview` | 预览构建结果 |
| `pnpm lint` | 检查代码 |

## 内容维护

站点使用中文单语言模式，内容直接放在各板块目录下，无须语言子目录。

导航名称为「序章」「文记」「篇章」「瞬间」「纪年」「自述」，对应路径分别为 `/`、`/note`、`/jotting`、`/moment`、`/memo`、`/about`。名称由 `src/i18n/zh-cn/index.yaml` 统一管理，供桌面和移动导航、页面标题、分享图及相关提示使用；写作工具文案位于同目录的 `script.yaml`。

- `src/content/note/`：文记。
- `src/content/jotting/`：篇章。
- `src/content/moment/`：瞬间，正文直接在单列列表完整展示，不生成详情页。
- `src/content/memo/`：纪年，`series` 为年份，`title` 为月份名称。
- `src/content/preface/`：序章页序文，按时间显示最新一篇。
- `src/content/information/`：自述与站点说明。
- `src/i18n/zh-cn/`：界面和写作工具的中文文案。

文记与篇章均需非空的 `title` 和日期类型的 `timestamp`。日期不要加引号，并显式填写时区，例如：

```yaml
---
title: "标题"
timestamp: 2026-10-30T14:55:00+08:00
tags: [生活记录]
draft: false
---
```

导入旧内容时，将 `publishedAt`、`published` 或 `date` 统一为 `timestamp`；有精确发布时间时优先保留该时间，无时区的旧日期按 `Asia/Shanghai`（`+08:00`）处理，仅有日期时使用当天零点。无标题篇章从正文摘取短句作为标题，文件名和正文保持原样。

`tags`、`description` 为可选字段；文记与篇章用 `series` 表示系列（迁移自 `category`），用 `top` 非负整数控制置顶优先级（`pinned: true` 对应 `top: 1`，`false` 对应 `0`）。主题不支持的 `archive`、`comment` 字段已移除。已有 `slug` 可以保留以维持链接。完整字段定义见 `src/content.config.ts`。本地图片放在内容文件旁，保持相对引用。

### 篇章

篇章列表支持系列单选与标签多选，二者组合筛选；再次点击已选系列可取消。切换筛选会回到第一页，筛选条件通过 `?series=系列名&tag=标签` 保留，适用于桌面侧栏与移动端顶部。列表及详情页显示所属系列，详情页系列链接可返回筛选结果。`pnpm new` 创建篇章时也可填写 `series`；展示名称改为「篇章」，内容目录和 `/jotting` 地址保持不变。

### 瞬间

在 `src/content/moment/` 中新增 Markdown 文件，或运行 `pnpm new` 选择「瞬间」。只需 `timestamp`，`tags` 可选；`title` 可选，仅用于首页、热力图和订阅源，不显示为正文标题。

```markdown
---
timestamp: 2026-10-30T17:42:08+08:00
tags: [生活, 随想]
draft: false
---

在这里写下一句话或几句话，也可以使用 Markdown 分段。
```

瞬间按发布时间从新到旧排列，每页 20 条，每条正文完整展示、不截断；分页数量由 `site.config.ts` 的 `pagination.moment` 管理，分页按钮与文记页共用样式，页码通过 `?page=2` 等地址参数保留。切换标签后回到第一页，筛选后不足两页时隐藏分页按钮；正文下方显示站点时区的 `YYYY-MM-DD HH:mm:ss` 和标签。桌面端保留右侧标签筛选，移动端与篇章页一致，将标签放在正文列表上方；多个标签同时选中时，只显示包含全部已选标签的内容。

现有瞬间内容迁移自原絮语，保留原始正文、发布时间、标签及文件名；最初的两篇排版示例已移除。装修记录《当时只道是寻常》（`zx-dszdsxc.md`）和《15问关于我的2026》（`life-of-2026.md`）现位于 `src/content/jotting/`。迁移前的文章地址通过 `astro.config.ts` 中的重定向转到新的页面或列表锚点。瞬间正文的字号、字重与篇章列表标题一致。

`draft: true` 和以下划线开头的文件不会进入列表、首页、热力图、字数统计或订阅源；草稿依然不是隐私权限。

默认的首页最新内容、热力图、字数统计和订阅源包含瞬间。所有瞬间链接均指向 `/moment#moment-文件标识`，打开链接时会自动切换到该条内容所在页并定位，不会生成 `/moment/文件标识` 详情页；标签链接使用 `/moment?tag=标签`。修改文件名后应检查相关锚点链接。`feed.section` 和 `latest` 支持使用 `moment` 筛选此板块。

`site.config.ts` 管理站点标题、博主署名、介绍和时区；首页英文引言在 `prologue` 中维护。

全站标识为 AI 生成的白底黑色实心四角星与轨道图，文件位于 `public/celestial-avatar.png`，用于首页、404/500 页面、分享图与订阅源。星芒保留实心形状，轨道和圆环使用较细线条；原模板的 Astro 标志图片已移除，页脚以文字保留框架及主题署名。

首页英文引言位于左列，最大宽度为 600px，在列内自然换行；头像在右列垂直居中，右边缘与下方日期对齐。移动端保留左右布局并缩小头像。

网页页签图标仅保留黑色实心四角星与轨道图案，背景与圆环内部均透明，文件为 `public/favicon.png`（96 × 96 RGBA PNG），在全站布局 `src/layouts/App.astro` 中引用，并带版本参数以刷新旧图标缓存。

站点地址在 `astro.config.ts` 的 `site` 中维护，当前为 `https://blog-thought-lite.pages.dev`，用于生成订阅、站点地图、规范链接与分享链接。以后更换域名时需同步更新此项。本仓库没有配置 GitHub 自动部署工作流；Cloudflare Pages 已启用 `main` 分支的 Git 集成自动部署，仍需以实际部署结果确认线上是否更新。

## 清理范围

已移除原模板的英日文内容副本、主题配置教程、示例友情链接、主题更新历史、多语言说明文档、问题与拉取请求模板、预览宣传图及上游主题专用的发布流程。保留必要的运行代码、写作脚本、质量检查与许可文件。

已清理未引用的旧山水头像、未使用的友链卡片组件及其默认图片和专用语言资源，以及根目录的空文件 `git`。自述页仍可通过 `information/linkroll` 内容扩展友情链接。

`draft` 控制公开内容的生成，但不是访问权限；不要把隐私内容放进公开仓库或仅依赖草稿标记保护。

## 许可与致谢

本项目基于 tuyuritio 的 [ThoughtLite](https://github.com/tuyuritio/astro-theme-thought-lite) 主题，源代码遵循 [GPL-3.0](LICENSE)。保留主题署名与原有版权，不将第三方图片视为博主作品。

评论区配置、总开关与免费 Cloudflare Pages Functions / D1 / Turnstile 接入步骤见 [评论区说明](docs/comments.md)。

页脚统计图标在悬浮、键盘聚焦或点击时显示三行信息：已运行天数、已发布文记／篇章／瞬间／纪年的正文总字数，以及上次更新日期。浮层沿用原提示框的 12px 字号，黑底白字、逐行小圆点、左对齐；按 Escape 或移开焦点可关闭。`site.config.ts` 的 `statistics.startedAt` 是带时区的正式上线时间，运行天数按满 24 小时累计，浏览器每分钟刷新一次。上次更新取构建所用最近一次 Git 提交的时间，并按站点时区显示为 `YYYY-MM-DD`；没有 Git 信息时使用 `statistics.updatedAt`，不以重新构建时间代替更新日期。

### 纪年

导航入口为 `/memo`，列表仅显示 `2026｜十月` 这样的标题链接，无额外页内大标题、摘要、时间或标签。列表字号、字重、行距和虚线与瞬间一致；桌面在右侧筛选年份，手机在列表上方筛选。年份从当前语言已发布内容的 `series` 自动去重、倒序生成；新增 `series: "2027"` 的内容后，重新构建部署即可出现 2027，无须修改菜单代码。点击已选年份取消筛选，切换年份回到第一页，地址以 `?series=2026&page=2` 保留筛选和页码。

新增文件 `src/content/memo/2027-01.md`，或运行 `pnpm new` 选择「纪年」：

```yaml
---
title: 一月
timestamp: 2027-01-31 00:00:00+08:00
series: "2027"
toc: true
draft: true
---
```

`series` 必须是带引号的四位年份字符串；`timestamp` 是内容发布时间，记录的日期写在正文小标题中。详情页沿用文章正文、目录、同年篇目、分享图和评论布局。首页最新内容、热力图、总字数和默认订阅源包含已发布纪年；`latest` / `feed.section` 可使用 `memo` 选择此板块，`pagination.memo` 控制每页篇数（默认 20）。草稿不生成详情和分享图，也不进入筛选、首页、字数、订阅源和评论清单。

十月纪年内容维护于 `src/content/memo/202610.md`，页面地址为 `/memo/202610`；原排版示例已替换，旧地址 `/memo/2026-10` 会跳转至当前页面。副标题等需要展示的文字写在正文中。年份与筛选回归检查：`pnpm exec tsx --test tests/memo.test.ts`。
