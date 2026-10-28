// LunaTV / MoonTV 配置 -> KVideo 源格式 的核心映射规则
//
// LunaTV  : { "<配置键>": { name, api, detail } }
// KVideo  : { id, name, baseUrl, searchPath, detailPath, group, enabled, priority }
//
// KVideo 两处导入逻辑不一致，必须分别产出：
//   1) 订阅导入(lib/utils/source-import-utils.ts -> convertToVideoSource) 会把 searchPath 强制写成 ''
//      => baseUrl 必须带完整路径（.../api.php/provide/vod），请求 URL = baseUrl + '?ac=detail&wd=..'
//   2) 手动粘贴导入(components/settings/import/JsonImportTab.tsx) 在 searchPath 为空时补 '/provide/vod'
//      => baseUrl 必须去掉 '/provide/vod'，把路径放进 searchPath
// 因此 build 会输出 kvideo-sources.json（订阅用）与 kvideo-sources-manual.json（粘贴用）两份。

// 上游把特殊分组的条目在名字前加一个符号（U+1F51E）作为分组标记。
// 这里用 unicode 转义来匹配，源码里不出现符号本身；命中的归入 premium 组，默认不输出。
const RESTRICTED_RE = /\u{1F51E}/u;

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** 去掉上游名字里的装饰符号，保留分组标记 */
export function cleanName(raw) {
  let n = String(raw || '').trim();
  n = n.replace(/🎬|📺|▶️?|🎞️?/gu, ' ');
  n = n.replace(/\s{2,}/g, ' ').trim();
  n = n.replace(/[-—–]{2,}/g, '-');       // 连续连字符压成一个
  n = n.replace(/^[-—–\s]+|[-—–\s]+$/g, '');
  return n || '未命名源';
}

/** 上游是否把该条目标记为特殊分组 */
export function isRestricted(key, site) {
  return RESTRICTED_RE.test(`${key} ${site?.name || ''}`);
}

/** 识别形如 https://xxx/?url=<目标接口> 的 CORS 中转包装 */
export function unwrapProxy(api) {
  const m = /^(https?:\/\/[^/]+\/)\?url=(.+)$/i.exec(api || '');
  if (!m) return null;
  let inner = m[2];
  try {
    inner = decodeURIComponent(inner);
  } catch {
    /* 原样使用 */
  }
  return { wrapper: m[1], inner };
}

/** 把完整接口拆成 baseUrl + path（供手动粘贴导入使用） */
export function splitPath(fullApi) {
  const api = fullApi.replace(/\?.*$/, '');
  const tail = '/provide/vod';
  if (api.endsWith(tail)) return { baseUrl: api.slice(0, -tail.length), path: tail };
  const idx = api.lastIndexOf('/');
  if (idx <= api.indexOf('://') + 2) return { baseUrl: api, path: '/' };
  return { baseUrl: api.slice(0, idx), path: api.slice(idx) };
}

/**
 * 生成一个 LunaTV 条目对应的 KVideo 源。
 * 返回 { source, manual, alternatives }
 *   source       : 订阅用源（searchPath 为空，baseUrl 为完整接口）
 *   manual       : 手动粘贴用源（可能为 null，例如 CORS 中转源）
 *   alternatives : 探测候选，按优先级排列 [{baseUrl, searchPath, detailPath, label}]
 */
export function toKVideoSource(key, site, { id, resolveProxy = false } = {}) {
  const api = String(site?.api || '').trim();
  if (!api) return null;

  const name = cleanName(site?.name);
  const group = isRestricted(key, site) ? 'premium' : 'normal';
  const sourceId = id || slugify(key || api);

  const proxied = unwrapProxy(api);
  const alternatives = [];

  if (proxied) {
    // 直连原站优先，其次走中转（两种中转写法都试）
    alternatives.push({
      baseUrl: proxied.inner,
      searchPath: '',
      detailPath: '',
      label: 'direct',
    });
    alternatives.push({
      baseUrl: `${proxied.wrapper}?url=${encodeURIComponent(proxied.inner)}`,
      searchPath: '',
      detailPath: '',
      label: 'proxy-encoded',
    });
    alternatives.push({
      baseUrl: `${proxied.wrapper}?url=${proxied.inner}`,
      searchPath: '',
      detailPath: '',
      label: 'proxy-raw',
    });
  } else {
    alternatives.push({ baseUrl: api, searchPath: '', detailPath: '', label: 'direct' });
  }

  // resolveProxy=false（默认）：上游给什么就写什么，中转源保留 ?url= 原样
  // resolveProxy=true（--probe）：先按候选顺序试通，再回写能用的那个
  const primary = proxied && !resolveProxy ? { baseUrl: api } : alternatives[0];
  const source = {
    id: sourceId,
    name,
    baseUrl: primary.baseUrl,
    searchPath: '',
    detailPath: '',
    group,
    enabled: true,
    priority: 1,
    // 便于排查，KVideo 会忽略未知字段
    _homepage: site?.detail || '',
    _lunatvKey: key,
  };

  let manual = null;
  if (!proxied) {
    const { baseUrl, path } = splitPath(api);
    manual = { ...source, baseUrl, searchPath: path, detailPath: path };
    delete manual._homepage;
    delete manual._lunatvKey;
  }

  return { source, manual, alternatives };
}

/** LunaTV 配置对象 -> 源数组（保持上游顺序，id 冲突自动加后缀） */
export function normalizeConfig(config, { overrides = {}, resolveProxy = false } = {}) {
  const apiSite = config?.api_site || config?.apiSite || {};
  const used = new Map();
  const out = [];
  const skipped = [];

  const renameMap = overrides.rename || {};
  const exclude = new Set(overrides.exclude || []);
  const groupOverride = overrides.group || {};

  for (const [key, site] of Object.entries(apiSite)) {
    if (!site || typeof site !== 'object') continue;
    if (site.disabled) {
      skipped.push({ key, reason: 'upstream-disabled' });
      continue;
    }
    let id = slugify(key);
    if (!id) id = slugify(site.api || 'src');
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.set(id, true);

    if (exclude.has(id) || exclude.has(key)) {
      skipped.push({ key, id, reason: 'overrides-exclude' });
      continue;
    }

    const built = toKVideoSource(key, site, { id, resolveProxy });
    if (!built) {
      skipped.push({ key, id, reason: 'no-api' });
      continue;
    }
    if (renameMap[id]) built.source.name = renameMap[id];
    if (groupOverride[id]) built.source.group = groupOverride[id];
    if (built.manual) {
      built.manual.name = built.source.name;
      built.manual.group = built.source.group;
    }
    out.push(built);
  }

  return { sources: out, skipped };
}
