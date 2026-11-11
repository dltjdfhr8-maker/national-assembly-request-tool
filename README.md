# 국회 요구자료 접수·배분 도구

국회 자료요구서를 문항별로 접수하고, 배분기준표에 따른 소관 과 후보를 확인하는 **교육용 시제품**입니다. 배분 가능한 과는 제공된 A부 조직도 26개 과로 제한하며, 최종 배분은 담당자가 확정합니다.

## 사용하기

- [시작 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/)
- [접수·배분 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html)
- [현업 회신 화면](./web/dept.html)
- [취합·확정 화면](./web/collect.html)

| 배포 서비스 | 화면 | Python 실행 역할 |
|---|---|---|
| GitHub Pages | [교육용 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html) | 정적 파일 제공 |
| Vercel | [시작 화면](https://national-assembly-request-tool-six.vercel.app/) · [접수·배분](https://national-assembly-request-tool-six.vercel.app/web/assign.html) · [현업 회신](https://national-assembly-request-tool-six.vercel.app/web/dept.html) · [취합](https://national-assembly-request-tool-six.vercel.app/web/collect.html) | 계정 접근 보호 아래 Python 추천 API, `/api/app` 서버 함수와 비공개 Blob 저장 |
| Netlify | [접수·배분](https://national-assembly-request-tool.netlify.app/assign.html) | 배포 시 Python 규칙 엔진으로 40개 교육용 결과를 만들고 자체 함수가 `/api/recommend?sample=T01`로 제공. 화면 기록은 브라우저에 저장 |

Python 예시는 `data/시험_요구문항_40건.csv`에 있는 **교육용 시험번호**만 받습니다. Vercel과 Netlify는 GitHub `main` 브랜치에 연결되어 이후 push하면 자동으로 다시 배포됩니다.

GitHub Pages는 `main` 브랜치의 `/ (root)`에서 제공됩니다. 웹 파일은 `web/`에 그대로 있으며, 주소 끝에 `/web/` 또는 `/web/assign.html`을 붙여 엽니다.

1. 접수·배분 화면에서 교육용 PDF 여러 건 또는 문항목록 CSV를 선택합니다.
2. 담당자를 입력하고 미리보기를 확인한 뒤 접수 등록합니다.
3. 문항별 후보와 근거를 살펴봅니다. Vercel 화면에서 규칙 후보가 없을 때만 `AI 추천`을 눌러 다른 색으로 표시된 AI 후보를 볼 수 있습니다.
4. 개별 또는 선택 문항을 확정합니다. 확정한 배분은 사유를 남기고 취소할 수 있습니다.
5. 시작 화면에서 과별 주관·협조 건수를 차트와 정렬·검색 가능한 표로 확인하고 엑셀로 내려받습니다.
6. 현업 회신 화면에서 내 과를 선택하고 회신 엑셀·메모를 제출하거나 사유를 적어 재배정을 요청합니다.
7. 취합 화면에서 확인필요·미회신 과를 검토하고 보완요청 또는 확정을 기록한 뒤 제출본 엑셀·Markdown을 내려받습니다.

새 화면 코드는 주소가 `*.vercel.app`이면 `/api/app`에서 공유 기록을 읽고 상태 변경을 요청합니다. 다른 주소에서는 해당 브라우저의 `localStorage`를 사용합니다. 저장 위치는 각 화면 상단에 표시됩니다. 서버 연결 오류가 나면 브라우저 저장으로 자동 전환하지 않습니다.

서버용 `api/app.js`와 상태 규칙 `web/flow.js`를 사용합니다. 브라우저 배분 화면과 서버는 같은 상태 규칙 함수를 사용합니다. `GET /api/app`은 문항 배열 전체를 읽고, `POST /api/app`은 접수·배분·회신·재배정요청·보완요청·확정과 AI 추천을 처리합니다. AI 추천은 요구내용만 OpenAI Chat Completions에 보내며 `gpt-4o-mini`, `temperature: 0`, JSON 응답을 사용합니다. 결과는 조직도 26개 과 안에서 최대 3개로 제한하고 최종 배분은 담당자가 확정합니다.

서버는 비공개 Vercel Blob의 `cases.json` 하나를 사용하며 `BLOB_READ_WRITE_TOKEN`은 Vercel 프로젝트의 서버 환경변수에만 둡니다. AI 추천용 `OPENAI_API_KEY`도 Vercel 프로젝트 **Settings → Environment Variables**에 서버 환경변수로 설정합니다. 키가 없으면 추천 요청은 안내 문구와 함께 HTTP 500을 반환합니다. 키를 `web/`이나 GitHub에 넣지 마세요. Vercel 전체 주소는 Vercel 계정 접근 보호로 제한합니다. **과 선택 자체는 사용자 권한 확인이 아니므로 실제 자료를 입력하지 마세요.** 테스트는 `node test_api.js`와 `node test_validate.js`로 실행할 수 있습니다.

## 현재 구현 범위

| 구현됨 | 아직 구현되지 않음 |
|---|---|
| PDF·CSV 접수, 문항 분해, 규칙 기반 후보 3순위 표시, 규칙 후보가 없을 때 AI 추천, 유사 문항 검색, 담당자 배분 확정·취소, 과거 520건 이력, 현업 회신 엑셀·재배정 화면, 취합·확인필요·보완요청·확정, 검증용 접수대장 점검, 제출본 엑셀·Markdown, 주소별 브라우저/서버 저장 선택, 서버 상태 함수·비공개 Blob 연결 | 사용자별 과 권한 확인, 결재·국회 제출 |

규칙 후보는 참고용입니다. 동순위·무매칭·불일치와 검사 이상은 담당자가 `확인필요`로 검토해야 합니다. 답변 작성과 최종 제출은 도구의 범위에 포함되지 않습니다.

## 로컬에서 열기

저장소 최상위 폴더에서 다음 명령을 실행한 뒤 `http://localhost:8000/web/`을 엽니다. 브라우저에서 파일을 직접 여는 방식은 CSV 읽기가 동작하지 않을 수 있습니다.

```bash
python -m http.server 8000
```

## 자료와 안전

이 저장소의 예시는 교육용 가상 자료입니다. 공개 Pages에 실제 요구자료나 개인정보를 입력하지 마세요. 브라우저에 입력한 기록도 현재는 접근 권한 관리나 중앙 백업이 없습니다. `.env`, `node_modules/`, 캐시와 생성 결과는 `.gitignore`로 제외합니다.

주요 파일은 `web/`(화면과 규칙 엔진), `data/`(조직도·배분기준표·시험 자료), `원문/`(교육용 PDF), `PROGRESS.md`(작업 기록), `CONTEXT.md`(자료 색인)입니다.

브라우저에서는 pdf.js(PDF), Papa Parse(CSV), Fuse.js(유사 검색), Chart.js(과별 차트), Tabulator(정렬·검색 표), SheetJS(회신 엑셀 읽기·현황 및 제출본 파일 작성)를 사용합니다. 외부 라이브러리의 버전·출처·라이선스 링크는 `web/lib/THIRD_PARTY.md`에 기록했습니다.

## 근거 및 검증

- 기능 범위: `00_문제정의/problem.md`의 「④ 범위」, `design.md`의 「2. 화면」
- 검증 기준: `00_문제정의/problem.md`의 「⑤ 검증 기준」
- 현재 결과와 남은 일: `PROGRESS.md`의 최근 작업 기록

규칙의 원천은 `data/배분기준표_소관키워드_304건.csv`이며, 화면은 `web/data/rules_보강.csv`와 `web/data/A부_조직도_26개과.csv`를 읽습니다.
