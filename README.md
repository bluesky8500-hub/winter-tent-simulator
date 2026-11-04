# 겨울 장박 에어텐트 시뮬레이터

개인 저장소 `bluesky8500-hub/winter-tent-simulator`의 GitHub Pages 정적 사이트입니다. `db/catalog.sqlite`가 제품·출처·Claim·채택값·검증 대장·변경 이력의 원본입니다. 브라우저는 빌드 중 SQLite에서 생성한 `dist/catalog.json`만 읽습니다. SQLite와 판매페이지 PDF는 Pages 산출물에 포함되지 않습니다.

## 새 Codex Cloud 작업에서 복원

Node.js 24 이상만 필요하며 npm 패키지 설치는 필요하지 않습니다.

```sh
node scripts/validate-catalog.mjs
node scripts/export-public-data.mjs db/catalog.sqlite catalog.generated.json
node scripts/check-catalog-parity.mjs
node --test tests/public.test.js
node scripts/build-frontend.mjs
node scripts/generate-browser-data.mjs
node scripts/check-dist.mjs
```

`npm run build`도 같은 검증·빌드를 실행합니다. `main`에 반영되면 GitHub Actions가 이 과정을 반복하고 Pages에 배포합니다. 사이트 주소는 <https://bluesky8500-hub.github.io/winter-tent-simulator/>입니다.

DB 수정 절차와 출처·충돌 처리 방식은 [데이터 작업 지침](docs/DATA_WORKFLOW.md)에 있습니다. 이전 공개 JSON은 `deploy-source/catalog.public.json`에 보존해 두었으며, CI는 DB 생성 결과가 그 기준과 의미상 같은지 검사합니다. 다음 데이터 변경을 승인·검증하면 JSON 스냅샷도 DB에서 다시 생성해 갱신합니다.

이전 판단의 이유와 미해결 쟁점은 [프로젝트 위키](wiki/index.md)에서 찾을 수 있습니다. 위키는 SQLite를 대신하지 않으며, `npm run wiki:lint`로 링크와 형식을 검사합니다. 판매페이지 PDF 원본은 저장소와 Pages 산출물에 포함하지 않습니다. 위키 Markdown은 개발 저장소에만 있고 Pages 사이트에는 배포하지 않습니다.

Codex Cloud의 게시된 환경은 GitHub보다 오래된 체크아웃을 줄 수 있습니다. 최상위 `AGENTS.md`는 새 작업 시작 시 작업 트리가 깨끗하고 fast-forward 가능한 경우에만 최신 `main`으로 갱신하도록 안내합니다. 이력이 갈라지거나 갱신에 실패하면 기존 파일을 덮어쓰지 않고 보고합니다.

조합은 각 브라우저 로컬 저장소에 저장됩니다. 휴대폰끼리 자동 동기화되지 않으며 조합 JSON 내보내기·가져오기로 공유할 수 있습니다.
