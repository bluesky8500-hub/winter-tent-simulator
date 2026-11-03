# 겨울 장박 에어텐트 시뮬레이터

GitHub Pages에 배포되는 정적 사이트의 공개 소스입니다. `main`에 push하면 GitHub Actions가 계산 규칙을 테스트하고, 공개 데이터 추출본에서 브라우저용 JSON을 생성한 뒤 Pages에 배포합니다.

`deploy-source/catalog.public.json`은 비공개 `catalog.sqlite`에서 추출한 **공개용 데이터 사본**입니다. 원본 SQLite, 판매페이지 PDF, 엑셀, 마스터 문서, 내부 검토 기록은 이 저장소에 포함되지 않습니다. 원본 데이터 변경 후에는 로컬 프로젝트에서 `node scripts/export-public-data.mjs`를 실행하고 공개 소스를 다시 준비해야 합니다.

사이트의 저장 조합은 각 브라우저의 로컬 저장소에만 남으며 기기간 자동 동기화되지 않습니다. 조합 JSON 파일의 내보내기·가져오기로 공유할 수 있습니다.

PC 없이 Codex Cloud에서 개발을 이어가려면 [인수인계 문서](CLOUD_HANDOFF.md)를 읽고 [재개 프롬프트](CLOUD_RESUME_PROMPT.md)를 사용하세요. 원본 SQLite와 PDF가 필요한 데이터 수정은 공개 저장소만으로 수행할 수 없습니다.
