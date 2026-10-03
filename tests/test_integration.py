"""Shared database and route contracts after merging the two payment workspaces."""
import uuid

from fastapi.testclient import TestClient

from tracefix import store
from tracefix.app import app
from tracefix.transfer import engine


def test_workspaces_share_storage_without_crossing_case_authority(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'merged.sqlite3')
    monkeypatch.setenv('TRACEFIX_SIM_TICKER', '0')
    with TestClient(app) as client:
        presenter = client.post('/api/transfer/session', json={'role': 'presenter'}).json()
        run = client.post('/api/transfer/runs', json={'scenario': 'worker_fault'},
                          headers={'Authorization': 'Bearer ' + presenter['token']}).json()
        customer = client.post('/api/transfer/session', json={'role': 'customer', 'run_id': run['id']}).json()
        paid = client.post('/api/transfer/payments', json={'run_id': run['id'], 'amount_minor': 100000, 'bank_code': 'MCB'},
                           headers={'Authorization': 'Bearer ' + customer['token'], 'Idempotency-Key': 'merged-payment'}).json()
        engine.advance(run['id'], 15000)
        with store.connect() as db:
            partner_case = engine.payment_row(db, paid['payment']['id'])['case_id']
            assert partner_case
            saved_case = store.get_case(db, partner_case)

        local_customer = client.post('/api/session', json={'role': 'customer'}).json()
        local_staff = client.post('/api/session', json={'role': 'staff'}).json()
        headers = {'X-TraceFix-Session': local_customer['token'], 'Idempotency-Key': uuid.uuid4().hex}
        local = client.post('/api/transactions', json={'amount_minor': 100000, 'scenario': 'missing_partner_response',
                                                      'customer_name': 'Fictional integration customer'}, headers=headers).json()
        for _ in range(2):
            headers['Idempotency-Key'] = uuid.uuid4().hex
            local = client.post('/api/transactions/' + local['id'] + '/advance',
                                json={'version': local['version']}, headers=headers).json()
        headers['Idempotency-Key'] = uuid.uuid4().hex
        complaint = client.post('/api/transactions/' + local['id'] + '/complaint',
                                json={'version': local['version'], 'issue_type': 'STUCK_TRANSFER',
                                      'description': 'Please check this exact synthetic transfer.'}, headers=headers)
        assert complaint.status_code == 200, complaint.text
        local_case = complaint.json()['case']['id']
        operator = {'X-TraceFix-Session': local_staff['token']}
        overview = client.get('/api/operations/overview', headers=operator)
        assert overview.status_code == 200
        ids = {c['id'] for c in overview.json()['cases']}
        assert local_case in ids and partner_case not in ids
        assert client.get('/api/cases/' + partner_case, headers=operator).status_code == 409
        assert client.get('/api/transfer/staff/cases/' + local_case,
                          headers={'Authorization': 'Bearer ' + local_staff['token']}).status_code == 404
        assert client.get('/api/payments/QR-DEMO-003', headers={'X-TraceFix-Session': local_customer['token']}).status_code == 200
        presenter_headers = {'Authorization': 'Bearer ' + presenter['token']}
        assert client.get('/api/transactions', headers=presenter_headers).status_code == 403
        assert client.get('/api/transactions/' + local['id'], headers=presenter_headers).status_code == 403
        assert client.get('/api/cases', headers=presenter_headers).status_code == 403
        # Startup migrations retain both case families and their financial records.
        with store.connect() as db:
            ledger_before = [tuple(r) for r in db.execute('SELECT * FROM tx_postings ORDER BY id')]
        store.initialize()
        with store.connect() as db:
            assert store.get_case(db, partner_case) == saved_case
            assert store.get_case(db, local_case)['incident_id'] == local['incident_id']
            assert [tuple(r) for r in db.execute('SELECT * FROM tx_postings ORDER BY id')] == ledger_before


def test_homepage_and_both_frontends_use_available_local_assets(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'DB_PATH', tmp_path / 'routes.sqlite3')
    monkeypatch.setenv('TRACEFIX_SIM_TICKER', '0')
    from html.parser import HTMLParser

    class Assets(HTMLParser):
        def __init__(self):
            super().__init__()
            self.paths = []
        def handle_starttag(self, tag, attrs):
            for name, value in attrs:
                if name in ('src', 'href') and value and value.startswith('/static/'):
                    self.paths.append(value)

    with TestClient(app) as client:
        for route in ('/', '/customer', '/operations', '/qr-demo', '/customer/payment', '/admin/queue', '/mfs'):
            response = client.get(route, follow_redirects=False)
            assert response.status_code == 200, route
            parser = Assets()
            parser.feed(response.text)
            for asset in parser.paths:
                assert client.get(asset).status_code == 200, (route, asset)
        assert '/operations' in client.get('/').text
        assert '/static/legacy/app.js' in client.get('/qr-demo').text
