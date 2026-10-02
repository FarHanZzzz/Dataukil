# Fictional evidence-pair dataset

No real customer data, archive transaction data, hidden truth or model-generated financial truth is used. Input schema: claim and passage only. Metadata: pair ID, case/group/split/language, candidate label and annotation status. IDs and metadata never enter features.

Nine phrase families are partitioned before fitting. Complete multilingual translations, topics and amount variants in a shared family stay in one split. This prevents exact family reuse but cannot establish natural-language generalization: the corpus deliberately shares a narrow claim inventory and topic vocabulary. Challenge examples are authored separately from the generator, frozen before fitting, and are still agent-authored and unreviewed by independent humans.

Document quality: clean text / human transcript. OCR accuracy is not evaluated because no OCR engine is used. Dataset is small, fictional, repetitive and exploratory; no production accuracy, cash authenticity, reimbursement prediction or fraud detection claim is supported.

Release gate: authorized, deidentified real retrospective cases, independent bilingual annotators, adjudication, revised dependence grouping, frozen held-out test, customer comprehension and staff preparation study. No participants or measured business benefit are fabricated.
