// Base58 (Bitcoin alphabet) 解码 —— LunaTV 的 .txt 配置就是整份 JSON 的 base58 编码
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP = new Map([...ALPHABET].map((c, i) => [c, BigInt(i)]));

export function base58Decode(str) {
  const s = String(str).trim();
  let num = 0n;
  for (const ch of s) {
    const v = MAP.get(ch);
    if (v === undefined) throw new Error(`非法 base58 字符: ${ch}`);
    num = num * 58n + v;
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let out = Buffer.from(hex, 'hex');
  // 前导 '1' 表示前导 0 字节
  let zeros = 0;
  for (const ch of s) {
    if (ch === '1') zeros++;
    else break;
  }
  if (zeros > 0) out = Buffer.concat([Buffer.alloc(zeros), out]);
  return out.toString('utf8');
}

export function base58Encode(input) {
  const buf = Buffer.from(typeof input === 'string' ? input : JSON.stringify(input), 'utf8');
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out || '1';
}

/** 自动识别 base58 文本 / JSON 对象 / JSON 字符串 */
export function parseConfigPayload(payload) {
  if (payload && typeof payload === 'object') return payload;
  const text = String(payload).trim();
  if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
  return JSON.parse(base58Decode(text));
}
