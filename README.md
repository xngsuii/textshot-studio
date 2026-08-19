# textshot studio

텍스트와 HTML을 이미지로 발췌하는 개인용 도구.

- **텍스트 발췌** — 지문을 붙여넣고 타이포를 다듬어 세로로 긴 이미지로 저장
- **HTML** — 완성된 HTML/CSS를 붙여넣고 지정한 너비로 캡쳐

빌드 도구 없이 도는 정적 사이트라 파일을 push하면 그대로 배포된다.

## 로컬에서 열기

`index.html`을 브라우저로 바로 열면 ES 모듈이 `file://`에서 막히므로 간단한 정적 서버가 필요하다.

```
python -m http.server 8080
```

## 마커

편집기에서 버튼으로 넣거나 직접 입력한다.

| 마커 | 결과 |
|---|---|
| `**굵게**` | 굵게 |
| `*행동지문*` | 보조색 + 기울임 |
| `"대사"` | 따옴표색 (곧은·둥근 따옴표 모두) |
| `_기울임_` | 기울임 |
| `---` | 구분선 |
| `===` | 분할선 — 여기서 이미지를 나눈다 |

`===` 분할선만 자동 서식 설정과 무관하게 항상 동작한다.

## 폰트

| 폰트 | 출처 |
|---|---|
| Pretendard | jsDelivr |
| Noto Sans KR / Noto Serif KR / 나눔명조 / 고운바탕 | Google Fonts |
| 마루 부리 / KoPub 돋움 / KoPub 바탕 / 조선일보명조 | 직접 넣기 — `assets/fonts/README.md` 참고 |

캡쳐할 때 폰트를 이미지에 심으려면 폰트 서버가 CORS를 허용해야 한다. Google Fonts·jsDelivr·unpkg는 허용하므로 문제없다.

## 구조

```
index.html
css/    tokens.css  app.css
js/     main.js  store.js  markup.js  ui.js
        text-tab.js  html-tab.js  templates.js
        capture.js  fonts.js
vendor/ modern-screenshot.mjs  jszip.min.js
assets/fonts/
```

캡쳐는 `js/capture.js` 하나에 모여 있다. 브라우저 렌더링이 한계에 부딪히면 이 파일만 갈아끼우면 된다.

## 아직 없는 것

- 채팅형 / 혼합형 (말풍선, 영역 지정, 프로필)
- HTML 탭의 클릭 → 코드 이동
