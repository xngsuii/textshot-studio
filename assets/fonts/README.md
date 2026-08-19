# 폰트 파일 넣는 곳

CDN에 없는 폰트는 여기에 `.woff2` 파일을 직접 넣어야 목록에서 선택할 수 있다.
파일이 없으면 폰트 목록에 `— 파일 없음`으로 표시된다.

## 필요한 파일 이름

정확히 이 이름으로 넣을 것. (`js/store.js`의 `FONTS`와 맞춰져 있다.)

확장자는 **`.woff2`를 권하지만 `.woff`도 된다.** woff2를 먼저 찾고 없으면 woff로 넘어간다.

| 폰트 | 파일 이름 (확장자 제외) | 받는 곳 |
|---|---|---|
| 마루 부리 | `MaruBuri-Regular`, `MaruBuri-Bold` | 네이버 나눔글꼴 배포 페이지 |
| KoPub 돋움 | `KoPubWorldDotum-Medium`, `KoPubWorldDotum-Bold` | 한국출판인회의 |
| KoPub 바탕 | `KoPubWorldBatang-Medium`, `KoPubWorldBatang-Bold` | 한국출판인회의 |
| 조선일보명조 | `ChosunilboNM` | 조선일보 |

## 왜 woff2인가

한글 폰트는 글자 수가 많아 원본이 무겁다. 같은 폰트라도 형식에 따라 용량이 크게 갈린다.

| 형식 | 대략 |
|---|---|
| ttf / otf | 4~8MB |
| woff | 3~5MB |
| woff2 | 1.5~3MB |

## ttf/otf를 woff2로 바꾸기

내려받은 파일이 `.ttf`나 `.otf`라면 변환해야 한다. 웹 변환기(transfonter, cloudconvert 등)에 넣고
woff2로 받으면 된다. transfonter는 한글만 남기는 서브셋 기능도 있어 용량을 더 줄일 수 있다.

## 라이선스

각 폰트의 라이선스 원문(`.txt`)을 폰트 파일 옆에 같이 넣어 둘 것.
대부분의 무료 한글 폰트가 요구하는 건 이 정도다.

- 폰트 파일을 사이트에서 내려받게 하는 링크는 만들지 않는다
- 사용 중인 폰트의 출처를 README에 남긴다
