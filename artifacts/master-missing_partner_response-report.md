# TraceFix investigation report

**Synthetic payment and sandbox correction records only.**

## Case Information

```json
{
  "id": "case_017e048acb76",
  "reference": "TF-5A08B4BCB32F",
  "incident_id": "incident_47cc49dd21ce",
  "transaction_id": "txn_4a027038b12d",
  "customer_name": "Nadia — fictional QA",
  "reported_amount_minor": 100000,
  "issue_type": "PAID_TWICE",
  "owner": "staff_2",
  "status": "ESCALATED",
  "version": 6
}
```

## Customer Statement

Please verify this ৳1,000 transfer and all exact postings.

## Customer Reported Context

```json
{
  "transaction_reference": "txn_4a027038b12d",
  "merchant_information": "Fictional recipient wallet",
  "approximate_time": "03 October 2026, Bangladesh time"
}
```

## Transaction Reconstruction

```json
{
  "id": "txn_4a027038b12d",
  "incident_id": "incident_47cc49dd21ce",
  "case_id": "case_017e048acb76",
  "amount_minor": 100000,
  "currency": "BDT",
  "scale": 2,
  "source_account": "DEMO-BANK-1-0042",
  "destination_wallet": "DEMO-UPAY-1-0187",
  "state": "UNCERTAIN",
  "current_stage": "wallet",
  "initiated_at": "2026-10-03T02:32:54.735935+00:00",
  "updated_at": "2026-10-03T02:32:54.844461+00:00",
  "version": 8,
  "step": 6,
  "customer_name": "Nadia — fictional QA",
  "reset_of": null,
  "pipeline": [
    {
      "id": "customer",
      "title": "Customer initiated",
      "status": "completed",
      "purpose": "Identify the intended amount, source account and destination wallet.",
      "event_ids": [
        "event_a0d71e5710b0"
      ],
      "summary": "Simulated bank-to-upay transfer BDT 1000.00 initiated."
    },
    {
      "id": "gateway",
      "title": "MFS gateway",
      "status": "completed",
      "purpose": "Accept the request and assign one correlation identity.",
      "event_ids": [
        "event_2d100b3645ea"
      ],
      "summary": "Gateway request accepted and exact transaction reference matched."
    },
    {
      "id": "bank",
      "title": "Bank / partner",
      "status": "completed",
      "purpose": "Record the bank debit under the exact transfer reference.",
      "event_ids": [
        "event_b3e4b112f79d",
        "event_8745610614a5"
      ],
      "summary": "The bank posting inventory for this exact reference is complete as of this recorded check."
    },
    {
      "id": "queue",
      "title": "Processing queue",
      "status": "completed",
      "purpose": "Track queued processing and retry attempts without assuming another payment.",
      "event_ids": [
        "event_9839d4ef2a56"
      ],
      "summary": "Retry request recorded under the same transaction."
    },
    {
      "id": "response",
      "title": "Response",
      "status": "unknown",
      "purpose": "Check whether the partner returned a verified outcome.",
      "event_ids": [
        "event_d2b7e26b157b"
      ],
      "summary": "Final partner response is not available. This does not establish a failed or duplicate settlement."
    },
    {
      "id": "settlement",
      "title": "Settlement",
      "status": "unknown",
      "purpose": "Reconcile the bank posting with final settlement.",
      "event_ids": [
        "event_040c7909df95"
      ],
      "summary": "Final settlement is not confirmed by the available records."
    },
    {
      "id": "wallet",
      "title": "upay wallet",
      "status": "unknown",
      "purpose": "Confirm the intended wallet credit or retain the unresolved outcome.",
      "event_ids": [
        "event_8227ef1f20b2"
      ],
      "summary": "Wallet completion remains unknown; further verification is required."
    }
  ],
  "synthetic": true,
  "can_advance": false,
  "balances": {
    "BANK": 900000,
    "WALLET": 200000,
    "SUSPENSE": 100000
  },
  "timeline": [
    {
      "id": "event_a0d71e5710b0",
      "timestamp": "2026-10-03T02:32:54.735935+00:00",
      "stage": "customer",
      "status": "completed",
      "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
      "purpose": "Identify the intended amount, source account and destination wallet."
    },
    {
      "id": "event_2d100b3645ea",
      "timestamp": "2026-10-03T02:32:56.735935+00:00",
      "stage": "gateway",
      "status": "completed",
      "text": "Gateway request accepted and exact transaction reference matched.",
      "purpose": "Accept the request and assign one correlation identity."
    },
    {
      "id": "event_b3e4b112f79d",
      "timestamp": "2026-10-03T02:32:58.735935+00:00",
      "stage": "bank",
      "status": "completed",
      "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
      "purpose": "Record the bank debit under the exact transfer reference."
    },
    {
      "id": "event_9839d4ef2a56",
      "timestamp": "2026-10-03T02:33:00.735935+00:00",
      "stage": "queue",
      "status": "completed",
      "text": "Retry request recorded under the same transaction.",
      "purpose": "Track queued processing and retry attempts without assuming another payment."
    },
    {
      "id": "event_d2b7e26b157b",
      "timestamp": "2026-10-03T02:33:02.735935+00:00",
      "stage": "response",
      "status": "unknown",
      "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
      "purpose": "Check whether the partner returned a verified outcome."
    },
    {
      "id": "event_040c7909df95",
      "timestamp": "2026-10-03T02:33:04.735935+00:00",
      "stage": "settlement",
      "status": "unknown",
      "text": "Final settlement is not confirmed by the available records.",
      "purpose": "Reconcile the bank posting with final settlement."
    },
    {
      "id": "event_8227ef1f20b2",
      "timestamp": "2026-10-03T02:33:06.735935+00:00",
      "stage": "wallet",
      "status": "unknown",
      "text": "Wallet completion remains unknown; further verification is required.",
      "purpose": "Confirm the intended wallet credit or retain the unresolved outcome."
    },
    {
      "id": "event_8745610614a5",
      "timestamp": "2026-10-03T02:33:08.735935+00:00",
      "stage": "bank",
      "status": "completed",
      "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
      "purpose": "Record the bank debit under the exact transfer reference."
    }
  ],
  "events": [
    {
      "id": "event_a0d71e5710b0",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 1,
      "timestamp": "2026-10-03T02:32:54.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.736083+00:00",
      "stage": "customer",
      "source": "customer",
      "status": "completed",
      "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
      "purpose": "Identify the intended amount, source account and destination wallet.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_77dd9ff58f96",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.736101+00:00",
        "event_at": "2026-10-03T02:32:54.735935+00:00",
        "as_of": "2026-10-03T02:32:54.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": 100000,
        "capability": "transfer_intent",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
        "original_hash": "5730ed78e93b586c237c10af6ca9a47d4aec3e349b71b941349461f26f9c3d41",
        "revisions": [
          {
            "version": 1,
            "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.736101+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_a0d71e5710b0",
        "source": "customer",
        "record": {
          "id": "event_a0d71e5710b0",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 1,
          "timestamp": "2026-10-03T02:32:54.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.736083+00:00",
          "stage": "customer",
          "source": "customer",
          "status": "completed",
          "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
          "purpose": "Identify the intended amount, source account and destination wallet.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_2d100b3645ea",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 2,
      "timestamp": "2026-10-03T02:32:56.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.755554+00:00",
      "stage": "gateway",
      "source": "gateway",
      "status": "completed",
      "text": "Gateway request accepted and exact transaction reference matched.",
      "purpose": "Accept the request and assign one correlation identity.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_a0d71e5710b0"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_a627ec494753",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.755600+00:00",
        "event_at": "2026-10-03T02:32:56.735935+00:00",
        "as_of": "2026-10-03T02:32:56.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": null,
        "capability": "gateway_accepted",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Gateway request accepted and exact transaction reference matched.",
        "original_hash": "8f99579eb178d56c9dba85af4fe06cdd02e717c578d52fa9a13725f501c16d3f",
        "revisions": [
          {
            "version": 1,
            "text": "Gateway request accepted and exact transaction reference matched.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.755600+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_2d100b3645ea",
        "source": "gateway",
        "record": {
          "id": "event_2d100b3645ea",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 2,
          "timestamp": "2026-10-03T02:32:56.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.755554+00:00",
          "stage": "gateway",
          "source": "gateway",
          "status": "completed",
          "text": "Gateway request accepted and exact transaction reference matched.",
          "purpose": "Accept the request and assign one correlation identity.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_a0d71e5710b0"
          ],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_b3e4b112f79d",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 3,
      "timestamp": "2026-10-03T02:32:58.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.772460+00:00",
      "stage": "bank",
      "source": "bank",
      "status": "completed",
      "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
      "purpose": "Record the bank debit under the exact transfer reference.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_2d100b3645ea"
      ],
      "error": null,
      "synthetic": true,
      "posting_id": "posting_6285711e9b63",
      "evidence": {
        "id": "ev_e709c9e1ae8c",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.772477+00:00",
        "event_at": "2026-10-03T02:32:58.735935+00:00",
        "as_of": "2026-10-03T02:32:58.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": 100000,
        "capability": "bank_debit",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
        "original_hash": "778c68d5c687533b5ee8f470b215044508cd7a69eeaf6c9dc7d5303e90cf9e08",
        "revisions": [
          {
            "version": 1,
            "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.772477+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_b3e4b112f79d",
        "source": "bank",
        "record": {
          "id": "event_b3e4b112f79d",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 3,
          "timestamp": "2026-10-03T02:32:58.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.772460+00:00",
          "stage": "bank",
          "source": "bank",
          "status": "completed",
          "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
          "purpose": "Record the bank debit under the exact transfer reference.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_2d100b3645ea"
          ],
          "error": null,
          "synthetic": true,
          "posting_id": "posting_6285711e9b63"
        }
      }
    },
    {
      "id": "event_9839d4ef2a56",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 4,
      "timestamp": "2026-10-03T02:33:00.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.790893+00:00",
      "stage": "queue",
      "source": "queue",
      "status": "completed",
      "text": "Retry request recorded under the same transaction.",
      "purpose": "Track queued processing and retry attempts without assuming another payment.",
      "attempt_id": "txn_4a027038b12d:attempt:2",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 1,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": {
        "name": "sandbox-settlement",
        "depth": 1,
        "held": false
      },
      "related_event_ids": [
        "event_b3e4b112f79d"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_43cd1a91e1bc",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.790918+00:00",
        "event_at": "2026-10-03T02:33:00.735935+00:00",
        "as_of": "2026-10-03T02:33:00.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": null,
        "capability": "retry_observed",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Retry request recorded under the same transaction.",
        "original_hash": "bb049fd08d43d67118173ae117b594c4da1d3975b90da44154eb676fc7250b99",
        "revisions": [
          {
            "version": 1,
            "text": "Retry request recorded under the same transaction.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.790918+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_9839d4ef2a56",
        "source": "queue",
        "record": {
          "id": "event_9839d4ef2a56",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 4,
          "timestamp": "2026-10-03T02:33:00.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.790893+00:00",
          "stage": "queue",
          "source": "queue",
          "status": "completed",
          "text": "Retry request recorded under the same transaction.",
          "purpose": "Track queued processing and retry attempts without assuming another payment.",
          "attempt_id": "txn_4a027038b12d:attempt:2",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 1,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": {
            "name": "sandbox-settlement",
            "depth": 1,
            "held": false
          },
          "related_event_ids": [
            "event_b3e4b112f79d"
          ],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_d2b7e26b157b",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 5,
      "timestamp": "2026-10-03T02:33:02.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.808538+00:00",
      "stage": "response",
      "source": "response",
      "status": "unknown",
      "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
      "purpose": "Check whether the partner returned a verified outcome.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": 30000,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_9839d4ef2a56"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_7d6dc7b81eb6",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.808556+00:00",
        "event_at": "2026-10-03T02:33:02.735935+00:00",
        "as_of": "2026-10-03T02:33:02.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": null,
        "capability": "response_missing",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
        "original_hash": "f9cb671674128e49e997e9c9b46d7d02f6fd4e808d13c06e2924b7d687ebd7c5",
        "revisions": [
          {
            "version": 1,
            "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.808556+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_d2b7e26b157b",
        "source": "response",
        "record": {
          "id": "event_d2b7e26b157b",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 5,
          "timestamp": "2026-10-03T02:33:02.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.808538+00:00",
          "stage": "response",
          "source": "response",
          "status": "unknown",
          "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
          "purpose": "Check whether the partner returned a verified outcome.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": 30000,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_9839d4ef2a56"
          ],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_040c7909df95",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 6,
      "timestamp": "2026-10-03T02:33:04.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.826137+00:00",
      "stage": "settlement",
      "source": "settlement",
      "status": "unknown",
      "text": "Final settlement is not confirmed by the available records.",
      "purpose": "Reconcile the bank posting with final settlement.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_d2b7e26b157b"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_2dc78272037d",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.826166+00:00",
        "event_at": "2026-10-03T02:33:04.735935+00:00",
        "as_of": "2026-10-03T02:33:04.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": null,
        "capability": "settlement_unknown",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Final settlement is not confirmed by the available records.",
        "original_hash": "be7dd8e4ea735064964a6f5a6cdbaaea22c55c6a3db90ed27556a7e9feb30781",
        "revisions": [
          {
            "version": 1,
            "text": "Final settlement is not confirmed by the available records.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.826166+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_040c7909df95",
        "source": "settlement",
        "record": {
          "id": "event_040c7909df95",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 6,
          "timestamp": "2026-10-03T02:33:04.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.826137+00:00",
          "stage": "settlement",
          "source": "settlement",
          "status": "unknown",
          "text": "Final settlement is not confirmed by the available records.",
          "purpose": "Reconcile the bank posting with final settlement.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_d2b7e26b157b"
          ],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_8227ef1f20b2",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 7,
      "timestamp": "2026-10-03T02:33:06.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.844119+00:00",
      "stage": "wallet",
      "source": "wallet",
      "status": "unknown",
      "text": "Wallet completion remains unknown; further verification is required.",
      "purpose": "Confirm the intended wallet credit or retain the unresolved outcome.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_040c7909df95"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_6edf866c4e95",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.844145+00:00",
        "event_at": "2026-10-03T02:33:06.735935+00:00",
        "as_of": "2026-10-03T02:33:06.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": 0,
        "capability": "wallet_unknown",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "Wallet completion remains unknown; further verification is required.",
        "original_hash": "abb4bbc567fbc4535bd2821d358416c873968fc1a8101e85edd104fb63171e2e",
        "revisions": [
          {
            "version": 1,
            "text": "Wallet completion remains unknown; further verification is required.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.844145+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_8227ef1f20b2",
        "source": "wallet",
        "record": {
          "id": "event_8227ef1f20b2",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 7,
          "timestamp": "2026-10-03T02:33:06.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.844119+00:00",
          "stage": "wallet",
          "source": "wallet",
          "status": "unknown",
          "text": "Wallet completion remains unknown; further verification is required.",
          "purpose": "Confirm the intended wallet credit or retain the unresolved outcome.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_040c7909df95"
          ],
          "error": null,
          "synthetic": true
        }
      }
    },
    {
      "id": "event_8745610614a5",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 8,
      "timestamp": "2026-10-03T02:33:08.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.844357+00:00",
      "stage": "bank",
      "source": "bank",
      "status": "completed",
      "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
      "purpose": "Record the bank debit under the exact transfer reference.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_8227ef1f20b2"
      ],
      "error": null,
      "synthetic": true,
      "evidence": {
        "id": "ev_e07788791696",
        "kind": "mock_pipeline",
        "supplied_by": "mock_adapter",
        "category": "Confirmed System Record",
        "reliability": "Confirmed",
        "received_at": "2026-10-03T02:32:54.844372+00:00",
        "event_at": "2026-10-03T02:33:08.735935+00:00",
        "as_of": "2026-10-03T02:33:08.735935+00:00",
        "scope": "this fictional purchase only",
        "reference": "txn_4a027038b12d",
        "purchase_id": "incident_47cc49dd21ce",
        "amount_minor": null,
        "capability": "bank_inventory_complete",
        "verification": "documented synthetic fixture contract",
        "authority": "confirmed within simulated source contract",
        "original": "The bank posting inventory for this exact reference is complete as of this recorded check.",
        "original_hash": "3e09c27ad1430b0a57855a98113f61bc8985f02ceb2fe912d0447bb2915db8ef",
        "revisions": [
          {
            "version": 1,
            "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
            "actor": "fixture",
            "at": "2026-10-03T02:32:54.844372+00:00",
            "reason": "original"
          }
        ],
        "blob": null,
        "transaction_id": "txn_4a027038b12d",
        "event_id": "event_8745610614a5",
        "source": "bank",
        "record": {
          "id": "event_8745610614a5",
          "transaction_id": "txn_4a027038b12d",
          "incident_id": "incident_47cc49dd21ce",
          "case_id": null,
          "sequence": 8,
          "timestamp": "2026-10-03T02:33:08.735935+00:00",
          "recorded_at": "2026-10-03T02:32:54.844357+00:00",
          "stage": "bank",
          "source": "bank",
          "status": "completed",
          "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
          "purpose": "Record the bank debit under the exact transfer reference.",
          "attempt_id": "txn_4a027038b12d:attempt:1",
          "correlation_id": "corr_88523e3c82d9",
          "retry_count": 0,
          "timeout_ms": null,
          "request": {
            "transaction_id": "txn_4a027038b12d",
            "amount_minor": 100000,
            "destination": "DEMO-UPAY-1-0187"
          },
          "response": null,
          "queue": null,
          "related_event_ids": [
            "event_8227ef1f20b2"
          ],
          "error": null,
          "synthetic": true
        }
      }
    }
  ],
  "ledger": {
    "entries": [
      {
        "id": "posting_6285711e9b63",
        "transaction_id": "txn_4a027038b12d",
        "incident_id": "incident_47cc49dd21ce",
        "at": "2026-10-03T02:32:54.772361+00:00",
        "kind": "BANK_DEBIT",
        "amount_minor": 100000,
        "postings": {
          "BANK": -100000,
          "SUSPENSE": 100000
        },
        "original_posting_id": null,
        "synthetic": true
      }
    ],
    "balances": {
      "BANK": 900000,
      "WALLET": 200000,
      "SUSPENSE": 100000
    },
    "balanced": true
  }
}
```

