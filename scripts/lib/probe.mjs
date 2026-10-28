// 源可用性探测：按 KVideo 真实请求方式验证（baseUrl + searchPath + ?ac=detail&wd=..&pg=1）
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(baseUrl, searchPath, params) {
  // 与 KVideo lib/api/search-api.ts 完全一致：字符串拼接后再用 URL 解析
  const url = new URL(`${baseUrl}${searchPath || ''}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text.trim());
    } catch {
      data = null;
    }
    return { status: res.status, ok: res.ok, data, text };
  } finally {
    clearTimeout(timer);
  }
}

function looksForbiddenKeyword(data) {
  if (!data) return false;
  const msg = String(data.msg || data.message || '');
  return /forbid|not allow|不允许|禁止|无权|关键词/i.test(msg) || data.code === 1002;
}

function countList(data) {
  if (!data) return 0;
  const list = data.list || data.data || [];
  return Array.isArray(list) ? list.length : 0;
}

function isUsable(data) {
  if (!data || typeof data !== 'object') return false;
  const code = data.code;
  const codeOk = code === undefined || code === 0 || code === 1 || code === '1' || code === '0';
  return codeOk && (Array.isArray(data.list) || Array.isArray(data.data));
}

/**
 * 探测单个候选地址。
 * @returns {{ok:boolean, status:string, latency:number, hits:number, detail:string}}
 */
export async function probeCandidate(candidate, { keyword, timeoutMs = 12000, retries = 1 } = {}) {
  const start = Date.now();
  let lastDetail = '';
  let keywordForbidden = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(600 * attempt);
    try {
      const searchUrl = buildUrl(candidate.baseUrl, candidate.searchPath, {
        ac: 'detail',
        wd: keyword,
        pg: 1,
      });
      const r = await getJson(searchUrl, timeoutMs);

      if (!r.ok) {
        lastDetail = `HTTP ${r.status}`;
        continue; // 5xx/403 允许重试
      }
      if (!r.data) {
        lastDetail = 'non-json';
        continue;
      }
      if (looksForbiddenKeyword(r.data)) {
        keywordForbidden = true;
        lastDetail = String(r.data.msg || 'keyword search forbidden');
        break;
      }
      if (!isUsable(r.data)) {
        lastDetail = `code=${r.data.code ?? '-'} msg=${String(r.data.msg || '').slice(0, 40)}`;
        continue;
      }

      // 搜索接口通了，再看是否真能返回条目（空列表也算接口可用，单独标记）
      const hits = countList(r.data);
      if (hits > 0) {
        return {
          ok: true,
          status: 'ok',
          latency: Date.now() - start,
          hits,
          detail: `搜索命中 ${hits} 条`,
          url: searchUrl,
        };
      }

      // 空列表：用 ac=list 复核接口是否活着
      const listUrl = buildUrl(candidate.baseUrl, candidate.searchPath, { ac: 'list', pg: 1 });
      const lr = await getJson(listUrl, timeoutMs);
      if (lr.ok && isUsable(lr.data) && countList(lr.data) > 0) {
        return {
          ok: true,
          status: 'empty-search',
          latency: Date.now() - start,
          hits: 0,
          detail: '搜索返回空，列表接口正常',
          url: searchUrl,
        };
      }
      return {
        ok: true,
        status: 'ok',
        latency: Date.now() - start,
        hits: 0,
        detail: '接口可达，搜索无结果',
        url: searchUrl,
      };
    } catch (e) {
      lastDetail = e.name === 'AbortError' ? 'timeout' : e.message || String(e);
    }
  }

  // 关键词搜索被禁：KVideo 只能搜索，基本不可用，但仍记录
  if (keywordForbidden) {
    return {
      ok: false,
      status: 'list-only',
      latency: Date.now() - start,
      hits: 0,
      detail: lastDetail || '禁止关键词搜索（KVideo 依赖搜索）',
    };
  }

  return {
    ok: false,
    status: /timeout/i.test(lastDetail) ? 'timeout' : 'unreachable',
    latency: Date.now() - start,
    hits: 0,
    detail: lastDetail || '连接失败',
  };
}

/** 依次尝试候选，返回第一个可用的（含实际使用的 baseUrl） */
export async function probeWithFallback(alternatives, opts) {
  let best = null;
  for (const candidate of alternatives) {
    const result = await probeCandidate(candidate, opts);
    const record = { ...result, candidate };
    if (result.ok) return record;
    if (!best) best = record;
  }
  return best || { ok: false, status: 'unreachable', latency: 0, hits: 0, detail: '无候选地址' };
}

/** 固定并发池 */
export async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
