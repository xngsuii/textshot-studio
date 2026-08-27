/* 스킨 — 정해진 겉모습을 잠깐 덮어씌운다.

   골라 둔 색을 고치지 않는다. 그릴 때만 스킨의 값을 얹어 그리고,
   「없음」으로 돌리면 원래 색이 그대로 돌아온다.

   colorset 의 값
     '#RRGGBB'  그 색으로 덮는다
     'keep'     프로필이 가진 색을 그대로 둔다 (키를 빼도 같다)
     'lift'     프로필이 가진 색을 어두운 바탕에서 읽히게 밝힌다
     'sink'     프로필이 가진 색을 밝은 바탕에서 읽히게 어둡게 한다

   화자를 따옴표 색으로 구분해 쓰는 일이 많아, 따옴표 색은 웬만하면
   건드리지 않는다. 오른쪽(본인) 말풍선처럼 바탕색이 확 바뀌는 자리만
   못 읽게 되므로 함께 덮는다. */

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
  const L = dir === 'up' ? 0.72 : 0.34;
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
    style: {
      bg: '#FFFFFF', fg: '#1A1A1A',
      bubbleStyle: 'tail', bubbleRadius: 18, avatarShape: 'circle',
      bubbleAlpha: 100, bubblePadV: 8, bubblePadH: 13,
      bubbleGap: 10, nameGap: 3, nameBold: false, bubbleMaxWidth: 72,
    },
    right: {
      bubbleBg: '#007AFF', textColor: '#FFFFFF',
      quoteColor: '#FFFFFF', parenColor: '#CFE3FF', nameColor: '#8E8E93',
    },
    left: {
      bubbleBg: '#E9E9EB', textColor: '#1A1A1A',
      parenColor: '#8E8E93', nameColor: '#8E8E93',
    },
  },
  {
    id: 'kakao',
    label: '카카오톡',
    style: {
      bg: '#B2C7D9', fg: '#1E2A33',
      bubbleStyle: 'corner', bubbleRadius: 14, avatarShape: 'square',
      bubbleAlpha: 100, bubblePadV: 8, bubblePadH: 12,
      bubbleGap: 10, nameGap: 4, nameBold: false, bubbleMaxWidth: 72,
    },
    right: {
      bubbleBg: '#FEE500', textColor: '#1A1A1A',
      quoteColor: '#1A1A1A', parenColor: '#7C6F16', nameColor: '#3B4A57',
    },
    left: {
      bubbleBg: '#FFFFFF', textColor: '#1A1A1A',
      parenColor: '#8C9594', nameColor: '#3B4A57',
    },
  },
  {
    id: 'dark',
    label: '다크',
    style: {
      bg: '#16181B', fg: '#E3E6E9',
      actionColor: '#8C9594', quoteColor: '#7FB3E0', parenColor: '#6E747A',
      dividerColor: '#2E3238', headingColor: '#F2F4F6',
      bqColor: '#4FB3AD', hlColor: '#5A4A16',
      codeBg: '#0F1113', codeFg: '#E6E9EC', codeTitleColor: '#7A848C',
      bubbleStyle: 'round', bubbleRadius: 16, avatarShape: 'circle',
      bubbleAlpha: 100, bubblePadV: 9, bubblePadH: 13,
    },
    right: {
      bubbleBg: '#14746F', textColor: '#FFFFFF',
      quoteColor: '#FFFFFF', parenColor: '#A8D5D2', nameColor: '#8C9594',
    },
    left: {
      bubbleBg: '#24282D', textColor: '#E3E6E9',
      quoteColor: 'lift', parenColor: '#7A8085', nameColor: '#8C9594',
    },
  },
  {
    id: 'paper',
    label: '종이',
    style: {
      bg: '#F6F3EC', fg: '#2B2B28',
      actionColor: '#8A8375', parenColor: '#9A9384', dividerColor: '#DCD6C8',
      headingColor: '#1F1F1C',
      bubbleAlpha: 0, bubblePadV: 0, bubblePadH: 0,
      bubbleMaxWidth: 100, bubbleGap: 14, nameGap: 4, nameBold: true,
      bubbleStyle: 'round', avatarShape: 'circle',
    },
    right: { textColor: '#2B2B28', quoteColor: 'sink', parenColor: '#9A9384', nameColor: '#8A8375' },
    left: { textColor: '#2B2B28', quoteColor: 'sink', parenColor: '#9A9384', nameColor: '#8A8375' },
  },
];

export const skinById = (id) => SKINS.find(s => s.id === id) || null;

const KEYS = ['bubbleBg', 'textColor', 'quoteColor', 'parenColor', 'nameColor', 'avatarColor'];

/* 스킨을 얹은 스타일. 스킨이 없으면 받은 것을 그대로 돌려준다. */
export function skinStyle(style, id) {
  const skin = skinById(id);
  return skin ? { ...style, ...skin.style } : style;
}

/* 스킨을 얹은 프로필. 이름·위치·사진·표시 여부는 건드리지 않는다. */
export function skinProfiles(profiles, id) {
  const skin = skinById(id);
  if (!skin) return profiles;
  return profiles.map((p) => {
    const set = p.side === 'right' ? skin.right : skin.left;
    if (!set) return p;
    const q = { ...p };
    for (const k of KEYS) {
      const v = set[k];
      if (v === undefined || v === 'keep') continue;
      if (v === 'lift' || v === 'sink') {
        if (p[k]) q[k] = shift(p[k], v === 'lift' ? 'up' : 'down');
        continue;
      }
      q[k] = v;
    }
    return q;
  });
}
