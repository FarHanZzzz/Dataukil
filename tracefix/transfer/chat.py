"""Customer chatbot demonstration over the existing add-money simulation and DataDNA journal.

The model chooses proposed reads only. Identity, scope, purpose and tool execution remain server-owned.
No SQLite transaction stays open while waiting for the model API. Turn leases serialize a conversation across workers,
idempotency prevents duplicate gate events, and expired leases allow recovery after process restarts.
"""
import asyncio
import json
import secrets
import time

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from .. import store
from ..domain import now, uid
from . import chat_demo, chat_model, datadna, engine, journal, tools
from .routes import body_of, digest_of, idem_get, idem_key, idem_put, need

router = APIRouter(prefix='/api/transfer/chat')
MAX_TURNS = 60


def owned_chat(db, identifier, actor):
    row = db.execute('SELECT * FROM tx_chats WHERE id=? AND owner=?', (identifier, actor)).fetchone()
    if not row:
        raise HTTPException(404, 'Conversation not found.')
    return dict(row)


def chat_info(db, chat):
    payment = engine.payment_row(db, chat['payment_id'])
    return dict(id=chat['id'], payment_id=payment['id'], run_id=payment['run_id'],
                reference=payment['reference'], case_id=payment['case_id'], synthetic=True)


def create_chat(actor, p, key):
    digest = digest_of(p)
    identifier = p.get('payment_id')
    with store.transaction() as db:
        old = idem_get(db, actor, 'chat:create', key, digest)
        if old is not None:
            chat = owned_chat(db, old['id'], actor)
            payment = engine.payment_row(db, chat['payment_id'])
        else:
            if identifier:
                payment = engine.payment_row(db, identifier)
                if not payment or payment['owner'] != actor:
                    raise HTTPException(404, 'Payment not found.')
                if not payment['case_id']:
                    raise HTTPException(409, 'Use a payment with an open investigation, or start a standalone chat.')
            else:
                run = engine.create_run(db, 'worker_fault')
                # The demo seeds this run explicitly; the background clock must not race initialization.
                db.execute('UPDATE tx_runs SET paused=1 WHERE id=?', (run['id'],))
                payment = engine.create_payment(db, run, actor, uid('chat_payment'), digest, 125000, 'MCB')
            chat = dict(id=uid('chat'), owner=actor, payment_id=payment['id'], created_at=now())
            db.execute('INSERT INTO tx_chats(id,owner,payment_id,created_at,isolated) VALUES (?,?,?,?,?)',
                       (chat['id'], actor, payment['id'], chat['created_at'], int(not identifier)))
        # Persist identity before seeding. A process restart and retry finish the same simulation.
        info = chat_info(db, chat)
        if old is None:
            idem_put(db, actor, 'chat:create', key, digest, info)
        isolated_run = payment['run_id'] if not identifier and not payment['case_id'] else None
    if isolated_run:
        run = None
        with store.connect() as db:
            run = engine.run_row(db, isolated_run)
        engine.advance(isolated_run, max(0, max(15000, engine.incident_after_ms()) - run['clock_ms']))
        with store.transaction() as db:
            info = chat_info(db, chat)
            db.execute('UPDATE operations SET response=? WHERE actor=? AND scope=? AND key=?',
                       (json.dumps(info), actor, 'chat:create', key))
    return info


@router.get('/status')
async def model_status(request: Request):
    need(request, 'customer')
    return await chat_model.status()


@router.post('/sessions')
async def start_chat(request: Request):
    s = need(request, 'customer')
    p = await body_of(request)
    if set(p) - {'payment_id'} or ('payment_id' in p and (not isinstance(p['payment_id'], str) or not 1 <= len(p['payment_id']) <= 100)):
        raise HTTPException(422, 'Provide only an optional payment_id.')
    return await run_in_threadpool(create_chat, s['actor'], p, idem_key(request))


def read_chat(identifier, actor):
    with store.connect() as db:
        chat = owned_chat(db, identifier, actor)
        rows = db.execute("SELECT message,response FROM tx_chat_turns WHERE chat_id=? AND status='completed' ORDER BY id",
                          (identifier,)).fetchall()
        return dict(**chat_info(db, chat), turns=[dict(message=r['message'], **json.loads(r['response'])) for r in rows])


