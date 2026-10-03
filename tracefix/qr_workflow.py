"""Exact-context synthetic QR/cash source checks and append-only event history."""
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from .domain import now, uid


def emit(c, actor, kind, node, state='completed', evidence_ids=None, detail='', version=None):
    event=dict(id=uid('qre'), sequence=len(c.setdefault('qr_events', []))+1,
        workflow='qr_cash', kind=kind, node=node, state=state, actor=actor,
        at=now(), version=version if version is not None else c['version']+1, evidence_version=c['evidence_version'],
        evidence_ids=evidence_ids or [], source_identifiers=dict(purchase_id=c['purchase_id'], qr_reference=c['qr_reference'],scan_id=c.get('qr_pipeline',{}).get('receipt_scan',{}).get('scan_id'),review_id=c.get('qr_pipeline',{}).get('receipt_review',{}).get('id'),marketplace_source_id=c.get('qr_pipeline',{}).get('marketplace',{}).get('source_id'),bank_debit_reference=c.get('verified_bank_record',{}).get('reference')), detail=detail)
    c['qr_events'].append(event)
    return event


def invalidate_downstream(c,reason):
    pipeline=c.setdefault('qr_pipeline',{})
    if pipeline.get('marketplace'):pipeline['marketplace']['status']='STALE'
    if pipeline.get('verdict'):pipeline['verdict']['status']='STALE'
    resolution=pipeline.get('resolution')
    if resolution and resolution.get('state')!='REFUND_COMPLETED':
        pipeline.setdefault('resolution_history',[]).append(dict(resolution,status='STALE',invalidated_at=now(),reason=reason))
        pipeline.pop('resolution')


def current_scan(c):
    scan=c.get('qr_pipeline',{}).get('receipt_scan')
    if not scan or scan['evidence_version']!=c['evidence_version'] or scan.get('manifest_version')!=2:
        raise HTTPException(409,'Scan the current receipt evidence with the updated visual scan before checking Marketplace records.')
    return scan


def current_review(c):
    scan=current_scan(c)
    review=c.get('qr_pipeline',{}).get('receipt_review')
    if not review or review['evidence_version']!=c['evidence_version'] or review['scan_id']!=scan['scan_id']:
        raise HTTPException(409,'Review the current receipt fields before checking Marketplace records.')
    return review


def review_receipt(c,actor,p):
    scan=current_scan(c)
    if p.get('scan_id')!=scan['scan_id']:raise HTTPException(409,'This scan changed. Review the current receipt.')
    if c.get('qr_pipeline',{}).get('resolution',{}).get('state')=='REFUND_COMPLETED':
        raise HTTPException(409,'A completed refund is historical. Do not replace its evidence review.')
    keys={a['field'] for a in scan['field_associations'] if a['field']!='barcode'}
    ids={r['id'] for r in scan['regions']}
    mapping=p.get('field_regions');reviewed=p.get('reviewed_fields');missing=p.get('missing_fields',[])
    if not isinstance(mapping,dict) or not isinstance(reviewed,list) or not isinstance(missing,list):raise HTTPException(422,'Provide field mappings and acknowledged missing fields.')
    if any(not isinstance(k,str) for k in reviewed+missing) or set(reviewed)!=keys or not set(missing)<=keys or not set(mapping)<=keys:
        raise HTTPException(422,'Review every field in this exact scan.')
    for key in keys:
        regions=mapping.get(key,[])
        if not isinstance(regions,list) or any(not isinstance(r,str) or r not in ids for r in regions):raise HTTPException(422,'A mapped region must belong to this scan.')
        if key in missing and regions:raise HTTPException(422,'A missing field cannot also have mapped regions.')
        if key not in missing and (not regions or not scan['fields'].get(key) and not key.startswith('line_items.')):
            raise HTTPException(422,'Map the field or acknowledge it as missing.')
    reason=p.get('reason','')
    if not isinstance(reason,str) or not reason.strip() or len(reason)>1000:raise HTTPException(422,'Provide a review reason of up to 1000 characters.')
    existing=c.get('qr_pipeline',{}).get('receipt_review')
    canonical=dict(field_regions={k:sorted(set(mapping.get(k,[]))) for k in sorted(keys)},reviewed_fields=sorted(keys),missing_fields=sorted(set(missing)))
    if existing and existing['scan_id']==scan['scan_id'] and existing.get('reason')==reason.strip() and all(existing.get(k)==v for k,v in canonical.items()):return 'The current receipt review is already saved.'
    review=dict(id=uid('review'),scan_id=scan['scan_id'],evidence_id=scan['evidence_id'],evidence_version=c['evidence_version'],
        transcript_revision=scan['transcript_revision'],semantic_source='operator_mapping',actor=actor,at=now(),reason=reason.strip(),**canonical)
    pipeline=c.setdefault('qr_pipeline',{})
    pipeline.setdefault('receipt_reviews',[]).append(review);pipeline['receipt_review']=review
    invalidate_downstream(c,'Receipt field review changed.')
    emit(c,actor,'RECEIPT_REVIEW_SAVED','annotated_fields','completed',[scan['evidence_id']],reason)
    return 'Receipt field review saved. Marketplace records have not yet been checked.'


