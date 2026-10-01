"""Deterministic structured-data baseline; not an LLM or harness implementation."""
import json
from decimal import Decimal, ROUND_HALF_UP

D = Decimal
def money(x):
    return format(x.quantize(D('0.01'), rounding=ROUND_HALF_UP), '.2f')

def validate_input(c):
    def require(ok):
        if not ok:
            raise ValueError('invalid input')
    def number(x, positive=False):
        require(isinstance(x, str))
        n=D(x)
        require(n.is_finite() and (n > 0 if positive else n >= 0))
    require(isinstance(c, dict))
    for k in ('case_id','tenant_id','invoice','purchase_order','receipts','invoice_history'):
        require(k in c)
    require(isinstance(c['case_id'],str) and bool(c['case_id']))
    require(isinstance(c['tenant_id'],str) and bool(c['tenant_id']))
    ids=[]
    def lines(ls, evidence=True):
        require(isinstance(ls,list) and bool(ls))
        skus=[]; lids=[]
        for l in ls:
            require(isinstance(l,dict))
            for k in ('sku','unit'):
                require(isinstance(l.get(k),str) and bool(l[k]))
            number(l.get('quantity'), True); number(l.get('unit_price'))
            skus.append(l['sku'])
            if evidence:
                require(isinstance(l.get('line_id'),str) and bool(l['line_id']))
                require(isinstance(l.get('evidence_id'),str) and bool(l['evidence_id']))
                ids.append(l['evidence_id']); lids.append(l['line_id'])
        require(len(skus)==len(set(skus)))
        require(len(lids)==len(set(lids)))
    for name in ('invoice','purchase_order'):
        obj=c[name]
        if name=='purchase_order' and obj is None:
            continue
        require(isinstance(obj,dict))
        for k in ('evidence_id','supplier_id','currency','order_id'):
            require(isinstance(obj.get(k),str) and bool(obj[k]))
        if name=='invoice':
            require(isinstance(obj.get('invoice_id'),str) and bool(obj['invoice_id'].strip()))
        ids.append(obj['evidence_id']); lines(obj.get('lines'))
    require(c['receipts'] is None or isinstance(c['receipts'],list))
    for r in c['receipts'] or []:
        require(isinstance(r,dict))
        for k in ('evidence_id','order_id','sku','unit'):
            require(isinstance(r.get(k),str) and bool(r[k]))
        number(r.get('quantity'),True); ids.append(r['evidence_id'])
    require(isinstance(c['invoice_history'],list))
    keys=[]
    for h in c['invoice_history']:
        for k in ('evidence_id','invoice_id','supplier_id','order_id'):
            require(isinstance(h.get(k),str) and bool(h[k].strip()))
        require(h.get('status') in ('accepted','paid','cancelled'))
        require(isinstance(h.get('lines'),list))
        if h['lines']: lines(h['lines'],False)
        ids.append(h['evidence_id'])
        keys.append((h['supplier_id'],h['invoice_id'].strip().upper()))
    require(len(keys)==len(set(keys)))
    require(len(ids)==len(set(ids)))
    # Unsupported receipt/history units must not silently disappear from sums.
    po=c['purchase_order']
    if po:
        units={l['sku']:l['unit'] for l in po['lines']}
        for r in c['receipts'] or []:
            if r['order_id']==po['order_id'] and r['sku'] in units:
                require(r['unit']==units[r['sku']])
        for h in c['invoice_history']:
            if h['order_id']==po['order_id'] and h['supplier_id']==po['supplier_id'] and h['status'] in ('accepted','paid'):
                for l in h['lines']:
                    if l['sku'] in units: require(l['unit']==units[l['sku']])

def analyze(c):
    fs=[]
    def add(code, evidence, amount=None, line=None):
        fs.append(dict(code=code,line_id=line,amount=amount,evidence_ids=evidence))
    def done(decision):
        action={'CLEAR':'RECORD_REVIEW','REVIEW':'REQUEST_HUMAN_REVIEW','NEEDS_INFO':'REQUEST_DOCUMENTS'}[decision]
        return dict(case_id=c.get('case_id','UNKNOWN'),decision=decision,next_action=action,
                    findings=fs,summary='Yapılandırılmış veriye dayalı deterministik referans inceleme; dış işlem yapılmadı.')
    try:
        validate_input(c)
    except (ValueError,TypeError,KeyError,ArithmeticError,AttributeError):
        add('INVALID_DATA',['INPUT']); return done('NEEDS_INFO')
    inv=c['invoice']; po=c['purchase_order']
    active=[h for h in c['invoice_history'] if h['status'] in ('accepted','paid')]
    duplicates=[h for h in active if h['supplier_id']==inv['supplier_id'] and h['invoice_id'].strip().upper()==inv['invoice_id'].strip().upper()]
    if duplicates:
        total=sum((D(l['quantity'])*D(l['unit_price']) for l in inv['lines']),D(0))
        add('DUPLICATE_INVOICE',['INV']+[h['evidence_id'] for h in duplicates],money(total)); return done('REVIEW')
    if po is None:
        add('MISSING_PO',['INV']); return done('NEEDS_INFO')
    for key,code in [('supplier_id','SUPPLIER_MISMATCH'),('currency','CURRENCY_MISMATCH'),('order_id','ORDER_REF_MISMATCH')]:
        if inv[key]!=po[key]:
            add(code,['INV','PO']); return done('NEEDS_INFO')
    if c['receipts'] is None:
        add('MISSING_RECEIPTS',['INV']); return done('NEEDS_INFO')
    polines={l['sku']:l for l in po['lines']}
    for l in inv['lines']:
        p=polines.get(l['sku'])
        if p is None: add('UNMATCHED_SKU',[l['evidence_id'],'PO'],line=l['line_id'])
        elif l['unit']!=p['unit']: add('UNIT_MISMATCH',[l['evidence_id'],p['evidence_id']],line=l['line_id'])
    if fs: return done('NEEDS_INFO')
    for l in inv['lines']:
        p=polines[l['sku']]; q=D(l['quantity']); price=D(l['unit_price'])
        price_diff=max(D(0),price-D(p['unit_price']))*q
        if D(money(price_diff))>D('0.01'):
            add('PRICE_OVER',[l['evidence_id'],p['evidence_id']],money(price_diff),l['line_id'])
        hs=[h for h in active if h['supplier_id']==inv['supplier_id'] and h['order_id']==inv['order_id'] and any(x['sku']==l['sku'] and x['unit']==l['unit'] for x in h['lines'])]
        prior=sum((D(x['quantity']) for h in hs for x in h['lines'] if x['sku']==l['sku'] and x['unit']==l['unit']),D(0))
        hids=[h['evidence_id'] for h in hs]
        over=max(D(0),prior+q-D(p['quantity']))
        if over>0: add('ORDER_QTY_OVER',[l['evidence_id'],p['evidence_id']]+hids,money(over*price),l['line_id'])
        rs=[r for r in c['receipts'] if r['order_id']==inv['order_id'] and r['sku']==l['sku'] and r['unit']==l['unit']]
        received=sum((D(r['quantity']) for r in rs),D(0))
        over=max(D(0),prior+q-received)
        if over>0: add('UNRECEIVED_QTY',[l['evidence_id']]+([r['evidence_id'] for r in rs] or ['RECEIPTS'])+hids,money(over*price),l['line_id'])
    return done('REVIEW' if fs else 'CLEAR')

if __name__=='__main__':
    import sys
    print(json.dumps(analyze(json.load(sys.stdin)),ensure_ascii=False))
