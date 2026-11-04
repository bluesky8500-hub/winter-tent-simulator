---
type: decision
status: accepted
updated: 2026-11-04
tags: [decision, data, privacy, publishing]
---

# 데이터 권한과 공개 범위

## 결정

- `db/catalog.sqlite`를 제품·모듈·옵션·가격 Claim·채택값·충돌 검증의 Single Source of Truth로 사용한다.
- PDF·엑셀·기존 HTML 등 사용자 제공 원본은 수정하지 않고 공개 저장소에 올리지 않는다.
- `wiki/`는 DB와 원본에서 파생된 설명·비교·질문을 담으며 계산용 원본으로 사용하지 않는다.
- 공개 GitHub 저장소에는 검토한 SQLite, 코드, 지침, 위키 Markdown을 보존한다. SQLite는 Pages가 읽는 JSON의 원본이다.
- 공개 GitHub Pages 산출물에는 DB에서 생성한 JSON과 프런트엔드만 포함한다. SQLite·위키 Markdown·원본 PDF·엑셀은 Pages에 넣지 않는다.
- 2026-11-04 사용자 요청으로 위키를 Cloud의 세션 간 맥락 자료로 사용한다. 공개 저장소에 올리기 전 민감 정보와 오래된 결론을 검토한다.

## 이유

위키는 연결과 종합에 강하지만 값의 이력·적용 조건·채택 상태를 엄격히 계산하기에는 SQLite 구조가 적합하다. 두 역할을 분리하면 설명을 풍부하게 만들면서도 가격 계산과 출처 추적의 정확성을 유지할 수 있다.

## 영향

새 사실을 위키에서 발견해도 DB Claim과 채택 이력을 먼저 갱신하지 않으면 시뮬레이터 계산에는 반영하지 않는다.

이 결정은 2026-11-03의 '위키 비공개' 초안을 공개 저장소와 Cloud 작업에 맞게 갱신한 것이다. 과거 초안은 로컬 원본에 남아 있다.
