"""
fetch_price.py — 물가·금리 데이터 수집
────────────────────────────────────────────
수집 지표:
  · 소비자물가 상승률 (CPI) — ECOS 월별
  · 기준금리 — ECOS 월별

환경변수:
  ECOS_KEY  한국은행 ECOS API 인증키
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from utils import (
    load_existing, save_data, upsert,
    get_fetch_start, today_str, ecos_fetch, ecos_fetch_all
)

ECOS_KEY = os.environ["ECOS_KEY"]


def run(data: dict) -> dict:
    """data.json dict를 받아 물가·금리 지표를 갱신 후 반환"""
    today = today_str()

    # ── 소비자물가 (CPI)
    print("\n[물가금리] 소비자물가 상승률 (CPI)")
    series = data.get("cpi", [])
    rows = ecos_fetch("901Y009", "0", "M",
                      get_fetch_start(series), today[:6], ECOS_KEY)
    if rows:
        for r in rows:
            series = upsert(series, r["ym"], r["val"])
        data["cpi"] = sorted(series, key=lambda x: x["ym"])[-30:]
        print(f"  → {len(data['cpi'])}개월, 최신: {data['cpi'][-1]}")
    else:
        print("  → 데이터 없음, 기존 유지")

    # ── 기준금리 결정일 (2008-01-01 ~ 오늘, 일별 → 변경일만 추출)
    print("\n[물가금리] 기준금리 결정일")
    rows_d = ecos_fetch_all("722Y001", "0101000", "D", "20240101", today, ECOS_KEY)
    if rows_d:
        rows_d = sorted(rows_d, key=lambda x: x["ym"])  # ym = YYYYMMDD
        decisions = []
        prev_val = None
        for r in rows_d:
            if r["val"] != prev_val:
                decisions.append({"date": r["ym"], "val": r["val"]})
                prev_val = r["val"]
        data["rate_decisions"] = decisions
        print(f"  → {len(decisions)}건: {[(d['date'], d['val']) for d in decisions]}")
    else:
        print("  → 데이터 없음, 기존 유지")

    return data


def main():
    data = load_existing()
    data = run(data)
    save_data(data)
    print("\n✅ fetch_price.py 완료")


if __name__ == "__main__":
    main()
