"""Meaningful regression tests for fixtures, arithmetic and evaluator failure handling."""
import copy
import json
import tempfile
import unittest
import subprocess
import sys
from pathlib import Path
from baseline import analyze
from evaluate import ROOT, evaluate, strict_load, validate_output

class PackTests(unittest.TestCase):
    def fixture(self,cid='D01'):
        split='dev' if cid.startswith('D') else 'test'
        return strict_load(ROOT/f'runtime/cases/{split}/{cid}/input.json')
    def populated(self,d):
        for path in (ROOT/'runtime/cases').glob('*/*/input.json'):
            c=strict_load(path)
            (d/f'{c["case_id"]}.json').write_text(json.dumps(analyze(c)),encoding='utf-8')
    def test_all_hand_authored_expectations(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t); self.populated(d); r=evaluate(d)
            self.assertEqual(r['cases'],30); self.assertEqual(r['exact_case_pct'],100,r['rows'])
    def test_missing_prediction_fails(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t); self.populated(d); (d/'D01.json').unlink()
            r=evaluate(d); self.assertLess(r['valid_output_pct'],100); self.assertLess(r['exact_case_pct'],100)
    def test_wrong_amount_fails(self):
        with tempfile.TemporaryDirectory() as t:
            d=Path(t); self.populated(d); p=analyze(self.fixture('D06')); p['findings'][0]['amount']='199.00'
            (d/'D06.json').write_text(json.dumps(p),encoding='utf-8')
            r=evaluate(d); self.assertLess(r['amount_accuracy_pct'],100); self.assertLess(r['exact_case_pct'],100)
    def test_fabricated_and_duplicate_evidence(self):
        c=self.fixture('D06'); p=analyze(c)
        p['findings'][0]['evidence_ids']=['FAKE']
        self.assertTrue(validate_output(p,c))
        p=analyze(c); p['findings'].append(copy.deepcopy(p['findings'][0]))
        self.assertTrue(validate_output(p,c))
    def test_malformed_output_cannot_crash_validator(self):
        c=self.fixture()
        p=analyze(c); p['decision']=[]
        self.assertTrue(validate_output(p,c))
    def test_negative_or_nonfinite_amount_rejected(self):
        for bad in ['-1','NaN','Infinity']:
            c=self.fixture(); c['invoice']['lines'][0]['quantity']=bad
            self.assertEqual(analyze(c)['findings'][0]['code'],'INVALID_DATA')
    def test_null_and_empty_receipts_distinct(self):
        self.assertEqual(analyze(self.fixture('D11'))['decision'],'NEEDS_INFO')
        self.assertEqual(analyze(self.fixture('T05'))['decision'],'REVIEW')
    def test_rounding_boundary(self):
        self.assertEqual(analyze(self.fixture('D05'))['decision'],'CLEAR')
        self.assertEqual(analyze(self.fixture('T06'))['findings'][0]['amount'],'0.02')
    def test_json_duplicate_keys_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            f=Path(t)/'bad.json'; f.write_text('{"a":1,"a":2}')
            with self.assertRaises(ValueError): strict_load(f)
    def test_wrong_case_id_rejected(self):
        c=self.fixture(); p=analyze(c); p['case_id']='D99'
        self.assertTrue(validate_output(p,c))
    def test_agent_runner_protocol_with_simulated_adapter(self):
        # This verifies subprocess transport only, never model capability.
        with tempfile.TemporaryDirectory() as t:
            d=Path(t); adapter=d/'simulated_adapter.py'
            adapter.write_text('import sys,json\nsys.path.insert(0,'+repr(str(ROOT/'scripts'))+')\nfrom baseline import analyze\nr=json.load(sys.stdin)\nprint(json.dumps(analyze(r["input"])))\n',encoding='utf-8')
            out=d/'outputs'
            r=subprocess.run([sys.executable,str(ROOT/'scripts/run.py'),'--mode','agent','--split','test','--out',str(out),'--adapter',sys.executable,str(adapter)],capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stderr)
            self.assertEqual(evaluate(out,'test')['exact_case_pct'],100)
    def test_unconnected_adapter_fails_explicitly(self):
        r=subprocess.run([sys.executable,str(ROOT/'scripts/adapter_template.py')],input='{}',capture_output=True,text=True)
        self.assertEqual(r.returncode,2)
        self.assertEqual(r.stdout,'')

if __name__=='__main__': unittest.main(verbosity=2)
