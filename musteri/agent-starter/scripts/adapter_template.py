"""Integration boundary; intentionally fails until connected to your real harness.

stdin: {preset_id, fresh_session, system_prompt, input, output_schema, request}
stdout: only the final InvoiceReviewV1 JSON object. Logs go to stderr.
Create a NEW session each call. Close it on success/failure. Do not use shared memory.
"""
import json
import sys

def invoke_existing_harness(request):
    # Map to your actual server SDK, HTTP API, or CLI here. No endpoint is assumed.
    # Pass system_prompt as trusted instruction; serialize input as untrusted user data.
    # Enforce preset capability restrictions on the server, not via the prompt alone.
    # Return the parsed final JSON (not stream events or reasoning_content).
    raise NotImplementedError('Connect invoke_existing_harness() to your actual harness API/CLI.')

if __name__=='__main__':
    try:
        request=json.load(sys.stdin)
        result=invoke_existing_harness(request)
        if not isinstance(result,dict): raise ValueError('Harness must return a JSON object')
        print(json.dumps(result,ensure_ascii=False))
    except Exception as e:
        print(f'{type(e).__name__}: {e}',file=sys.stderr)
        raise SystemExit(2)

