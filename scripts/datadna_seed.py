"""Create a synthetic add-money run against a running DataUkil server and print the investigation board URL.

    python scripts/datadna_seed.py mapping_ambiguity [--base http://127.0.0.1:8765] [--investigate]

With --investigate the script also waits for the incident, starts the investigation as staff and prints the check
count, so the DataDNA funnel can be watched on the printed board URL. Everything is fictional.
"""
import argparse
import json
import secrets
import time
import urllib.request


def call(base, method, path, token=None, body=None, key=None):
    headers = {'content-type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if key:
        headers['Idempotency-Key'] = key
    req = urllib.request.Request(base + '/api/transfer' + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scenario', choices=['worker_fault', 'lost_ack', 'mapping_ambiguity', 'late_completion'])
    ap.add_argument('--base', default='http://127.0.0.1:8765')
    ap.add_argument('--investigate', action='store_true')
    a = ap.parse_args()
    session = lambda role, run=None: call(a.base, 'POST', '/session', body=dict(role=role, **({'run_id': run} if run else {})))['token']
    presenter = session('presenter')
    run = call(a.base, 'POST', '/runs', presenter, dict(scenario=a.scenario))
    customer = session('customer', run['id'])
    pay = call(a.base, 'POST', '/payments', customer, dict(run_id=run['id'], amount_minor=125000, bank_code='MCB'), key='seed-' + secrets.token_hex(4))
    pid = pay['payment']['id']
    print(f"{a.base}/admin/cases/{pid}?run={run['id']}")
    if a.investigate:
        staff = session('staff', run['id'])
        for _ in range(120):
            snap = call(a.base, 'GET', f'/staff/cases/{pid}', staff)
            if snap['payment']['case_id']:
                break
            time.sleep(1)
        call(a.base, 'POST', f'/staff/cases/{pid}/investigate', staff, {}, key='inv-' + secrets.token_hex(4))
        print('investigation started')


if __name__ == '__main__':
    main()
