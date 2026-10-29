# kvideo-config

把 [LunaTV / MoonTV 的源配置](https://github.com/fmynj/lunatv-config) 转换成 **KVideo 能直接订阅的源**，并把三个上游的源汇总去重，每天自动同步。

## 订阅地址

| 版本 | 条数 | 地址 |
|---|---:|---|
| **全量**（含 18 开头的受限源） | 101 | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json` |
| **全量 · 加速** | 101 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json` |
| **常规**（不含受限源） | 61 | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-normal.json` |
| **常规 · 加速** | 61 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json` |

<!-- MERGE:START -->

> 自动生成于 **2026-10-29 09:03 +08:00** ｜ 合计 **101** 个（常规 61 / 受限 40）
>
> 本次：合并重复 106 条，剔除上游标注失效 101 条，排除 XML 接口 6 条

<!-- MERGE:END -->

汇总范围：

- 本仓库（由 LunaTV / MoonTV 配置转换）
- [puppet680/KVideo-config](https://github.com/puppet680/KVideo-config)
- [335459215/kvideo-sources](https://github.com/335459215/kvideo-sources)

汇总规则：

1. **对方标注失效的不收录**（对方有巡检记录的，按其失效名单剔除）；
2. **标注有效的照收**，每天重新跑一次，上游恢复后自动回到列表；
3. 三个上游里有重复的只留一个 —— 去重认的是**请求地址**，不是域名，因为同一个域名下可能挂着两套不同的资源库；
4. 受限分组同样以 `18` 开头命名。

## 怎么用

1. KVideo → 设置 → 导入设置 → 订阅管理
2. 填个名字，粘贴上面任意一条地址，点「添加」
3. 在订阅条目上点「立即更新」

**导入后对一下条数**：

| 看到几条 | 说明 |
|---:|---|
| **101** | 正常，全量 |
| **61** | 正常，常规 |
| 40 | 订阅的是旧的常规文件，点「立即更新」变 61；想要全量就再加一条全量地址 |
| 74 | 订阅的是 `kvideo-sources.json`（LunaTV 单家转换，仅供核对），换成上表地址 |

名字以 `18` 开头的 40 条属于受限分组，只出现在**全量**里；它们在 KVideo 的独立入口 `/premium`，与普通内容完全隔离，普通页面不会出现。

## 更新机制

| 项目 | 说明 |
|---|---|
| 频率 | 每天北京时间 **04:10** 自动跑 |
| 实际时间 | GitHub 排队，可能晚几小时；跑完会顺带刷新 CDN 缓存 |
| 步骤 | 拉三个上游 → 转换 → 剔失效 → 去重 → 自检 → 提交 |
| 手动跑 | 仓库页 → Actions → Update sources → Run workflow |

**失效怎么判**：只认上游的标注 —— 对方 `disabled.json` 里列出的、或条目写着 `enabled: false` 的，本轮不收录。没被标注、但实际已经挂掉的接口会留在列表里（本仓库不做主动探测，避免机房 IP 被拦造成误删）。上游改回标注后，第二天自动回到列表。

## 源列表存在哪（重要）

订阅地址由服务端下发，**源列表存在你当前这台设备的浏览器里**，不是存在服务器上：

| 内容 | 位置 |
|---|---|
| 订阅地址 | 服务器环境变量 / 本 README |
| 源列表、开关、排序 | 当前浏览器 localStorage |
| 观看历史、收藏 | 当前浏览器 localStorage |

订阅更新是**合并**方式：新源加入、同 id 的更新字段，**已从清单里删掉的源不会自动消失**。带来的结果：

- 新设备第一次打开 → 拿到的就是当天这份清单，完全一致；
- 用过的设备 → 会残留以前的旧源，条数比清单多；
- 手机和电脑两份列表互相独立，各拉各的。

想让它和本文清单完全对齐，两条路：

**A. 无痕窗口**（最省事）

每次用无痕窗口打开，本地是空的，等于新设备，直接拉到当天清单。代价是历史和收藏不保留。

**B. 重置脚本**（普通模式也能干净）

KVideo 页面按 F12 → Console，粘贴执行：

```js
const k = 'kvideo-settings';
const r = JSON.parse(localStorage.getItem(k) || '{}');
r.state.sources = [];
r.state.premiumSources = [];
r.state.subscriptions = (r.state.subscriptions || []).map((s) => ({ ...s, lastUpdated: 0 }));
localStorage.setItem(k, JSON.stringify(r));
location.reload();
```

刷新后会按订阅重新拉一遍，结果与本文清单一致。注意：自己手动加过的源会被清掉。

## 常见问题

**订阅删不掉，删了刷新又回来** — 订阅地址写在服务端环境变量 `SUBSCRIPTION_SOURCES` 里，每次读设置都会被补回，属于设计如此。要去掉只能在服务器上改环境变量。

**「加速」地址拿到旧内容** — jsDelivr 边缘节点缓存 12 小时。workflow 每次推送后已主动 purge；仍不生效就在地址后加个 `?v=2` 强制取新。raw 地址只缓存 5 分钟。

**手机和电脑列表不一样** — 见上一节，属于本地存储机制，不是同步出错。

**想手动踢掉某个源** — 提 issue，或在 `config/overrides.json` 的 `exclude` 里加一条，下次生成时跳过。

## Docker 一键部署（官方镜像）

用 KVideo 官方镜像 `kuekhaoyang/kvideo:latest`，**三个可调项：端口、源、登录密码**。

```bash
git clone https://github.com/boderline7/kvideo-config.git
cd kvideo-config

sh deploy/install.sh                            # 3000 端口 + 自动选源，不设密码
sh deploy/install.sh 8080                       # 换端口
sh deploy/install.sh 8080 <源地址>               # 端口和源都指定
sh deploy/install.sh --password 你的密码          # 设置登录密码（推荐）
sh deploy/install.sh --password 你的密码 --premium 另一个密码   # 高级内容再单独设一道
sh deploy/install.sh --force                    # 重建同名容器
```

不指定源时，脚本按 `gcore` → `jsDelivr` → `raw` 试一遍，用能通的那条（国内通常只有 `gcore` 通）。

compose 方式：`cd deploy && docker compose up -d`（密码在 compose 文件里取消注释填写）。

### 登录密码（访问认证）

KVideo 默认**不设密码时谁打开都能用**，同一个网络里的人直接输 IP 就能进。要加锁只加一个环境变量：

| 变量 | 作用 |
|---|---|
| `ADMIN_PASSWORD` | 登录密码，登录后就是超级管理员，能管源和设置 |
| `PREMIUM_PASSWORD` | 只给 `/premium` 高级内容加的独立密码，可选 |
| `PERSIST_SESSION` | 默认 `true`，关掉浏览器后再打开不用重输；设 `false` 则每次重新登录 |

```bash
sh deploy/install.sh --password 你的密码
```

装完打开页面会先出现登录框，输入这个密码才进得去。密码只在容器启动时读取，**改密码要重建容器**（`--force` 再跑一次）。

如果家里多个人用、还想各看各的收藏和历史，可以改用多账户 `ACCOUNTS`（格式 `用户名:密码:名称:角色`，角色选 `admin` 或 `viewer`），数据按账户隔离；这条参数本脚本没做，需要时手动加 `-e`。

### 装完自检

```bash
curl -s http://127.0.0.1:3000/api/auth | grep -o kvideo-merged.json        # 有输出 = 源已挂
curl -s http://127.0.0.1:3000/api/auth | grep -o '"hasAuth":[a-z]*'         # true = 密码已生效
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/settings    # 200
```

浏览器打开 `http://<设备IP>:3000/settings` → 订阅点「立即更新」→ 应为 **101** 条。

### 给 AI 的指令

> 用官方镜像 `kuekhaoyang/kvideo:latest` 部署 KVideo，设三样：端口 3000、源用本仓库汇总地址、登录密码用我给你的那个。执行 `sh deploy/install.sh --password <我给的密码>`；完成后确认 `/api/auth` 含 `kvideo-merged.json` 且 `"hasAuth":true`、`/settings` 返回 200、打开页面会要求登录、订阅更新后 101 条。失败看 `docker logs --tail 50 kvideo`，不要重复 `docker run` 叠加容器。

### 部署常见问题

**镜像拉不下来** — Docker Hub 国内直连不稳。给 Docker 配镜像加速，或在能拉通的机器 `docker save` 后 `docker load`。

**换端口** — 只改 `-p` 左边，右边始终是容器的 3000，例如 `-p 8080:3000`。

**忘了登录密码** — 密码是启动参数，容器里查不到明文补救。用 `docker inspect kvideo` 看当前 `SUBSCRIPTION_SOURCES`，然后用 `sh deploy/install.sh --force --password 新密码` 重建，源不会丢。

**设了密码后手机连不上** — 页面会先弹登录框，输一次即可；`PERSIST_SESSION=false` 时每次打开都要重新输。

## 说明

- 只做格式转换与去重，不托管任何内容。
- 接口域名原样保留（域名是连通必需，不能改写）；源名称里的标记统一用拼音缩写替代。
- `dist/kvideo-sources-manual.json`、`dist/kvideo-merged-manual.json` 是**纯数组**格式，只给「导入设置 → JSON」粘贴用，不能拿来当订阅地址。

## 本地运行

需要 Node.js 18+，零依赖，不用 `npm install`。

```bash
node scripts/build.mjs      # 拉上游 → 转换 → 写 dist/ 和 README
node scripts/merge.mjs      # 三方汇总去重（失败时自动用 cache/ 里的副本）
node scripts/verify.mjs     # 自检，应输出「全部通过」
```

## 源清单

<!-- SOURCES:START -->

<details>
<summary>源清单（74 个 · LunaTV 原始转换，汇总前，点击展开）</summary>

> 生成于 **2026-10-29 09:02 +08:00** ｜ 上游：`fmynj/lunatv-config (jsDelivr)` ｜ 常规 40 / premium 34

| # | 名称 | id | 接口域名 | 分组 |
|---:|---|---|---|:---:|
| 1 | 爱奇艺 | `iqiyizyapi-com` | `iqiyizyapi.com` | normal |
| 2 | 豆瓣资源 | `dbzy-tv` | `caiji.dbzy5.com` | normal |
| 3 | 茅台资源 | `mtzy-me` | `caiji.maotaizy.cc` | normal |
| 4 | 卧龙资源 | `wolongzyw-com` | `wolongzyw.com` | normal |
| 5 | iKun资源 | `ikunzy-com` | `ikunzyapi.com` | normal |
| 6 | 电影天堂 | `dyttzyapi-com` | `caiji.dyttzyapi.com` | normal |
| 7 | 猫眼资源 | `www-maoyanzy-com` | `api.maoyanapi.top` | normal |
| 8 | 量子资源 | `cj-lzcaiji-com` | `cj.lzcaiji.com` | normal |
| 9 | 360 资源 | `360zy-com` | `360zyzz.com` | normal |
| 10 | 极速资源 | `jszyapi-com` | `jszyapi.com` | normal |
| 11 | 魔都资源 | `www-moduzy-net` | `www.mdzyapi.com` | normal |
| 12 | 非凡资源 | `ffzyapi-com` | `api.ffzyapi.com` | normal |
| 13 | 暴风资源 | `bfzy-tv` | `bfzyapi.com` | normal |
| 14 | 最大资源 | `zuida-xyz` | `api.zuidapi.com` | normal |
| 15 | 无尽资源 | `wujinzy-me` | `api.wujinapi.me` | normal |
| 16 | 新浪资源 | `xinlangapi-com` | `api.xinlangapi.com` | normal |
| 17 | 旺旺资源 | `api-wwzy-tv` | `api.wwzy.tv` | normal |
| 18 | 速播资源 | `www-subozy-com` | `subocaiji.com` | normal |
| 19 | 金鹰点播 | `jinyingzy-com` | `jinyingzy.com` | normal |
| 20 | 飘零资源 | `p2100-net` | `p2100.net` | normal |
| 21 | U酷影视 | `api-ukuapi88-com` | `api.ukuapi88.com` | normal |
| 22 | 光速资源 | `api-guangsuapi-com` | `api.guangsuapi.com` | normal |
| 23 | 红牛资源 | `www-hongniuzy-com` | `www.hongniuzy2.com` | normal |
| 24 | 魔都动漫 | `caiji-moduapi-cc` | `caiji.moduapi.cc` | normal |
| 25 | 如意资源 | `www-ryzyw-com` | `pz.168188.dpdns.org` | normal |
| 26 | 豪华资源 | `www-haohuazy-com` | `pz.168188.dpdns.org` | normal |
| 27 | 百度云zy | `bdzy1-com` | `pz.168188.dpdns.org` | normal |
| 28 | 艾旦影视 | `lovedan-net` | `pz.168188.dpdns.org` | normal |
| 29 | 金蝉影视 | `zy-jinchancaiji-com` | `zy.jinchancaiji.com` | normal |
| 30 | 量子影视 | `lzizy-net` | `cj.lziapi.com` | normal |
| 31 | 最大点播 | `zuidazy-co` | `zuidazy.me` | normal |
| 32 | 无尽影视 | `wujinzy-com` | `api.wujinapi.com` | normal |
| 33 | 旺旺短剧 | `wwzy-tv` | `wwzy.tv` | normal |
| 34 | 优质资源 | `1080zyk4-com` | `api.yzzy-api.com` | normal |
| 35 | 虎牙资源 | `www-huyaapi-com` | `www.huyaapi.com` | normal |
| 36 | 鸭鸭资源 | `yayazy3-com` | `cj.yayazy.net` | normal |
| 37 | 索尼资源 | `suonizy-net` | `suoniapi.com` | normal |
| 38 | 快车资源 | `kuaichezy-com` | `caiji.kuaichezy.org` | normal |
| 39 | 闪电资源 | `shandianzy-com` | `xsd.sdzyapi.com` | normal |
| 40 | 樱花资源 | `yhzy-cc` | `m3u8.apiyhzy.com` | normal |
| 41 | 18md | `91md-me` | `91md.me` | premium |
| 42 | 18aivin | `lbapiby-com` | `lbapiby.com` | premium |
| 43 | 18zy155 | `155zy2-com` | `155api.com` | premium |
| 44 | 18yt | `apiyutu-com` | `apiyutu.com` | premium |
| 45 | 18fh | `fhapi9-com` | `fhapi9.com` | premium |
| 46 | 18lsb | `apilsbzy1-com` | `apilsbzy1.com` | premium |
| 47 | 18yy | `www-yyzywcj-com` | `www.yyzywcj.com` | premium |
| 48 | 18xj | `xiaojizy-live` | `api.xiaojizy.live` | premium |
| 49 | 18hsck | `hsckzy-xyz` | `hsckzy.xyz` | premium |
| 50 | 18dnz | `apidanaizi-com` | `apidanaizi.com` | premium |
| 51 | 18jkun | `jkunzyapi-com` | `jkunzyapi.com` | premium |
| 52 | 18lb | `lbapi9-com` | `lbapi9.com` | premium |
| 53 | 18nx | `naixxzy-com` | `naixxzy.com` | premium |
| 54 | 18sl | `slapibf-com` | `beiyong.slapibf.com` | premium |
| 55 | 18lj | `apilj-com` | `pz.168188.dpdns.org` | premium |
| 56 | 18sy | `shayuapi-com` | `shayuapi.com` | premium |
| 57 | 18dd | `doudouzy-com` | `api.douapi.cc` | premium |
| 58 | 18ddd | `didizy-com` | `api.ddapi.cc` | premium |
| 59 | 18hl | `heiliaozy-cc` | `www.heiliaozyapi.com` | premium |
| 60 | 18bw | `api-bwzym3u8-com` | `api.bwzyz.com` | premium |
| 61 | 18th | `thzy8-me` | `thzy1.me` | premium |
| 62 | 18jp | `www-jingpinx-com` | `www.jingpinx.com` | premium |
| 63 | 18ck | `ckzy-me` | `ckzy.me` | premium |
| 64 | 18souav | `souavzyw-com` | `api.souavzyw.net` | premium |
| 65 | 18xb | `www-xxibaozyw-com` | `www.xxibaozyw.com` | premium |
| 66 | 18xj2 | `xiangjiaozyw-com` | `www.xiangjiaozyw.com` | premium |
| 67 | 18msn | `www-msnii-com` | `www.msnii.com` | premium |
| 68 | 18hay | `www-pgxdy-com` | `www.pgxdy.com` | premium |
| 69 | 18bp | `www-kxgav-com` | `www.kxgav.com` | premium |
| 70 | 18xb2 | `xingba111-com` | `xingba222.com` | premium |
| 71 | 18dad | `dadizy11-com` | `dadiapi.com` | premium |
| 72 | 18sm | `semaozy1-com` | `caiji.semaozy.net` | premium |
| 73 | 18ask | `aosikazy-com` | `aosikazy.com` | premium |
| 74 | 18sw | `siwazyw-tv` | `siwazyw.tv` | premium |

</details>

<!-- SOURCES:END -->
