#!/usr/bin/env node
// 把 LunaTV / MoonTV 源配置转换成 KVideo 可用的订阅源。
// 默认只做转换：上游配了哪些源，就原样转成 KVideo 字段输出，不删、不改、不判断。
//
//   node scripts/build.mjs                                  # 拉上游 -> 转换 -> 写 dist/ 和 README
//   node scripts/build.mjs --input path/to/LunaTV-config.json   # 用本地文件
//   node scripts/build.mjs --include-premium                # 连特殊分组源一起输出（默认不含）
//   node scripts/build.mjs --probe                          # 额外跑一次可用性探测（可选，仅作参考）

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfigPayload } from './lib/base58.mjs';
import { normalizeConfig } from './lib/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const argv = process.argv.slice(2);
const arg = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const has = (name) => argv.includes(`--${name}`);

const INPUT = arg('input');
const PROBE = has('probe') || process.env.PROBE === '1';
const CONCURRENCY = Number(arg('concurrency', process.env.CONCURRENCY || 8));
const TIMEOUT_MS = Number(arg('timeout', process.env.TIMEOUT_MS || 12000));
const KEYWORD = String(arg('keyword', process.env.PROBE_KEYWORD || '庆余年'));
const STAMP = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date());

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'kvideo-config-builder/1.0', 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 依次尝试多个上游地址，返回第一份能解析的配置 */
async function loadUpstream(upstreams) {
  const errors = [];
  for (const item of upstreams) {
    const url = typeof item === 'string' ? item : item.url;
    const label = typeof item === 'string' ? item : item.name || item.url;
    try {
      log(`拉取上游 ${label}`);
      const cfg = parseConfigPayload(await fetchText(url));
      const count = Object.keys(cfg?.api_site || cfg?.apiSite || {}).length;
      if (!count) throw new Error('配置里没有 api_site');
      log(`  OK: ${count} 个源`);
      return { cfg, label, url };
    } catch (e) {
      log(`  失败: ${e.message}`);
      errors.push(`${label}: ${e.message}`);
    }
  }
  throw new Error(`所有上游都失败\n${errors.join('\n')}`);
}

function toOutput(entry, priority) {
  const { source } = entry;
  const out = {
    id: source.id,
    name: source.name,
    baseUrl: source.baseUrl,
    searchPath: '',
    detailPath: '',
    group: source.group,
    enabled: true,
    priority,
  };
  if (entry.result) {
    if (entry.result.latency) out._latency = entry.result.latency;
    if (entry.result.status && entry.result.status !== 'ok') out._status = entry.result.status;
    if (!entry.result.ok) out.enabled = false;
  }
  return out;
}

const MARK_START = '<!-- SOURCES:START -->';
const MARK_END = '<!-- SOURCES:END -->';

