# 국회 요구자료 접수·배분 도구

국회 자료요구서를 문항별로 접수하고, 배분기준표에 따른 소관 과 후보를 확인하는 **교육용 시제품**입니다. 배분 가능한 과는 제공된 A부 조직도 26개 과로 제한하며, 최종 배분은 담당자가 확정합니다.

## 사용하기

- [시작 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/)
- [접수·배분 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html)

| 배포 서비스 | 화면 | Python 실행 역할 |
|---|---|---|
| GitHub Pages | [교육용 화면](https://dltjdfhr8-maker.github.io/national-assembly-request-tool/web/assign.html) | 정적 파일 제공 |
| Vercel | [접수·배분](https://national-assembly-request-tool-six.vercel.app/web/assign.html) | [교육용 추천 API](https://national-assembly-request-tool-six.vercel.app/api/recommend?sample=T01)를 요청마다 Python으로 실행 |
| Netlify | [접수·배분](https://national-assembly-request-tool.netlify.app/assign.html) | 배포 시 Python 규칙 엔진으로 [결과 JSON](https://national-assembly-request-tool.netlify.app/generated/python-check.json)을 생성하고, [실시간 API 경로](https://national-assembly-request-tool.netlify.app/api/recommend?sample=T01)는 Vercel Python API로 전달 |

두 서비스의 Python 예시는 `data/시험_요구문항_40건.csv`에 있는 **교육용 시험번호**만 받습니다. 실제 요구자료나 임의의 문항 내용을 서버로 보내는 API는 제공하지 않습니다. Vercel과 Netlify는 GitHub `main` 브랜치에 연결되어 이후 push하면 자동으로 다시 배포됩니다.

GitHub Pages는 `main` 브랜치의 `/ (root)`에서 제공됩니다. 웹 파일은 `web/`에 그대로 있으며, 주소 끝에 `/web/` 또는 `/web/assign.html`을 붙여 엽니다.

1. 접수·배분 화면에서 교육용 PDF 여러 건 또는 문항목록 CSV를 선택합니다.
2. 담당자를 입력하고 미리보기를 확인한 뒤 접수 등록합니다.
3. 문항별 후보와 근거를 살펴보고 주관 과·협조 과를 정합니다.
4. 개별 또는 선택 문항을 확정합니다. 확정한 배분은 사유를 남기고 취소할 수 있습니다.

현재 기록은 **해당 브라우저의 `localStorage`에만 저장**됩니다. 다른 기기와 공유되지 않으며, 브라우저 기록을 지우거나 화면의 `저장 기록 초기화`를 누르면 복구할 수 없습니다.

## 현재 구현 범위

| 구현됨 | 아직 구현되지 않음 |
|---|---|
| PDF·CSV 접수, 문항 분해, 규칙 기반 후보 3순위 표시, 담당자 배분 확정·취소, 브라우저별 기록 | 현업 회신 화면, 취합·누락 검사 화면, 여러 사용자 간 공유 저장, 결재·국회 제출 |

규칙 후보는 참고용입니다. 동순위·무매칭·불일치와 검사 이상은 담당자가 `확인필요`로 검토해야 합니다. 답변 작성과 최종 제출은 도구의 범위에 포함되지 않습니다.

## 로컬에서 열기

저장소 최상위 폴더에서 다음 명령을 실행한 뒤 `http://localhost:8000/web/`을 엽니다. 브라우저에서 파일을 직접 여는 방식은 CSV 읽기가 동작하지 않을 수 있습니다.

```bash
python -m http.server 8000
```

## 자료와 안전

이 저장소의 예시는 교육용 가상 자료입니다. 공개 Pages에 실제 요구자료나 개인정보를 입력하지 마세요. 브라우저에 입력한 기록도 현재는 접근 권한 관리나 중앙 백업이 없습니다. `.env`, `node_modules/`, 캐시와 생성 결과는 `.gitignore`로 제외합니다.

주요 파일은 `web/`(화면과 규칙 엔진), `data/`(조직도·배분기준표·시험 자료), `원문/`(교육용 PDF), `PROGRESS.md`(작업 기록), `CONTEXT.md`(자료 색인)입니다.

## 근거 및 검증

- 기능 범위: `00_문제정의/problem.md`의 「④ 범위」, `design.md`의 「2. 화면」
- 검증 기준: `00_문제정의/problem.md`의 「⑤ 검증 기준」
- 현재 결과와 남은 일: `PROGRESS.md`의 최근 작업 기록

규칙의 원천은 `data/배분기준표_소관키워드_304건.csv`이며, 화면은 `web/data/rules_보강.csv`와 `web/data/A부_조직도_26개과.csv`를 읽습니다.