## Evidence Reviewed

```json
[
  {
    "id": "ev_6e1d9f1226ac",
    "kind": "customer_supplied",
    "category": "Customer Statement",
    "reliability": "User-provided",
    "authority": "supplied / unverified",
    "supplied_by": "customer_1",
    "reference": null,
    "event_at": "2026-10-03T02:32:54.862539+00:00",
    "received_at": "2026-10-03T02:32:54.862539+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "5bdd2e7a9bc67ad5817f224c9d305bdf8d46d0cb2de28d7fa8d53a47cec878a3",
    "revisions": [
      {
        "version": 1,
        "text": "Please verify this ৳1,000 transfer and all exact postings.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.862539+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": null,
    "event_id": null,
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": null,
    "assertion": null,
    "record": null
  },
  {
    "id": "ev_da993675487e",
    "kind": "customer_supplied",
    "category": "Customer Evidence",
    "reliability": "User-provided",
    "authority": "supplied / unverified",
    "supplied_by": "customer",
    "reference": null,
    "event_at": "2026-10-03T02:32:54.862604+00:00",
    "received_at": "2026-10-03T02:32:54.862604+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "3f280e60dfea65ceed7701430da71aa37738cae3927c75cf5300639196371d4f",
    "revisions": [
      {
        "version": 1,
        "text": "Customer screenshot wording: payment confirmation unclear.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.862604+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": null,
    "event_id": null,
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": null,
    "assertion": null,
    "record": null
  },
  {
    "id": "ev_77dd9ff58f96",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:32:54.735935+00:00",
    "received_at": "2026-10-03T02:32:54.736101+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "5730ed78e93b586c237c10af6ca9a47d4aec3e349b71b941349461f26f9c3d41",
    "revisions": [
      {
        "version": 1,
        "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.736101+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_a0d71e5710b0",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": 100000,
    "capability": "transfer_intent",
    "assertion": null,
    "record": {
      "id": "event_a0d71e5710b0",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 1,
      "timestamp": "2026-10-03T02:32:54.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.736083+00:00",
      "stage": "customer",
      "source": "customer",
      "status": "completed",
      "text": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
      "purpose": "Identify the intended amount, source account and destination wallet.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_a627ec494753",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:32:56.735935+00:00",
    "received_at": "2026-10-03T02:32:54.755600+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "8f99579eb178d56c9dba85af4fe06cdd02e717c578d52fa9a13725f501c16d3f",
    "revisions": [
      {
        "version": 1,
        "text": "Gateway request accepted and exact transaction reference matched.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.755600+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_2d100b3645ea",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": "gateway_accepted",
    "assertion": null,
    "record": {
      "id": "event_2d100b3645ea",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 2,
      "timestamp": "2026-10-03T02:32:56.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.755554+00:00",
      "stage": "gateway",
      "source": "gateway",
      "status": "completed",
      "text": "Gateway request accepted and exact transaction reference matched.",
      "purpose": "Accept the request and assign one correlation identity.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_a0d71e5710b0"
      ],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_e709c9e1ae8c",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:32:58.735935+00:00",
    "received_at": "2026-10-03T02:32:54.772477+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "778c68d5c687533b5ee8f470b215044508cd7a69eeaf6c9dc7d5303e90cf9e08",
    "revisions": [
      {
        "version": 1,
        "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.772477+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_b3e4b112f79d",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": 100000,
    "capability": "bank_debit",
    "assertion": null,
    "record": {
      "id": "event_b3e4b112f79d",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 3,
      "timestamp": "2026-10-03T02:32:58.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.772460+00:00",
      "stage": "bank",
      "source": "bank",
      "status": "completed",
      "text": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
      "purpose": "Record the bank debit under the exact transfer reference.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_2d100b3645ea"
      ],
      "error": null,
      "synthetic": true,
      "posting_id": "posting_6285711e9b63"
    }
  },
  {
    "id": "ev_e07788791696",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:33:08.735935+00:00",
    "received_at": "2026-10-03T02:32:54.844372+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "3e09c27ad1430b0a57855a98113f61bc8985f02ceb2fe912d0447bb2915db8ef",
    "revisions": [
      {
        "version": 1,
        "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.844372+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_8745610614a5",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": "bank_inventory_complete",
    "assertion": null,
    "record": {
      "id": "event_8745610614a5",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 8,
      "timestamp": "2026-10-03T02:33:08.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.844357+00:00",
      "stage": "bank",
      "source": "bank",
      "status": "completed",
      "text": "The bank posting inventory for this exact reference is complete as of this recorded check.",
      "purpose": "Record the bank debit under the exact transfer reference.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_8227ef1f20b2"
      ],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_43cd1a91e1bc",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:33:00.735935+00:00",
    "received_at": "2026-10-03T02:32:54.790918+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "bb049fd08d43d67118173ae117b594c4da1d3975b90da44154eb676fc7250b99",
    "revisions": [
      {
        "version": 1,
        "text": "Retry request recorded under the same transaction.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.790918+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_9839d4ef2a56",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": "retry_observed",
    "assertion": null,
    "record": {
      "id": "event_9839d4ef2a56",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 4,
      "timestamp": "2026-10-03T02:33:00.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.790893+00:00",
      "stage": "queue",
      "source": "queue",
      "status": "completed",
      "text": "Retry request recorded under the same transaction.",
      "purpose": "Track queued processing and retry attempts without assuming another payment.",
      "attempt_id": "txn_4a027038b12d:attempt:2",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 1,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": {
        "name": "sandbox-settlement",
        "depth": 1,
        "held": false
      },
      "related_event_ids": [
        "event_b3e4b112f79d"
      ],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_7d6dc7b81eb6",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:33:02.735935+00:00",
    "received_at": "2026-10-03T02:32:54.808556+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "f9cb671674128e49e997e9c9b46d7d02f6fd4e808d13c06e2924b7d687ebd7c5",
    "revisions": [
      {
        "version": 1,
        "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.808556+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_d2b7e26b157b",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": "response_missing",
    "assertion": null,
    "record": {
      "id": "event_d2b7e26b157b",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 5,
      "timestamp": "2026-10-03T02:33:02.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.808538+00:00",
      "stage": "response",
      "source": "response",
      "status": "unknown",
      "text": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
      "purpose": "Check whether the partner returned a verified outcome.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": 30000,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_9839d4ef2a56"
      ],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_2dc78272037d",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:33:04.735935+00:00",
    "received_at": "2026-10-03T02:32:54.826166+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "be7dd8e4ea735064964a6f5a6cdbaaea22c55c6a3db90ed27556a7e9feb30781",
    "revisions": [
      {
        "version": 1,
        "text": "Final settlement is not confirmed by the available records.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.826166+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_040c7909df95",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": null,
    "capability": "settlement_unknown",
    "assertion": null,
    "record": {
      "id": "event_040c7909df95",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 6,
      "timestamp": "2026-10-03T02:33:04.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.826137+00:00",
      "stage": "settlement",
      "source": "settlement",
      "status": "unknown",
      "text": "Final settlement is not confirmed by the available records.",
      "purpose": "Reconcile the bank posting with final settlement.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_d2b7e26b157b"
      ],
      "error": null,
      "synthetic": true
    }
  },
  {
    "id": "ev_6edf866c4e95",
    "kind": "mock_pipeline",
    "category": "Confirmed System Record",
    "reliability": "Confirmed",
    "authority": "confirmed within simulated source contract",
    "supplied_by": "mock_adapter",
    "reference": "txn_4a027038b12d",
    "event_at": "2026-10-03T02:33:06.735935+00:00",
    "received_at": "2026-10-03T02:32:54.844145+00:00",
    "scope": "this fictional purchase only",
    "original_hash": "abb4bbc567fbc4535bd2821d358416c873968fc1a8101e85edd104fb63171e2e",
    "revisions": [
      {
        "version": 1,
        "text": "Wallet completion remains unknown; further verification is required.",
        "actor": "fixture",
        "at": "2026-10-03T02:32:54.844145+00:00",
        "reason": "original"
      }
    ],
    "transaction_id": "txn_4a027038b12d",
    "event_id": "event_8227ef1f20b2",
    "purchase_id": "incident_47cc49dd21ce",
    "amount_minor": 0,
    "capability": "wallet_unknown",
    "assertion": null,
    "record": {
      "id": "event_8227ef1f20b2",
      "transaction_id": "txn_4a027038b12d",
      "incident_id": "incident_47cc49dd21ce",
      "case_id": null,
      "sequence": 7,
      "timestamp": "2026-10-03T02:33:06.735935+00:00",
      "recorded_at": "2026-10-03T02:32:54.844119+00:00",
      "stage": "wallet",
      "source": "wallet",
      "status": "unknown",
      "text": "Wallet completion remains unknown; further verification is required.",
      "purpose": "Confirm the intended wallet credit or retain the unresolved outcome.",
      "attempt_id": "txn_4a027038b12d:attempt:1",
      "correlation_id": "corr_88523e3c82d9",
      "retry_count": 0,
      "timeout_ms": null,
      "request": {
        "transaction_id": "txn_4a027038b12d",
        "amount_minor": 100000,
        "destination": "DEMO-UPAY-1-0187"
      },
      "response": null,
      "queue": null,
      "related_event_ids": [
        "event_040c7909df95"
      ],
      "error": null,
      "synthetic": true
    }
  }
]
```

