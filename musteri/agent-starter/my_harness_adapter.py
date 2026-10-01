import asyncio
import json
import os
import re
import sys
import requests
import websockets

BACKEND_HTTP = os.environ.get("HARNESS_HTTP", "http://127.0.0.1:3080")
BACKEND_WS = os.environ.get("HARNESS_WS", "ws://127.0.0.1:3080/ws")
WORKSPACE_DIR = os.environ.get(
    "HARNESS_WORKSPACE",
    "/home/huseyina/code_mode/custom-harness/musteri/agent-starter/workspace"
)
LOG_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "adapter_debug.log"
)

def log_debug(msg: str):
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{msg}\n")
    except Exception:
        pass
    print(msg, file=sys.stderr, flush=True)

def extract_json_object(text: str) -> dict:
    """
    Model çıktısından saf JSON objesini ayıklar.
    Düşünce bloklarını temizler ve metin içindeki geçerli ilk JSON objesini
    JSONDecoder().raw_decode ile çeker (sonrasındaki çöpleri yok sayar).
    """
    if not text or not text.strip():
        raise ValueError("Model çıktısı boş geldi")

    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()

    # 1. Doğrudan parse etmeyi dene
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # 2. Markdown kod bloğunu ara: ```json ... ```
    for block in re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE):
        candidate = block.strip()
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    # 3. Metin içindeki her '{' karakterinden itibaren geçerli bir JSON nesnesi ara
    decoder = json.JSONDecoder()
    pos = 0
    while True:
        idx = cleaned.find("{", pos)
        if idx == -1:
            break
        try:
            obj, _ = decoder.raw_decode(cleaned[idx:])
            if isinstance(obj, dict) and ("decision" in obj or "case_id" in obj):
                return obj
        except Exception:
            pass
        pos = idx + 1

    log_debug(f"[PARSE ERROR] Metin parse edilemedi. Tam ham metin:\n{text}")
    raise ValueError(f"Geçerli bir JSON objesi bulunamadı. Çıktı başı:\n{text[:300]}")

async def run_agent_case(request_payload: dict) -> dict:
    preset_id = request_payload.get("preset_id", "invoice-reviewer-v1")
    case_input = request_payload.get("input", {})
    case_id = case_input.get("case_id", "unknown")
    user_request = request_payload.get("request", "Faturayı incele ve schema ile uyumlu JSON döndür.")
    
    # Her vakaya özel izole workspace dizini (vLLM KV-cache ve dosya çakışmalarını %100 önler)
    case_workspace = os.path.join(WORKSPACE_DIR, f"case_{case_id}")
    os.makedirs(case_workspace, exist_ok=True)

    # 1. Preset dosyalarını ve vaka input.json'ını bu izole workspace'e kopyala
    preset_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runtime", "preset")
    for fname in ("POLICY.md", "output.schema.json", "SYSTEM_PROMPT.md"):
        src = os.path.join(preset_dir, fname)
        dst = os.path.join(case_workspace, fname)
        if os.path.exists(src) and not os.path.exists(dst):
            try:
                import shutil
                shutil.copy2(src, dst)
            except Exception:
                pass

    case_file = os.path.join(case_workspace, "input.json")
    try:
        with open(case_file, "w", encoding="utf-8") as f:
            json.dump(case_input, f, ensure_ascii=False, indent=2)
        log_debug(f"[ADAPTER] Case {case_id} input.json workspace'e yazıldı: {case_file}")
    except Exception as e:
        log_debug(f"[ADAPTER WARN] input.json yazılamadı: {e}")

    # 2. Yeni bir session oluştur (İzole vaka çalışma alanı ile)
    session_title = f"[Eval] Case {case_id}"
    session_id = None
    try:
        r = requests.post(
            f"{BACKEND_HTTP}/api/sessions",
            json={"title": session_title, "workspace": case_workspace},
            timeout=10
        )
        r.raise_for_status()
        session_data = r.json()
        session_id = session_data.get("id") or session_data.get("sessionId")
        log_debug(f"[ADAPTER] Case {case_id} session açıldı: {session_id} (workspace: case_{case_id})")
    except Exception as e:
        log_debug(f"[ADAPTER ERROR] Session oluşturulamadı: {e}")
        raise

    system_prompt = request_payload.get("system_prompt")

    # 3. Sade prompt
    prompt = (
        f"{user_request}\n\n"
        f"Çalışma alanındaki `input.json` dosyasını `read_file` aracıyla incele ve faturayı denetle.\n"
        f"ÖNEMLİ KURAL: İncelemeyi ve hesaplamaları bitirdiğinde, başka hiçbir metin veya açıklama eklemeden YALNIZCA geçerli tek bir JSON nesnesi döndür."
    )

    # 4. OpenAI / vLLM resmi Structured Output (json_schema) parametresi
    output_schema = request_payload.get("output_schema", {})
    clean_schema = dict(output_schema)
    clean_schema.pop("$schema", None)

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "InvoiceReviewV1",
            "strict": True,
            "schema": clean_schema
        }
    }

    accumulated_text = ""
    try:
        # 5. WebSocket'e bağlan
        async with websockets.connect(BACKEND_WS, ping_timeout=120, close_timeout=10) as ws:
            ws_payload = {
                "type": "chat",
                "sessionId": session_id,
                "prompt": prompt,
                "presetId": preset_id,
                "systemPrompt": system_prompt,
                "workspace": case_workspace,
                "userId": "user_admin",
                "responseFormat": response_format
            }
            await ws.send(json.dumps(ws_payload))

            while True:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=110)
                data = json.loads(raw_msg)
                mtype = data.get("type")
                if mtype == "tool_start":
                    call_name = data.get("call", {}).get("name", "unknown")
                    log_debug(f"[ADAPTER EVENT] tool_start -> {call_name}")
                elif mtype not in ("chunk", "thought"):
                    log_debug(f"[ADAPTER EVENT] {mtype}")

                if mtype == "chunk":
                    accumulated_text += data.get("text", "")
                elif mtype == "done":
                    final_response = data.get("response") or accumulated_text
                    log_debug(f"[ADAPTER DONE] Response length: {len(final_response)}")
                    log_debug(f"[ADAPTER RAW RESPONSE]:\n{final_response}\n---")
                    return extract_json_object(final_response)
                elif mtype == "error":
                    err_msg = data.get("error", "Bilinmeyen sunucu hatası")
                    log_debug(f"[ADAPTER ERROR EVENT] {err_msg}")
                    raise RuntimeError(f"Backend Agent Error: {err_msg}")

    finally:
        if session_id:
            try:
                requests.delete(f"{BACKEND_HTTP}/api/sessions/{session_id}", timeout=5)
            except Exception:
                pass

if __name__ == "__main__":
    try:
        input_data = json.load(sys.stdin)
        result = asyncio.run(run_agent_case(input_data))
        
        if not isinstance(result, dict):
            raise ValueError("Ajan çıktısı dict türünde bir JSON nesnesi olmalıdır")

        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        log_debug(f"[ADAPTER FATAL] {type(e).__name__}: {e}")
        sys.exit(1)