const STATUS_LABEL = {
  ok: '✅ 可用',
  'empty-search': '⚠️ 可搜/无结果',
  'list-only': '⛔ 禁关键词搜索',
  timeout: '❌ 超时',
  unreachable: '❌ 不通',
};

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function main() {
  await fs.mkdir(DIST, { recursive: true });
  const overrides = await readJson(path.join(ROOT, 'config', 'overrides.json'), {});
  const upstreams =
    overrides.upstreams && overrides.upstreams.length
      ? overrides.upstreams
      : ['https://raw.githubusercontent.com/fmynj/lunatv-config/main/LunaTV-config.json'];

  // 1) 取配置
  let cfg;
  let upstreamLabel;
  if (INPUT) {
    const file = path.resolve(process.cwd(), String(INPUT));
    log(`使用本地配置 ${file}`);
    cfg = parseConfigPayload(await fs.readFile(file, 'utf8'));
    upstreamLabel = `local:${path.basename(file)}`;
  } else {
    const r = await loadUpstream(upstreams);
    cfg = r.cfg;
    upstreamLabel = r.label;
  }

  // 2) 转换（原样转换，不动任何源的启用状态）
  const { sources, skipped } = normalizeConfig(cfg, { overrides, resolveProxy: PROBE });
  const normal = sources.filter((s) => s.source.group === 'normal');
  const premium = sources.filter((s) => s.source.group === 'premium');
  // 全量输出：上游给多少就转多少，不按分组做筛选
  const active = sources;
  log(
    `转换完成: 共 ${sources.length} 个（常规 ${normal.length} / premium ${premium.length}），` +
      `跳过 ${skipped.length}`,
  );

  // 3) 可选探测（默认不做，纯转换模式下不联网打接口）
  if (PROBE) {
    const { probeWithFallback, mapPool } = await import('./lib/probe.mjs');
    log(`探测 ${active.length} 个源（并发 ${CONCURRENCY}，关键词「${KEYWORD}」）`);
    let done = 0;
    await mapPool(active, CONCURRENCY, async (entry) => {
      const result = await probeWithFallback(entry.alternatives, {
        keyword: KEYWORD,
        timeoutMs: TIMEOUT_MS,
        retries: 1,
      });
      entry.result = result;
      // 只在中转源上回写实测能通的地址，其余保持上游原样
      if (result.ok && result.candidate && entry.alternatives.length > 1) {
        entry.source.baseUrl = result.candidate.baseUrl;
        if (entry.manual) entry.manual.baseUrl = result.candidate.baseUrl;
      }
      done++;
      if (done % 10 === 0 || done === active.length) log(`  进度 ${done}/${active.length}`);
      return result;
    });
  }

  // 4) 写出
  const allList = active.map((entry, i) => toOutput(entry, i + 1));
  const normalList = allList.filter((s) => s.group === 'normal');
  const premiumList = allList.filter((s) => s.group === 'premium');

  const manual = active
    .filter((entry) => entry.manual)
    .map((entry, i) => {
      const m = { ...entry.manual, priority: i + 1 };
      if (entry.result && !entry.result.ok) m.enabled = false;
      return m;
    });

  const meta = {
    name: 'KVideo 中文源（由 LunaTV/MoonTV 配置转换）',
    updated_at: `${STAMP} +08:00`,
    upstream: upstreamLabel,
    count: allList.length,
    mode: PROBE ? 'convert+probe' : 'convert',
  };

  const writeJson = async (file, data) =>
    fs.writeFile(path.join(DIST, file), JSON.stringify(data, null, 2) + '\n', 'utf8');

  const withList = (base, list, extra = {}) => ({ ...base, ...extra, count: list.length, sources: list });

  await writeJson('kvideo-sources.json', withList(meta, allList, { name: 'KVideo 中文源 · 全量' }));
  await writeJson('kvideo-normal.json', withList(meta, normalList, { name: 'KVideo 中文源 · 常规' }));
  // 全量文件已包含 premium 分组，不再单独出第三份
  await fs.rm(path.join(DIST, 'kvideo-premium.json'), { force: true });
  // 注意：KVideo 的「JSON」粘贴页只有 Array.isArray 一条分支（JsonImportTab.tsx），
  // 包一层 {name, count, sources} 会直接报「JSON 格式错误：应为数组」，
  // 所以这个文件必须是纯数组 —— 它是唯一能被粘贴页接受的文件。
  await writeJson('kvideo-sources-manual.json', manual);

  // 纯转换模式不再产出 status.json，清掉旧版本残留
  await fs.rm(path.join(DIST, 'status.json'), { force: true });

  log(`完成: ${allList.length} 个源（常规 ${normalList.length} / premium ${premiumList.length}）`);
  await updateReadme({ meta, allList, readmeRepo: overrides.repo, probed: PROBE, keyword: KEYWORD });
}

function mdTable(rows, probed) {
  const head = probed
    ? '| # | 名称 | id | 接口域名 | 状态 | 延迟 | 分组 |\n|---:|---|---|---|---|---:|:---:|'
    : '| # | 名称 | id | 接口域名 | 分组 |\n|---:|---|---|---|:---:|';
  const body = rows
    .map((s, i) => {
      const group = s.group === 'premium' ? 'premium' : 'normal';
      const name = s.name.replace(/\|/g, '/');
      const host = hostOf(s.baseUrl);
      if (!probed) return `| ${i + 1} | ${name} | \`${s.id}\` | \`${host}\` | ${group} |`;
      const state = STATUS_LABEL[s._status] || '✅ 可用';
      const lat = s._latency ? `${s._latency} ms` : '—';
      return `| ${i + 1} | ${name} | \`${s.id}\` | \`${host}\` | ${state}${s.enabled === false ? '（默认关闭）' : ''} | ${lat} | ${group} |`;
    })
    .join('\n');
  return `${head}\n${body}`;
}

async function updateReadme({ meta, allList, readmeRepo, probed, keyword }) {
  const readmePath = path.join(ROOT, 'README.md');
  const template = await fs.readFile(readmePath, 'utf8');
  if (!template.includes(MARK_START) || !template.includes(MARK_END)) {
    log('README 缺少标记位，跳过表格更新');
    return;
  }
  const premiumCount = allList.filter((s) => s.group === 'premium').length;
  const lines = [
    MARK_START,
    '',
    '<details>',
    `<summary>源清单（${meta.count} 个 · LunaTV 原始转换，汇总前，点击展开）</summary>`,
    '',
    `> 生成于 **${meta.updated_at}** ｜ 上游：\`${meta.upstream}\`` +
      (premiumCount ? ` ｜ 常规 ${meta.count - premiumCount} / premium ${premiumCount}` : ''),
    '' + (probed ? `>\n> 本次带了探测（关键词「${keyword}」），状态列仅供参考，不影响是否收录。\n` : ''),
    mdTable(allList, probed),
    '',
    '</details>',
    '',
    MARK_END,
  ];

  const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
  const repo = String(readmeRepo || process.env.GITHUB_REPOSITORY || '').trim();
  let next = template.replace(re, lines.join('\n'));
  if (repo) next = next.replaceAll('{{GITHUB_REPO}}', repo);
  await fs.writeFile(readmePath, next, 'utf8');
}

main().catch((e) => {
  console.error('构建失败:', e.message);
  process.exit(1);
});