## Verifier Readings

```json
[
  {
    "id": "analysis_a0523fbaf677",
    "at": "2026-10-03T02:32:55.938927+00:00",
    "run_id": "run_3d2210ff6090",
    "model": {
      "engine": "rules_primary_with_trained_advisory",
      "available": true,
      "metadata": {
        "task": "three-label visible claim/passage assessment",
        "architecture": "frozen multilingual E5-small + standardized logistic regression head",
        "encoder": {
          "repo": "intfloat/multilingual-e5-small",
          "revision": "614241f622f53c4eeff9890bdc4f31cfecc418b3",
          "license": "MIT",
          "encoder_frozen": true
        },
        "labels": [
          "SUPPORTED_BY_PASSAGE",
          "CONTRADICTED_BY_PASSAGE",
          "INSUFFICIENT_EVIDENCE"
        ],
        "classifier_sha256": "7ae461354e62671b66c06f32d83a7388410669dff3d1b7916b9e6edf1b1d6a5c",
        "dataset_sha256": "2da7c31503bb26ff41e6b9e4997892a02773728211a4ca66f90fe7f6c4445966",
        "challenge_sha256_before_selection": "9851d23bc7298d08b175b8bb8bbcc295b12ff1896f50f063aae18df4b83368a2",
        "preprocessing": {
          "normalization": "NFC + Bengali digits to ASCII for model only; originals preserved",
          "max_tokens": 256,
          "prefix": "query: ",
          "pooling": "masked mean, L2 normalization"
        },
        "trained_component": "logistic regression head only",
        "encoder_finetuned": false,
        "calibrated": false,
        "training_pairs": 1080,
        "development_pairs": 432,
        "chosen_C": 1.0,
        "development_candidates": [
          {
            "C": 0.05,
            "dev_macro_f1": 0.6651168070660542
          },
          {
            "C": 0.2,
            "dev_macro_f1": 0.6613563145184832
          },
          {
            "C": 1.0,
            "dev_macro_f1": 0.6710291025643574
          }
        ],
        "training_seconds": 27.02879670006223,
        "python": "3.13.7",
        "independent_human_review": false,
        "limitations": "Fictional agent-labelled corpus; no production/domain accuracy certification."
      },
      "error": null,
      "runtime_policy": {
        "primary": "rules",
        "trained_advisory": true,
        "reason": "Select the more reliable measured path on the frozen authored challenge; this is not independent human validation.",
        "evaluation_version": 2,
        "rules_version": 2
      },
      "rules_version": 2,
      "limitations": "Synthetic agent-labelled training; no independent human validation; not a financial truth score."
    },
    "claims": [
      {
        "id": "debit",
        "text": "The bank account was debited.",
        "links": [
          {
            "evidence_id": "ev_6e1d9f1226ac",
            "excerpt": "Please verify this ৳1,000 transfer and all exact postings.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_da993675487e",
            "excerpt": "Customer screenshot wording: payment confirmation unclear.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_77dd9ff58f96",
            "excerpt": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_a627ec494753",
            "excerpt": "Gateway request accepted and exact transaction reference matched.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e709c9e1ae8c",
            "excerpt": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e07788791696",
            "excerpt": "The bank posting inventory for this exact reference is complete as of this recorded check.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_43cd1a91e1bc",
            "excerpt": "Retry request recorded under the same transaction.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_7d6dc7b81eb6",
            "excerpt": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_2dc78272037d",
            "excerpt": "Final settlement is not confirmed by the available records.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_6edf866c4e95",
            "excerpt": "Wallet completion remains unknown; further verification is required.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          }
        ]
      },
      {
        "id": "duplicate",
        "text": "Two bank debits occurred for the same transfer.",
        "links": [
          {
            "evidence_id": "ev_6e1d9f1226ac",
            "excerpt": "Please verify this ৳1,000 transfer and all exact postings.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_da993675487e",
            "excerpt": "Customer screenshot wording: payment confirmation unclear.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_77dd9ff58f96",
            "excerpt": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_a627ec494753",
            "excerpt": "Gateway request accepted and exact transaction reference matched.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e709c9e1ae8c",
            "excerpt": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e07788791696",
            "excerpt": "The bank posting inventory for this exact reference is complete as of this recorded check.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_43cd1a91e1bc",
            "excerpt": "Retry request recorded under the same transaction.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_7d6dc7b81eb6",
            "excerpt": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_2dc78272037d",
            "excerpt": "Final settlement is not confirmed by the available records.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_6edf866c4e95",
            "excerpt": "Wallet completion remains unknown; further verification is required.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          }
        ]
      },
      {
        "id": "wallet",
        "text": "The wallet received the intended transfer.",
        "links": [
          {
            "evidence_id": "ev_6e1d9f1226ac",
            "excerpt": "Please verify this ৳1,000 transfer and all exact postings.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_da993675487e",
            "excerpt": "Customer screenshot wording: payment confirmation unclear.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_77dd9ff58f96",
            "excerpt": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_a627ec494753",
            "excerpt": "Gateway request accepted and exact transaction reference matched.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e709c9e1ae8c",
            "excerpt": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e07788791696",
            "excerpt": "The bank posting inventory for this exact reference is complete as of this recorded check.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_43cd1a91e1bc",
            "excerpt": "Retry request recorded under the same transaction.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_7d6dc7b81eb6",
            "excerpt": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_2dc78272037d",
            "excerpt": "Final settlement is not confirmed by the available records.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_6edf866c4e95",
            "excerpt": "Wallet completion remains unknown; further verification is required.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          }
        ]
      },
      {
        "id": "repayment",
        "text": "The extra debit was reversed.",
        "links": [
          {
            "evidence_id": "ev_6e1d9f1226ac",
            "excerpt": "Please verify this ৳1,000 transfer and all exact postings.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_da993675487e",
            "excerpt": "Customer screenshot wording: payment confirmation unclear.",
            "transcript_version": 1,
            "source_status": "supplied / unverified",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_77dd9ff58f96",
            "excerpt": "Simulated bank-to-upay transfer BDT 1000.00 initiated.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_a627ec494753",
            "excerpt": "Gateway request accepted and exact transaction reference matched.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e709c9e1ae8c",
            "excerpt": "Bank posting posting_6285711e9b63 confirms BDT 1000.00 debited.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_e07788791696",
            "excerpt": "The bank posting inventory for this exact reference is complete as of this recorded check.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_43cd1a91e1bc",
            "excerpt": "Retry request recorded under the same transaction.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_7d6dc7b81eb6",
            "excerpt": "Final partner response is not available. This does not establish a failed or duplicate settlement.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_2dc78272037d",
            "excerpt": "Final settlement is not confirmed by the available records.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          },
          {
            "evidence_id": "ev_6edf866c4e95",
            "excerpt": "Wallet completion remains unknown; further verification is required.",
            "transcript_version": 1,
            "source_status": "confirmed within simulated source contract",
            "mismatches": [],
            "label": "INSUFFICIENT_EVIDENCE",
            "learned_label": "INSUFFICIENT_EVIDENCE",
            "engine": "rules_primary_with_trained_advisory",
            "model_available": true,
            "reason": "Rules selected after stronger challenge result; trained label remains inspectable."
          }
        ]
      }
    ],
    "assessment": {
      "status": "NEEDS_EVIDENCE",
      "headline": "Final transfer evidence is incomplete",
      "summary": "Final transfer evidence is incomplete. Customer statements and retries alone do not establish another debit.",
      "evidence_ids": [
        "ev_77dd9ff58f96",
        "ev_a627ec494753",
        "ev_e709c9e1ae8c",
        "ev_e07788791696",
        "ev_43cd1a91e1bc",
        "ev_7d6dc7b81eb6",
        "ev_2dc78272037d",
        "ev_6edf866c4e95"
      ],
      "missing": [
        "Obtain the final wallet outcome for the exact transaction.",
        "Obtain the final partner response and settlement record."
      ],
      "recorded_excess_minor": 0,
      "engine": "source-grounded rules and balanced sandbox ledger checks",
      "limitations": "Synthetic source records only."
    },
    "verification": "INCONCLUSIVE",
    "evidence_version": 10,
    "source_version": 8
  }
]
```

