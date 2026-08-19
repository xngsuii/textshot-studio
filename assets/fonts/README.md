# 폰트 파일 넣는 곳

CDN에 없는 폰트는 여기에 `.woff2` 파일을 직접 넣어야 목록에서 선택할 수 있다.
파일이 없으면 폰트 목록에 `— 파일 없음`으로 표시된다.

## 필요한 파일 이름

정확히 이 이름으로 넣을 것. (`js/store.js`의 `FONTS`와 맞춰져 있다.)

| 폰트 | 파일 이름 | 받는 곳 |
|---|---|---|
| 마루 부리 | `MaruBuri-Regular.woff2`, `MaruBuri-Bold.woff2` | 네이버 클로바 나눔글꼴 배포 페이지 |
| KoPub 돋움 | `KoPubWorldDotum-Medium.woff2`, `KoPubWorldDotum-Bold.woff2` | 한국출판인회의 |
| KoPub 바탕 | `KoPubWorldBatang-Medium.woff2`, `KoPubWorldBatang-Bold.woff2` | 한국출판인회의 |
| 조선일보명조 | `ChosunilboNM.woff2` | 조선일보 |

## ttf/otf를 woff2로 바꾸기

내려받은 파일이 `.ttf`나 `.otf`라면 변환해야 한다. 웹 변환기(예: cloudconvert, transfonter)에 넣고
woff2로 받으면 된다. 용량이 1/3 정도로 줄어든다.

## 라이선스

각 폰트의 라이선스 원문(`.txt`)을 폰트 파일 옆에 같이 넣어 둘 것.
대부분의 무료 한글 폰트가 요구하는 건 이 정도다.

- 폰트 파일을 사이트에서 내려받게 하는 링크는 만들지 않는다
- 사용 중인 폰트의 출처를 README에 남긴다
