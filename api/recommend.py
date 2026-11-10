"""교육용 시험 문항만 대상으로 하는 Vercel Python 함수."""

import csv
import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from 소관과_추천 import 소관과_추천


TEST_DATA = Path(__file__).resolve().parents[1] / "data" / "시험_요구문항_40건.csv"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        sample = parse_qs(urlparse(self.path).query).get("sample", ["T01"])[0]
        with TEST_DATA.open(encoding="utf-8-sig", newline="") as source:
            row = next((item for item in csv.DictReader(source) if item["시험번호"] == sample), None)
        if row is None:
            self._json(404, {"error": "교육용 시험번호를 찾지 못했습니다."})
            return
        self._json(200, {"시험번호": sample, "요구내용": row["요구내용"], "추천": 소관과_추천(row["요구내용"])})

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
