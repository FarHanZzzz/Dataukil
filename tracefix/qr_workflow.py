"""Exact-context synthetic QR/cash source checks and append-only event history."""
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from .domain import now, uid


def emit(c, actor, kind, node, state='completed', evidence_ids=None, detail='', version=None):
    event=dict(id=uid('qre'), sequence=len(c.setdefault('qr_events', []))+1,
        workflow='qr_cash', kind=kind, node=node, state=state, actor=actor,
        at=now(), version=version if version is not None else c['version']+1, evidence_version=c['evidence_version'],
        evidence_ids=evidence_ids or [], source_identifiers=dict(purchase_id=c['purchase_id'], qr_reference=c['qr_reference'],marketplace_source_id=c.get('qr_pipeline',{}).get('marketplace',{}).get('source_id'),bank_debit_reference=c.get('verified_bank_record',{}).get('reference')), detail=detail)
    c['qr_events'].append(event)
    return event


def current_scan(c):
    scan=c.get('qr_pipeline',{}).get('receipt_scan')
    if not scan or scan['evidence_version']!=c['evidence_version']:
        raise HTTPException(409,'Scan the current receipt evidence before checking Marketplace records.')
    return scan


def marketplace_check(db, c, actor, unavailable=False):
    from .simulation import get_sim
    scan=current_scan(c)
    sim=get_sim(db,c.get('simulation_id',''))
    if not sim: raise HTTPException(409,'An exact synthetic purchase is required.')
    # The fixture catalog is created at purchase creation and is never sourced
    # from a receipt or transcript. A missing fixture is uncertainty.
    catalog=sim.get('marketplace_record')
    fields=scan.get('fields',{})
    previous=c.get('qr_pipeline',{}).get('marketplace')
    if previous and previous['evidence_version']==c['evidence_version'] and not unavailable: return previous
    emit(c,actor,'MARKETPLACE_QUERY_STARTED','purchase_lookup','active',[scan['evidence_id']])
    pairs=[]
    if unavailable or not catalog or catalog.get('available') is False or catalog.get('timeout'):
        outcome='UNCERTAIN'; reason='Marketplace records are unavailable. Human review is required.'
    else:
        expected=dict(purchase_id=c['purchase_id'],merchant=sim['merchant'],item=sim['item'],
            amount=f"{sim['total_minor']/100:.2f}",cash_reference='CASH-'+c['purchase_id'])
        for key,value in expected.items():
            observed=fields.get(key)
            source=str(catalog.get(key,''))
            status='MISSING' if not observed or not source else 'MATCH' if str(observed)==str(value)==source else 'CONFLICT'
            pairs.append(dict(field=key,receipt=observed,marketplace=source,status=status))
        for key,value in [('qr_reference',c['qr_reference']),('bank_debit_reference','BANK-'+c['qr_reference']),('timestamp',sim['created_at'])]:
            pairs.append(dict(field=key,receipt=fields.get(key) if key=='timestamp' else 'Linked purchase context',marketplace=catalog.get(key),status='MISSING' if not catalog.get(key) or (key=='timestamp' and not fields.get(key)) else 'MATCH' if catalog.get(key)==value and (key!='timestamp' or fields.get(key)==value) else 'CONFLICT'))
        if catalog.get('conflicting_records'):
            outcome='UNCERTAIN';reason='Marketplace returned conflicting records. Automation is paused for human review.'
        elif catalog.get('order_exists') is False:
            outcome='REJECTED';reason='The available Marketplace source explicitly confirms that this purchase order does not exist.'
        elif catalog.get('denial') or any(p['status']=='CONFLICT' for p in pairs):
            outcome='REJECTED';reason='The exact Marketplace and payment records conflict with the submitted receipt or transaction context.'
        elif any(p['status']=='MISSING' for p in pairs) or catalog.get('refunded'):
            outcome='UNCERTAIN';reason='Evidence is incomplete or a prior refund needs human review.'
        elif not catalog.get('bank_debit_verified') or not catalog.get('cash_received'):
            outcome='UNCERTAIN';reason='Both payment records are not independently corroborated.'
        else:
            outcome='LEGITIMATE';reason='Receipt fields, Marketplace order, cash record and bank debit match the exact purchase.'
    result=dict(id=uid('market'),outcome=outcome,reason=reason,comparisons=pairs,evidence_version=c['evidence_version'],
        evidence_ids=[scan['evidence_id']],source_id='MARKETPLACE-'+sim['purchase_id'],
        bank_debit_verified=bool(not unavailable and catalog and catalog.get('available') and not catalog.get('timeout') and not catalog.get('conflicting_records') and catalog.get('bank_debit_verified') and catalog.get('bank_debit_reference')=='BANK-'+c['qr_reference']),at=now(),synthetic=True)
    if c.get('qr_pipeline',{}).get('verdict') and c['qr_pipeline']['verdict'].get('source_result_id')!=result['id']:
        c['qr_pipeline']['verdict']['status']='STALE'
    c['operator_state']='MARKETPLACE_QUERY_RETURNED'
    c.setdefault('qr_pipeline',{})['marketplace']=result
    c['verified_bank_record']=dict(verified=result['bank_debit_verified'],reference='BANK-'+sim['qr_reference'],amount_minor=sim['qr_amount_minor'] if result['bank_debit_verified'] else None,source='synthetic_bank_record')
    def field_state(keys):
        values=[v['status'] for v in pairs if v['field'] in keys]
        return 'uncertain' if len(values)!=len(keys) or 'MISSING' in values else 'rejected' if 'CONFLICT' in values else 'completed'
    states=dict(purchase_lookup='uncertain',order_match='uncertain',amount_match='uncertain',qr_lookup='uncertain',bank_debit='uncertain',cash_claim='uncertain')
    if catalog and catalog.get('available') and not unavailable and not catalog.get('timeout') and not catalog.get('conflicting_records'):
        states.update(purchase_lookup='rejected' if catalog.get('order_exists') is False else 'completed',
            order_match=field_state(['purchase_id','merchant','timestamp']),amount_match=field_state(['amount','item']),
            qr_lookup=field_state(['qr_reference']),bank_debit=field_state(['bank_debit_reference']) if result['bank_debit_verified'] else 'uncertain',
            cash_claim='rejected' if catalog.get('denial') else field_state(['cash_reference']) if catalog.get('cash_received') else 'uncertain')
    result['node_states']=states
    for node,state in states.items():
        emit(c,actor,'MARKETPLACE_QUERY_COMPLETED',node,state,[scan['evidence_id']],reason)
    return result