## Investigation Timeline

```json
[
  {
    "id": "run_3d2210ff6090",
    "case_id": "case_017e048acb76",
    "incident_id": "incident_47cc49dd21ce",
    "transaction_id": "txn_4a027038b12d",
    "status": "NEEDS_HUMAN_REVIEW",
    "requested_mode": "demo",
    "mode": "DEMO",
    "mode_label": "DEMO INVESTIGATION — SIMULATED AI TRACE",
    "started_at": "2026-10-03T02:32:54.894476+00:00",
    "updated_at": "2026-10-03T02:32:56.154619+00:00",
    "actor": "staff_1",
    "owner_at_start": "staff_1",
    "evidence_version": 10,
    "source_version": 8,
    "sequence": 20,
    "hypotheses": [
      {
        "id": "partner_timeout",
        "title": "Partner response delayed / missing",
        "description": "A response was unavailable when the path was first checked.",
        "status": "SUPPORTED",
        "supporting_evidence": [
          "ev_7d6dc7b81eb6"
        ],
        "contradicting_evidence": [],
        "unresolved_evidence": [
          "Obtain final partner confirmation."
        ]
      },
      {
        "id": "duplicate_debit",
        "title": "Retry produced an additional debit",
        "description": "Two financial postings, rather than two request events, establish the discrepancy.",
        "status": "CONTRADICTED",
        "supporting_evidence": [],
        "contradicting_evidence": [
          "ev_e709c9e1ae8c",
          "ev_e07788791696"
        ],
        "unresolved_evidence": []
      },
      {
        "id": "settlement_complete",
        "title": "Intended settlement completed",
        "description": "A settlement and the corresponding wallet credit establish completion.",
        "status": "UNRESOLVED",
        "supporting_evidence": [],
        "contradicting_evidence": [],
        "unresolved_evidence": [
          "Obtain the final wallet outcome for the exact transaction.",
          "Obtain the final partner response and settlement record."
        ]
      },
      {
        "id": "retry_idempotent",
        "title": "Retry retained one posting",
        "description": "Multiple requests can share one successful financial posting.",
        "status": "UNRESOLVED",
        "supporting_evidence": [],
        "contradicting_evidence": [],
        "unresolved_evidence": [
          "Compare all attempt and posting identities."
        ]
      },
      {
        "id": "unsettled_debit",
        "title": "Debit remains unsettled",
        "description": "A complete negative wallet query and an explicit partner contract permit a bounded correction.",
        "status": "UNRESOLVED",
        "supporting_evidence": [],
        "contradicting_evidence": [],
        "unresolved_evidence": [
          "Obtain the final wallet outcome for the exact transaction.",
          "Obtain the final partner response and settlement record."
        ]
      }
    ],
    "evidence_count": 10,
    "current_phase": "decision",
    "current_finding": "Ownership changed to staff_2.",
    "source_checks": [
      {
        "id": "check_e94f411b29cd",
        "kind": "customer",
        "requested_at": "2026-10-03T02:32:55.059977+00:00",
        "as_of": "2026-10-03T02:32:55.059992+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_77dd9ff58f96"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.059999+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060003+00:00"
          }
        ]
      },
      {
        "id": "check_177285fcfe48",
        "kind": "gateway",
        "requested_at": "2026-10-03T02:32:55.060146+00:00",
        "as_of": "2026-10-03T02:32:55.060157+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_a627ec494753"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.060165+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060171+00:00"
          }
        ]
      },
      {
        "id": "check_f5bce35b0038",
        "kind": "bank",
        "requested_at": "2026-10-03T02:32:55.060413+00:00",
        "as_of": "2026-10-03T02:32:55.060421+00:00",
        "state": "COMPLETED",
        "result": "2 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_e709c9e1ae8c",
          "ev_e07788791696"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.060429+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060461+00:00"
          }
        ]
      },
      {
        "id": "check_5540ce35ec9f",
        "kind": "queue",
        "requested_at": "2026-10-03T02:32:55.060612+00:00",
        "as_of": "2026-10-03T02:32:55.060619+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_43cd1a91e1bc"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.060626+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060632+00:00"
          }
        ]
      },
      {
        "id": "check_ef2c1c60d02f",
        "kind": "response",
        "requested_at": "2026-10-03T02:32:55.060771+00:00",
        "as_of": "2026-10-03T02:32:55.060779+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_7d6dc7b81eb6"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.060786+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060791+00:00"
          }
        ]
      },
      {
        "id": "check_ed43104e5bbf",
        "kind": "settlement",
        "requested_at": "2026-10-03T02:32:55.060929+00:00",
        "as_of": "2026-10-03T02:32:55.060936+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_2dc78272037d"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.060944+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.060950+00:00"
          }
        ]
      },
      {
        "id": "check_7d79dab389dc",
        "kind": "wallet",
        "requested_at": "2026-10-03T02:32:55.061077+00:00",
        "as_of": "2026-10-03T02:32:55.061082+00:00",
        "state": "COMPLETED",
        "result": "1 matching source record(s) inspected.",
        "evidence_ids": [
          "ev_6edf866c4e95"
        ],
        "scope": "Exact transaction and incident only",
        "states": [
          {
            "state": "RUNNING",
            "at": "2026-10-03T02:32:55.061089+00:00"
          },
          {
            "state": "COMPLETED",
            "at": "2026-10-03T02:32:55.061094+00:00"
          }
        ]
      }
    ],
    "verification": "INCONCLUSIVE",
    "provider": {
      "available": false,
      "error": "Demo mode explicitly selected.",
      "model": null
    },
    "recommendation": {
      "eligible": false,
      "authorization": "Repair Not Authorized",
      "action": "MANUAL_REVIEW",
      "amount_minor": 0,
      "evidence_ids": [
        "ev_77dd9ff58f96",
        "ev_a627ec494753",
        "ev_e709c9e1ae8c",
        "ev_e07788791696",
        "ev_43cd1a91e1bc",
        "ev_7d6dc7b81eb6",
        "ev_2dc78272037d",
        "ev_6edf866c4e95"
      ],
      "reason": "Available evidence does not authorize an automatic correction.",
      "missing": [
        "Obtain the final wallet outcome for the exact transaction.",
        "Obtain the final partner response and settlement record."
      ],
      "risk": "Synthetic sandbox only; exact posting identity, current evidence and operator approval required.",
      "approval_required": true,
      "team": "Partner Operations",
      "next_action": "Verify the missing source records and retain an accountable owner.",
      "id": "recommendation_6001a67fe9eb",
      "run_id": "run_3d2210ff6090",
      "case_id": "case_017e048acb76",
      "incident_id": "incident_47cc49dd21ce",
      "at": "2026-10-03T02:32:55.938874+00:00"
    },
    "completed_at": "2026-10-03T02:32:55.938900+00:00",
    "strength": "Insufficient / incomplete coverage",
    "events": [
      {
        "sequence": 1,
        "id": "trace_5995bf57334c",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:54.907713+00:00",
        "phase": "initialize",
        "title": "Investigator initialized",
        "purpose": "Identify the case and the operational problem.",
        "action": "Start an observable investigation",
        "finding": "One existing incident and case selected; no additional case created.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "One existing incident and case selected; no additional case created.",
        "next_step": "Case context loaded",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 2,
        "id": "trace_08780b7477ed",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:54.955520+00:00",
        "phase": "context",
        "title": "Case context loaded",
        "purpose": "Separate the customer allegation from confirmed source facts.",
        "action": "Load the saved complaint, owner and evidence",
        "finding": "Customer statement preserved separately from confirmed system records.",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1
        },
        "changed": "Customer statement preserved separately from confirmed system records.",
        "next_step": "Transaction reconstructed",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 3,
        "id": "trace_bc35856857b3",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.001480+00:00",
        "phase": "reconstruct",
        "title": "Transaction reconstructed",
        "purpose": "Match attempts, references and correlation identities.",
        "action": "Match transaction, purchase and attempt identities",
        "finding": "Exact references define the scope. Equal amounts alone do not link payments.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "Exact references define the scope. Equal amounts alone do not link payments.",
        "next_step": "Relevant records retrieved",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 4,
        "id": "trace_db69d4b97b18",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.049377+00:00",
        "phase": "retrieve",
        "title": "Relevant records retrieved",
        "purpose": "Obtain the available records and identify missing sources.",
        "action": "Query the scoped synthetic sources",
        "finding": "Retrieving the records available for this incident; no financial conclusion has been made.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "Retrieving the records available for this incident; no financial conclusion has been made.",
        "next_step": "Processing path followed",
        "state": "active",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 5,
        "id": "trace_a263813ff3c1",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.076785+00:00",
        "phase": "retrieve",
        "title": "Relevant records retrieved",
        "purpose": "Obtain the available records and identify missing sources.",
        "action": "Retrieve matching source records",
        "finding": "10 distinct records available; 0 source checks unavailable.",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e",
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1,
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "10 distinct records available; 0 source checks unavailable.",
        "next_step": "Processing path followed",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 6,
        "id": "trace_5a7f64079117",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.131640+00:00",
        "phase": "follow",
        "title": "Processing path followed",
        "purpose": "Locate the point where the payment became uncertain.",
        "action": "Follow the observed processing path",
        "finding": "Retry request recorded under the same transaction.; Final partner response is not available. This does not establish a failed or duplicate settlement.; Final settlement is not confirmed by the available records.",
        "evidence_ids": [
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d"
        ],
        "evidence_revisions": {
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1
        },
        "changed": "Retry request recorded under the same transaction.; Final partner response is not available. This does not establish a failed or duplicate settlement.; Final settlement is not confirmed by the available records.",
        "next_step": "Evidence compared",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 7,
        "id": "trace_aa016dbd919d",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.192547+00:00",
        "phase": "compare",
        "title": "Evidence compared",
        "purpose": "Reconcile debit, settlement and wallet or merchant records.",
        "action": "Run the trained claim/passage verifier",
        "finding": "Comparing wording with the trained advisory verifier and reconciling authoritative amounts independently.",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e",
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1,
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Comparing wording with the trained advisory verifier and reconciling authoritative amounts independently.",
        "next_step": "Claim verified",
        "state": "active",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 8,
        "id": "trace_d2e3f344c17b",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.440211+00:00",
        "phase": "compare",
        "title": "Evidence compared",
        "purpose": "Reconcile debit, settlement and wallet or merchant records.",
        "action": "Compare postings and assess claim/passage wording",
        "finding": "Checked payments: BDT 1000.00; returned: BDT 0.00. Trained text readings remain advisory.",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e",
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1,
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Checked payments: BDT 1000.00; returned: BDT 0.00. Trained text readings remain advisory.",
        "next_step": "Claim verified",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Scoped to checked synthetic records",
        "hypotheses": null
      },
      {
        "sequence": 9,
        "id": "trace_f641055b22cc",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.500891+00:00",
        "phase": "verify",
        "title": "Claim verified",
        "purpose": "Establish whether duplicate payment is supported, contradicted or inconclusive.",
        "action": "Verify the reported payment issue",
        "finding": "INCONCLUSIVE. Final transfer evidence is incomplete",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e",
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1,
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "INCONCLUSIVE. Final transfer evidence is incomplete",
        "next_step": "Possible causes evaluated",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 10,
        "id": "trace_9b4a9ac46bf6",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.550347+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Evaluate Partner response delayed / missing",
        "finding": "SUPPORTED: A response was unavailable when the path was first checked.",
        "evidence_ids": [
          "ev_7d6dc7b81eb6"
        ],
        "evidence_revisions": {
          "ev_7d6dc7b81eb6": 1
        },
        "changed": "SUPPORTED: A response was unavailable when the path was first checked.",
        "next_step": "Repair eligibility checked",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": [
          {
            "id": "partner_timeout",
            "title": "Partner response delayed / missing",
            "description": "A response was unavailable when the path was first checked.",
            "status": "SUPPORTED",
            "supporting_evidence": [
              "ev_7d6dc7b81eb6"
            ],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain final partner confirmation."
            ]
          }
        ]
      },
      {
        "sequence": 11,
        "id": "trace_bab91904cb93",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.597585+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Evaluate Retry produced an additional debit",
        "finding": "CONTRADICTED: Two financial postings, rather than two request events, establish the discrepancy.",
        "evidence_ids": [
          "ev_e709c9e1ae8c",
          "ev_e07788791696"
        ],
        "evidence_revisions": {
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1
        },
        "changed": "CONTRADICTED: Two financial postings, rather than two request events, establish the discrepancy.",
        "next_step": "Repair eligibility checked",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": [
          {
            "id": "partner_timeout",
            "title": "Partner response delayed / missing",
            "description": "A response was unavailable when the path was first checked.",
            "status": "SUPPORTED",
            "supporting_evidence": [
              "ev_7d6dc7b81eb6"
            ],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain final partner confirmation."
            ]
          },
          {
            "id": "duplicate_debit",
            "title": "Retry produced an additional debit",
            "description": "Two financial postings, rather than two request events, establish the discrepancy.",
            "status": "CONTRADICTED",
            "supporting_evidence": [],
            "contradicting_evidence": [
              "ev_e709c9e1ae8c",
              "ev_e07788791696"
            ],
            "unresolved_evidence": []
          }
        ]
      },
      {
        "sequence": 12,
        "id": "trace_feb3721cbfd5",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.645299+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Evaluate Intended settlement completed",
        "finding": "UNRESOLVED: A settlement and the corresponding wallet credit establish completion.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "UNRESOLVED: A settlement and the corresponding wallet credit establish completion.",
        "next_step": "Repair eligibility checked",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": [
          {
            "id": "partner_timeout",
            "title": "Partner response delayed / missing",
            "description": "A response was unavailable when the path was first checked.",
            "status": "SUPPORTED",
            "supporting_evidence": [
              "ev_7d6dc7b81eb6"
            ],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain final partner confirmation."
            ]
          },
          {
            "id": "duplicate_debit",
            "title": "Retry produced an additional debit",
            "description": "Two financial postings, rather than two request events, establish the discrepancy.",
            "status": "CONTRADICTED",
            "supporting_evidence": [],
            "contradicting_evidence": [
              "ev_e709c9e1ae8c",
              "ev_e07788791696"
            ],
            "unresolved_evidence": []
          },
          {
            "id": "settlement_complete",
            "title": "Intended settlement completed",
            "description": "A settlement and the corresponding wallet credit establish completion.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain the final wallet outcome for the exact transaction.",
              "Obtain the final partner response and settlement record."
            ]
          }
        ]
      },
      {
        "sequence": 13,
        "id": "trace_d439f2720e04",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.706828+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Evaluate Retry retained one posting",
        "finding": "UNRESOLVED: Multiple requests can share one successful financial posting.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "UNRESOLVED: Multiple requests can share one successful financial posting.",
        "next_step": "Repair eligibility checked",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": [
          {
            "id": "partner_timeout",
            "title": "Partner response delayed / missing",
            "description": "A response was unavailable when the path was first checked.",
            "status": "SUPPORTED",
            "supporting_evidence": [
              "ev_7d6dc7b81eb6"
            ],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain final partner confirmation."
            ]
          },
          {
            "id": "duplicate_debit",
            "title": "Retry produced an additional debit",
            "description": "Two financial postings, rather than two request events, establish the discrepancy.",
            "status": "CONTRADICTED",
            "supporting_evidence": [],
            "contradicting_evidence": [
              "ev_e709c9e1ae8c",
              "ev_e07788791696"
            ],
            "unresolved_evidence": []
          },
          {
            "id": "settlement_complete",
            "title": "Intended settlement completed",
            "description": "A settlement and the corresponding wallet credit establish completion.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain the final wallet outcome for the exact transaction.",
              "Obtain the final partner response and settlement record."
            ]
          },
          {
            "id": "retry_idempotent",
            "title": "Retry retained one posting",
            "description": "Multiple requests can share one successful financial posting.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Compare all attempt and posting identities."
            ]
          }
        ]
      },
      {
        "sequence": 14,
        "id": "trace_15bc6123780a",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.752165+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Evaluate Debit remains unsettled",
        "finding": "UNRESOLVED: A complete negative wallet query and an explicit partner contract permit a bounded correction.",
        "evidence_ids": [],
        "evidence_revisions": {},
        "changed": "UNRESOLVED: A complete negative wallet query and an explicit partner contract permit a bounded correction.",
        "next_step": "Repair eligibility checked",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": [
          {
            "id": "partner_timeout",
            "title": "Partner response delayed / missing",
            "description": "A response was unavailable when the path was first checked.",
            "status": "SUPPORTED",
            "supporting_evidence": [
              "ev_7d6dc7b81eb6"
            ],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain final partner confirmation."
            ]
          },
          {
            "id": "duplicate_debit",
            "title": "Retry produced an additional debit",
            "description": "Two financial postings, rather than two request events, establish the discrepancy.",
            "status": "CONTRADICTED",
            "supporting_evidence": [],
            "contradicting_evidence": [
              "ev_e709c9e1ae8c",
              "ev_e07788791696"
            ],
            "unresolved_evidence": []
          },
          {
            "id": "settlement_complete",
            "title": "Intended settlement completed",
            "description": "A settlement and the corresponding wallet credit establish completion.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain the final wallet outcome for the exact transaction.",
              "Obtain the final partner response and settlement record."
            ]
          },
          {
            "id": "retry_idempotent",
            "title": "Retry retained one posting",
            "description": "Multiple requests can share one successful financial posting.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Compare all attempt and posting identities."
            ]
          },
          {
            "id": "unsettled_debit",
            "title": "Debit remains unsettled",
            "description": "A complete negative wallet query and an explicit partner contract permit a bounded correction.",
            "status": "UNRESOLVED",
            "supporting_evidence": [],
            "contradicting_evidence": [],
            "unresolved_evidence": [
              "Obtain the final wallet outcome for the exact transaction.",
              "Obtain the final partner response and settlement record."
            ]
          }
        ]
      },
      {
        "sequence": 15,
        "id": "trace_487b87e13842",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.806108+00:00",
        "phase": "causes",
        "title": "Possible causes evaluated",
        "purpose": "Update hypotheses from supporting, contradicting and unresolved evidence.",
        "action": "Use deterministic evidence assessment",
        "finding": "Demo mode explicitly selected.",
        "evidence_ids": [
          "ev_6e1d9f1226ac",
          "ev_da993675487e",
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_6e1d9f1226ac": 1,
          "ev_da993675487e": 1,
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Mode explicitly changed to demo investigation.",
        "next_step": "Check backend eligibility.",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 16,
        "id": "trace_f5ef481c4b85",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.820835+00:00",
        "phase": "eligibility",
        "title": "Repair eligibility checked",
        "purpose": "Determine whether a supported action is authorized by backend rules.",
        "action": "Check backend eligibility and permissions",
        "finding": "Repair Not Authorized: Available evidence does not authorize an automatic correction.",
        "evidence_ids": [
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Repair Not Authorized: Available evidence does not authorize an automatic correction.",
        "next_step": "Recommendation generated",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 17,
        "id": "trace_613f2db7c70b",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.877231+00:00",
        "phase": "recommend",
        "title": "Recommendation generated",
        "purpose": "Present an evidence-cited proposal and its constraints.",
        "action": "Generate a cited operator recommendation",
        "finding": "MANUAL REVIEW. Verify the missing source records and retain an accountable owner.",
        "evidence_ids": [
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "MANUAL REVIEW. Verify the missing source records and retain an accountable owner.",
        "next_step": "Operator decision required",
        "state": "completed",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 18,
        "id": "trace_a05862e0e45e",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:55.940572+00:00",
        "phase": "decision",
        "title": "Operator decision required",
        "purpose": "Require approval or an owned handoff; investigation completion is not resolution.",
        "action": "Require an operator decision",
        "finding": "Investigation finished. The payment is resolved only after a verified outcome or correction.",
        "evidence_ids": [
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Human review or evidence follow-up required.",
        "next_step": "Approve, reject, record review or hand off.",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 19,
        "id": "trace_2569ee2b506f",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:56.100125+00:00",
        "phase": "decision",
        "title": "Operator decision required",
        "purpose": "Require approval or an owned handoff; investigation completion is not resolution.",
        "action": "Request an owned handoff",
        "finding": "Partner Operations: Final response, wallet outcome and settlement evidence are incomplete.",
        "evidence_ids": [
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Operator action saved in case history.",
        "next_step": "Current owner remains accountable until staff_2 acknowledges. Retrieve exact final partner and wallet confirmation.",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      },
      {
        "sequence": 20,
        "id": "trace_353fe0c88786",
        "run_id": "run_3d2210ff6090",
        "case_id": "case_017e048acb76",
        "incident_id": "incident_47cc49dd21ce",
        "timestamp": "2026-10-03T02:32:56.154472+00:00",
        "phase": "decision",
        "title": "Operator decision required",
        "purpose": "Require approval or an owned handoff; investigation completion is not resolution.",
        "action": "Acknowledge the handoff",
        "finding": "Ownership changed to staff_2.",
        "evidence_ids": [
          "ev_77dd9ff58f96",
          "ev_a627ec494753",
          "ev_e709c9e1ae8c",
          "ev_e07788791696",
          "ev_43cd1a91e1bc",
          "ev_7d6dc7b81eb6",
          "ev_2dc78272037d",
          "ev_6edf866c4e95"
        ],
        "evidence_revisions": {
          "ev_77dd9ff58f96": 1,
          "ev_a627ec494753": 1,
          "ev_e709c9e1ae8c": 1,
          "ev_e07788791696": 1,
          "ev_43cd1a91e1bc": 1,
          "ev_7d6dc7b81eb6": 1,
          "ev_2dc78272037d": 1,
          "ev_6edf866c4e95": 1
        },
        "changed": "Operator action saved in case history.",
        "next_step": "Retrieve exact final partner and wallet confirmation.",
        "state": "attention",
        "record_category": "Derived Observation",
        "uncertainty": "Evidence incomplete",
        "hypotheses": null
      }
    ]
  }
]
```

