---
title: 翻来覆去折腾的一些非技术过程
timestamp: 2026-09-18T00:00:00+08:00
description: 记个人博客装修过程
tags: ["非技术记录"]
series: Hello, World!
draft: false
top: 0
---

## 灵感

某天摸鱼看设计网站，发现一个很有意思的个人站，又顺着友链摸摸摸了很久，产生了也想要建一个可以写自己的小文字的地方，想法成！


## 建毛坯

最最最开始是想自己写 html+css+js，也根据自己的想法磕磕绊绊出了好几版，抄了好几位大佬的模板和动态效果。

> 涉及文件：无，纯手写练习

原本设计的网站是连了数据库，个人比较喜欢用 admin 控制网站，但是对贫民玩家真的不太友好，首页加载超超慢，放弃~

> 涉及文件：无，方案阶段

本来在素版和二次元中间摇摆不定，直到看到 Firefly，真是好看又实用，遂立即改装成喜欢的雷神效果，美味！

> 涉及文件：`src/config/siteConfig.ts`、`src/config/backgroundWallpaper.ts`、`src/styles/variables.styl`

更改所有的配置也是摸摸索索了一些时间。

> 涉及文件：`src/config/` 下全部配置文件

#### 环境准备

- Node.js ≥ 22
- pnpm ≥ 11
- Git

接下来要扩建+精装修了！

*2026-09-19*


## 精装修

#### 背景音乐

- 将稻妻的系列音乐加入了，好听

> 涉及文件：`src/config/musicConfig.ts`、`public/assets/music/`

- 加入了一些图片壁纸，耶

> 涉及文件：`src/config/backgroundWallpaper.ts`、`src/assets/images/DesktopWallpaper/`、`src/assets/images/MobileWallpaper/`

*2026-09-20*


#### 样式调整

- 加了评论区

> 涉及文件：`src/config/commentConfig.ts`

- 调整了一点首页样式

> 涉及文件：`src/config/siteConfig.ts`、`src/config/backgroundWallpaper.ts`、`src/styles/variables.styl`

*2026-09-21*


#### 配置项优化

- 部分文案整理更改

> 涉及文件：`src/config/siteConfig.ts`、`src/config/profileConfig.ts`、`src/config/announcementConfig.ts`、`src/content/spec/about.md`、`src/content/spec/guestbook.md`

- 调整了一点点细节之后感觉已经想不到还能调整什么了，呆

- 加了原神语录，忘不了风起地

> 涉及文件：`src/config/announcementConfig.ts`、`src/config/navBarConfig.ts`、`src/components/widget/QuoteOfTheDay.astro`、`src/content/ziyuan/quote.md`、`src/content.config.ts`、`src/components/layout/SideBar.astro`

*2026-09-22*


#### 样式调整

- 哎嘿，按照大佬的模板调整了鼠标样式，完美

鼠标制作工具：[RealWorld Cursor Editor](https://www.rw-designer.com/cursor-maker)

> 涉及文件：`src/styles/mouse.css`

- 更改了站点标题~

> 涉及文件：`src/config/siteConfig.ts`、`src/layouts/Layout.astro`

- 增加标签页，记录看过的电影读过的书~

> 涉及文件：`src/pages/all-tags.astro`、`src/content/spec/tags-page.md`、`src/content.config.ts`、`src/config/navBarConfig.ts`

*2026-09-23*


#### 页面调整

- 整理了页面结构

- 想仿一个大佬的聊天框页面，暂时还没成功，仍需努力

*2026-09-24*


#### 页面完整度

- 增加了几个页面

- 样式感觉需要调整的不太多了，后续想想还能增加什么内容以及多写一些记录

*2026-10-09*
