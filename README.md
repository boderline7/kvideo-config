# kvideo-config

给 [KVideo](https://github.com/kuekhaoyang/KVideo) 用的订阅源仓库：把 [LunaTV / MoonTV 的配置](https://github.com/fmynj/lunatv-config) 转成 KVideo 能直接读的格式，再和另外两个上游汇总去重，每天自动更新一次。

| 部分 | 内容 |
|---|---|
| **订阅** | 一个 JSON 地址，加进 KVideo 就是全部源；分全量与常规两版 |
| **配置** | 服务端环境变量自动下发订阅，或页面里手动添加，两种方式都支持 |
| **部署** | 官方镜像 `kuekhaoyang/kvideo:latest`，一条 `docker run`，只改端口和源 |

## 订阅地址

```text
# 全量：常规 + 受限（名字以 18 开头）
https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json
https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json
https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json

# 常规：不含受限
https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-normal.json
https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json
https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json
```

同一版本的三条只是 CDN 不同，内容完全一致；哪条能打开就用哪条。`raw` 最快但部分网络打不开，`gcore` 兼容性通常最好。

<!-- MERGE:START -->

> 自动生成于 **2026-10-29 11:33 +08:00** ｜ 合计 **101** 个（常规 61 / 受限 40）
>
> 本次：合并重复 106 条，剔除上游标注失效 101 条，排除 XML 接口 6 条

<!-- MERGE:END -->

**汇总范围**：本仓库（LunaTV / MoonTV 转换）+ [puppet680/KVideo-config](https://github.com/puppet680/KVideo-config) + [335459215/kvideo-sources](https://github.com/335459215/kvideo-sources)。

**汇总规则**：

1. 上游标注失效的不收录，标注有效的照收；每天重跑，恢复后自动回来
2. 重复的只留一个 —— 按**请求地址**去重，不按域名（同一域名下可能挂着不同资源库）
3. 受限分组同样以 `18` 开头命名

## 在 KVideo 里添加

1. 设置 → 导入设置 → 订阅管理
2. 填名字、粘贴上面任一地址 → 添加
3. 在订阅条目上点「立即更新」

源数量以 JSON 里的 `count` 字段为准（每天会变，不用记具体数字），页面显示的数量与它一致就说明拉全了。

名字以 `18` 开头的属于受限分组，只出现在**全量**里，并且只在 `/premium` 独立入口可见，普通页面不会出现。

## 服务端配置（可选）

把订阅写进容器环境变量，所有设备打开时都会自动带上这条订阅，不用手动添加 —— 部署时在 `docker run` 里加这一行：

```bash
-e 'SUBSCRIPTION_SOURCES=[{"name":"汇总","url":"<上面任一地址>"}]'
```

- 多条就写成 JSON 数组，或用逗号分隔的纯 URL
- 想看服务端实际下发了什么：`curl -s http://127.0.0.1:3000/api/auth`

## 自动更新

| 项目 | 说明 |
|---|---|
| 频率 | 每天北京时间 **04:10** 自动跑一次 |
| 延迟 | GitHub 排队，可能晚几小时 |
| 步骤 | 拉三个上游 → 转换 → 剔失效 → 去重 → 自检 → 提交 → 刷新 CDN 缓存 |
| 手动 | 仓库页 → Actions → Update sources → Run workflow |

**失效怎么判**：只认上游的标注 —— 对方 `disabled.json` 里列出的、或条目写着 `enabled: false` 的，本轮不收录。不做主动探测，避免机房 IP 被站点拦截造成误删；上游改回标注后，第二天自动回到列表。

**想剔除某个源**：在 `config/overrides.json` 的 `exclude` 里加一条，下次生成时跳过。

## 部署

官方镜像，一条命令，订阅源已内置：

```bash
docker run -d --name kvideo --restart unless-stopped -p 3000:3000 \
  -e 'SUBSCRIPTION_SOURCES=[{"name":"汇总","url":"https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"}]' \
  kuekhaoyang/kvideo:latest
```

常用改动：

| 改什么 | 怎么改 |
|---|---|
| 端口 | `-p 8080:3000`，冒号右边固定是容器的 3000 |
| 订阅 | 替换 `SUBSCRIPTION_SOURCES` 里的 url；要常规版就换成 `kvideo-normal.json` |
| 重建 | 先 `docker rm -f kvideo`，再执行上面的命令 |

### 部署后确认

```bash
curl -s http://127.0.0.1:3000/api/auth | grep -c kvideo-merged.json        # 1 = 订阅已下发
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/settings    # 200 = 页面正常
```

浏览器打开 `http://<设备IP>:3000/settings`，在订阅上点「立即更新」，数量与 JSON 里的 `count` 一致即可。

### 其他安装方式

**一行安装**：设备连不上某个 CDN 时用这个，脚本会依次试三条地址，取第一条能读到列表的。

```bash
curl -fsSL https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/deploy/install.sh | sh -s -- 3000
```

`-- 3000` 是端口，后面还可以跟源地址、`--force`（重建同名容器）。

**docker compose**：把下面存成 `docker-compose.yml`，同目录执行 `docker compose up -d`。

```yaml
services:
  kvideo:
    image: kuekhaoyang/kvideo:latest
    container_name: kvideo
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      SUBSCRIPTION_SOURCES: '[{"name":"汇总","url":"https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"}]'
```

### 交给 AI 部署

> 在这台设备上用官方镜像 `kuekhaoyang/kvideo:latest` 起一个容器：`docker run -d --name kvideo --restart unless-stopped -p 3000:3000 -e 'SUBSCRIPTION_SOURCES=[{"name":"汇总","url":"https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"}]' kuekhaoyang/kvideo:latest`。完成后确认 `curl -s http://127.0.0.1:3000/api/auth` 的输出里含 `kvideo-merged.json`、`/settings` 能正常打开、设置页里订阅更新后的数量与 JSON 里的 `count` 一致。失败先看 `docker logs --tail 50 kvideo`；订阅地址取不到就换 jsDelivr 或 raw 的同路径地址。

### 部署常见问题

**镜像拉不下来** — Docker Hub 直连不稳。给 Docker 配镜像加速，或在能拉通的机器 `docker save` 后 `docker load`。

**容器起来了但订阅拉不到** — 设备访问不了那个域名。用 `curl -I` 逐个试上面三条地址，把能通的填进 `SUBSCRIPTION_SOURCES` 后重建。

**改了端口或源** — 先 `docker rm -f kvideo` 再重新执行命令。源列表保存在浏览器本地，重建容器不会丢。

## 目录结构

```text
dist/         生成的订阅文件（KVideo 读的就是这里）
scripts/      build 转换 / merge 汇总 / verify 自检
config/       overrides 覆盖规则、renames 命名映射
deploy/       一键脚本、docker-compose
.github/      定时任务
```

## 本地运行

需要 Node.js 18+，零依赖，不用装包。

```bash
node scripts/build.mjs      # 拉上游 → 转换 → 写 dist/ 和 README
node scripts/merge.mjs      # 三方汇总去重（网络失败时用 cache/ 里的副本）
node scripts/verify.mjs     # 自检，应输出「全部通过」
```

## 说明

- 只做格式转换与去重，不托管任何内容。
- 接口域名原样保留（域名是连通必需，不能改写）；源名称里的标记统一用拼音缩写替代。
- `dist/*-manual.json` 是**纯数组**格式，只给「导入设置 → JSON」粘贴用，不能当订阅地址。

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
