// 引入站点配置构造函数（来自项目源码，用于生成类型安全的配置对象）
import siteConfig from "./src/lib/config";

const config = siteConfig({
	// ── 基础信息 ──────────────────────────────
	title: "须臾之间",                    // 站点标题，显示在浏览器标签、页头等位置
	prologue: "May no regrets linger in the night bygone. May all shadows fade ere the dawn to come.",
	                                      // 站点副标题/开场白，通常显示在首页标题下方
	                                      // 这行英文意思是："如果你需要一个加载快、SEO 好的网站，那 Astro 就是为你准备的"
	                                      // （看起来像是模板自带的示例文案，可以改成你自己的）

	author: {
		name: "北冥"                      // 作者名，用于文章署名、版权信息等
	},

	description: "寄蜉蝣于天地，渺沧海之一粟。",
	                                      // 站点描述，用于 SEO 的 <meta description> 和 RSS 摘要

	// ── 版权信息 ──────────────────────────────
	copyright: {
		type: "CC BY-NC-ND 4.0",          // 版权协议类型：知识共享 署名-非商业性使用-禁止演绎 4.0
		                                  // 表示：可转载需署名、不能商用、不能修改后分发
		year: "2026"                      // 版权年份，显示在页脚 © 后面
	},

	// ── 本地化 ────────────────────────────────
	timezone: "Asia/Shanghai",            // 站点时区，影响文章发布时间、归档分组等显示
	i18n: {
		locales: ["zh-cn"],               // 支持的语言列表，这里只有简体中文
		defaultLocale: "zh-cn"            // 默认语言
	},

	// ── 分页 ──────────────────────────────────
	pagination: {
		note: 10,                         // "随笔/笔记"（note）列表每页显示 10 条
		jotting: 24                       // "短记/碎念"（jotting）列表每页显示 24 条
	},

	// ── 热力图 ────────────────────────────────
	heatmap: {
		unit: "day",                      // 热力图每个格子代表的时间单位：按"天"
		weeks: 20                         // 热力图显示最近 20 周的数据（类似 GitHub 贡献图）
	},

	// ── RSS/Atom 订阅源 ───────────────────────
	feed: {
		section: "*",                     // 订阅源包含的板块："*" 表示所有板块
		limit: 20                         // 订阅源最多输出 20 篇文章
	},

	// ── 最新内容 ──────────────────────────────
	latest: "*"                           // 首页"最新"区域显示的内容范围："*" 表示所有类型
	                                      // （也可能接受字符串数组，如 ["note", "jotting"] 来筛选类型）
});

// 判断是否为单语言站点：语言列表长度为 1 时为 true
// 用于模板中决定是否显示语言切换器等 UI
export const monolocale = Number(config.i18n.locales.length) === 1;

// 导出最终配置，供全站引用
export default config;