import os
import json

def check():
    tenants_dir = os.path.expanduser("~/.dsh/tenants")
    print(f"=== CHECKING {tenants_dir} ===")
    if os.path.exists(tenants_dir):
        for t in os.listdir(tenants_dir):
            p_dir = os.path.join(tenants_dir, t, "presets")
            print(f"Tenant: {t}")
            if os.path.exists(p_dir):
                for f in os.listdir(p_dir):
                    print(f"  Preset file: {f}")
                    try:
                        with open(os.path.join(p_dir, f), "r", encoding="utf-8") as pf:
                            data = json.load(pf)
                            print(f"    id: {data.get('id')}")
                            print(f"    name: {data.get('name')}")
                            print(f"    tools: {data.get('enabledTools') or data.get('tools')}")
                            print(f"    modelId: {data.get('modelId')}")
                            print(f"    providerId: {data.get('providerId')}")
                            print(f"    temperature: {data.get('temperature')}")
                            print(f"    responseFormat: {data.get('responseFormat')}")
                            print(f"    systemPrompt preview: {str(data.get('systemPrompt'))[:100]}...")
                    except Exception as e:
                        print(f"    error: {e}")
            else:
                print(f"  No presets dir in {t}")

    global_dir = os.path.expanduser("~/.dsh/agent-presets")
    print(f"=== CHECKING {global_dir} ===")
    if os.path.exists(global_dir):
        for f in os.listdir(global_dir):
            print(f"  Global file: {f}")
            try:
                with open(os.path.join(global_dir, f), "r", encoding="utf-8") as pf:
                    data = json.load(pf)
                    print(f"    id: {data.get('id')}")
                    print(f"    name: {data.get('name')}")
            except Exception as e:
                print(f"    error: {e}")

if __name__ == "__main__":
    check()
