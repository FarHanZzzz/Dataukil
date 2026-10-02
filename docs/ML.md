# AI/ML and data context

Task: claim + bounded visible passage -> SUPPORTED_BY_PASSAGE, CONTRADICTED_BY_PASSAGE, INSUFFICIENT_EVIDENCE. Predict passage semantics only. Source capability/reference gates and amount arithmetic are deterministic and independent.

Candidate: frozen `intfloat/multilingual-e5-small` (MIT; Bengali listed) with mean-pooling, normalized 384-dimensional embeddings. Claim/passage embeddings, difference/product and explicit linguistic features feed a trained small classifier. Encoder similarity alone is not NLI. Encoder is not fine-tuned. Scores are not calibrated probabilities of financial truth.

Dataset plan: multilingual fictional template families with complete family/case grouping; no PaySim use, real customer data, hidden truth, scenario names or source authority in learned inputs. Separate authored challenge passages frozen before tuning. Generated labels require independent human review before production claims. Data card, annotation guide, split manifest, adjudication status and hashes are mandatory.

Evaluation: compare strong rules and retrieval-only against trained verifier, same inputs; actual confusion matrices, F1/language slices/abstention/citation/reference gates and measured latency. No external LLM baseline without credentials; mark unavailable. No human preparation/comprehension study without participants. Synthetic automated numbers are exploratory only.

## Implemented artifacts

Training: ml/build_data.py, ml/features.py, ml/train.py. Inference: tracefix/verifier.py. Actual classifier: models/verifier.joblib. Metadata: models/metadata.json; pinned encoder: models/encoder_source.json, downloaded files in models/encoder/. The upstream card is retained with the download and declares MIT. The archive CSV is unused.

Actual counts: 1,944 generated pairs / 324 fictional bundles: 1,080 train (180 bundles), 432 development (72), 432 grouped synthetic test (72). Three languages are equally represented in the generated pairs. Separately authored challenge: 37 pairs / 36 bundles, English 13, Bangla 12, Banglish 12. No independent human annotator has reviewed either corpus.

Frozen encoder revision: 614241f622f53c4eeff9890bdc4f31cfecc418b3. Head: StandardScaler + class-balanced logistic regression; C=1 selected on development. No encoder fine-tuning, probability calibration or hidden truth. Training wall time ~27.0 seconds on CPU (download/setup excluded).

## First evaluation (preserved)

| Suite | Rules macro F1 | Retrieval-only macro F1 | Trained head macro F1 |
|---|---:|---:|---:|
| Grouped synthetic / 432 pairs | 0.810 | 0.426 | 0.827 |
| Authored challenge / 37 pairs | 0.609 | 0.367 | 0.471 |

Raw artifacts: artifacts/evaluation_v1.json, predictions_v1.jsonl, ERROR_ANALYSIS_v1.md. Trained challenge accuracy 51.4%; grouped synthetic accuracy 88.2%. A narrow synthetic result did not generalize to broader wording. Trained unsupported-support fraction was zero in these small tests but useful coverage was limited; this is not a safety certification.

## Revised rules and runtime

Browser inspection found rules attributing a cash predicate to QR completion and a single posting to same-purchase linkage. Topic-scoped rule version 2 corrects those cases and handles request negation separately. Model weights/data labels are unchanged. Its challenge macro F1 is 0.972 on the **reused** frozen challenge, and grouped synthetic macro F1 is 0.622. Neither is an untouched-test estimate for the revised rules. artifacts/evaluation.json records v2 and test_reused=true; original results remain available in the judge view.

Rules are primary advisory assessments; real trained predictions remain displayed in the evidence matrix. Exact source/reference gates establish permitted operational facts independently of both methods. Changes in rule version or evidence version make older analyses stale. Missing model activates explicitly labelled rules fallback. Oversized text abstains without silent truncation.

The user approved synthetic-only scope. Independent bilingual review, authorized case data, cross-language claim/passage testing, staff preparation study, customer comprehension, LLM baseline, OCR and real partner performance remain future work. See REVIEW_PROTOCOL.md.
