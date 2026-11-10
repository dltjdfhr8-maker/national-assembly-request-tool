"""Netlify 빌드에서 Python 규칙 엔진 실행 결과를 정적 JSON으로 만든다."""

import csv
import json
from pathlib import Path

from 소관과_추천 import 소관과_추천


ROOT = Path(__file__).resolve().parent
with (ROOT / "data" / "시험_요구문항_40건.csv").open(encoding="utf-8-sig", newline="") as source:
    row = next(item for item in csv.DictReader(source) if item["시험번호"] == "T01")

target = ROOT / "web" / "generated" / "python-check.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(
    json.dumps({"시험번호": "T01", "추천": 소관과_추천(row["요구내용"])}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Python 규칙 엔진 빌드 완료: {target}")
