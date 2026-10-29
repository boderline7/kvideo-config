#!/usr/bin/env node
/**
 * 三方汇总脚本
 *   1) 本仓库（dist/kvideo-sources.json，源自 LunaTV/MoonTV 配置）
 *   2) puppet680/KVideo-config
 *   3) 335459215/kvideo-sources
 *
 * 做法：把三方的源统一成 KVideo 字段 -> 按「归一化请求地址」去重 -> 受限源改名 18+拼音缩写
 * 去重只认请求地址，不认域名：同一个域名下可能挂着两套完全不同的资源库
 * （例：api.1080zyku.com 的 /inc/apijson.php 与 /inc/api_mac10.php）。
 *
 * 用法：
 *   node scripts/merge.mjs             # 联网拉两个上游
 *   node scripts/merge.mjs --offline   # 只用 cache/ 里的副本
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, 'cache');
const OFFLINE = process.argv.includes('--offline');

// 名字里带这个符号的上游条目属于受限分组（用转义写，源码里不出现符号本身）
const MARK = '\u{1F51E}';

// 上游清单：顺序即去重优先级，排前面的条目优先保留
const UPSTREAMS = [
  { key: 'own', label: '本仓库', local: 'dist/kvideo-sources.json' },
  { key: 'p680', label: 'puppet680/KVideo-config', repo: 'puppet680/KVideo-config', files: ['KVideo-config.json'] },
  {
    key: 'k335',
    label: '335459215/kvideo-sources',
    repo: '335459215/kvideo-sources',
    files: ['master.json', 'adult-master.json'],
    disabled: 'disabled.json',
  },
];

const STAMP = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16);

const log = (...a) => console.log(...a);

/* ---------------------------------- 工具 ---------------------------------- */

// 上游有些地址把测试参数一起存进去了（?ac=list / ?ac=detail），这些参数由 KVideo 自己填
const JUNK_PARAMS = new Set(['ac', 'at', 'wd', 'pg', 'pagesize', 'p', 'format']);

/**
 * 清洗地址：合并多余斜杠、去掉尾斜杠、剔除测试参数
 * 注意 ?url= 形式的中转地址必须原样保留查询串，否则中转站会失效
 */
function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const qIdx = s.indexOf('?');
  let base = qIdx === -1 ? s : s.slice(0, qIdx);
  const query = qIdx === -1 ? '' : s.slice(qIdx + 1).split('#')[0];

  // 只合并路径里的重复斜杠，别碰协议后面的 //
  base = base.replace(/([^:/])\/{2,}/g, '$1/').replace(/\/+$/, '');
  // 只剩主机时补回根路径（中转地址是 https://host/?url=... 这种形式）
  if (/^https?:\/\/[^/]+$/i.test(base)) base += '/';

  let keep = '';
  if (query) {
    const params = new URLSearchParams(query);
    if (params.has('url')) {
      keep = query; // 中转地址：整串保留
    } else {
      const out = new URLSearchParams();
      for (const [k, v] of params) if (!JUNK_PARAMS.has(k.toLowerCase())) out.append(k, v);
      keep = out.toString();
    }
  }
  return keep ? `${base}?${keep}` : base;
}

/** 归一化请求地址：用清洗后的地址算去重键 */
function canonical(raw) {
  const u = normalizeUrl(raw);
  if (!u) return '';
  const qIdx = u.indexOf('?');
  const bare = qIdx === -1 ? u : u.slice(0, qIdx);
  const query = qIdx === -1 ? '' : u.slice(qIdx);
  let host = '';
  let pathname = '';
  try {
    const parsed = new URL(bare);
    host = parsed.host.toLowerCase();
    pathname = parsed.pathname.replace(/\/+$/, '');
  } catch {
    const m = /^([^/]+)(\/.*)?$/.exec(bare);
    host = (m?.[1] || bare).toLowerCase();
    pathname = (m?.[2] || '').replace(/\/+$/, '');
  }
  // apple-cms 的 /at/json 只是输出格式后缀，和裸接口是同一个源
  pathname = pathname.replace(/\/at\/json$/i, '');
  // .../xxx.php/provide/vod 与 .../xxx.php 是同一个接口的两种写法
  pathname = pathname.replace(/\/provide\/vod$/i, '');
  return host + pathname + query.toLowerCase();
}