def action(db, c, actor, p):
    pipeline=c.setdefault('qr_pipeline',{})
    market=pipeline.get('marketplace',{})
    action=p.get('action')
    if not market or market.get('evidence_version')!=c['evidence_version']:
        raise HTTPException(409,'Check the current receipt and Marketplace evidence before making a decision.')
    ids=market['evidence_ids']
    if action=='verdict':
        verdict=p.get('verdict')
        if verdict not in ('LEGITIMATE','REJECTED','UNCERTAIN'): raise HTTPException(422,'Choose a QR verdict.')
        if verdict!=market['outcome']: raise HTTPException(409,'The verdict must follow the saved source result; uncertainty cannot be treated as rejection.')
        previous=pipeline.get('verdict',{})
        if previous.get('status')=='RECORDED' and previous.get('source_result_id')==market['id'] and previous.get('outcome')==verdict:
            return market['reason']
        if pipeline.get('resolution') and pipeline['resolution'].get('evidence_version')==c['evidence_version']: raise HTTPException(409,'A resolution already exists. Its saved outcome cannot be replaced.')
        pipeline['verdict']=dict(outcome=verdict,reason=market['reason'],at=now(),actor=actor,
            evidence_ids=ids,evidence_version=c['evidence_version'],source_result_id=market['id'],status='RECORDED')
        emit(c,actor,'VERDICT_RECORDED',verdict.lower(),'completed' if verdict=='LEGITIMATE' else verdict.lower(),ids,market['reason'])
        c['operator_state']='VERDICT_RECORDED'
        if verdict=='LEGITIMATE':
            if pipeline.get('resolution',{}).get('state')=='REFUND_COMPLETED': raise HTTPException(409,'A completed refund already exists for this purchase; human review is required.')
            pipeline['resolution']=dict(state='REFUND_PROPOSED',amount_minor=c['qr_amount_minor'],synthetic=True,evidence_version=c['evidence_version'])
            emit(c,actor,'REFUND_ELIGIBLE','refund_eligibility','completed',ids)
            emit(c,actor,'REFUND_PROPOSED','refund_eligibility','completed',ids)
            emit(c,actor,'OPERATOR_APPROVAL_REQUIRED','refund_eligibility','active',ids,'The AI proposal awaits explicit approval by the case owner.')
        elif verdict=='REJECTED':
            if pipeline.get('resolution',{}).get('state')!='REFUND_COMPLETED': pipeline.pop('resolution',None)
            c['status']='OUTCOME_RECORDED'
            emit(c,actor,'CUSTOMER_NOTIFIED','customer_notification','rejected',ids)
        else:
            emit(c,actor,'AUTOMATION_PAUSED','uncertain','uncertain',ids,market['reason'])
            if pipeline.get('resolution',{}).get('state')!='REFUND_COMPLETED': pipeline.pop('resolution',None)
            c['status']='ESCALATED'
        return market['reason']
    verdict=pipeline.get('verdict',{})
    if verdict.get('evidence_version')!=c['evidence_version'] or verdict.get('source_result_id')!=market['id']: raise HTTPException(409,'The verdict is stale. Review the new evidence first.')
    if action=='approve_refund':
        if any(t['status'] in ('OPEN','RESPONDED') for t in c['tasks']): raise HTTPException(409,'Review the outstanding evidence requests before approving a refund.')
        if verdict.get('outcome')!='LEGITIMATE' or pipeline.get('resolution',{}).get('state')!='REFUND_PROPOSED':
            raise HTTPException(409,'Only the current legitimate refund proposal can be approved.')
        pipeline['resolution'].update(state='REFUND_REQUESTED',approved_by=actor,approved_at=now(),request_id=uid('refund'))
        emit(c,actor,'REFUND_ELIGIBILITY_APPROVED','refund_eligibility','completed',ids)
        c['operator_state']='RESOLUTION_STARTED'
        emit(c,actor,'REFUND_APPROVED','refund_request','completed',ids)
        emit(c,actor,'REFUND_REQUESTED','refund_request','active',ids)
        return 'The operator approved a simulated refund request. Money has not yet been returned.'
    if action=='complete_refund':
        if verdict.get('outcome')!='LEGITIMATE' or pipeline.get('resolution',{}).get('state')!='REFUND_REQUESTED':
            raise HTTPException(409,'Operator approval is required before completing a simulated refund.')
        pipeline['resolution'].update(state='REFUND_COMPLETED',completed_at=now())
        c['status']='OUTCOME_RECORDED'
        from .simulation import get_sim,save_sim
        sim=get_sim(db,c['simulation_id'])
        if not sim or sim.get('marketplace_record',{}).get('refunded'): raise HTTPException(409,'This purchase is unavailable or already refunded.')
        sim['marketplace_record']['refunded']=True;save_sim(db,sim)
        emit(c,actor,'REFUND_REQUEST_SETTLED','refund_request','completed',ids)
        emit(c,actor,'REFUND_COMPLETED','refund_posted','completed',ids)
        emit(c,actor,'CUSTOMER_NOTIFIED','customer_notification','completed',ids)
        return 'The synthetic completed-refund event confirms the simulated refund. No real money moved.'
    if action=='handoff':
        if verdict.get('outcome')!='UNCERTAIN': raise HTTPException(409,'Only an uncertain verdict can create this handoff.')
        if pipeline.get('handoff'): return 'The owned human handoff is already saved.'
        due=(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()
        h=dict(id=uid('handoff'),destination='staff_2',owner=c['owner'],queue='QR evidence review',
            reason=market['reason'],missing_evidence=[v['field'] for v in market.get('comparisons',[]) if v['status']!='MATCH'] or ['Independent Marketplace corroboration'],
            status='REQUESTED',next_review=due,at=now(),actor=actor)
        c['handoffs'].append(h);pipeline['handoff']=h;c['next_review']=due;c['status']='ESCALATED'
        emit(c,actor,'HANDOFF_CREATED','human_handoff','handoff',ids,market['reason'])
        return 'Automation is paused. Investigator 1 retains ownership until Investigator 2 accepts the handoff. The next review is saved.'
    raise HTTPException(422,'Unknown QR workflow action.')