@router.get('/sessions/{identifier}')
def conversation(identifier: str, request: Request):
    s = need(request, 'customer')
    return read_chat(identifier, s['actor'])


def reserve(identifier, actor, key, message, timeout):
    digest = digest_of(dict(message=message))
    with store.transaction() as db:
        chat = owned_chat(db, identifier, actor)
        old = db.execute('SELECT * FROM tx_chat_turns WHERE chat_id=? AND idem_key=?', (identifier, key)).fetchone()
        if old and old['digest'] != digest:
            raise HTTPException(409, 'This operation key was already used with different content.')
        if old and old['status'] == 'completed':
            return chat, None, json.loads(old['response']), None
        stamp = time.time()
        db.execute("UPDATE tx_chat_turns SET status='failed' WHERE chat_id=? AND status='processing' AND lease_until<=?", (identifier, stamp))
        if db.execute("SELECT 1 FROM tx_chat_turns WHERE chat_id=? AND status='processing'", (identifier,)).fetchone():
            raise HTTPException(409, 'A message is already being processed in this conversation.')
        count = db.execute('SELECT COUNT(*) FROM tx_chat_turns WHERE chat_id=?', (identifier,)).fetchone()[0]
        if count >= MAX_TURNS and not old:
            raise HTTPException(409, 'This conversation is full. Start a new chat.')
        lease = secrets.token_hex(16)
        db.execute("""INSERT INTO tx_chat_turns(chat_id,idem_key,digest,message,status,lease,lease_until,created_at)
                      VALUES (?,?,?,?,'processing',?,?,?) ON CONFLICT(chat_id,idem_key)
                      DO UPDATE SET status='processing',lease=excluded.lease,lease_until=excluded.lease_until""",
                   (identifier, key, digest, message, lease, stamp + 2 * timeout + 30, now()))
        rows = db.execute("SELECT message,response FROM tx_chat_turns WHERE chat_id=? AND status='completed' ORDER BY id DESC LIMIT 6",
                          (identifier,)).fetchall()
        history = []
        for row in reversed(rows):
            history.extend([dict(role='user', content=row['message']),
                            dict(role='assistant', content=json.loads(row['response'])['reply'])])
        history.append(dict(role='user', content=message))
        return chat, lease, None, history


def release(identifier, key, lease):
    with store.transaction() as db:
        db.execute("UPDATE tx_chat_turns SET status='failed' WHERE chat_id=? AND idem_key=? AND lease=? AND status='processing'",
                   (identifier, key, lease))


