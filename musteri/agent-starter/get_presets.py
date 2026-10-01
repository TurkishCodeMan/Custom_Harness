import requests
import json
import sys

try:
    res = requests.get("http://127.0.0.1:3080/api/presets", timeout=5)
    print("STATUS:", res.status_code)
    data = res.json()
    presets = data.get("presets", data) if isinstance(data, dict) else data
    if isinstance(presets, list):
        print(f"Total presets: {len(presets)}")
        for p in presets:
            print(f"- id: {p.get('id')}, name: {p.get('name')}, modelId: {p.get('modelId')}, providerId: {p.get('providerId')}")
    else:
        print(json.dumps(data, indent=2, ensure_ascii=False)[:500])
except Exception as e:
    print("Error:", e, file=sys.stderr)
