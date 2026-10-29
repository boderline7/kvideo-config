#!/usr/bin/env node
// 自检：用 KVideo 的真实解析/拼接逻辑检查 dist/ 产物能不能用。
//   node scripts/verify.mjs
//
// 覆盖 KVideo 的三个导入入口：
//   1. 文件导入 / 链接导入 / 订阅管理 → parseSourcesFromJson()：数组、{sources}、{list} 都吃
//   2. JSON 粘贴页 → JsonImportTab.tsx：**只认顶层数组**，对象会报「JSON 格式错误：应为数组」
//   3. 两边的 searchPath 处理不一样：订阅把 searchPath 强制写 ''，粘贴页空值补 '/provide/vod'
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const SUB_FILES = ['kvideo-sources.json', 'kvideo-normal.json', 'kvideo-merged.json'];
const PASTE_FILES = ['kvideo-sources-manual.json', 'kvideo-merged-manual.json'];
const STALE = ['status.json', 'kvideo-premium.json'];

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

/** 订阅/链接/文件导入：parseSourcesFromJson 的等价实现 */
function parseSubscription(raw) {
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : data.sources || data.list || [];
  return arr.map((s) => ({ ...s, searchPath: '', detailPath: '' }));
}

/** JSON 粘贴页：JsonImportTab.tsx 的等价实现 */
function parsePaste(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('顶层不是数组，粘贴页会报「JSON 格式错误：应为数组」');
  return data.map((s, i) => {
    if (!s?.name || !s?.baseUrl) throw new Error(`第 ${i + 1} 项缺少 name 或 baseUrl`);
    return {
      id: s.id || `json-${i}`,
      name: s.name,
      baseUrl: s.baseUrl,
      searchPath: s.searchPath || '/provide/vod',
      detailPath: s.detailPath || '/provide/vod',
      group: s.group,
      enabled: s.enabled !== false,
    };
  });
}

function checkCommon(sources, label) {
  const ids = new Set();
  let dup = 0;
  for (const s of sources) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) fail(`${label} id 不规范: ${s.id}`);
    if (ids.has(s.id)) dup++;
    ids.add(s.id);
    let u;
    try {
      u = new URL(`${s.baseUrl}${s.searchPath}`);
    } catch {
      fail(`${label} ${s.id} 拼出来的不是合法 URL: ${s.baseUrl}${s.searchPath}`);
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) fail(`${label} ${s.id} 协议异常: ${u.protocol}`);
    if (/provide\/vod\/provide\/vod|api\.php\/api\.php/.test(u.pathname))
      fail(`${label} ${s.id} 路径双写: ${u.pathname}`);
  }
  if (dup) fail(`${label} 有 ${dup} 个重复 id`);
  return sources.length;
}

const files = (await fs.readdir(DIST)).filter((f) => f.endsWith('.json'));
if (!files.length) {
  console.error('dist/ 里没有文件，先跑 node scripts/build.mjs');
  process.exit(1);
}

for (const stale of STALE) {
  if (files.includes(stale)) fail(`dist/${stale} 是已废弃产物，应删除`);
}

for (const file of files.filter((f) => SUB_FILES.includes(f))) {
  console.log(`\n${file}  （订阅路径）`);
  const raw = await fs.readFile(path.join(DIST, file), 'utf8');
  const sources = parseSubscription(raw);
  if (!sources.length) {
    fail('解析出 0 个源');
    continue;
  }
  const declared = JSON.parse(raw).count;
  if (typeof declared === 'number' && declared !== sources.length)
    fail(`count 写的是 ${declared}，实际 ${sources.length} 个`);
  ok(`解析 ${sources.length} 个源`);

  // 订阅导入会把 searchPath 抹成 ''，所以 baseUrl 必须自带完整接口路径
  const bad = sources.filter((s) => {
    let u;
    try {
      u = new URL(s.baseUrl);
    } catch {
      return true;
    }
    // CORS 中转源（?url=...）的真实路径在查询参数里，域名根路径是正常的
    return (u.pathname === '/' || u.pathname === '') && !u.searchParams.has('url');
  });
  if (bad.length) fail(`${bad.length} 个 baseUrl 缺接口路径，订阅后必 404，例: ${bad[0].id} ${bad[0].baseUrl}`);
  else ok('baseUrl 均带完整接口路径');

  checkCommon(sources, file);
}

for (const PASTE_FILE of PASTE_FILES.filter((f) => files.includes(f))) {
  console.log(`\n${PASTE_FILE}  （JSON 粘贴路径）`);
  const raw = await fs.readFile(path.join(DIST, PASTE_FILE), 'utf8');
  let sources;
  try {
    sources = parsePaste(raw);
  } catch (e) {
    fail(e.message);
    sources = [];
  }
  if (sources.length) {
    ok(`顶层是数组，解析 ${sources.length} 个源（粘贴页可接受）`);
    const bad = sources.filter((s) => !s.searchPath);
    if (bad.length) fail(`${bad.length} 个 searchPath 为空，粘贴页会补成 /provide/vod 造成双写`);
    else ok('searchPath 均非空');
    checkCommon(sources, PASTE_FILE);
  }
}

// 一致性：常规必须是全量的真子集，条数等于全量里的 normal 分组数
// （两份文件都来自同一次汇总；对不上说明 merge.mjs 被改坏了，或 build 之后没跑 merge）
console.log('\n常规 ⊆ 全量（一致性）');
try {
  const mergedRaw = JSON.parse(await fs.readFile(path.join(DIST, 'kvideo-merged.json'), 'utf8'));
  const normalRaw = JSON.parse(await fs.readFile(path.join(DIST, 'kvideo-normal.json'), 'utf8'));
  const merged = Array.isArray(mergedRaw) ? mergedRaw : mergedRaw.sources || [];
  const normal = Array.isArray(normalRaw) ? normalRaw : normalRaw.sources || [];
  const mergedIds = new Set(merged.map((s) => s.id));
  const normalIds = new Set(normal.map((s) => s.id));
  const extra = [...normalIds].filter((id) => !mergedIds.has(id));
  const expect = merged.filter((s) => s.group !== 'premium').length;
  if (extra.length) fail(`常规里有 ${extra.length} 个源不在全量里，例: ${extra[0]}`);
  else ok('常规里的源全部能在全量里找到');
  if (normal.length !== expect) fail(`常规 ${normal.length} 条，但全量里 normal 分组是 ${expect} 条（先跑 node scripts/merge.mjs）`);
  else ok(`常规 ${normal.length} 条 = 全量里的 normal 分组`);
  if (normal.some((s) => s.group === 'premium')) fail('常规里混进了 premium 分组');
  else ok('常规里没有 18 开头的受限源');
} catch (e) {
  fail(`一致性检查跳过：${e.message}`);
}

console.log(`\n${failures ? `❌ ${failures} 处问题` : '✅ 全部通过'}`);
process.exit(failures ? 1 : 0);
