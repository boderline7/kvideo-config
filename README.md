# kvideo-config

把 [LunaTV / MoonTV 的源配置](https://github.com/fmynj/lunatv-config) 转换成 **KVideo 能直接订阅的源**，并把三个上游的源汇总去重，每天自动同步。

## 订阅地址

| 版本 | 条数 | 地址 |
|---|---:|---|
| **全量**（含 18 开头的受限源） | 101 | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json` |
| 全量 · jsDelivr | 101 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json` |
| 全量 · gcore | 101 | `https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json` |
| **常规**（不含受限源） | 61 | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-normal.json` |
| 常规 · jsDelivr | 61 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json` |
| 常规 · gcore | 61 | `https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json` |

三条地址内容完全相同，只是 CDN 不同；哪条能打开就用哪条。

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
| 其他数字 | 地址不是上表里的文件，换回上表地址重新添加 |

名字以 `18` 开头的 40 条属于受限分组，只出现在**全量**里；它们在 KVideo 的独立入口 `/premium`，与普通内容完全隔离，普通页面不会出现。

## 更新机制

| 项目 | 说明 |
|---|---|
| 频率 | 每天北京时间 **04:10** 自动跑 |
| 实际时间 | GitHub 排队，可能晚几小时；跑完会顺带刷新 CDN 缓存 |
| 步骤 | 拉三个上游 → 转换 → 剔失效 → 去重 → 自检 → 提交 |
| 手动跑 | 仓库页 → Actions → Update sources → Run workflow |

**失效怎么判**：只认上游的标注 —— 对方 `disabled.json` 里列出的、或条目写着 `enabled: false` 的，本轮不收录。没被标注、但实际已经挂掉的接口会留在列表里（本仓库不做主动探测，避免机房 IP 被拦造成误删）。上游改回标注后，第二天自动回到列表。

**想手动剔除某个源**：提 issue，或在 `config/overrides.json` 的 `exclude` 里加一条，下次生成时跳过。

## 关于本地数据

KVideo 的源列表、观看历史、收藏都存在各自浏览器的 localStorage 里，服务端只下发订阅地址。因此每台设备独立一份：首次打开按订阅拉取当天清单；订阅更新是合并方式（新增、覆盖同 id），清单里已被移除的源不会自动从旧设备消失，清空源列表后重新拉取即可对齐。

## Docker 部署

官方镜像 `kuekhaoyang/kvideo:latest`，要设的只有两样：**端口**、**订阅源**。

### 一键脚本

```bash
git clone https://github.com/boderline7/kvideo-config.git
cd kvideo-config

sh deploy/install.sh                    # 3000 端口 + 自动选源
sh deploy/install.sh 8080               # 换端口
sh deploy/install.sh 8080 <源地址>       # 端口、源都指定
sh deploy/install.sh --force            # 同名容器已存在时重建
```

脚本做四件事：检查 Docker → 依次试上表三条订阅地址、用第一条能取到列表的 → 起容器（`restart unless-stopped`）→ 等就绪并自检订阅是否挂上。

### docker compose

```bash
cd deploy
docker compose up -d
```

### 装完自检

```bash
curl -s http://127.0.0.1:3000/api/auth | grep -o kvideo-merged.json        # 有输出 = 订阅已挂
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/settings    # 200
```

浏览器打开 `http://<设备IP>:3000/settings` → 订阅点「立即更新」→ 应为 **101** 条。

### 给 AI / Agent 的部署指令

> 在这台设备上用官方镜像 `kuekhaoyang/kvideo:latest` 部署 KVideo，只设两样：端口 3000、订阅源用本仓库汇总地址。执行 `sh deploy/install.sh`；完成后确认 `/api/auth` 含 `kvideo-merged.json`、`/settings` 返回 200、订阅更新后 101 条。失败看 `docker logs --tail 50 kvideo`，不要重复 `docker run` 叠加容器。

### 部署常见问题

**镜像拉不下来** — Docker Hub 直连不稳时给 Docker 配镜像加速，或在能拉通的机器 `docker save` 后 `docker load`。

**换端口** — 只改 `-p` 左边，右边始终是容器的 3000，例如 `-p 8080:3000`。

**容器起来了但订阅拉不到** — 设备访问不了那个域名。用 `curl -I` 逐个试上表三条地址，把能通的填进 `SUBSCRIPTION_SOURCES` 后重建。

**改了源或端口** — `docker rm -f kvideo` 后重跑脚本；源列表在浏览器本地，重建容器不会丢。

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
