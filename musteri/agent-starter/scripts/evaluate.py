"""Strict business-output evaluator. Does not certify actual runtime permissions."""
import argparse
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CODES=set(json.loads((ROOT/'runtime/preset/output.schema.json').read_text(encoding='utf-8'))['properties']['findings']['items']['properties']['code']['enum'])
ACTIONS={'CLEAR':'RECORD_REVIEW','REVIEW':'REQUEST_HUMAN_REVIEW','NEEDS_INFO':'REQUEST_DOCUMENTS'}

def strict_load(path):
    def pairs(items):
        out={}
        for k,v in items:
            if k in out: raise ValueError('duplicate JSON key: '+k)
            out[k]=v
        return out
    return json.loads(path.read_text(encoding='utf-8'),object_pairs_hook=pairs,
                      parse_constant=lambda x: (_ for _ in ()).throw(ValueError('nonfinite JSON')))

def evidence_ids(c):
    found={'INPUT','RECEIPTS'}
    def visit(x):
        if isinstance(x,dict):
            if isinstance(x.get('evidence_id'),str): found.add(x['evidence_id'])
            for v in x.values(): visit(v)
        elif isinstance(x,list):
            for v in x: visit(v)
    visit(c)
    return found

def validate_output(p,c):
    errors=[]
    if not isinstance(p,dict): return ['output must be an object']
    if set(p)!={'case_id','decision','next_action','findings','summary'}: errors.append('top-level keys')
    if p.get('case_id')!=c['case_id']: errors.append('case_id mismatch')
    d=p.get('decision')
    if not isinstance(d,str) or d not in ACTIONS: errors.append('decision enum')
    elif p.get('next_action')!=ACTIONS[d]: errors.append('next_action mismatch')
    if not isinstance(p.get('summary'),str) or not p['summary'].strip(): errors.append('summary')
    fs=p.get('findings')
    if not isinstance(fs,list): return errors+['findings must be array']
    if d=='CLEAR' and fs: errors.append('CLEAR with findings')
    if d in ('REVIEW','NEEDS_INFO') and not fs: errors.append('non-CLEAR without findings')
    seen=set(); known=evidence_ids(c)
    for f in fs:
        if not isinstance(f,dict): errors.append('finding object'); continue
        if set(f)!={'code','line_id','amount','evidence_ids'}: errors.append('finding keys')
        code=f.get('code'); line=f.get('line_id')
        if not isinstance(code,str) or code not in CODES: errors.append('finding code')
        if line is not None and (not isinstance(line,str) or not line): errors.append('line_id')
        if isinstance(code,str) and (line is None or isinstance(line,str)):
            key=(code,line)
            if key in seen: errors.append('duplicate finding')
            seen.add(key)
        amt=f.get('amount')
        if amt is not None and (not isinstance(amt,str) or not re.fullmatch(r'\d+\.\d{2}',amt)): errors.append('amount format')
        ev=f.get('evidence_ids')
        if not isinstance(ev,list) or not ev or any(not isinstance(x,str) for x in ev): errors.append('evidence format')
        elif len(ev)!=len(set(ev)) or not set(ev)<=known: errors.append('duplicate or fabricated evidence')
    return errors

def evaluate(pred_dir, split='all'):
    gold=[g for g in strict_load(ROOT/'evaluator_private/gold.json') if split=='all' or g['split']==split]
    rows=[]; tp=fp=fn=0; amount_ok=amount_total=ev_ok=ev_total=0
    for g in gold:
        c=strict_load(ROOT/f'runtime/cases/{g["split"]}/{g["case_id"]}/input.json')
        path=pred_dir/f'{g["case_id"]}.json'
        row={'case_id':g['case_id'],'valid':False,'decision_correct':False,'action_correct':False,'exact':False,'false_clear':False}
        try:
            pred=strict_load(path); errs=validate_output(pred,c)
        except (OSError,ValueError,TypeError) as e:
            pred={}; errs=[type(e).__name__+': '+str(e)]
        expected={(f['code'],f['line_id']):f for f in g['findings']}
        if errs:
            row['errors']=errs; fn+=len(expected)
            amount_total+=sum(f['amount'] is not None for f in expected.values()); ev_total+=len(expected)
        else:
            row['valid']=True
            row['decision_correct']=pred['decision']==g['decision']
            row['action_correct']=pred['next_action']==g['next_action']
            row['false_clear']=pred['decision']=='CLEAR' and g['decision']!='CLEAR'
            actual={(f['code'],f['line_id']):f for f in pred['findings']}
            tp+=len(actual.keys() & expected.keys()); fp+=len(actual.keys()-expected.keys()); fn+=len(expected.keys()-actual.keys())
            field_match=True
            for key,f in expected.items():
                got=actual.get(key)
                if f['amount'] is not None:
                    amount_total+=1
                    amount_ok+=int(got is not None and got['amount']==f['amount'])
                ev_total+=1
                eok=got is not None and set(got['evidence_ids'])==set(f['evidence_ids'])
                ev_ok+=int(eok)
                if not eok or got['amount']!=f['amount']: field_match=False
            row['exact']=row['decision_correct'] and row['action_correct'] and actual.keys()==expected.keys() and field_match
            if not row['exact']: row['errors']=['business output differs from gold; inspect case and gold locally']
        rows.append(row)
    n=len(rows)
    pct=lambda k: round(100*sum(r[k] for r in rows)/n,2)
    ratio=lambda a,b: round(100*a/b,2) if b else None
    expected_files={g['case_id']+'.json' for g in gold}
    extra=sorted(p.name for p in pred_dir.glob('*.json') if p.name not in expected_files)
    report={'split':split,'cases':n,'valid_output_pct':pct('valid'),'decision_accuracy_pct':pct('decision_correct'),
        'action_accuracy_pct':pct('action_correct'),'exact_case_pct':pct('exact'),
        'finding_precision_pct':ratio(tp,tp+fp),'finding_recall_pct':ratio(tp,tp+fn),
        'finding_f1_pct':ratio(2*tp,2*tp+fp+fn),'amount_accuracy_pct':ratio(amount_ok,amount_total),
        'evidence_exact_pct':ratio(ev_ok,ev_total),'false_clear_count':sum(r['false_clear'] for r in rows),
        'unscored_json_files':extra,'rows':rows,
        'limitations':'Synthetic business-output tests only. No live agent/security/integration certification. Invalid or missing cases fail; F1 alone cannot express schema failures. Read exact_case_pct with valid_output_pct.'}
    return report

def main():
    p=argparse.ArgumentParser(); p.add_argument('--predictions',type=Path,required=True)
    p.add_argument('--split',choices=['dev','test','all'],default='all'); p.add_argument('--report',type=Path,required=True)
    a=p.parse_args(); report=evaluate(a.predictions,a.split)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False,indent=2))
    return 0 if report['exact_case_pct']==100 and report['valid_output_pct']==100 and not report['unscored_json_files'] else 1

if __name__=='__main__': raise SystemExit(main())