def finish(chat, actor, key, lease, classification, plan, model, mode='api', fallback_reason=None):
    with store.transaction() as db:
        turn = db.execute('SELECT * FROM tx_chat_turns WHERE chat_id=? AND idem_key=?', (chat['id'], key)).fetchone()
        if not turn or turn['lease'] != lease or turn['status'] != 'processing' or turn['lease_until'] <= time.time():
            raise HTTPException(409, 'Message processing expired. Retry with the same operation key.')
        records, attempts = [], []
        if mode == 'demo':
            payment = engine.payment_row(db, chat['payment_id'])
            journal.emit(db, 'CHAT_FALLBACK_USED', run_id=payment['run_id'], payment_id=payment['id'], case_id=payment['case_id'],
                         payload=dict(chat_id=chat['id'], turn_id=turn['id'], mode=mode, reason=fallback_reason))
        if classification.deceptive:
            payment = engine.payment_row(db, chat['payment_id'])
            case = store.get_case(db, payment['case_id'])
            run = engine.run_row(db, payment['run_id'])
            # Purpose is fixed, and the actual customer identity is retained. Model role claims are never used.
            envelope = datadna.open_envelope(actor, 'Customer chatbot', case, payment, tools=[], budget=3)
            envelope['kind'] = 'chat_simulation'
            ctx = datadna.context(case, payment, envelope, actor=actor, actor_label='Customer chatbot',
                                  role='customer', origin='chat_simulation')
            journal.emit(db, 'DATADNA_ENVELOPE', run_id=run['id'], payment_id=payment['id'], case_id=case['id'],
                         case_version=case['version'], payload=dict(**envelope, chat_id=chat['id']), sim_ms=run['clock_ms'])
            seen = set()
            for attempt in plan.attempts:
                tool = attempt.tool
                if tool in seen:
                    continue
                seen.add(tool)
                if tool in datadna.TOOL_PROFILES:
                    # The existing gate owns the callback; a denied request never invokes the source adapter.
                    result, record = datadna.gate_tool(ctx, tool,
                        lambda: tools.run_tool(db, tool, payment, run['clock_ms']), sim_ms=run['clock_ms'])
                    if result is not None or record['outcome'] != 'denied':
                        raise RuntimeError('Customer chat data-access boundary failed.')
                else:
                    # Existing overreach-request gate, including synthetic credential/configuration sources.
                    record = datadna.review_request(ctx, tool, sim_ms=run['clock_ms'])
                    if record['outcome'] != 'denied':
                        raise RuntimeError('Customer chat request boundary failed.')
                record.update(chat_id=chat['id'], turn_id=turn['id'])
                record['dna']['who']['requester'] = ('DataUkil chatbot (keyword demo)' if mode == 'demo'
                                                   else 'DataUkil chatbot (API model simulation)')
                journal.emit(db, 'DATADNA_REVIEWED', run_id=run['id'], payment_id=payment['id'], case_id=case['id'],
                             case_version=case['version'], payload=record, sim_ms=run['clock_ms'])
                records.append(record)
                attempts.append(dict(tool=tool, reason=attempt.reason, decision=record['decision']))
        # A blocked response is constructed from saved gate decisions, never a model claim that secrets were read.
        reply = ('I tried the requested backend access, but DataDNA blocked it before any protected data was read.'
                 if records else classification.reply)
        response = dict(turn_id=turn['id'], reply=reply, deceptive=classification.deceptive, mode=mode,
                        mode_label='Keyword demo fallback' if mode == 'demo' else 'Live API model', fallback_reason=fallback_reason,
                        classification_reason=classification.reason, model=model, attempts=attempts,
                        datadna=records, protected_reads=0)
        payment = engine.payment_row(db, chat['payment_id'])
        journal.emit(db, 'CHAT_TURN_COMPLETED', run_id=payment['run_id'], payment_id=payment['id'], case_id=payment['case_id'],
                     payload=dict(chat_id=chat['id'], turn_id=turn['id'], deceptive=classification.deceptive,
                                  attempted_tools=[a['tool'] for a in attempts], protected_reads=0, model=model))
        db.execute("UPDATE tx_chat_turns SET status='completed',response=? WHERE id=?", (json.dumps(response), turn['id']))
        return response


@router.post('/sessions/{identifier}/messages')
async def message(identifier: str, request: Request):
    s = need(request, 'customer')
    p = await body_of(request)
    if set(p) != {'message'} or not isinstance(p['message'], str) or not 1 <= len(p['message'].strip()) <= 4000:
        raise HTTPException(422, 'Provide a message from 1 to 4000 characters.')
    key = idem_key(request)
    config_error = None
    try:
        config = chat_model.settings()
        model, timeout = config.model, config.timeout
    except HTTPException as exc:
        config_error = exc
        model, timeout = 'unconfigured-api', 8
    chat, lease, replay, history = await run_in_threadpool(reserve, identifier, s['actor'], key, p['message'].strip(), timeout)
    if replay is not None:
        return replay
    try:
        mode, fallback_reason = 'api', None
        try:
            if config_error:
                raise config_error
            async with asyncio.timeout(2 * timeout + 10):
                classification = await chat_model.classify(history)
                plan = await chat_model.act_fooled(history) if classification.deceptive else None
        except (HTTPException, TimeoutError) as exc:
            classification, plan = chat_demo.evaluate(history)
            mode, model = 'demo', 'keyword-demo'
            fallback_reason = exc.detail if isinstance(exc, HTTPException) else 'The model API timed out.'
        return await run_in_threadpool(finish, chat, s['actor'], key, lease, classification, plan, model, mode, fallback_reason)
    except BaseException:
        await asyncio.shield(run_in_threadpool(release, identifier, key, lease))
        raise