## Findings

```json
{
  "qr_confirmed": false,
  "qr_not_completed": false,
  "cash_confirmed": false,
  "purchase_total_minor": 100000,
  "recorded_paid_minor": 100000,
  "recorded_repaid_minor": 0,
  "recorded_excess_minor": 0,
  "requirements": [
    "Obtain the final wallet outcome for the exact transaction.",
    "Obtain the final partner response and settlement record."
  ],
  "conflict": false,
  "split_tender": false,
  "bank_debit_minor": 100000,
  "wallet_credit_minor": 0,
  "capabilities": [
    "bank_debit",
    "bank_inventory_complete",
    "gateway_accepted",
    "response_missing",
    "retry_observed",
    "settlement_unknown",
    "transfer_intent",
    "wallet_unknown"
  ],
  "bank_inventory_complete": true,
  "remaining_unsettled_minor": 100000,
  "evidence_ids": [
    "ev_77dd9ff58f96",
    "ev_a627ec494753",
    "ev_e709c9e1ae8c",
    "ev_e07788791696",
    "ev_43cd1a91e1bc",
    "ev_7d6dc7b81eb6",
    "ev_2dc78272037d",
    "ev_6edf866c4e95"
  ]
}
```

## Possible Causes

```json
[
  {
    "id": "partner_timeout",
    "title": "Partner response delayed / missing",
    "description": "A response was unavailable when the path was first checked.",
    "status": "SUPPORTED",
    "supporting_evidence": [
      "ev_7d6dc7b81eb6"
    ],
    "contradicting_evidence": [],
    "unresolved_evidence": [
      "Obtain final partner confirmation."
    ]
  },
  {
    "id": "duplicate_debit",
    "title": "Retry produced an additional debit",
    "description": "Two financial postings, rather than two request events, establish the discrepancy.",
    "status": "CONTRADICTED",
    "supporting_evidence": [],
    "contradicting_evidence": [
      "ev_e709c9e1ae8c",
      "ev_e07788791696"
    ],
    "unresolved_evidence": []
  },
  {
    "id": "settlement_complete",
    "title": "Intended settlement completed",
    "description": "A settlement and the corresponding wallet credit establish completion.",
    "status": "UNRESOLVED",
    "supporting_evidence": [],
    "contradicting_evidence": [],
    "unresolved_evidence": [
      "Obtain the final wallet outcome for the exact transaction.",
      "Obtain the final partner response and settlement record."
    ]
  },
  {
    "id": "retry_idempotent",
    "title": "Retry retained one posting",
    "description": "Multiple requests can share one successful financial posting.",
    "status": "UNRESOLVED",
    "supporting_evidence": [],
    "contradicting_evidence": [],
    "unresolved_evidence": [
      "Compare all attempt and posting identities."
    ]
  },
  {
    "id": "unsettled_debit",
    "title": "Debit remains unsettled",
    "description": "A complete negative wallet query and an explicit partner contract permit a bounded correction.",
    "status": "UNRESOLVED",
    "supporting_evidence": [],
    "contradicting_evidence": [],
    "unresolved_evidence": [
      "Obtain the final wallet outcome for the exact transaction.",
      "Obtain the final partner response and settlement record."
    ]
  }
]
```

