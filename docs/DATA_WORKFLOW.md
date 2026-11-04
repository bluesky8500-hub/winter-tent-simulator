# SQLite 데이터 작업 지침

## 원본과 배포

`db/catalog.sqlite`가 유일한 데이터 원본이다. `deploy-source/catalog.public.json`은 직전 공개 버전과의 대조용 스냅샷이고 `catalog.generated.json`은 빌드 때 DB에서 생성하는 임시 파일이다. GitHub Pages에는 `dist/catalog.json`만 포함된다.

`npm run build`는 DB 무결성·외래키·개인정보 패턴·채택값을 검사하고, JSON을 생성해 보존 스냅샷과 비교하며, 가격·도킹·배치 테스트를 실행한다. 데이터 변경을 승인받아 반영한 경우 `node scripts/export-public-data.mjs db/catalog.sqlite deploy-source/catalog.public.json`로 스냅샷을 갱신하고 다시 빌드한다. 생성된 JSON을 손으로 편집하지 않는다.

## 출처와 충돌

새 사실은 `source`에 출처를 등록하고 `claim`에 원문 값·범위·조건을 별도 기록한다. 같은 항목의 다른 값은 기존 Claim을 수정하지 않고 새 Claim과 `verification` 충돌 항목을 추가한다. 계산에 쓸 값은 사용자 확인 또는 확인 가능한 근거가 있을 때만 `adoption_history`에 추가한다. 기존 채택행은 남긴다. 미확인 수치·도킹 호환성·설치 여유는 계산하지 않는다.

구조 데이터 변경은 `catalog_row_history`에 전후 JSON과 근거를 남기고, 한 번만 적용되는 마이그레이션 ID를 `catalog_migration`에 기록한다. 이번 병합의 재현 코드는 `scripts/migrate-cloud-catalog.mjs`다. 신규 마이그레이션은 별도 파일로 추가하고 기존 파일이나 이전 DB 기록을 다시 쓰지 않는다.

## Git의 SQLite 바이너리 충돌

DB 파일을 동시에 두 브랜치에서 수정하면 Git이 행 단위로 병합할 수 없다. 데이터 작업 브랜치는 최신 `main`에서 시작하고 한 번에 하나만 병합한다. 충돌 시 어느 한쪽 SQLite를 임의로 선택하지 말고 두 DB를 백업한 뒤 각 브랜치의 마이그레이션을 순서대로 재실행해 새 DB를 만든다. `catalog_row_history`와 보존 JSON으로 전후 차이를 검증한다.

## 판매페이지 원본

PDF는 저작권과 파일 크기 때문에 저장소에 올리지 않는다. `source`에는 출처 식별 정보만 두며 공개가 필요한 구체 문구·이미지는 별도 권리 검토 후 관리한다. 에어노크 7.0T PDF는 이 저장소에 없으므로 기존 클라우드 JSON의 기록을 보존하되 추가 PDF 사실 검증은 원본 확보 후 진행한다.
