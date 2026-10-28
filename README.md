# kvideo-config

把 [LunaTV / MoonTV 的源配置](https://github.com/fmynj/lunatv-config) 转换成 **KVideo 能直接订阅的源**，每天自动同步一次。

> 只做格式转换，不探测、不筛选、不托管任何内容。上游配了哪些源，这里就输出哪些源（特殊分组除外）。

## 订阅地址

| 用途 | 地址 |
|---|---|
| 全量订阅（推荐） | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-sources.json` |
| jsDelivr 加速（国内更快） | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-sources.json` |
| 只要常规源 | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-normal.json` |

用法：KVideo → **设置 → 导入设置 → 订阅管理** → 填名称 + 粘贴上表地址 → 添加。
订阅会记住，之后每天自动更新后重新同步一次就是新列表。

## 三个产物分别对应哪个导入入口

KVideo 的四个导入入口对 JSON 形状的要求**不一样**，拿错文件就会报错，所以这里写清楚：

| 文件 | 顶层结构 | 只能用在 |
|---|---|---|
| `kvideo-sources.json`（订阅 / 全部 40 个） | `{ name, count, sources: [...] }` | 订阅管理、链接导入、文件导入 |
| `kvideo-normal.json`（只要常规 40 个） | 同上 | 同上 |
| `kvideo-sources-manual.json`（粘贴用 36 个） | **纯数组** `[ {...}, {...} ]` | **只能**用在「JSON」粘贴页 |

两个坑，都是读源码确认的：

- `JsonImportTab.tsx` 只写了 `if (!Array.isArray(parsed)) → 「JSON 格式错误：应为数组」`，不认 `{sources:[...]}`。
  所以粘贴版是纯数组，订阅版是对象，**不能互换**。
- 订阅导入走 `convertToVideoSource()`，把 `searchPath` 强制写成 `''`，`baseUrl` 必须是完整接口地址；
  而粘贴页 `item.searchPath || '/provide/vod'`，空值会补路径，`baseUrl` 必须去掉 `/provide/vod`。
  两份文件就是照这两个分支各生成一份。

粘贴版少 4 个源，是因为那 4 个是 `?url=` 形式的中转源，地址里的真实接口没法拆成 `baseUrl` + `searchPath`。
想要全量就用订阅，别用粘贴。

## 为什么两边的源不能直接通用

两边描述的是同一种 CMS 采集接口，但字段模型完全不同：

| | LunaTV / MoonTV | KVideo |
|---|---|---|
| 顶层结构 | `{ api_site: { "<配置键>": {...} } }` | `[{ id, name, baseUrl, ... }]` |
| 接口地址 | 一个完整 URL `api` | `baseUrl` + `searchPath` 拼接 |
| 标识 | 配置键（域名） | `id`（英文、稳定） |
| 分组 | 名字里的前缀符号 | `group: normal / premium` |
| 传输格式 | JSON，或整份 base58 编码的 txt | 纯 JSON |
| 能力依赖 | 列表 + 详情 + 搜索 | 完全依赖关键词搜索（`ac=detail&wd=`） |

转换时踩到两个必须处理的坑：

1. **拼接坑**：KVideo 拼 URL 是 `baseUrl + searchPath`。上游给的 `https://x.com/api.php/provide/vod` 如果直接当 `baseUrl`，
   而 KVideo 又补一个 `/provide/vod`，就会变成 `.../provide/vod/provide/vod`，全站 404。
2. **KVideo 两个导入入口自己就不一致**：
   - 订阅导入走 `convertToVideoSource()`，会把 `searchPath` 强制写成 `''` → `baseUrl` 必须是**完整接口地址**；
   - 「导入设置 → JSON」粘贴走 `JsonImportTab`，`searchPath` 为空时会补 `/provide/vod` → `baseUrl` 必须**去掉** `/provide/vod`。

   所以同时产出两份文件，**别混用**：订阅用 `kvideo-sources.json`，手工粘贴用 `kvideo-sources-manual.json`（纯数组）。

## 转换规则

- `id`：配置键转 slug（`cj.lzcaiji.com` → `cj-lzcaiji-com`），冲突自动加 `-2`，跨天稳定，不会让 KVideo 里已有的收藏/历史错位。
- `name`：去掉 🎬 等装饰符号和首尾横线，保留分组标记。
- `group`：名字带分组标记符号的进 `premium`，其余 `normal`。`premium` 默认不输出（`--include-premium` 可开）。
- `enabled`：**全部为 `true`**，不做任何筛选。上游自己标了 `disabled` 的条目会跳过。
- **CORS 中转源**（形如 `https://pz.xxx/?url=https://real/api.php/provide/vod`）：默认原样保留上游写法，不改写。
- **非标接口**（`/inc/apijson.php`、`/api/json.php`、`/feifei` 等）原样保留，不猜路径。
- 顺序：保持上游配置里的顺序，`priority` 依次递增。

## 关于「不探测」

这个工程最初写过每日探测 + 只收录可用源，后来去掉了，原因很实际：GitHub Actions 跑在海外机房，而这类采集站大部分只有国内线路。
在本机实测 40 个常规源只通 4–5 个（10–13%），真按探测结果筛，仓库会长期处于「只剩几个源」甚至空列表的状态，比不筛更糟。
所以默认**只转换**，谁通谁不通交给 KVideo 在你自己的网络下去试。

需要自己看一眼连通性时可以手动跑（不进定时任务，也不影响收录）：

```bash
node scripts/build.mjs --probe --keyword 庆余年
```

探测结果只写成 `_latency` / `_status` 两个附加字段，方便排查，KVideo 会忽略它们。

## 本地运行

需要 Node.js ≥ 18（用内置 `fetch`），**零依赖**，不用 `npm install`。

```bash
# 完整流程：拉上游 → 转换 → 写 dist/ 和 README（默认不探测）
node scripts/build.mjs

# 用本地配置，不联网拉上游（支持 .json，也支持 base58 编码的 .txt）
node scripts/build.mjs --input path/to/LunaTV-config.json

# 连特殊分组源一起输出
node scripts/build.mjs --include-premium

# 可选：跑一次探测（只加注释字段，不影响收录）
node scripts/build.mjs --probe --concurrency 8 --timeout 12000

# 自检：模拟 KVideo 的解析/拼接逻辑，查双写路径、重复 id、空 searchPath
node scripts/verify.mjs

# 纯转换工具：把任意 LunaTV 配置转成 KVideo JSON
node scripts/convert.mjs --input LunaTV-config.json --out kvideo.json
node scripts/convert.mjs --input LunaTV-config.txt  --mode manual --out kvideo-manual.json
```

## 自动化

`.github/workflows/update.yml` 每天北京时间 04:10 跑一次 `build.mjs`，把 `dist/` 和 README 表格提交回仓库。
因为是纯转换，一次跑完只要几秒，也不受 runner 所在地区的网络影响。

- 仓库 Settings → Actions → General → Workflow permissions 选 **Read and write permissions**，否则 push 失败；
- 手动触发：Actions → Update sources → Run workflow；
- 想同时出特殊分组文件：手动触发时勾上对应选项。

## 目录结构

```
config/overrides.json        上游地址、仓库 slug、排除名单、改名、强制分组（手工维护）
scripts/build.mjs            主流程：拉取 → 转换 → 输出
scripts/convert.mjs          纯转换 CLI
scripts/verify.mjs           产物自检（模拟 KVideo 的解析与 URL 拼接）
scripts/lib/base58.mjs       base58 编解码（LunaTV 的 txt 就是整份 JSON 的 base58）
scripts/lib/normalize.mjs    字段映射、路径拆分、中转源解包
scripts/lib/probe.mjs        可选探测（只有 --probe 时才加载）
dist/kvideo-sources.json         订阅主文件
dist/kvideo-normal.json          仅常规源
dist/kvideo-premium.json         仅特殊分组（--include-premium 时才生成）
dist/kvideo-sources-manual.json  「导入 → JSON」粘贴用
```

想剔除某个源：在 `config/overrides.json` 的 `exclude` 里加 id；改名用 `rename`；强制分组用 `group`。

## 常见问题

**订阅加进去了，但有些源搜不到东西？**
正常，本项目不做筛选，上游给的源会原样进来。接口失效、只有国内线路、禁关键词搜索（返回 `code:1002`）都可能搜不到，把那几条关掉就行。

**为什么不默认输出特殊分组源？**
上游把一部分条目标了分组符号，内容性质跟普通影视源不同，KVideo 的 `premium` 分组本身也要口令才能进。
本项目默认只输出常规影视源，需要时用 `--include-premium` 自己跑一次。

**上游新增的源什么时候能看到？**
每天定时同步，或者你手动点一次 Run workflow。也可以本地 `node scripts/build.mjs` 后 push。

**能加自定义请求头吗？**
KVideo 源对象支持 `headers`，但上游配置里没有这类信息，需要的话在 `config/overrides.json` 里扩展，或直接改 `dist`。

## 免责声明

本项目仅提供格式转换工具，不存储、不代理、不分发任何音视频内容，与所列第三方站点无任何关联。
接口均来自第三方公开采集 API，内容合法性与可用性由其运营方负责。请遵守当地法律法规，仅供个人学习与技术研究使用。

## 源列表

<!-- SOURCES:START -->

> 自动生成于 **2026-10-28 16:42 +08:00** ｜ 上游：`fmynj/lunatv-config (jsDelivr)` ｜ 共 **40** 个源
>
> 本次为纯转换：上游有什么就转什么，未做可用性筛选。

| # | 名称 | id | 接口域名 | 分组 |
|---:|---|---|---|:---:|
| 1 | 爱奇艺 | `iqiyizyapi-com` | `iqiyizyapi.com` | 常规 |
| 2 | 豆瓣资源 | `dbzy-tv` | `caiji.dbzy5.com` | 常规 |
| 3 | 茅台资源 | `mtzy-me` | `caiji.maotaizy.cc` | 常规 |
| 4 | 卧龙资源 | `wolongzyw-com` | `wolongzyw.com` | 常规 |
| 5 | iKun资源 | `ikunzy-com` | `ikunzyapi.com` | 常规 |
| 6 | 电影天堂 | `dyttzyapi-com` | `caiji.dyttzyapi.com` | 常规 |
| 7 | 猫眼资源 | `www-maoyanzy-com` | `api.maoyanapi.top` | 常规 |
| 8 | 量子资源 | `cj-lzcaiji-com` | `cj.lzcaiji.com` | 常规 |
| 9 | 360 资源 | `360zy-com` | `360zyzz.com` | 常规 |
| 10 | 极速资源 | `jszyapi-com` | `jszyapi.com` | 常规 |
| 11 | 魔都资源 | `www-moduzy-net` | `www.mdzyapi.com` | 常规 |
| 12 | 非凡资源 | `ffzyapi-com` | `api.ffzyapi.com` | 常规 |
| 13 | 暴风资源 | `bfzy-tv` | `bfzyapi.com` | 常规 |
| 14 | 最大资源 | `zuida-xyz` | `api.zuidapi.com` | 常规 |
| 15 | 无尽资源 | `wujinzy-me` | `api.wujinapi.me` | 常规 |
| 16 | 新浪资源 | `xinlangapi-com` | `api.xinlangapi.com` | 常规 |
| 17 | 旺旺资源 | `api-wwzy-tv` | `api.wwzy.tv` | 常规 |
| 18 | 速播资源 | `www-subozy-com` | `subocaiji.com` | 常规 |
| 19 | 金鹰点播 | `jinyingzy-com` | `jinyingzy.com` | 常规 |
| 20 | 飘零资源 | `p2100-net` | `p2100.net` | 常规 |
| 21 | U酷影视 | `api-ukuapi88-com` | `api.ukuapi88.com` | 常规 |
| 22 | 光速资源 | `api-guangsuapi-com` | `api.guangsuapi.com` | 常规 |
| 23 | 红牛资源 | `www-hongniuzy-com` | `www.hongniuzy2.com` | 常规 |
| 24 | 魔都动漫 | `caiji-moduapi-cc` | `caiji.moduapi.cc` | 常规 |
| 25 | 如意资源 | `www-ryzyw-com` | `pz.168188.dpdns.org` | 常规 |
| 26 | 豪华资源 | `www-haohuazy-com` | `pz.168188.dpdns.org` | 常规 |
| 27 | 百度云zy | `bdzy1-com` | `pz.168188.dpdns.org` | 常规 |
| 28 | 艾旦影视 | `lovedan-net` | `pz.168188.dpdns.org` | 常规 |
| 29 | 金蝉影视 | `zy-jinchancaiji-com` | `zy.jinchancaiji.com` | 常规 |
| 30 | 量子影视 | `lzizy-net` | `cj.lziapi.com` | 常规 |
| 31 | 最大点播 | `zuidazy-co` | `zuidazy.me` | 常规 |
| 32 | 无尽影视 | `wujinzy-com` | `api.wujinapi.com` | 常规 |
| 33 | 旺旺短剧 | `wwzy-tv` | `wwzy.tv` | 常规 |
| 34 | 优质资源 | `1080zyk4-com` | `api.yzzy-api.com` | 常规 |
| 35 | 虎牙资源 | `www-huyaapi-com` | `www.huyaapi.com` | 常规 |
| 36 | 鸭鸭资源 | `yayazy3-com` | `cj.yayazy.net` | 常规 |
| 37 | 索尼资源 | `suonizy-net` | `suoniapi.com` | 常规 |
| 38 | 快车资源 | `kuaichezy-com` | `caiji.kuaichezy.org` | 常规 |
| 39 | 闪电资源 | `shandianzy-com` | `xsd.sdzyapi.com` | 常规 |
| 40 | 樱花资源 | `yhzy-cc` | `m3u8.apiyhzy.com` | 常规 |

<!-- SOURCES:END -->