## Verification Result

INCONCLUSIVE

## Recommended Action

```json
{
  "eligible": false,
  "authorization": "Repair Not Authorized",
  "action": "MANUAL_REVIEW",
  "amount_minor": 0,
  "evidence_ids": [
    "ev_77dd9ff58f96",
    "ev_a627ec494753",
    "ev_e709c9e1ae8c",
    "ev_e07788791696",
    "ev_43cd1a91e1bc",
    "ev_7d6dc7b81eb6",
    "ev_2dc78272037d",
    "ev_6edf866c4e95"
  ],
  "reason": "Available evidence does not authorize an automatic correction.",
  "missing": [
    "Obtain the final wallet outcome for the exact transaction.",
    "Obtain the final partner response and settlement record."
  ],
  "risk": "Synthetic sandbox only; exact posting identity, current evidence and operator approval required.",
  "approval_required": true,
  "team": "Partner Operations",
  "next_action": "Verify the missing source records and retain an accountable owner.",
  "id": "recommendation_6001a67fe9eb",
  "run_id": "run_3d2210ff6090",
  "case_id": "case_017e048acb76",
  "incident_id": "incident_47cc49dd21ce",
  "at": "2026-10-03T02:32:55.938874+00:00"
}
```

## Operator Decisions

```json
[]
```

