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
| `pnpm new` | 交互式创建中文文章、随笔或序文 |
| `pnpm check` | 检查类型与内容 |
| `pnpm build` | 生成静态站点到 `dist/` |
| `pnpm preview` | 预览构建结果 |
| `pnpm lint` | 检查代码 |

## 内容维护

站点使用中文单语言模式，内容直接放在各板块目录下，无须语言子目录。

- `src/content/note/`：文章，目前保留两篇明确标注的中文演示文章。
- `src/content/jotting/`：随笔，保留文字排版、图片和阅读提示三篇演示。
- `src/content/preface/`：首页序文，按时间显示最新一篇。
- `src/content/information/`：关于与站点说明。
- `src/i18n/zh-cn/`：界面和写作工具的中文文案。

文章与随笔需要 `title` 和 `timestamp` 字段；可使用 `tags`、`description` 等字段，完整定义见 `src/content.config.ts`。本地图片放在文章旁，保持相对引用。

`site.config.ts` 管理站点标题、博主署名、介绍和时区。当前「中文博客」「博主」为通用占位名称，未填写个人邮箱或主页；首页英文引言在 `prologue` 中维护。

发布前应在 `astro.config.ts` 中将 `site` 改为自己的实际域名，目前仍是原主题的演示域名，影响订阅、站点地图与分享链接。本仓库没有配置自动部署，推送到 `main` 不代表线上已更新。

## 清理范围

已移除原模板的英日文内容副本、主题配置教程、示例友情链接、主题更新历史、多语言说明文档、问题与拉取请求模板、预览宣传图及上游主题专用的发布流程。保留必要的运行代码、写作脚本、质量检查与许可文件。

演示文章均可替换或删除。`draft` 只控制公开列表，不是访问权限；不要把隐私内容放进公开仓库或仅依赖草稿标记保护。

## 许可与致谢

本项目基于 tuyuritio 的 [ThoughtLite](https://github.com/tuyuritio/astro-theme-thought-lite) 主题，源代码遵循 [GPL-3.0](LICENSE)。保留主题署名与原有版权，不将第三方图片视为博主作品。
