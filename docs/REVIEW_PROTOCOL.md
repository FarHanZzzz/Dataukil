# Independent grounding and release protocol

Current corpus: fictional, agent-authored labels. Current human reviewer count: zero. No real-world accuracy or independent benchmark is established. Real accounts and customer records must not be introduced without authorization and de-identification.

## Obtain evidence
Collect a bounded retrospective set through an approved provider or merchant process. Remove names, account identifiers, phone numbers and unneeded personal details. Preserve the logical purchase/payment relationship, source type, actual text and necessary negation. Define the evidence authority contract before ingestion.

## Blind annotation
Two independent bilingual reviewers inspect each visible claim/passage pair. They receive no generator truth, model prediction, scenario title or candidate label. They assign one of the three labels using data/ANNOTATION_GUIDE.md and a rationale. The script `scripts/export_review_packet.py` creates an immediately usable blind packet from the fictional challenge as a workflow rehearsal; this does not turn it into real provider validation.

Require reviewer IDs and reviewer independence from corpus authoring. Discuss disagreement only after independent labels are saved. Record adjudicator ID, final visible-text rationale and changes. Measure agreement before adjudication. Do not use review decisions, author roles or hidden-world truth as target labels.

## Splits and training
Partition entire connected purchase/case/template groups. Fit preprocessing and classifier on training only, select on development, and freeze new independent tests before selection. First model current test was frozen before fitting. Rules were later corrected after browser inspection; rule v2 scores reuse the old test and do not qualify as an independent final test. Original model and v1 results remain saved.

## Real evaluation
Include Bangla, Banglish, English, implicit negation, qualifiers, unrelated references, split tender, equal-value separate purchases, merchant disagreement and repayment stages. Keep document/OCR errors separate from text labels. Compare rules, retrieval, optional configured LLM and trained verifier using equal evidence and coverage. Verify source citations and unsupported operational conclusions independently.

Measure staff case preparation and customer comprehension with actual participants and counterbalanced tasks. Save counts, corrections, incomplete investigations and waiting time. Do not infer bank savings from synthetic units.

## Go/no-go
Only supervised shadow evaluation after dataset permission, independent annotation, acceptable held-out errors and source-contract validation. Current local demo is usable for workflow review; financial action routes remain absent. Public deployment/production identity are outside the current local build.
