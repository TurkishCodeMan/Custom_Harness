"""Export ONLY model-visible files; never include answers or benchmark scripts."""
import argparse
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def main():
    choices=sorted(p.parent.name for p in (ROOT/'runtime/cases').glob('*/*/input.json'))
    p=argparse.ArgumentParser(); p.add_argument('--case',required=True,choices=choices)
    p.add_argument('--out',type=Path,required=True); a=p.parse_args()
    split='dev' if a.case.startswith('D') else 'test'
    case=ROOT/f'runtime/cases/{split}/{a.case}'
    a.out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(a.out,'x',zipfile.ZIP_DEFLATED) as z:
        for name in ['SYSTEM_PROMPT.md','POLICY.md','output.schema.json','preset.json']:
            z.write(ROOT/'runtime/preset'/name,name)
        for name in ['input.json','request.txt']: z.write(case/name,name)
    print(a.out)
if __name__=='__main__': main()

