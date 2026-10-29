# kvideo-config

把 [LunaTV / MoonTV 的源配置](https://github.com/fmynj/lunatv-config) 转换成 **KVideo 能直接订阅的源**，并把三个上游的源汇总去重，每天自动同步。

## 订阅地址

### 三方汇总（推荐，去重后最全）

| 版本 | 地址 |
|---|---|
| **汇总** | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-merged.json` |
| 汇总 · 加速 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-merged.json` |

<!-- MERGE:START -->

> 自动生成于 **2026-10-29 08:45 +08:00** ｜ 合计 **101** 个（常规 61 / 受限 40）
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

### 本仓库单独版本

| 版本 | 地址 |
|---|---|
| **全量**（74 个） | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-sources.json` |
| 全量 · 加速 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-sources.json` |
| **常规**（40 个） | `https://raw.githubusercontent.com/boderline7/kvideo-config/main/dist/kvideo-normal.json` |
| 常规 · 加速 | `https://cdn.jsdelivr.net/gh/boderline7/kvideo-config@main/dist/kvideo-normal.json` |

**用法**：KVideo → 设置 → 导入设置 → 订阅管理 → 填名称 + 粘贴上面任一地址 → 添加。
之后在订阅条目上点「立即更新」就能拿到最新列表。

- **全量**：本仓库转换出的所有源。其中 `premium` 分组的源，名字统一以 `18` 开头，方便识别。
- **常规**：只含 `normal` 分组的普通影视源。
- raw 那个地址国内直连偶尔会卡，卡就换「加速」那条，内容完全一样。

## 更新机制

每天北京时间 **04:10** 自动拉上游 → 转换 → 汇总去重 → 提交，订阅地址不变，内容每天刷新。
手动跑一次：仓库页 → Actions → Update sources → Run workflow。

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
<summary>源清单（74 个，点击展开）</summary>

> 生成于 **2026-10-29 08:44 +08:00** ｜ 上游：`fmynj/lunatv-config (jsDelivr)` ｜ 常规 40 / premium 34

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
