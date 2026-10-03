"""Rules-based investigation policy.

Pure functions over *returned observations*. It has no database handle, no scenario label and no access to the
simulator, so it can only decide from evidence the tools already returned. The runner validates every action against
the tool allowlist and budget; a language-model policy could implement the same two functions.
"""

MODE = 'rules'
MODE_LABEL = 'Rules-based investigation'


def _done(obs, tool):
    return tool in obs


def _ok(obs, tool):
    return tool in obs and obs[tool]['status'] == 'completed'


def next_action(view):
    """Return {'type':'check', tool, rationale, hypotheses, cites} or {'type':'conclude'}."""
    o = view['obs']
    cites = lambda *tools: [o[t]['id'] for t in tools if t in o]

    def check(tool, rationale, hyps, *cited):
        return dict(type='check', tool=tool, rationale=rationale, hypotheses=list(hyps), cites=cites(*cited))

    if not _done(o, 'bank_record_check'):
        return check('bank_record_check',
                     'Establish whether the bank actually posted the debit before drawing any conclusion about the wallet side.',
                     ['duplicate'])
    if not _done(o, 'wallet_ledger_check'):
        return check('wallet_ledger_check',
                     'The most direct explanation of a missing acknowledgement is a credit that posted without being acknowledged. Test it first.',
                     ['ack_lost', 'still_pending'], 'bank_record_check')
    w = o['wallet_ledger_check']
    credit_found = w['status'] == 'completed' and w['data'].get('found')
    if credit_found:
        if not _done(o, 'partner_status_check'):
            return check('partner_status_check',
                         'A posted credit leaves open why no acknowledgement arrived. Read the partner status and its callback delivery state.',
                         ['ack_lost'], 'wallet_ledger_check')
        return dict(type='conclude')
    if not _done(o, 'partner_status_check'):
        return check('partner_status_check',
                     'No credit is visible. Ask the partner whether it is still processing and which operations its contract permits.',
                     ['still_pending', 'source_unavailable'], 'wallet_ledger_check')
    if not _done(o, 'attempt_history_check'):
        return check('attempt_history_check',
                     'Confirm how many attempts exist before any replay is considered; a second attempt would raise duplicate risk.',
                     ['duplicate'], 'partner_status_check')
    if not _done(o, 'mapping_check'):
        return check('mapping_check',
                     'Verify that the intent maps to exactly one wallet account. A replay on an ambiguous mapping could credit the wrong account.',
                     ['mapping'], 'attempt_history_check')
    mapping = o['mapping_check']
    if _ok(o, 'mapping_check') and mapping['data'].get('ambiguous'):
        if not _done(o, 'eligibility_check'):
            return check('eligibility_check',
                         'The mapping is ambiguous. Evaluate whether any correction is permitted before proposing anything.',
                         ['mapping'], 'mapping_check', 'partner_status_check')
        return dict(type='conclude')
    if not _done(o, 'worker_error_check'):
        return check('worker_error_check',
                     'The mapping is clean and no credit exists. Look for an authorized worker error tied to this intent.',
                     ['worker_retryable', 'still_pending'], 'mapping_check', 'partner_status_check')
    if not _done(o, 'eligibility_check'):
        return check('eligibility_check',
                     'Evaluate the prerequisites for a permitted correction against the evidence gathered so far.',
                     ['worker_retryable', 'still_pending'], 'worker_error_check', 'mapping_check', 'partner_status_check')
    return dict(type='conclude')