/** KVideo 用 response.json() 解析，XML 接口必然拿不到数据 */
function isXmlEndpoint(u) {
  return /\/xml\.php(\?|$)/i.test(u) || /\.xml(\?|$)/i.test(u);
}

function cleanName(raw) {
  let n = String(raw || '').replaceAll(MARK, '').replaceAll('\u{1F3AC}', '');
  n = n.replace(/\s{2,}/g, ' ');
  n = n.replace(/[-—–－]{2,}/g, '-');
  n = n.replace(/^[-—–－\s]+|[-—–－\s]+$/g, '');
  return n.trim();
}

function sanitizeId(raw) {
  const id = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return id || 'src';
}

async function fetchText(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'kvideo-config-merge' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

/** 拉上游文件；失败时回落到 cache/ 里的副本 */
async function readUpstream(up, file) {
  const cachePath = path.join(CACHE, `${up.key}_${file}`);
  const url = `https://raw.githubusercontent.com/${up.repo}/main/${file}`;
  if (!OFFLINE) {
    try {
      const text = await fetchText(url);
      const data = JSON.parse(text);
      await fs.mkdir(CACHE, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      return { data, from: 'network' };
    } catch (e) {
      log(`  ! ${up.label}/${file} 拉取失败（${e.message}），改用本地副本`);
    }
  }
  const text = await fs.readFile(cachePath, 'utf8');
  return { data: JSON.parse(text), from: 'cache' };
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  for (const k of ['sources', 'data', 'list']) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  if (data && typeof data === 'object') {
    // LunaTV 的 api_site 是 {key: {...}} 形式
    if (data.api_site && typeof data.api_site === 'object') {
      return Object.entries(data.api_site).map(([k, v]) => ({ id: k, ...v }));
    }
  }
  return [];
}

/* ---------------------------------- 主流程 --------------------------------- */

await fs.mkdir(DIST, { recursive: true });
await fs.mkdir(CACHE, { recursive: true });

const renames = JSON.parse(await fs.readFile(path.join(ROOT, 'config', 'renames.json'), 'utf8'));

// 1) 收集三方条目
const collected = []; // { up, name, url, group, promoted, entry }
const stats = { perSource: {}, droppedXml: [], invalid: new Map() };

for (const up of UPSTREAMS) {
  let lists = [];
  if (up.local) {
    const data = JSON.parse(await fs.readFile(path.join(ROOT, up.local), 'utf8'));
    lists = [asArray(data)];
    stats.perSource[up.label] = { total: 0, from: 'local' };
  } else {
    const parts = [];
    for (const f of up.files) {
      const { data, from } = await readUpstream(up, f);
      parts.push(...asArray(data));
      stats.perSource[up.label] = { total: 0, from };
    }
    lists = [parts];
    // 上游自己判定的失效条目：直接不收录（对方标了失效就不拉）
    if (up.disabled) {
      try {
        const { data } = await readUpstream(up, up.disabled);
        for (const s of asArray(data)) {
          const c = canonical(s.baseUrl);
          if (c) stats.invalid.set(c, { from: `${up.label}/${up.disabled}`, name: s.name, reason: s._comment || '' });
        }
      } catch (e) {
        log(`  ! ${up.label}/${up.disabled} 读取失败（${e.message}），本轮不做失效剔除`);
      }
    }
  }

  for (const list of lists) {
    for (const s of list) {
      const url = normalizeUrl(s.baseUrl || s.api || '');
      if (!url) continue;
      stats.perSource[up.label].total++;
      if (isXmlEndpoint(url)) {
        stats.droppedXml.push({ from: up.label, url });
        continue;
      }
      // 上游把 enabled 显式写成 false 的，同样算「标注失效」
      if (s.enabled === false) {
        stats.invalid.set(canonical(url), { from: `${up.label}(enabled:false)`, name: s.name, reason: '上游标注不可用' });
        continue;
      }
      const rawName = String(s.name || s.id || '');
      const marked = String(s.group || '').toLowerCase() === 'premium' || rawName.includes(MARK);
      collected.push({
        up: up.key,
        rawName,
        rawId: s.id,
        url,
        canon: canonical(url),
        marked,
      });
    }
  }
}

log(`收集到 ${collected.length} 条（XML 接口已排除 ${stats.droppedXml.length} 条）`);

// 2) 剔除上游标注失效的条目（对方标了失效就不拉）
// 报告里不写源名，只留域名和原因，避免原文落到仓库文件里
const hostOf = (u) => {
  try {
    return new URL(String(u).replace(/^([a-z]+:\/\/[^/?]+)\?(.*)$/i, '$1/$2')).host;
  } catch {
    return '';
  }
};
const droppedInvalid = [];
const kept = [];
for (const item of collected) {
  const bad = stats.invalid.get(item.canon);
  if (bad) {
    droppedInvalid.push({ host: hostOf(item.url), reason: bad.reason, from: item.up });
    continue;
  }
  kept.push(item);
}
log(`剔除上游标注失效 ${droppedInvalid.length} 条，剩 ${kept.length} 条`);

// 3) 按归一化地址去重，优先保留排前面的上游
const byCanon = new Map();
const dupPairs = [];
for (const item of kept) {
  const hit = byCanon.get(item.canon);
  if (hit) {
    dupPairs.push({ kept: `${hit.up}:${hit.rawName}`, dropped: `${item.up}:${item.rawName}`, url: item.url });
    // 任一方标为受限，整条就归受限
    if (item.marked) hit.marked = true;
    continue;
  }
  byCanon.set(item.canon, item);
}
log(`去重后 ${byCanon.size} 条（合并掉 ${dupPairs.length} 条重复）`);

// 4) 生成 KVideo 条目
const usedNames = new Map();
const usedIds = new Set();
const results = [];

for (const item of byCanon.values()) {
  // 名称
  let name;
  if (item.marked) {
    const fallbackId = sanitizeId(String(item.rawId || '').replace(/^www[-.]/, '') || item.canon);
    // renames.json 用名称的哈希做键，这样受限源的原名不会出现在仓库文件里
    const nameHash = (s) => createHash('md5').update(String(s || ''), 'utf8').digest('hex').slice(0, 16);
    name =
      renames[nameHash(item.rawName)] ||
      renames[nameHash(cleanName(item.rawName))] ||
      `18${fallbackId}`;
    name = name.slice(0, 16);
  } else {
    name = cleanName(item.rawName) || sanitizeId(item.rawId);
    name = name.slice(0, 24);
  }
  // 重名加序号
  const seen = usedNames.get(name) || 0;
  usedNames.set(name, seen + 1);
  if (seen > 0) name = `${name}${seen + 1}`;

  // id
  let id = sanitizeId(item.rawId || name);
  if (usedIds.has(id)) {
    let n = 2;
    while (usedIds.has(`${id}${n}`)) n++;
    id = `${id}${n}`;
  }
  usedIds.add(id);

  results.push({
    id,
    name,
    baseUrl: item.url,
    searchPath: '',
    detailPath: '',
    group: item.marked ? 'premium' : 'normal',
    enabled: true,
    _canon: item.canon,
    _from: item.up,
  });
}

// 4) 排序：常规在前、受限在后，组内按来源顺序（Map 天然保持插入序）
const ordered = [
  ...results.filter((s) => s.group === 'normal'),
  ...results.filter((s) => s.group === 'premium'),
].map((s, i) => ({
  id: s.id,
  name: s.name,
  baseUrl: s.baseUrl,
  searchPath: s.searchPath,
  detailPath: s.detailPath,
  group: s.group,
  enabled: s.enabled,
  priority: i + 1,
}));

// 5) 订阅版（对象）
const meta = {
  name: 'KVideo 中文源 · 三方汇总',
  updated_at: `${STAMP} +08:00`,
  upstream: UPSTREAMS.map((u) => u.label).join(' + '),
  count: ordered.length,
  mode: 'merge',
};
const writeJson = async (file, data) =>
  fs.writeFile(path.join(DIST, file), JSON.stringify(data, null, 2) + '\n', 'utf8');

await writeJson('kvideo-merged.json', { ...meta, sources: ordered });

// 6) 粘贴版（纯数组）：JsonImportTab 在 searchPath 为空时会补 /provide/vod，
//    所以只有以 /provide/vod 结尾的接口能安全拆分，其余不进这份文件
const manual = [];
for (const s of ordered) {
  const m = /^(.*?)\/provide\/vod$/i.exec(s.baseUrl);
  if (!m) continue;
  manual.push({
    id: s.id,
    name: s.name,
    baseUrl: m[1],
    searchPath: '/provide/vod',
    detailPath: '/provide/vod',
    group: s.group,
    enabled: s.enabled,
    priority: manual.length + 1,
  });
}
await writeJson('kvideo-merged-manual.json', manual);

// 7) 报告
const summary = {
  generated_at: meta.updated_at,
  upstream: meta.upstream,
  inputs: stats.perSource,
  collected: collected.length,
  dropped_invalid: droppedInvalid.length,
  merged_duplicates: dupPairs.length,
  dropped_xml: stats.droppedXml.length,
  output: ordered.length,
  normal: ordered.filter((s) => s.group === 'normal').length,
  premium: ordered.filter((s) => s.group === 'premium').length,
  manual_exportable: manual.length,
  invalid_samples: droppedInvalid.slice(0, 40),
  xml_samples: stats.droppedXml.slice(0, 20),
};

await writeJson('merge-report.json', summary);

// 8) 刷新 README 里的统计块
const MARK_START = '<!-- MERGE:START -->';
const MARK_END = '<!-- MERGE:END -->';
try {
  const readmePath = path.join(ROOT, 'README.md');
  const readme = await fs.readFile(readmePath, 'utf8');
  if (readme.includes(MARK_START) && readme.includes(MARK_END)) {
    const block = [
      MARK_START,
      '',
      `> 自动生成于 **${meta.updated_at}** ｜ 合计 **${ordered.length}** 个（常规 ${summary.normal} / 受限 ${summary.premium}）`,
      '>',
      `> 本次：合并重复 ${dupPairs.length} 条，剔除上游标注失效 ${droppedInvalid.length} 条，排除 XML 接口 ${summary.dropped_xml} 条`,
      '',
      MARK_END,
    ].join('\n');
    const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
    await fs.writeFile(readmePath, readme.replace(re, block), 'utf8');
  }
} catch (e) {
  log(`  ! README 统计块未更新：${e.message}`);
}

log('');
log(`三方汇总完成`);
for (const [k, v] of Object.entries(stats.perSource)) log(`  ${k.padEnd(28)} ${String(v.total).padStart(4)} 条（${v.from}）`);
log(`  剔除上游标注失效    ${droppedInvalid.length} 条`);
log(`  合并重复            ${dupPairs.length} 条`);
log(`  排除 XML 接口       ${stats.droppedXml.length} 条`);
log(`  输出                ${ordered.length} 条（常规 ${summary.normal} / 受限 ${summary.premium}）`);
log(`  粘贴版可导出        ${manual.length} 条`);
