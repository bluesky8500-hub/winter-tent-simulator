# Codex Cloud 인수인계

- 개인 GitHub 저장소: `bluesky8500-hub/winter-tent-simulator`
- GitHub Pages: <https://bluesky8500-hub.github.io/winter-tent-simulator/>
- Node.js 24 이상, 외부 npm 의존성 없음. `npm run build`로 DB 검증, JSON 생성·비교, 계산 테스트, 프런트엔드 빌드, 배포 파일 검사를 실행한다.
- `db/catalog.sqlite`가 원본이며 제품·옵션·가격·배송비·도킹 규칙, Source, 전체 Claim, 채택 이력, 검증 대장과 변경 이력을 담는다.
- `deploy-source/catalog.public.json`은 클라우드 전환 직전 공개 JSON의 보존 스냅샷이다. CI는 SQLite에서 생성한 현재 JSON과 의미상 동등한지 검사한다. 승인된 데이터 변경 시 DB와 함께 갱신한다.
- 판매페이지 PDF·엑셀·기존 마스터는 저장소에 없다. PDF 새 사실은 원본이나 확인 가능한 출처를 받은 뒤 반영한다. 에어노크 7.0T 판매페이지는 클라우드 JSON에 기록된 출처 메타데이터만 보존했다.
- SQLite는 공개 GitHub 저장소의 소스 파일로 관리하지만 Pages의 `dist/`에는 포함되지 않는다. 민감정보·절대경로 검사는 `scripts/validate-catalog.mjs`, 배포 파일 검사는 `scripts/check-dist.mjs`가 담당한다.
- 2026-11-04 이전 공개 상태는 Git 태그 `pre-cloud-ssot-2026-11-04`(커밋 `2f07c2d`)로 보존했다.

현재 화면은 01에서 모듈·옵션 선택과 텐트 배치, 03에서 전체 배치 검토, 05에서 저장 조합 비교를 제공한다. 가격은 기본가·교체금·옵션·할인·배송비를 분리하며 미확인 금액이 있으면 최종 총액을 확정하지 않는다. 조합 저장은 브라우저별 로컬 저장소이고 JSON 내보내기·가져오기로 공유한다.

미확인 사항에는 쿠디 10.0 PRO 바닥 소재 표기 범위, 에어노크 7.0T 중량 16.5/16.8kg, 7.0T 일부 옵션 가격·포함 관계·도킹 외곽, 옵션 단독 구매 및 합배송 조건, 일부 커넥터 치수와 설치 여유가 있다. DB의 검증 대장을 확인하고 임의로 해소하지 않는다.

데이터 변경·마이그레이션 절차는 [데이터 작업 지침](docs/DATA_WORKFLOW.md)을 따른다.
