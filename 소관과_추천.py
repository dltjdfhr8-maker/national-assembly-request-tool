"""요구 문항의 소관 과 후보를 배분기준표에서 찾는다.

실행: python 소관과_추천.py  (제공된 40건 시험)
"""

import csv
from pathlib import Path


DATA = Path(__file__).resolve().parent / "data"


def _읽기(파일명):
    with (DATA / 파일명).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def 소관과_추천(요구문항):
    """{'1순위': 과 또는 None, '후보': 목록, '상태': 문자열, '근거': 목록} 반환.

    같은 최고 우선순위에 여러 과가 있으면 확정하지 않고 확인필요로 둔다.
    """
    if not isinstance(요구문항, str) or not 요구문항.strip():
        raise ValueError("요구문항은 비어 있지 않은 문자열이어야 합니다.")

    과목록 = {행["과"] for 행 in _읽기("A부_조직도_26개과.csv")}
    점수 = {}
    근거 = {}
    for 규칙 in _읽기("배분기준표_소관키워드_304건.csv"):
        과 = 규칙["과"]
        if 과 not in 과목록:
            continue
        키워드 = 규칙["키워드"].strip()
        제외어 = [x.strip() for x in 규칙["제외어"].split("|") if x.strip()]
        if not 키워드 or 키워드.casefold() not in 요구문항.casefold():
            continue
        if any(x.casefold() in 요구문항.casefold() for x in 제외어):
            continue
        우선순위 = int(규칙["우선순위"])
        if 우선순위 > 점수.get(과, -1):
            점수[과] = 우선순위
            근거[과] = [f'{규칙["rule_id"]}: {키워드}']
        elif 우선순위 == 점수.get(과):
            근거[과].append(f'{규칙["rule_id"]}: {키워드}')

    후보 = sorted(점수, key=lambda 과: (-점수[과], 과))
    동순위 = len(후보) > 1 and 점수[후보[0]] == 점수[후보[1]]
    상태 = "확인필요" if not 후보 or 동순위 else "후보추천"
    return {
        "1순위": 후보[0] if 상태 == "후보추천" else None,
        "후보": 후보[:3],
        "상태": 상태,
        "근거": [{"과": 과, "우선순위": 점수[과], "규칙": 근거[과]} for 과 in 후보[:3]],
    }


if __name__ == "__main__":
    시험 = _읽기("시험_요구문항_40건.csv")
    정답 = 0
    for 행 in 시험:
        결과 = 소관과_추천(행["요구내용"])
        맞음 = 결과["1순위"] == 행["정답_배분과"]
        정답 += 맞음
        print(f'{행["시험번호"]}: {결과["1순위"] or "확인필요"} / 정답 {행["정답_배분과"]} / {"O" if 맞음 else "X"}')
    print(f"1순위 정답: {정답}/{len(시험)}")
