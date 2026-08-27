/* PNG 안에 원문 한 벌을 심고 다시 꺼낸다.

   PNG 는 IHDR 과 IEND 사이에 아무 청크나 끼워 넣어도 되고, 모르는 청크는
   그림 프로그램이 조용히 지나친다. 그 성질을 빌려 iTXt 청크 하나를 쓴다.
   (텍스트 청크 셋 중 UTF-8 을 담을 수 있는 건 iTXt 뿐이다. 한글이 들어가니
    latin1 만 되는 tEXt·zTXt 는 못 쓴다.)

   주의 — 카카오톡·디스코드·트위터처럼 올린 사진을 다시 인코딩하는 곳을
   거치면 이 청크는 사라진다. 파일 그대로 주고받은 것만 되살릴 수 있다. */

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const KEYWORD = 'textshot';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* 브라우저가 가진 압축기를 쓴다. deflate 는 PNG 가 요구하는 zlib 형식 그대로다. */
async function through(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const deflate = (b) => through(b, new CompressionStream('deflate'));
const inflate = (b) => through(b, new DecompressionStream('deflate'));

export const canEmbed = () => typeof CompressionStream === 'function';

/* 길이 + 이름 + 내용 + CRC. PNG 청크 한 덩어리의 생김새다. */
function makeChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function itxtData(text) {
  const enc = new TextEncoder();
  const kw = enc.encode(KEYWORD);
  const body = await deflate(enc.encode(text));
  const data = new Uint8Array(kw.length + 5 + body.length);
  data.set(kw, 0);
  let p = kw.length;
  data[p++] = 0;   // 이름 끝
  data[p++] = 1;   // 압축했음
  data[p++] = 0;   // 압축 방식 — zlib
  data[p++] = 0;   // 언어 태그 없음
  data[p++] = 0;   // 옮긴 이름 없음
  data.set(body, p);
  return data;
}

/* PNG 블롭에 정보를 심어 새 블롭을 돌려준다. PNG 가 아니면 손대지 않는다. */
export async function embed(blob, obj) {
  if (!canEmbed()) return blob;
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < 20 || !SIG.every((b, i) => buf[i] === b)) return blob;
  // IHDR 은 언제나 첫 청크다. 그 바로 뒤가 우리 자리.
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const at = 8 + 12 + dv.getUint32(8);
  if (at > buf.length) return blob;
  const chunk = makeChunk('iTXt', await itxtData(JSON.stringify(obj)));
  return new Blob([buf.subarray(0, at), chunk, buf.subarray(at)], { type: 'image/png' });
}

/* 파일에서 심어 둔 정보를 꺼낸다. 없으면 null. */
export async function extract(file) {
  let buf;
  try { buf = new Uint8Array(await file.arrayBuffer()); } catch { return null; }
  if (buf.length < 8 || !SIG.every((b, i) => buf[i] === b)) return null;

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = dv.getUint32(p);
    if (len < 0 || p + 12 + len > buf.length) return null;
    const type = dec.decode(buf.subarray(p + 4, p + 8));
    if (type === 'IEND') return null;
    if (type === 'iTXt') {
      const data = buf.subarray(p + 8, p + 8 + len);
      const z = data.indexOf(0);
      if (z > 0 && dec.decode(data.subarray(0, z)) === KEYWORD) {
        const packed = data[z + 1] === 1;
        let q = data.indexOf(0, z + 3) + 1;   // 언어 태그를 건너뛴다
        q = data.indexOf(0, q) + 1;           // 옮긴 이름도
        if (q <= 0 || q > data.length) return null;
        try {
          const body = data.subarray(q);
          return JSON.parse(dec.decode(packed ? await inflate(body) : body));
        } catch { return null; }
      }
    }
    p += 12 + len;
  }
  return null;
}
