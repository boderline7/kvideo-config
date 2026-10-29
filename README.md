# kvideo-config

把 [LunaTV / MoonTV 的源配置](https://github.com/fmynj/lunatv-config) 转成 [KVideo](https://github.com/kuekhaoyang/KVideo) 能直接读的格式，并与两个上游汇总去重，每天自动更新。本仓库不生产源，只做转换、去重、同步。

## 致谢

| 出处 | 提供了什么 |
|---|---|
| [kuekhaoyang/KVideo](https://github.com/kuekhaoyang/KVideo) | 客户端本体 |
| [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV) | 源配置格式 |
| [fmynj/lunatv-config](https://github.com/fmynj/lunatv-config) | 初始源数据 |
| [puppet680/KVideo-config](https://github.com/puppet680/KVideo-config) · [335459215/kvideo-sources](https://github.com/335459215/kvideo-sources) | 汇总上游 |
| 各采集站点 | 接口与内容 |

内容和接口都归上面这些项目与站点，用得顺手就给原项目点个 Star。

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

同一版本的三条只是 CDN 不同，内容一致，哪条能打开就用哪条。

<!-- MERGE:START -->

> 自动生成于 **2026-10-30 07:55 +08:00** ｜ 合计 **97** 个（常规 58 / 受限 39）
>
> 本次：合并重复 102 条，剔除上游标注失效 109 条，排除 XML 接口 6 条

<!-- MERGE:END -->

汇总规则：上游标失效的不收（每天重跑，恢复后自动回来）；重复的按**请求地址**去重，不按域名；受限分组名字同样以 `18` 开头。

## 在 KVideo 里添加

设置 → 导入设置 → 订阅管理 → 填名字、粘贴上面任一地址 → 添加，然后在条目上点「立即更新」。

数量与 JSON 里的 `count` 字段一致即拉全（`count` 每天会变，不用记数字）。`18` 开头的受限源只在**全量**里，且仅 `/premium` 入口可见。

## 部署

官方镜像 `kuekhaoyang/kvideo:latest`，订阅已通过环境变量内置：

```bash
docker run -d --name kvideo --restart unless-stopped -p 3000:3000 \
  -e 'SUBSCRIPTION_SOURCES=[{"name":"汇总","url":"https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json"}]' \
  kuekhaoyang/kvideo:latest
```

| 改什么 | 怎么改 |
|---|---|
| 端口 | `-p 8080:3000`，冒号右边固定 3000 |
| 版本 | url 末尾换成 `kvideo-normal.json` 即常规版 |
| 重建 | 先 `docker rm -f kvideo`，再执行上面的命令 |

**确认部署成功**：

```bash
curl -s http://127.0.0.1:3000/api/auth | grep -c kvideo-merged.json       # 1 = 订阅已下发
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/settings   # 200 = 页面正常
```

浏览器打开 `http://<设备IP>:3000/settings`，订阅上点「立即更新」，数量与 `count` 一致即可。

**其他方式**：设备连不上某个 CDN 时，用一行安装（自动试三条地址，选能通的）：

```bash
curl -fsSL https://gcore.jsdelivr.net/gh/boderline7/kvideo-config@main/deploy/install.sh | sh -s -- 3000
```

或用 [deploy/docker-compose.yml](deploy/docker-compose.yml)：`docker compose up -d`。

**交给 AI 部署**：直接把上面的 `docker run` 命令给它，并让它按「确认部署成功」那两行自检。

## 自动更新

每天北京时间 **04:10** 跑一次：拉三个上游 → 转换 → 剔失效 → 去重 → 自检 → 提交 → 刷 CDN 缓存。GitHub 排队可能晚几小时。手动触发：仓库页 → Actions → Update sources → Run workflow。

## 常见问题

| 问题 | 处理 |
|---|---|
| 镜像拉不下来 | 配 Docker 镜像加速，或 `docker save` / `load` 中转 |
| 订阅拉不到 | 换上面另一条 CDN 地址，填进 `SUBSCRIPTION_SOURCES` 后重建 |
| 改了端口或源 | `docker rm -f kvideo` 后重跑；源列表在浏览器本地，重建不会丢 |
| 想剔除某个源 | 在 `config/overrides.json` 的 `exclude` 里加一条 |

## 目录结构

```text
dist/         生成的订阅文件（KVideo 读这里）
scripts/      build 转换 / merge 汇总 / verify 自检
config/       overrides 覆盖规则、renames 命名映射
deploy/       一键脚本、docker-compose
.github/      定时任务
```

## 本地运行

需要 Node.js 18+，零依赖。

```bash
node scripts/build.mjs      # 拉上游 → 转换 → 写 dist/ 和 README
node scripts/merge.mjs      # 三方汇总去重
node scripts/verify.mjs     # 自检，应输出「全部通过」
```

## 说明

- 接口域名原样保留（改写就取不到数据），源名里的标记统一用拼音缩写替代。
- `dist/*-manual.json` 是**纯数组**，只给「导入设置 → JSON」粘贴用，不能当订阅地址。

## 源清单

<!-- SOURCES:START -->

<details>
<summary>源清单（74 个 · LunaTV 原始转换，汇总前，点击展开）</summary>

> 生成于 **2026-10-30 07:55 +08:00** ｜ 上游：`fmynj/lunatv-config (raw)` ｜ 常规 40 / premium 34

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
