#!/usr/bin/env node
// 纯转换：不联网、不探测，把 LunaTV/MoonTV 配置（JSON 或 base58 txt）转成 KVideo 源 JSON。
//
//   node scripts/convert.mjs --input LunaTV-config.json --out kvideo.json
//   node scripts/convert.mjs --input LunaTV-config.txt  --mode manual --out kvideo-manual.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseConfigPayload } from './lib/base58.mjs';
import { normalizeConfig } from './lib/normalize.mjs';

const argv = process.argv.slice(2);
const arg = (name, fb) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fb;
  return argv[i + 1] ?? fb;
};
const has = (n) => argv.includes(`--${n}`);

const input = arg('input');
const output = arg('output') || arg('out') || 'kvideo-sources.json';
const mode = arg('mode', has('manual') ? 'manual' : 'subscribe');
const includePremium = has('include-premium');

if (!input) {
  console.error('用法: node scripts/convert.mjs --input <LunaTV-config.json|.txt> [--out kvideo.json] [--mode subscribe|manual] [--include-premium]');
  process.exit(1);
}

const cfg = parseConfigPayload(await fs.readFile(path.resolve(process.cwd(), input), 'utf8'));
const { sources } = normalizeConfig(cfg);
const picked = includePremium ? sources : sources.filter((s) => s.source.group === 'normal');

const list =
  mode === 'manual'
    ? picked
        .filter((s) => s.manual)
        .map((s, i) => ({ ...s.manual, priority: i + 1 }))
    : picked.map((s, i) => ({
        id: s.source.id,
        name: s.source.name,
        baseUrl: s.source.baseUrl,
        searchPath: '',
        detailPath: '',
        group: s.source.group,
        enabled: true,
        priority: i + 1,
      }));

await fs.writeFile(path.resolve(process.cwd(), output), JSON.stringify(list, null, 2) + '\n', 'utf8');
console.log(`已写出 ${list.length} 个源 -> ${output} (mode=${mode})`);
