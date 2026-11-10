"""원문 자료요구서 PDF를 문항별 CSV로 분리한다."""

import csv
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "원문"
OUTPUT = ROOT / "data" / "문항목록.csv"
COLUMNS = ["파일명", "위원회", "의원", "제출기한", "문항번호", "요구내용", "세부항목", "비고"]
TITLE = re.compile(r"^(.+?위원회)\s+(.+?)\s+의원실\s+자료요구서$")
DATE = re.compile(r"제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.")
ITEM = re.compile(r"^(\d+)\.\s*(.*)$")
SUBITEM = re.compile(r"^[가-하]\.\s*.*$")
EXPECTED = re.compile(r"_(\d+)문항\.pdf$")


def split_pdf(path):
    pages = PdfReader(path).pages
    lines = [line.strip() for page in pages for line in (page.extract_text() or "").splitlines()]
    lines = [line for line in lines if line]
    if not lines:
        raise ValueError(f"텍스트를 추출할 수 없음: {path.name}")
    title = TITLE.fullmatch(lines[0])
    if not title:
        raise ValueError(f"첫 줄 형식 오류: {path.name}")
    deadline_line = next((line for line in lines if line.startswith("수신:")), "")
    date = DATE.search(deadline_line)
    if not date:
        raise ValueError(f"제출기한을 찾을 수 없음: {path.name}")
    year, month, day = map(int, date.groups())
    deadline = f"{year:04d}-{month:02d}-{day:02d}"

    rows = []
    current = None
    field = "요구내용"
    for line in lines[1:]:
        if line.startswith(("수신:", "담당 보좌관:", "끝.")):
            continue
        number = ITEM.match(line)
        if number:
            current = dict.fromkeys(COLUMNS, "")
            current.update(파일명=path.name, 위원회=title[1], 의원=title[2],
                           제출기한=deadline, 문항번호=number[1], 요구내용=number[2])
            rows.append(current)
            field = "요구내용"
            continue
        if current is None:
            raise ValueError(f"첫 문항 전 예기치 않은 줄: {path.name}")
        if SUBITEM.match(line):
            field = "세부항목"
        elif line.startswith("※"):
            field = "비고"
            line = line.removeprefix("※").strip()
        separator = " / " if field == "세부항목" else "\n"
        current[field] += (separator if current[field] else "") + line

    expected_match = EXPECTED.search(path.name)
    if not expected_match:
        raise ValueError(f"파일명 문항 수를 읽을 수 없음: {path.name}")
    expected = int(expected_match[1])
    numbers = [int(row["문항번호"]) for row in rows]
    continuous = numbers == list(range(1, len(rows) + 1))
    ok = len(rows) == expected and continuous
    return rows, expected, numbers[-1] if numbers else 0, continuous, ok


def main():
    paths = sorted(SOURCE.glob("자료요구서_*.pdf"))
    if len(paths) != 3:
        raise ValueError(f"PDF 3건이 필요함: 현재 {len(paths)}건")
    all_rows = []
    checks = []
    for path in paths:
        rows, expected, last, continuous, ok = split_pdf(path)
        all_rows.extend(rows)
        checks.append((path.name, expected, len(rows), last, continuous, ok))
    print("파일명 | 파일명의 문항 수 | 뽑은 문항 수 | 마지막 번호 | 번호 연속 | 일치(O/X)")
    for name, expected, count, last, continuous, ok in checks:
        print(f"{name} | {expected} | {count} | {last} | {'O' if continuous else 'X'} | {'O' if ok else 'X'}")
    if not all(check[-1] for check in checks):
        raise ValueError("문항 수 또는 번호가 일치하지 않아 CSV를 만들지 않음")
    with OUTPUT.open("x", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)


if __name__ == "__main__":
    main()
