"""
gen_insights.py — Azure OpenAI로 지표별 AI 해석 배치 생성
─────────────────────────────────────────────────────────
summary.json을 읽어 각 지표별 해석을 생성하고 insights.json에 저장.
GitHub Actions에서 매일 새벽 fetch_data.py 이후 실행.

환경변수:
  AZURE_OAI_ENDPOINT   : https://xxx.openai.azure.com/
  AZURE_OAI_KEY        : Azure OpenAI API 키
  AZURE_OAI_DEPLOYMENT : 배포 이름 (예: gpt-4o-mini)

실행: python scripts/gen_insights.py
"""

import os, json, urllib.request, urllib.error, urllib.parse, datetime

# 로컬 실행 시 .env 파일 자동 로드 (python-dotenv 없으면 무시)
try:
    from dotenv import load_dotenv
    _env = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    load_dotenv(_env)
except ImportError:
    pass

SUMMARY_PATH  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "summary.json")
INSIGHTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "insights.json")

# 전체 URL이 들어와도 베이스(scheme+host)만 추출
_raw_endpoint = os.environ.get("AZURE_OAI_ENDPOINT", "").strip()
_parsed       = urllib.parse.urlparse(_raw_endpoint)
ENDPOINT      = f"{_parsed.scheme}://{_parsed.netloc}".rstrip("/")

API_KEY    = os.environ.get("AZURE_OAI_KEY", "")
DEPLOYMENT = os.environ.get("AZURE_OAI_DEPLOYMENT", "gpt-4o-mini")

# 프롬프트 로드 — scripts/prompts.json 우선, 없으면 환경변수 폴백
PROMPTS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.json")

if os.path.exists(PROMPTS_PATH):
    with open(PROMPTS_PATH, "r", encoding="utf-8") as _f:
        _p = json.load(_f)
    SYSTEM_PROMPT     = _p.get("system", "").strip()
    INDICATOR_PROMPTS = _p.get("indicators", {})
else:
    # GitHub Actions: Secret에서 읽기
    SYSTEM_PROMPT = os.environ.get("AZURE_OAI_SYSTEM_PROMPT", "").strip()
    _raw_prompts  = os.environ.get("AZURE_OAI_INDICATOR_PROMPTS", "").strip()
    INDICATOR_PROMPTS = json.loads(_raw_prompts) if _raw_prompts else {}

if not SYSTEM_PROMPT:
    raise EnvironmentError("시스템 프롬프트가 없습니다. scripts/prompts.json 또는 AZURE_OAI_SYSTEM_PROMPT 환경변수를 확인하세요.")
if not INDICATOR_PROMPTS:
    raise EnvironmentError("지표별 프롬프트가 없습니다. scripts/prompts.json 또는 AZURE_OAI_INDICATOR_PROMPTS 환경변수를 확인하세요.")


def call_azure_oai(user_prompt: str) -> str:
    url = f"{ENDPOINT}/openai/deployments/{DEPLOYMENT}/chat/completions?api-version=2025-01-01-preview"
    body = json.dumps({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt}
        ],
        "max_tokens": 1500
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=body,
        headers={"api-key": API_KEY, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {e.code} — URL: {url}\n응답: {body_err}") from e
    return data["choices"][0]["message"]["content"].strip()


def build_data_block(key: str, entry: dict) -> str:
    kpi = entry.get("kpi", {})
    s12 = entry.get("series12", [])
    series_str = ", ".join(f"{r['ym']}:{r['val']}" for r in s12)
    lines = [f"[{key} 실수치]"]
    if "cur"  in kpi: lines.append(f"현재값: {kpi['cur']}")
    if "mom"  in kpi: lines.append(f"전월비: {kpi['mom']}")
    if "yoy"  in kpi: lines.append(f"전년비: {kpi['yoy']}")
    if "avg6" in kpi: lines.append(f"6개월평균: {kpi['avg6']}")
    if series_str:    lines.append(f"최근12개월: {series_str}")
    return "\n".join(lines)


def run(summary: dict) -> dict:
    if not ENDPOINT or not API_KEY:
        print("  [gen_insights] AZURE_OAI_ENDPOINT / AZURE_OAI_KEY 없음 → skip")
        return {}

    now_kst = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    insights = {
        "generated":  now_kst.strftime("%Y%m"),
        "updated_at": now_kst.strftime("%Y-%m-%d %H:%M KST"),
    }

    for key, base_prompt in INDICATOR_PROMPTS.items():
        entry = summary.get(key)
        if not entry:
            print(f"  [{key}] summary 없음 → skip")
            continue
        try:
            data_block  = build_data_block(key, entry)
            full_prompt = base_prompt + "\n\n" + data_block
            text = call_azure_oai(full_prompt)
            insights[key] = text
            print(f"  [{key}] ✓ ({len(text)}자)")
        except Exception as e:
            print(f"  [{key}] 오류: {e}")
            insights[key] = None

    return insights


def save_insights(insights: dict):
    with open(INSIGHTS_PATH, "w", encoding="utf-8") as f:
        json.dump(insights, f, ensure_ascii=False, indent=2)


def main():
    try:
        with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
            summary = json.load(f)
    except Exception as e:
        print(f"  [오류] summary.json 읽기 실패: {e}")
        return

    print(f"Azure OpenAI ({DEPLOYMENT}) 지표 해석 생성 중…")
    insights = run(summary)
    if insights:
        save_insights(insights)
        print(f"✅ insights.json 저장 완료 ({len([k for k in insights if k not in ('generated','updated_at')])}개 지표)")


if __name__ == "__main__":
    main()
