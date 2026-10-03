"""Bounded local model adapter. Private reasoning is never stored or displayed."""
import asyncio
import json
import os
import time
import httpx
from pydantic import BaseModel, ConfigDict
from typing import Literal


class ModelAssessment(BaseModel):
    model_config=ConfigDict(extra='forbid')
    verification: Literal['SUPPORTS_CLAIM','CONTRADICTS_CLAIM','INCONCLUSIVE']
    hypothesis_order: list[str]
    action: Literal['REVERSE_DUPLICATE_DEBIT','RETRY_SETTLEMENT','SIMULATED_CORRECTION','MANUAL_REVIEW','NO_ACTION']
    evidence_ids: list[str]


async def assess(case, hypotheses, verdict, expected_action):
    model=os.environ.get('TRACEFIX_AI_MODEL','qwen3:4b-instruct')
    base=os.environ.get('TRACEFIX_OLLAMA_URL','http://127.0.0.1:11434').rstrip('/')
    allowed={e['id'] for e in case['evidence']}
    # Mandatory source facts and contradictions are retained. Oversized evidence abstains.
    packet=[dict(id=e['id'],category=e.get('category','Confirmed System Record' if e['kind'].startswith('mock_') else 'Customer Evidence'),
                 reference=e.get('reference'),amount_minor=e.get('amount_minor'),capability=e.get('capability'),
                 text=e['revisions'][-1]['text'][:350]) for e in case['evidence']]
    if len(packet)>24 or len(json.dumps(packet,ensure_ascii=False))>11000:
        return dict(available=False,model=model,error='Evidence packet exceeds the bounded live-model input; full deterministic checks retained.')
    prompt=('You assess a SYNTHETIC transaction incident using only supplied records. Customer statements are allegations. '
            'Retries do not establish another debit. Missing evidence is inconclusive. Never output private reasoning. '
            'Return compact JSON matching the schema. Rank only the listed hypothesis IDs. Cite only provided evidence IDs. '
            'The backend independently authorizes repair; proposals cannot perform actions. '
            f'Checked verdict: {verdict}. Evidence-derived candidate: {expected_action}. '
            f'Hypotheses: {json.dumps(hypotheses,ensure_ascii=False)}. '
            f'Current evidence: {json.dumps(packet,ensure_ascii=False)}.')
    started=time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45,connect=3)) as client:
            response=await asyncio.wait_for(client.post(base+'/api/chat',json=dict(
                model=model,messages=[dict(role='user',content=prompt)],format=ModelAssessment.model_json_schema(),
                stream=False,think=False,options=dict(temperature=0,num_ctx=4096,num_predict=320))),timeout=45)
            response.raise_for_status()
            value=ModelAssessment.model_validate_json(response.json()['message']['content'])
        if not value.evidence_ids or not set(value.evidence_ids)<=allowed:
            raise ValueError('Model citations do not identify reviewed evidence.')
        if not value.hypothesis_order or not set(value.hypothesis_order)<={h['id'] for h in hypotheses}:
            raise ValueError('Model hypothesis IDs are invalid.')
        if value.verification!=verdict:
            raise ValueError('Model verification contradicts the checked source facts.')
        return dict(available=True,model=model,seconds=round(time.monotonic()-started,2),assessment=value.model_dump(),
                    blocked_action=value.action if value.action!=expected_action else None,
                    private_reasoning_stored=False)
    except (Exception,asyncio.TimeoutError) as error:
        return dict(available=False,model=model,seconds=round(time.monotonic()-started,2),
                    error='Local model timeout.' if isinstance(error,(asyncio.TimeoutError,httpx.TimeoutException)) else type(error).__name__+': structured output could not be accepted.',
                    private_reasoning_stored=False)