def assess(tool, obs, view):
    """Hypothesis changes implied by one returned observation. Each cites the observation that supports it."""
    d, cur, oid = obs['data'], view['hyp'], obs['id']
    out = []

    def set_(hid, status, why):
        if cur.get(hid, {}).get('status', 'unchecked') != status:
            out.append(dict(hypothesis_id=hid, status=status, rationale=why, cites=[oid]))

    if tool == 'bank_record_check' and obs['status'] == 'completed':
        if d['debit_count'] == 1 and d['amount_matches']:
            set_('duplicate', 'ruled_out', 'One bank debit posting exists for this intent; no duplicate funding leg in this scope.')
        elif d['debit_count'] > 1:
            set_('duplicate', 'supported', 'More than one debit posting exists for this intent.')
    elif tool == 'wallet_ledger_check':
        if obs['status'] != 'completed':
            set_('ack_lost', 'unresolved', 'The wallet ledger could not be read.')
        elif d['found']:
            set_('ack_lost', 'supported', 'A matching credit is posted in the wallet ledger, so the missing acknowledgement does not mean the payment failed.')
            set_('still_pending', 'ruled_out', 'The credit is already posted, so processing is not pending.')
            set_('worker_retryable', 'ruled_out', 'The credit posted, so no pre-credit worker failure explains the symptom.')
        else:
            set_('ack_lost', 'ruled_out', f"No matching credit as of {d['as_of']}. This is a time-scoped lookup.")
    elif tool == 'partner_status_check':
        if obs['status'] != 'completed':
            set_('source_unavailable', 'supported', 'The partner status source did not respond; processing state is unknown from this source.')
            set_('still_pending', 'unresolved', 'Pending cannot be judged without the partner status.')
        else:
            state, caps = d['state'], d['capabilities']
            if state == 'completed':
                set_('still_pending', 'ruled_out', 'The partner reports the instruction as already processed.')
            elif caps.get('late_completion_possible'):
                set_('still_pending', 'supported', 'The partner reports the original instruction is queued and can still complete.')
            else:
                set_('still_pending', 'ruled_out', 'The partner reports no active processing for this intent.')
    elif tool == 'attempt_history_check':
        if d['count'] > 1:
            set_('duplicate', 'supported', f"{d['count']} attempts exist for this intent.")
        else:
            set_('duplicate', 'ruled_out', 'Only one attempt exists; no duplicate intent is visible in the connector log.')
    elif tool == 'mapping_check' and obs['status'] == 'completed':
        if d['ambiguous']:
            set_('mapping', 'supported', f"{len(d['candidates'])} wallet accounts match the reference and none is verified.")
        elif d['verified']:
            set_('mapping', 'ruled_out', 'The intent maps to exactly one wallet account.')
    elif tool == 'worker_error_check':
        if obs['status'] != 'completed':
            set_('worker_retryable', 'unresolved', 'Worker logs were not reachable.')
        elif d['error']:
            set_('worker_retryable', 'supported' if d['error']['retryable'] else 'unresolved',
                 f"{d['error']['code']} on attempt {d['error']['attempt_no']}: {d['error']['message']}")
        else:
            set_('worker_retryable', 'ruled_out', 'No worker error is recorded for this intent.')
    return out


def conclude(view):
    """Outcome from the evidence only: a permitted proposal, or an owned handoff with the specific next requirement."""
    o = view['obs']
    cites = [x['id'] for x in o.values()]
    w = o.get('wallet_ledger_check')
    if w and w['status'] == 'completed' and w['data'].get('found'):
        return dict(outcome='proposal', kind='REFRESH_CUSTOMER_STATUS', cites=cites,
                    summary='The wallet credit is posted. Only the acknowledgement path failed, so the customer status needs refreshing. No money moves.')
    e = o.get('eligibility_check')
    if e and e['status'] == 'completed':
        opts = {x['kind']: x for x in e['data']['options']}
        err = (o.get('worker_error_check') or {}).get('data', {}).get('error')
        if opts['RESUME_ORIGINAL']['eligible']:
            why = f"A retryable worker error ({err['code']}) stopped the credit before posting. " if err else ''
            return dict(outcome='proposal', kind='RESUME_ORIGINAL', cites=cites,
                        summary=why + 'Funding is confirmed, no credit exists, and the contract allows the original funded intent to resume once.')
        if opts['MONITOR_ORIGINAL']['eligible']:
            return dict(outcome='proposal', kind='MONITOR_ORIGINAL', cites=cites,
                        summary='No fault is located. The original transfer is queued and can still complete, so a return is not supported. Wait, keep an owned follow-up and escalate if it does not finish.')
    need = []
    m = o.get('mapping_check')
    if m and m['status'] == 'completed' and m['data'].get('ambiguous'):
        need.append('Obtain the partner\'s confirmation of the intended wallet account for this intent, then re-run the mapping and wallet checks.')
    p = o.get('partner_status_check')
    if p and p['status'] != 'completed':
        need.append('Restore access to the partner status source, or obtain the partner\'s own written confirmation of the processing state.')
    if not need:
        need.append('Review the saved evidence manually; no permitted correction applies and no cause is confirmed.')
    return dict(outcome='handoff', kind=None, cites=cites, next_requirement=' '.join(need),
                summary='Cause remains unconfirmed and no correction is permitted. The case returns to an owned operator queue with the next requirement.')