def marketplace_check(db,c,actor,unavailable=False):
    from .simulation import get_sim
    from .qr_receipt import money_minor
    scan=current_scan(c);review=current_review(c)
    sim=get_sim(db,c.get('simulation_id',''))
    if not sim:raise HTTPException(409,'An exact synthetic purchase is required.')
    catalog=sim.get('marketplace_record');fields=scan['fields']
    previous=c.get('qr_pipeline',{}).get('marketplace')
    if previous and previous.get('review_id')==review['id'] and previous.get('status')!='STALE' and not unavailable:return previous
    emit(c,actor,'MARKETPLACE_QUERY_STARTED','purchase_lookup','active',[scan['evidence_id']])
    pairs=[];excess=None;reason_code=None
    available=bool(not unavailable and catalog and catalog.get('available') and not catalog.get('timeout') and not catalog.get('conflicting_records'))
    def compare(key,observed,source,numeric=False):
        absent=key in review['missing_fields'] or observed is None or source is None
        if numeric:
            observed=money_minor(observed)
            absent=absent or observed is None or type(source) is not int
        def norm(v):return ' '.join(str(v).split()).casefold()
        status='MISSING' if absent else 'MATCH' if (observed==source if numeric else norm(observed)==norm(source)) else 'CONFLICT'
        pairs.append(dict(field=key,receipt=observed,marketplace=source,status=status))
    if not available:
        outcome='UNCERTAIN';reason='Marketplace records are unavailable or conflicting. Human review is required.'
    else:
        for key,source in [('purchase_id',catalog.get('purchase_id')),('merchant',catalog.get('merchant')),
                           ('cash_reference',catalog.get('cash_reference')),('currency',catalog.get('currency')),('payment_method',catalog.get('payment_method'))]:
            compare(key,fields.get(key),source)
        for key,source in [('total',catalog.get('invoice_total_minor')),('subtotal',catalog.get('subtotal_minor')),
                           ('tax',catalog.get('tax_minor')),('cash_paid',catalog.get('cash_amount_minor'))]:
            compare(key,fields.get(key),source,True)
        def canonical(items):
            return sorted((' '.join(i['description'].split()).casefold(),i['quantity'],i['unit_price_minor'],i['line_total_minor']) for i in items)
        try:
            observed=canonical(fields.get('line_items',[]));source=canonical(catalog.get('line_items',[]))
            missing=not observed or not source or any(k.startswith('line_items.') for k in review['missing_fields'])
            pairs.append(dict(field='item',receipt=observed,marketplace=source,status='MISSING' if missing else 'MATCH' if observed==source else 'CONFLICT'))
        except (KeyError,TypeError):pairs.append(dict(field='item',receipt=None,marketplace=None,status='MISSING'))
        try:
            try:observed=datetime.fromisoformat(fields['timestamp'])
            except ValueError:observed=datetime.strptime(fields['timestamp'],'%d/%m/%Y %I:%M:%S %p %z')
            if observed.tzinfo is None:raise ValueError('Timestamp requires a timezone')
            source=datetime.fromisoformat(catalog['receipt_timestamp'])
            compare('timestamp',observed.replace(microsecond=0).isoformat(),source.astimezone(observed.tzinfo).replace(microsecond=0).isoformat())
        except (KeyError,TypeError,ValueError):compare('timestamp',None,catalog.get('receipt_timestamp'))
        for key,value in [('qr_reference',c['qr_reference']),('bank_debit_reference','BANK-'+c['qr_reference'])]:
            pairs.append(dict(field=key,receipt='Linked purchase context: '+value,marketplace=catalog.get(key),
                status='MISSING' if not catalog.get(key) else 'MATCH' if value==catalog[key] else 'CONFLICT'))
        pairs.append(dict(field='qr_posted_amount',receipt=c['qr_amount_minor'],marketplace=catalog.get('qr_posted_amount_minor'),status='MISSING' if not catalog.get('bank_debit_verified') or type(catalog.get('qr_posted_amount_minor')) is not int else 'MATCH' if catalog['qr_posted_amount_minor']==c['qr_amount_minor'] else 'CONFLICT'))
        if catalog.get('order_exists') is False:
            outcome='REJECTED';reason='Marketplace confirms this purchase order does not exist.'
        elif catalog.get('denial') or any(p['status']=='CONFLICT' for p in pairs):
            outcome='REJECTED';reason='The source records conflict with the receipt or exact transaction context.'
        elif any(p['status']=='MISSING' for p in pairs) or catalog.get('refunded'):
            outcome='UNCERTAIN';reason='Receipt evidence is incomplete or a prior refund needs human review.'
        elif not catalog.get('bank_debit_verified') or not catalog.get('cash_received') or type(catalog.get('qr_posted_amount_minor')) is not int:
            outcome='UNCERTAIN';reason='Both payment amounts are not independently corroborated.'
        else:
            excess=catalog['qr_posted_amount_minor']+catalog['cash_amount_minor']-catalog['invoice_total_minor']
            if excess<=0:
                outcome='REJECTED';reason_code='NO_OVERPAYMENT';reason='No duplicate payment was established. The receipt can be valid: the verified QR and cash amounts do not exceed the invoice total.'
            elif excess>catalog['qr_posted_amount_minor']:
                outcome='UNCERTAIN';reason='The overpayment exceeds the QR debit. Additional cash reconciliation requires human review.'
            else:
                outcome='LEGITIMATE';reason=f'Exact receipt, order and payment records establish a BDT {excess/100:.2f} overpayment.'
    bank_verified=bool(available and catalog.get('bank_debit_verified') and catalog.get('bank_debit_reference')=='BANK-'+c['qr_reference'] and type(catalog.get('qr_posted_amount_minor')) is int and catalog['qr_posted_amount_minor']==c['qr_amount_minor'])
    result=dict(id=uid('market'),outcome=outcome,reason=reason,reason_code=reason_code,comparisons=pairs,
        evidence_version=c['evidence_version'],evidence_ids=[scan['evidence_id']],source_id='MARKETPLACE-'+sim['purchase_id'],
        scan_id=scan['scan_id'],review_id=review['id'],bank_debit_verified=bank_verified,status='CURRENT',
        verified_excess_minor=excess,refund_amount_minor=excess if outcome=='LEGITIMATE' else None,
        eligibility=dict(invoice_total_minor=catalog.get('invoice_total_minor') if available else None,
            qr_posted_amount_minor=catalog.get('qr_posted_amount_minor') if available else None,
            cash_confirmed_minor=catalog.get('cash_amount_minor') if available else None,excess_minor=excess),at=now(),synthetic=True)
    pipeline=c.setdefault('qr_pipeline',{})
    if pipeline.get('verdict') and pipeline['verdict'].get('source_result_id')!=result['id']:invalidate_downstream(c,'Marketplace source result changed.')
    c['operator_state']='MARKETPLACE_QUERY_RETURNED';pipeline['marketplace']=result
    c['verified_bank_record']=dict(verified=bank_verified,reference='BANK-'+sim['qr_reference'],amount_minor=catalog['qr_posted_amount_minor'] if bank_verified else None,source='synthetic_bank_record')
    def field_state(keys):
        values=[v['status'] for v in pairs if v['field'] in keys]
        return 'uncertain' if len(values)!=len(keys) or 'MISSING' in values else 'rejected' if 'CONFLICT' in values else 'completed'
    states=dict(purchase_lookup='uncertain',order_match='uncertain',amount_match='uncertain',qr_lookup='uncertain',bank_debit='uncertain',cash_claim='uncertain')
    if available:
        states.update(purchase_lookup='rejected' if catalog.get('order_exists') is False else 'completed',
            order_match=field_state(['purchase_id','merchant','timestamp']),amount_match=field_state(['total','item','currency']),
            qr_lookup=field_state(['qr_reference']),bank_debit=field_state(['bank_debit_reference']) if bank_verified else 'uncertain',
            cash_claim='rejected' if catalog.get('denial') else field_state(['cash_reference','cash_paid']) if catalog.get('cash_received') else 'uncertain')
    result['node_states']=states
    for node,state in states.items():emit(c,actor,'MARKETPLACE_QUERY_COMPLETED',node,state,[scan['evidence_id']],reason)
    return result


def action(db, c, actor, p):
    pipeline=c.setdefault('qr_pipeline',{})
    market=pipeline.get('marketplace',{})
    action=p.get('action')
    if action=='review_receipt':return review_receipt(c,actor,p)
    review=current_review(c)
    if not market or market.get('status')=='STALE' or market.get('review_id')!=review['id'] or market.get('evidence_version')!=c['evidence_version']:
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
            pipeline['resolution']=dict(state='REFUND_PROPOSED',amount_minor=market['refund_amount_minor'],source_result_id=market['id'],review_id=review['id'],synthetic=True,evidence_version=c['evidence_version'])
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
