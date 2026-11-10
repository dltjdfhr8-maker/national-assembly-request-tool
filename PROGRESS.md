# PROGRESS.md — 작업 기록 (에이전트가 작업 시작 전에 먼저 읽고, 매일 종료 전 갱신)

| 날짜 | 단계 | 완료 | 남은 일 | 막힌 점 / 질문 |
|---|---|---|---|---|
| 2026-11-09 | 문제정의 | `00_문제정의/problem.md` 5칸 표 작성. 접수대장 520행, 소관 450건·공통 70건 확인. 시험 40건 중 1순위 30건 이상(75% 이상) 목표 명시 | 실제 추천 결과로 정확도 검증 | 발생 건수·처리 시간은 접수대장에서 확인 불가 |
| 2026-11-09 | 설계 | `design.md`에 흐름·역할·화면 4개·데이터 2개·상태·`/api/app`·S3~S8 연결 작성 | 구현과 검증은 착수 전 | 답변 작성·결재·제출은 범위 밖 |
| 2026-11-09 | 문서 탐색 규칙 | `AGENTS.md`를 현재 폴더 구조에 맞게 보완하고 `CONTEXT.md`의 설계서 경로·지침 자료 목록을 바로잡음 | 확정 지침이 생기면 색인과 충돌 여부 갱신 | 현재 `처리지침.md` 없음 |
| 2026-11-09 | 하네스 완성 | 기존 세 파일을 유지하며 실제 자료 경로·우선순위·안전 규칙·진행 상태를 확인하고 보완 | 다음 요청 시 `design.md`의 S3부터 착수 | `cases.json`과 실행 코드는 아직 없음 |
| 2026-11-09 | 처리지침 초안 | `처리지침_초안.md`에 7개 장 19개 조, 별표 4개 작성. 조직도 26행·배분기준표 304행·접수대장 사례 24건을 전사하고 `CONTEXT.md`에 색인 추가 | 확정본을 받으면 세 범주(확정본만/초안만/서로 다름)로 조문별 비교 | `처리지침.md` 확정본이 작업 폴더와 상위 배포 폴더에서 확인되지 않음. 초안의 확인 필요 질문 5개 |
| 2026-11-09 | 확정본 비교 | 사용자 제공 `C:/Users/peter/Downloads/처리지침.md`와 초안 조문·별표를 대조하고 세 범주의 차이를 `처리지침_초안.md`에 기록. 배분기준표 304개 규칙 값 일치 확인 | 초안을 확정본에 맞춰 개정할지는 별도 작업 | 배분 이견 기산점 등 차이는 표에 기록 |
| 2026-11-10 | 소관 과 추천 함수 | `소관과_추천.py` 작성. 기준표 304행의 키워드·제외어·우선순위를 읽고 조직도 26개 과로 제한. 시험 40건 1순위 26건 정답 | 30/40 목표 달성을 위한 기준표·추천 방식 검토 | 예산 집행 등 범용 키워드의 높은 우선순위가 구체 소관 키워드보다 앞서는 사례가 있음 |
| 2026-11-10 | 숨은 시험 비교 | `05_비교실험_숨은시험세트/채점기.py`로 A(하네스없음) 10/30, B(공통툴) 30/30 확인. 문항별 결과와 비교표 저장. 두 쪽 모두 조직도 밖 과·실행 오류 0건 | 제공 시험 40건의 30/40 목표는 별도로 개선·검증 필요. 숨은 시험은 각 1회 실행 결과 | 없음 |
| 2026-11-10 | 원문 PDF 문항 분리 | `pypdf` 설치 확인, `split.py`와 UTF-8-SIG `data/문항목록.csv` 신규 작성. PDF 3건의 25·34·19문항, 총 78문항 번호 연속 및 파일명 수 일치 확인. 파일별 세부항목·비고 문항 1개씩 원문 대조, 연락처·보좌관 정보 미포함 확인 | 없음 | 없음 |
| 2026-11-10 | 문항목록 생성 스킬 | 교체된 `C:/Users/peter/Downloads/문항목록.csv`와 프로젝트 CSV의 동일성을 확인. `split.py`의 세부항목 구분자와 비고 표기를 교체본에 맞춰 수정하고, `skills/pdf-question-list` 스킬을 작성·설치. 원문 3건에서 재생성한 78행이 교체본과 전부 일치함을 확인 | 없음 | 없음 |
| 2026-11-10 | 프로젝트 문항 분리 스킬 | `.agents/skills/split-request/SKILL.md`에 `name`·`description`, PDF 문항 분리 절차와 파일별 문항 수·번호 연속·원문 대조·교체본 전체 셀 비교 기준을 기록 | 없음 | 없음 |
| 2026-11-10 | 기존 스킬 동기화 | `skills/pdf-question-list/SKILL.md`와 설치된 동일 스킬에 `[확인]` 기준(파일별 일치 표, 원문 3문항 대조, 교체본 전체 셀 비교)을 반영하고 두 파일 동일성 확인 | 없음 | 없음 |
| 2026-11-10 | 행정문서 작성 스킬 적용 | 다른 작업 폴더의 `ai-friendly-report` 스킬을 현재 폴더 `.agents/skills/ai-friendly-report/SKILL.md`로 복사. 원본과 파일 동일성 및 근거 HWPX 존재 확인 | 없음 | 없음 |
| 2026-11-10 | 조직도 JSON 변환 | `to_json.js`를 작성해 `data/A부_조직도_26개과.csv`의 실국·과·대표키워드를 `org.json`으로 변환. 대표키워드를 `|` 기준 배열로 분리하고 실행 결과 26개 원소 확인 | 없음 | 없음 |
| 2026-11-10 | 배분 규칙 엔진 | `web/engine.js`가 기준표 CSV·조직도 CSV를 읽어 최대 3개 후보와 점수·근거키워드를 반환하도록 작성. `test_engine.js` 시험 40건 결과 1순위 28/40, 3순위 안 40/40; 브라우저 방식 CSV 읽기와 후보 반환도 확인 | 기존 문제정의서의 1순위 30/40 목표는 미달. 점수식이 사용자 지정 방식이므로 기준표·정렬 방식 변경은 별도 검토 | 범용 예산·언론 키워드가 구체 소관보다 앞서는 사례 12건 |
| 2026-11-10 | 배분 규칙 정확도 보강 | 사용자 선택에 따라 원본 304행은 그대로 두고 `data/rules_보강.csv`의 R136 민원 서비스 1→3, R181 지방채 1→2, R211 안전등급 1→3만 변경. 시험 1순위 28/40→31/40(T11·T15·T18 개선), 접수대장 441/520→441/520, 두 자료 새 오답 0건 확인. 조건 충족으로 배포 키트의 양식을 복사해 `.agents/skills/add-assign-rule/SKILL.md` 저장 | 남은 시험 오답 9건은 별도 검토 | 범용 예산·언론 규칙이 여전히 일부 구체 소관보다 앞섬 |
| 2026-11-10 | 접수·배분 화면 | `web/index.html`, `web/assign.html`, `web/split.js`, `web/common.js`, 화면 스크립트·스타일 작성. 보강 기준표·조직도와 pdf.js를 `web/data`, `web/lib`에 복사. 로컬 서버에서 PDF 3건→25·34·19문항(총 78), 기준 CSV 전 셀 일치, CSV 접수 78문항, 배분확정 2건 및 새로고침 후 유지 확인 | S6 현업 회신·S8 취합 화면 연결 | 현재 저장은 브라우저별 localStorage이며 공유되지 않음 |
| 2026-11-10 | 브라우저 기록 초기화 | 시작·배분 화면에 `저장 기록 초기화` 단추를 추가. 삭제 전 문항 수와 이력 삭제 범위를 확인하고 해당 앱의 localStorage 키만 제거. 취소 시 78건 유지, 확인 시 0건 및 미리보기 초기화, 시작 화면 0건 표시를 별도 시험 브라우저에서 확인 | 없음 | 초기화한 브라우저의 접수·배분 이력은 복구할 수 없음 |
| 2026-11-10 | 선택 확정·배분 취소 | 배분 표에 문항 선택과 선택 문항 일괄 확정, 확정 건의 배분 취소를 추가. 일괄 확정은 전체 입력 검증 후 한 번에 저장하며 취소는 사유 필수·접수 상태 복귀·이력 보존. 별도 시험 브라우저에서 2건 일괄 확정, 1건 취소, 새로고침 유지, 오류 시 0건 확정 확인 | 없음 | 없음 |
| 2026-11-10 | GitHub 공개 및 Pages | 텍스트·CSV·PDF 3건과 엑셀 7건의 셀 값을 점검하고 `.gitignore`를 추가. 공개 저장소 `dltjdfhr8-maker/national-assembly-request-tool`에 첫 커밋을 push. Pages를 `main` 브랜치의 `/ (root)`로 설정하고 `.nojekyll`을 추가해 빌드 성공 및 배포 화면 HTTP 200 확인. 배포 주소: `https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html` | 없음 | GitHub 플러그인의 저장소 생성 권한 오류로 로그인된 GitHub CLI를 사용함. 엑셀 XML의 긴 숫자는 셀 값 검사에서 개인정보 형식으로 나타나지 않음 |
| 2026-11-10 | 저장소 안내문 | `README.md`에 교육용 목적, Pages 주소, 접수·배분 사용 순서, 구현 범위, 로컬 실행, 자료 보호와 근거 문서를 정리 | 없음 | 없음 |
| 2026-11-10 | Netlify 연결 준비 | Netlify 공식 `netlify/context-and-tools` 목록에서 `netlify-skills` 플러그인 1.8.1을 Codex 사용자 설정에 설치·활성화하고, 공식 원격 MCP `https://mcp.netlify.com/mcp`를 등록해 OAuth 로그인 완료 | Netlify 사이트 생성·GitHub 저장소 연결·배포는 요청 시 진행 | 현재 대화에는 새 MCP 도구가 즉시 표시되지 않을 수 있어 다음 대화에서 사용 확인 필요 |
| 2026-11-10 | Vercel·Netlify Python 배포 | Vercel `https://national-assembly-request-tool-six.vercel.app/web/assign.html`에 Python 추천 API `/api/recommend?sample=T01`와 화면을 운영 배포. Netlify `https://national-assembly-request-tool.netlify.app/assign.html`는 배포 빌드에서 Python을 실행해 `/generated/python-check.json` 생성, `/api/recommend`를 Vercel API로 프록시. 두 프로젝트를 GitHub `main`에 연결. 커밋 `42000c2` push 뒤 두 서비스 운영 배포가 준비 완료됐고 화면·Python API 4개 주소 모두 HTTP 200 확인 | 없음 | Netlify 프로젝트 공개 설정은 사용자가 변경 |
| 2026-11-10 | Vercel 첫 주소 수정 | `/`의 HTML 재작성 때문에 `style.css`와 `common.js`가 `/`에서 404인 문제를 확인. `vercel.json`에서 `/`를 `/web/`으로 이동하도록 수정. 자동 배포 후 첫 주소 307→`/web/`, 스타일 파일과 Python API HTTP 200 확인 | 없음 | 없음 |
| 2026-11-10 | 브라우저 라이브러리 활용·공개 전 검사 | Papa Parse(CSV), Fuse.js(문항 검색), Chart.js(과별 차트), Tabulator(과별 정렬·검색 표), SheetJS(현황 엑셀 내보내기)를 화면에 연결. 기존 pdf.js 사용 확인. 브라우저에서 CSV 접수→배분확정→차트·표 반영→엑셀 다운로드 확인. 공개 대상 67파일 중 프로젝트 파일 57개에서 키·개인키·주민등록번호·휴대전화·이메일 형식 발견 0건, `.env` 추적 0개. `지침재료/00_안내.txt`가 자료를 가상 교육용으로 명시하며 PDF 3건에 가상 표시 확인 | S6 회신 엑셀 업로드·S8 취합은 별도 구현 | 자동 검사는 실제 자료 출처를 독립적으로 증명할 수 없음. 외부 라이브러리의 원본 라이선스 파일 다운로드는 자동 승인 검토에서 거절되어 `web/lib/THIRD_PARTY.md`에 출처·라이선스 링크를 기록 |

