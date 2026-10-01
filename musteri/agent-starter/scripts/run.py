"""Fresh subprocess per case. The adapter integrates the user's existing harness."""
import argparse
import json
import subprocess
import time
from pathlib import Path
from baseline import analyze

ROOT=Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--split',choices=['dev','test','all'],default='dev')
    p.add_argument('--mode',choices=['baseline','agent'],required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--timeout',type=float,default=120)
    p.add_argument('--adapter',nargs=argparse.REMAINDER)
    a=p.parse_args()
    if a.mode=='agent' and not a.adapter: p.error('agent mode requires --adapter COMMAND ... as last argument')
    if a.timeout<=0: p.error('timeout must be positive')
    a.out.mkdir(parents=True,exist_ok=True)
    preset=ROOT/'runtime/preset'
    instruction=(preset/'SYSTEM_PROMPT.md').read_text(encoding='utf-8')+'\n\n'+(preset/'POLICY.md').read_text(encoding='utf-8')
    schema=json.loads((preset/'output.schema.json').read_text(encoding='utf-8'))
    paths=sorted((ROOT/'runtime/cases').glob(f'{"*" if a.split=="all" else a.split}/*/input.json'))
    failures=0
    for path in paths:
        c=json.loads(path.read_text(encoding='utf-8')); start=time.monotonic()
        record={'case_id':c['case_id'],'mode':a.mode,'status':'ok'}
        try:
            if a.mode=='baseline': result=analyze(c)
            else:
                payload={'preset_id':'invoice-reviewer-v1','fresh_session':True,'system_prompt':instruction,
                         'input':c,'output_schema':schema,'request':(path.parent/'request.txt').read_text(encoding='utf-8')}
                r=subprocess.run(a.adapter,input=json.dumps(payload,ensure_ascii=False),text=True,
                    encoding='utf-8',capture_output=True,timeout=a.timeout,check=False)
                if r.returncode: raise RuntimeError(f'adapter exit code {r.returncode}; inspect adapter logs')
                result=json.loads(r.stdout)
            if not isinstance(result,dict): raise ValueError('output must be one JSON object')
            (a.out/f'{c["case_id"]}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired) as e:
            failures+=1; record.update(status='error',error=str(e))
        record['elapsed_seconds']=round(time.monotonic()-start,4)
        with (a.out/'run_log.jsonl').open('a',encoding='utf-8') as f: f.write(json.dumps(record,ensure_ascii=False)+'\n')
        print(c['case_id'],record['status'])
    print(json.dumps({'cases':len(paths),'failures':failures,'mode':a.mode}))
    return 1 if failures else 0

if __name__=='__main__':
    raise SystemExit(main())

