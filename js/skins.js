/* 스킨 — 말풍선 색만 잠깐 덮어씌운다.

   건드리는 것 — 프로필마다의 말풍선·글자·이름·따옴표·괄호 색, 그 다섯 가지.
   건드리지 않는 것 — 배경, 지문 색, 말풍선 모양·모서리·간격, 프로필 사진 모양,
                      이름·사진 표시 여부. 전부 네가 정한 대로 둔다.

   골라 둔 색을 고치지 않는다. 그릴 때만 스킨의 값을 얹고,
   「없음」으로 돌리면 원래 색이 그대로 돌아온다.

   색 한 벌의 값
     '#RRGGBB'      그 색으로 덮는다
     'transparent'  말풍선을 지운다 (말풍선 색에만)
     'keep'         프로필이 가진 색을 그대로 둔다 (키를 빼도 같다)
     'lift'         프로필이 가진 색을 어두운 바탕에서 읽히게 밝힌다
     'sink'         프로필이 가진 색을 밝은 바탕에서 읽히게 어둡게 한다

   화자를 따옴표 색으로 가려 쓰는 일이 많다. 그래서 따옴표 색은 웬만하면
   두고, 바탕이 확 바뀌어 못 읽게 되는 자리만 손댄다. */

const hex2rgb = (h) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(h).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgb2hex = (r, g, b) => '#' + [r, g, b]
  .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
  .join('').toUpperCase();

/* 밝기만 옮기고 색상은 그대로 둔다. 「누구의 색인지」는 알아볼 수 있게.
   dir 이 'up' 이면 어두운 바탕용으로 밝히고, 'down' 이면 밝은 바탕용으로 낮춘다. */
function shift(hexColor, dir) {
  const rgb = hex2rgb(hexColor);
  if (!rgb) return hexColor;
  const [r, g, b] = rgb.map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  // 이미 그 바탕에서 읽히는 밝기면 손대지 않는다
  if (dir === 'up' ? l >= 0.66 : l <= 0.45) return hexColor;
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = d ? Math.min(1, (d / (1 - Math.abs(2 * l - 1))) * 1.08) : 0;
  const L = dir === 'up' ? 0.72 : 0.32;
  const c = (1 - Math.abs(2 * L - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m2 = L - c / 2;
  const k = Math.floor(h * 6) % 6;
  const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return rgb2hex((t[0] + m2) * 255, (t[1] + m2) * 255, (t[2] + m2) * 255);
}

export const SKINS = [
  {
    id: 'imessage',
    label: '아이메시지',
    right: {
      bubbleBg: '#007AFF', textColor: '#FFFFFF',
      nameColor: '#8E8E93', quoteColor: '#FFFFFF', parenColor: '#CFE3FF',
    },
    left: {
      bubbleBg: '#E9E9EB', textColor: '#1A1A1A',
      nameColor: '#8E8E93', parenColor: '#8E8E93',
    },
  },
  {
    id: 'kakao',
    label: '카카오톡',
    note: '왼쪽 말풍선이 흰색입니다. 캔버스 배경을 조금 어둡게(예: #B2C7D9) 두면 살아납니다.',
    right: {
      bubbleBg: '#FEE500', textColor: '#1A1A1A',
      nameColor: '#6B7C8A', quoteColor: '#1A1A1A', parenColor: '#7C6F16',
    },
    left: {
      bubbleBg: '#FFFFFF', textColor: '#1A1A1A',
      nameColor: '#6B7C8A', parenColor: '#8C9594',
    },
  },
  {
    id: 'dark',
    label: '다크',
    note: '캔버스 배경을 어둡게(예: #16181B) 두면 어울립니다. 지문 색은 색상 탭에서 따로 맞추세요.',
    right: {
      bubbleBg: '#14746F', textColor: '#FFFFFF',
      nameColor: '#8C9594', quoteColor: '#FFFFFF', parenColor: '#A8D5D2',
    },
    left: {
      bubbleBg: '#24282D', textColor: '#E3E6E9',
      nameColor: '#8C9594', quoteColor: 'lift', parenColor: '#7A8085',
    },
  },
  {
    id: 'clear',
    label: '투명',
    note: '말풍선만 지웁니다. 밝은 바탕에서 안 보일 만큼 옅은 글자색은 읽히게 낮춥니다.',
    right: {
      bubbleBg: 'transparent', textColor: 'sink',
      quoteColor: 'sink', parenColor: 'sink',
    },
    left: {
      bubbleBg: 'transparent', textColor: 'sink',
      quoteColor: 'sink', parenColor: 'sink',
    },
  },
];

export const skinById = (id) => SKINS.find(s => s.id === id) || null;

/* 미리보기 칩에 쓰는 차례 — 이름표도 이 순서다 */
export const CHIP_KEYS = ['bubbleBg', 'textColor', 'nameColor', 'quoteColor', 'parenColor'];
export const CHIP_LABELS = ['말풍선', '글자', '이름', '따옴표', '괄호'];

/* 색 한 벌의 값 하나를 실제 색으로 푼다. 풀 수 없으면 null. */
export function resolve(v, base) {
  if (v === undefined || v === 'keep') return base ?? null;
  if (v === 'lift' || v === 'sink') {
    return base ? shift(base, v === 'lift' ? 'up' : 'down') : null;
  }
  return v;
}

/* 스킨을 얹은 프로필. 이름·위치·사진·표시 여부는 건드리지 않는다. */
export function skinProfiles(profiles, id) {
  const skin = skinById(id);
  if (!skin) return profiles;
  return profiles.map((p) => {
    const set = p.side === 'right' ? skin.right : skin.left;
    if (!set) return p;
    const q = { ...p };
    for (const k of CHIP_KEYS) {
      const v = resolve(set[k], p[k]);
      if (v) q[k] = v;
    }
    return q;
  });
}