## Approvals

```json
[]
```

## Repair Results

```json
[]
```

## Remaining Issues

```json
{
  "evidence_gaps": [
    "Obtain the final wallet outcome for the exact transaction.",
    "Obtain the final partner response and settlement record."
  ],
  "remaining_duplicate_minor": 0,
  "remaining_unsettled_minor": 100000,
  "outstanding_requests": [],
  "owner": "staff_2",
  "next_review": "2026-10-03T06:32:54.862522+00:00"
}
```

## Tasks

```json
[]
```

## Handoffs

```json
[
  {
    "id": "handoff_527a9fec0eef",
    "origin": "staff_1",
    "destination": "staff_2",
    "reason": "Final response, wallet outcome and settlement evidence are incomplete.",
    "at": "2026-10-03T02:32:56.098949+00:00",
    "status": "ACKNOWLEDGED",
    "team": "Partner Operations",
    "priority": "HIGH",
    "next_action": "Retrieve exact final partner and wallet confirmation.",
    "acknowledged_at": "2026-10-03T02:32:56.153675+00:00"
  }
]
```

## Customer Updates

```json
[
  {
    "at": "2026-10-03T02:32:54.862627+00:00",
    "text": "Your transfer complaint is saved under one incident. An operator will verify the payment records.",
    "text_bn": "আপনার মামলার নতুন আপডেট সংরক্ষণ করা হয়েছে। তদন্তকারী বিস্তারিত পর্যালোচনা করবেন।"
  },
  {
    "at": "2026-10-03T02:32:55.939586+00:00",
    "text": "Final transfer evidence is incomplete",
    "text_bn": "ট্রান্সফারের চূড়ান্ত তথ্য অসম্পূর্ণ। আরও যাচাই প্রয়োজন।"
  },
  {
    "at": "2026-10-03T02:32:56.098975+00:00",
    "text": "Further review was requested. Your current investigator retains responsibility until the handoff is accepted.",
    "text_bn": "আপনার মামলার নতুন আপডেট সংরক্ষণ করা হয়েছে। তদন্তকারী বিস্তারিত পর্যালোচনা করবেন।"
  },
  {
    "at": "2026-10-03T02:32:56.153718+00:00",
    "text": "The handoff was accepted by your new investigator.",
    "text_bn": "আপনার মামলার নতুন আপডেট সংরক্ষণ করা হয়েছে। তদন্তকারী বিস্তারিত পর্যালোচনা করবেন।"
  }
]
```

