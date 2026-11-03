# Codex Cloud 인수인계 — 겨울 장박 텐트 시뮬레이터

## 저장소와 범위

- 공개 개발 저장소: `bluesky8500-hub/winter-tent-simulator`
- 배포 사이트: `https://bluesky8500-hub.github.io/winter-tent-simulator/`
- 이 저장소는 정적 사이트의 공개 소스만 담는다. `deploy-source/catalog.public.json`은 로컬 `db/catalog.sqlite`에서 생성한 공개용 사본이다.
- 원본 SQLite, 판매페이지 PDF, 엑셀, 마스터 문서, 내부 검증 기록은 공개 저장소에 없다. Cloud에서 이 자료가 필요한 데이터 변경은 추정하지 말고 사용자에게 비공개 제공 경로를 요청한다.

## 구현된 기능

- 쿠디·에어노크·캠빌 제품과 모듈 선택, 유료 옵션 수량, 기본 포함품과 사은품 표시.
- 가격 내역: 기본가, 모듈 교체금, 옵션, 할인, 배송비. 미확인 금액이 있으면 확인된 소계만 표시한다.
- 01 BUILD에서 확인된 본체 치수로 텐트를 드래그·회전하고 기본 연결부와 선택한 커넥터의 연결 대상을 기록한다.
- 03 FIT에서 01의 배치를 한 묶음으로 이동하고 본체 배치 경계의 가로·세로·면적을 표시한다.
- 도킹 호환성과 사이트 치수 판단을 분리한다. 커넥터의 미확인 전체 설치 면적, 가이라인, 차량, 동선은 면적에 더하지 않는다.
- 조합을 브라우저에 저장하고 선택한 저장 조합끼리 제품·옵션 금액, 별도 배송비, 구성품, 배치 크기를 표로 비교한다.
- 조합 JSON 내보내기·가져오기. 브라우저 간 자동 동기화는 없다.
- 공개 JSON에는 채택값과 필요한 검증 정보만 담고 원본 개인 자료는 배포하지 않는다.

## 파일과 데이터 흐름

- `src/main.js`: 화면과 조합 상태.
- `src/engine.js`: 가격·옵션·도킹 규칙.
- `src/fit-board.js`: 01 배치판과 03에 쓰는 경계 계산.
- `src/scenario-file.js`: 조합 파일 검증·공유.
- `deploy-source/catalog.public.json`: 로컬 SQLite에서 추출한 공개용 입력. Cloud의 원본 DB가 아니다.
- `scripts/build-frontend.mjs`, `scripts/generate-browser-data.mjs`, `scripts/check-dist.mjs`: 정적 빌드 및 공개 파일 허용 목록 검사.
- `.github/workflows/pages.yml`: `main` push 시 테스트·빌드·GitHub Pages 배포.

## 실행과 검증

Node.js 24 이상을 사용한다. 외부 npm 의존성은 없다.

```sh
node --test tests/public.test.js
node scripts/build-frontend.mjs
node scripts/generate-browser-data.mjs
node scripts/check-dist.mjs
```

`dist/`가 배포 산출물이다. GitHub Actions가 저장소 이름에 따른 base path를 설정한다. 변경 후 모바일 폭에서도 01 배치판, 03 재현, 05 가로 스크롤 표를 확인한다.

## 남은 작업과 주의점

- 해피패밀리 기본 연결부는 공개 데이터에 3.6×0.6m로 기록돼 있다. 쿠디 PRO 커넥터 폭 0.1m는 사용자 확인값이며, 나머지 커넥터의 미확인 치수와 공식 완성 외곽은 추정하지 않는다.
- 2026-11-03 사용자 직접 확인: 에어노크 8.0T는 해피패밀리 ST·타프쉘터와 커넥터 없이 도킹 가능하다. 공개 사본의 `airnok8St`·`airnok8Tarp` 규칙에 반영했다. 비공개 원본 SQLite에도 같은 근거를 반영한 뒤 공개 사본을 다시 추출해야 한다.
- 03의 면적은 본체 위치를 감싸는 경계 사각형이며 본체 면적의 합이나 실제 점유 면적이 아니다.
- 브라우저 로컬 저장소의 조합은 다른 기기로 자동 동기화되지 않는다.
- 쿠디 8.0 PRO 배송비, 옵션 단독 구매 배송비, 해피패밀리 별도 정면 TPU 옵션의 적용 대상, SKY 교체 구성과 일부 도킹 외곽은 미확인이다.
- Claim, 출처, 채택값과 충돌 이력은 로컬 SQLite가 기준이다. 공개 JSON을 임의로 새 사실의 원본으로 삼지 않는다.
- 공개 저장소에 `catalog.sqlite`, PDF, 엑셀, 개인 자료, API 키, 토큰, 로컬 작업 기록을 추가하지 않는다.

## Cloud 작업 방식

공식 OpenAI Docs에 따르면 Codex Cloud는 GitHub 저장소를 선택한 환경에서 작업하며 PC가 꺼져 있어도 진행할 수 있다. 모바일에서는 기존 Cloud 환경을 선택해 작업한다. 새 환경 생성은 웹 또는 데스크톱에서 먼저 수행한다. GitHub 연결과 저장소 선택은 사용자가 직접 승인한 뒤 진행한다.
