import asyncio
import json
import sys
import requests
import websockets

async def test():
    # 1. Create session
    r = requests.post("http://127.0.0.1:3080/api/sessions", json={"title": "Eval Test Session"})
    r.raise_for_status()
    session_data = r.json()
    session_id = session_data["id"]
    print(f"[DEBUG] Created session: {session_id}", file=sys.stderr)

    # 2. Connect to WS
    uri = "ws://127.0.0.1:3080/ws"
    async with websockets.connect(uri) as ws:
        print("[DEBUG] Connected to WS", file=sys.stderr)

        payload = {
            "type": "chat",
            "sessionId": session_id,
            "prompt": 'Sadece şu JSON çıktısını döndür, başka hiçbir şey yazma: {"status": "ok"}',
            "presetId": "invoice-reviewer-v1",
            "userId": "user_admin"
        }
        await ws.send(json.dumps(payload))
        print("[DEBUG] Sent chat directive", file=sys.stderr)

        accumulated_text = ""
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=60)
            data = json.loads(raw_msg)
            mtype = data.get("type")
            print(f"[DEBUG] Event: {mtype}", file=sys.stderr)
            if mtype == "chunk":
                accumulated_text += data.get("text", "")
            elif mtype == "done":
                final = data.get("response") or accumulated_text
                print(f"[DEBUG] Done! Response: {final[:200]}...", file=sys.stderr)
                return final
            elif mtype == "error":
                err = data.get("error", "Unknown error")
                print(f"[DEBUG] Error event: {err}", file=sys.stderr)
                raise RuntimeError(err)

if __name__ == "__main__":
    res = asyncio.run(test())
    print("FINAL RESULT:", res)