## Case History

```json
[
  {
    "id": 10,
    "case_id": "case_017e048acb76",
    "actor": "customer_1",
    "action": "transfer_complaint",
    "at": "2026-10-03T02:32:54.862872+00:00",
    "version": 1,
    "detail": ""
  },
  {
    "id": 11,
    "case_id": "case_017e048acb76",
    "actor": "staff_1",
    "action": "investigation_started",
    "at": "2026-10-03T02:32:54.894999+00:00",
    "version": 2,
    "detail": "run_3d2210ff6090"
  },
  {
    "id": 12,
    "case_id": "case_017e048acb76",
    "actor": "investigator",
    "action": "records_retrieved",
    "at": "2026-10-03T02:32:55.062029+00:00",
    "version": 3,
    "detail": "[\"check_e94f411b29cd\", \"check_177285fcfe48\", \"check_f5bce35b0038\", \"check_5540ce35ec9f\", \"check_ef2c1c60d02f\", \"check_ed43104e5bbf\", \"check_7d79dab389dc\"]"
  },
  {
    "id": 13,
    "case_id": "case_017e048acb76",
    "actor": "investigator",
    "action": "investigation_completed",
    "at": "2026-10-03T02:32:55.941351+00:00",
    "version": 4,
    "detail": "run_3d2210ff6090"
  },
  {
    "id": 14,
    "case_id": "case_017e048acb76",
    "actor": "staff_1",
    "action": "handoff",
    "at": "2026-10-03T02:32:56.101742+00:00",
    "version": 5,
    "detail": ""
  },
  {
    "id": 15,
    "case_id": "case_017e048acb76",
    "actor": "staff_2",
    "action": "acknowledge",
    "at": "2026-10-03T02:32:56.157088+00:00",
    "version": 6,
    "detail": ""
  }
]
```