| 2026-11-10 | 서버 상태 규칙·Blob 저장 코드 | `web/flow.js`를 브라우저·서버 공통 상태 함수로 작성하고 기존 배분 화면의 접수·확정·취소에 연결. `api/app.js`의 GET/POST, `api/org.json`, `@vercel/blob` 의존성 및 `test_api.js` 가짜 저장소 시험 23개 작성. 브라우저에서 접수→배분확정→취소 확인 | 화면의 서버 저장 연결, S7 AI 추천, S8 보완요청·확정, 운영 인증·비공개 Blob 연결 | 현재 배포 화면은 localStorage를 쓰며, 서버 API는 인증 없이 공개 운영하면 자료가 노출될 수 있어 운영 배포를 하지 않음 |

| 2026-11-10 | 서버·브라우저 저장 전환과 현업 회신 화면 | `web/common.js`가 `*.vercel.app`에서 `/api/app` GET/POST, 그 밖에서 브라우저 저장을 사용하도록 수정하고 세 화면 상단에 저장 위치를 표시. `web/dept.html`에서 내 과 문항만 표시, 회신 엑셀 1·2행 검사·행 점검·메모 제출·재배정 요청 구현. `web/data/접수대장.csv` 520건을 읽기 전용으로 복사해 1순위 근거 키워드로 이력 요약·최근 5건을 배분·현업 화면에 표시. 로컬 브라우저에서 접수→배분→현업 회신→재배정 요청→다시 배분과 Vercel 주소 모의 API GET/POST·오류 시 저장 방식 유지 확인 | S7 AI 추천, S8 보완요청·확정·취합, 사용자 인증, 비공개 Blob 운영 연결 | 새 화면·서버 코드는 아직 GitHub/Vercel에 배포하지 않음. 공개 API에 인증 없이 실제 자료를 넣으면 안 됨 |
| 2026-11-10 | 회신 점검·취합·운영 배포 | `web/validate.js`, `web/collect.html`·`collect.js`, 현업 업로드 즉시 점검과 제출 재확인, 과별 취합·보완요청·확정, 차트와 제출본 엑셀 2시트·Markdown을 구현. 원본 회신 값은 유지. `flow.js`에 보완요청·재회신·확정 상태와 이력을 추가. `test_api.js` 29개, `test_validate.js`에서 가상 접수대장 120행·회신 엑셀 6개 통과(확인필요 12건). 브라우저에서 업로드→보완→재회신→확정→파일 다운로드 확인. GitHub `main`에 push 후 Vercel·Netlify 자동 배포 확인. Vercel 프로젝트 전체에 계정 접근 보호를 적용하고 비공개 Blob `cases.json` 저장소·`BLOB_READ_WRITE_TOKEN` 서버 환경변수를 연결. 의존성 보완 커밋 `b7caf94` 배포에서 `/api/app` GET `[]`, 잘못된 POST 오류 응답, 비로그인 요청 302 로그인 이동 확인. Netlify 취합·현업 화면, 검증용 CSV, 자체 `/api/recommend` 응답 HTTP 200 확인 | 실제 사용자별 과 권한 확인과 S7 AI 추천은 남음 | Vercel 계정 권한이 있는 사용자만 공유 저장 화면에 접근 가능. 과 선택은 사용자 권한 검증이 아니므로 실제 자료 입력은 보류 |
| 2026-11-10 | Vercel 접수 등록 오류 수정·복구 | 접수 19문항 중 2문항 저장 뒤 실패한 원인을 Blob 읽기의 약한 ETag(`W/`)와 조건부 저장의 강한 ETag 불일치로 확인. `api/app.js`에서 원본 ETag를 대조하고, 일시적 충돌은 최신 기록을 다시 읽어 재시도하도록 수정. `web/common.js`에서 여러 문항을 한 번에 저장하도록 변경해 중간 일부 저장을 방지. `test_api.js` 37개 통과. 기존 2문항과 원본 가상 예시의 필드가 정확히 일치하는 것을 확인한 뒤 남은 17문항을 등록; Vercel 운영 `/api/app`에서 총 19문항 모두 접수 상태·가상 예시 일치 확인 | 실제 사용자별 과 권한 확인과 S7 AI 추천은 남음 | 없음 |

## 배포 주소

| 서비스 | 접속 주소 | 역할·상태 |
|---|---|---|
| GitHub Pages | `https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/` · `https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html` | `main` 브랜치의 `/ (root)`에서 `web/` 정적 화면 제공 |
| Vercel | `https://national-assembly-request-tool-six.vercel.app/` · `https://national-assembly-request-tool-six.vercel.app/web/dept.html` · `https://national-assembly-request-tool-six.vercel.app/web/collect.html` | 계정 접근 보호 아래 정적 화면·Python 추천 API·서버 함수·비공개 Blob 공유 기록. GitHub `main` 자동 배포 |
| Netlify | `https://national-assembly-request-tool.netlify.app/assign.html` · `https://national-assembly-request-tool.netlify.app/dept.html` · `https://national-assembly-request-tool.netlify.app/collect.html` | 정적 화면·브라우저별 기록. 빌드 시 Python으로 가상 추천 결과를 생성해 Netlify 함수가 제공. GitHub `main` 자동 배포 |
| Cloudflare Workers | `https://green-term-f06a.dltjdfhr8.workers.dev/` | 사용자가 수동 업로드한 정적 화면. 사용자 확인상 작동; 이 저장소 push와 자동 연동 여부는 확인되지 않음 |
