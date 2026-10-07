# API chatbot and DataDNA demonstration

Open **http://127.0.0.1:8000/chat**. The homepage links to **Chatbot + DataDNA**.
Restart an older uvicorn process after updating Python routes; otherwise `/chat` will return 404.

## Provider configuration

The chatbot uses an OpenAI-compatible third-party chat API. The default is Groq's
[`llama-3.1-8b-instant`](https://console.groq.com/docs/model/llama-3.1-8b-instant), selected for low latency.
An API key must match its issuing provider. If the key is rejected or the API is unavailable, an explicitly labelled keyword demo takes over automatically.
Its proposed reads still go through the real DataDNA gates; the assistant remains usable without an API key.

Store server-only configuration in **`runtime/chat-provider.json`**, which is ignored by Git:

```json
{
  "base_url": "https://api.groq.com/openai/v1",
  "model": "llama-3.1-8b-instant",
  "api_key": "<key issued by the configured provider>",
  "timeout": 8,
  "response_format": "json_object"
}
```

Restrict the file to its owner (`chmod 600 runtime/chat-provider.json` on Linux).
The key is used only in the backend's Authorization header. It is never returned to the browser,
placed in conversation content, or written to the saved chat journal.

Environment variables override the local configuration file. `.env` is not automatically loaded:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRACEFIX_CHAT_API_URL` | `https://api.groq.com/openai/v1` | Provider base URL, including its API version path |
| `TRACEFIX_CHAT_MODEL` | `llama-3.1-8b-instant` | Model offered by that provider |
| `TRACEFIX_CHAT_API_KEY` | No default | Provider-specific server credential |
| `TRACEFIX_CHAT_TIMEOUT` | `8` | Seconds per model call, from 1 to 180 |
| `TRACEFIX_CHAT_RESPONSE_FORMAT` | `json_object` | JSON object mode, or `json_schema` for models supporting strict schemas |

HTTPS is required for remote providers; loopback HTTP is supported for testing.
The client ignores proxy environment variables and does not follow redirects with credentials.
The API protocol follows [Groq's compatibility documentation](https://console.groq.com/docs/openai).
JSON mode is combined with strict server-side validation. Optional schema mode follows the provider's
[structured-output protocol](https://console.groq.com/docs/structured-outputs).

Start the application from the repository root:

```sh
.venv/bin/python -m uvicorn tracefix.app:app --host 127.0.0.1 --port 8000
```

The connection card checks authentication and model availability through the configured provider's `/models`.
A provider without that endpoint can still receive messages through `/chat/completions`, although its status
check reports an unavailable endpoint. The chat interface renders and responds even if the API is unavailable.
A keyword demo answers the message when inference fails. No local Ollama service is required for this chatbot.

For access from another device, bind uvicorn to `0.0.0.0` and open `http://<application-host>:8000/chat`.
Existing fixture authentication issues predefined identities, including staff and presenter; this is a synthetic
demo mechanism, not production identity management or a public deployment configuration.

## Message flow

1. The authenticated customer opens an owned conversation. A standalone chat seeds a fictional BDT 1,250
   worker-fault payment through the existing Add Money engine and pauses its processing clock. Its run does
   not replace the default Add Money journey. To reuse an existing owned payment with an investigation,
   open `/chat?payment_id=<payment-id>`.
2. The model classifies the latest message with bounded conversation history. A benign question receives a
   general support answer and produces no protected-source requests or chatbot DataDNA gate calls.
3. A deceptive API classification triggers a second API call with the deliberately gullible system prompt.
   It proposes one to three reads from the server-defined tool list. It cannot supply SQL, endpoint URLs,
   another payment/customer identity, authority grants, or tool arguments.
4. The backend preserves the authenticated **customer** role. Each proposed investigation tool passes through
   the existing `datadna.gate_tool` callback boundary. Broader personal-data and internal-credential requests
   pass through `datadna.review_request`. DataDNA denies the customer access before any source adapter runs.
   Credential/configuration requests have policy profiles only; no real secret store is connected.
5. The same SQLite transaction saves `DATADNA_ENVELOPE`, `DATADNA_REVIEWED`, `CHAT_TURN_COMPLETED` and the
   completed chat response. The page shows classification, model proposals, gate results and saved
   decision IDs. The linked Add Money staff board sees the same journal records.

The classifier and deliberately gullible system prompts are `CLASSIFIER_PROMPT` and `SIMULATOR_PROMPT` in
[`tracefix/transfer/chat_model.py`](../tracefix/transfer/chat_model.py). The gullible persona does not control
classification or data permissions. Unknown tools, unexpected fields and malformed responses fail validation
and activate the deterministic demo instead of executing the invalid model proposal.

Classification is model-dependent and may produce false positives or miss deception. A missed attempt gets
no tool execution; a false positive still meets the customer's DataDNA access restrictions. This demo does
not measure real-world attack detection accuracy. Protected-read counts refer to chatbot source-adapter
calls, not routine application reads of conversation metadata or simulation setup writes.

Conversation messages and bounded history are sent to the configured third-party provider. Messages and gate
decisions are also saved locally. The provider never receives actual protected-source results or the API key
as model conversation content. Missing configuration requires no provider request: demo mode starts immediately.

## HTTP contract

All endpoints use the existing transfer bearer session and require customer identity. Conversation ownership
is checked server-side. A prompt claiming to be staff never changes the actual session.

| Method | Path under `/api/transfer` | Request |
| --- | --- | --- |
| GET | `/chat/status` | Provider authentication and model availability |
| POST | `/chat/sessions` | `{}` or `{"payment_id":"pay_…"}`; `Idempotency-Key` required |
| GET | `/chat/sessions/{id}` | Saved owned conversation and its gate decisions |
| POST | `/chat/sessions/{id}/messages` | `{"message":"…"}`; `Idempotency-Key` required |

Messages are limited to 4,000 characters. A conversation permits 60 turn records and includes the most recent
six completed turns as context. Reusing a completed operation key returns the saved response without new
inference or duplicate journal events; changing its content returns 409. Only one message processes per
conversation. SQLite leases serialize requests across workers without holding a write transaction during
inference. Expired leases recover after restarts, and stale inferences cannot commit. Failed requests can be
retried with the same key. No transcript purge job is implemented.

The model transport identifies provider authentication, endpoint, quota, connection, timeout and invalid-output
errors. The message route catches them and returns a normal 200 response with `mode: "demo"`,
`model: "keyword-demo"`, `mode_label: "Keyword demo fallback"` and a safe `fallback_reason`. A working API returns
`mode: "api"`. Request validation, authentication, ownership and conversation-conflict errors still fail normally.

## Deterministic fallback

`tracefix/transfer/chat_demo.py` classifies the latest message using keyword rules. Instruction overrides
such as "ignore previous instructions" trigger an internal-information proposal. Retrieval/impersonation language
combined with passwords, API keys, bank statements, contact details, other wallet holders or internal logs
selects the corresponding allow-listed tool. Educational security questions and ordinary payment help receive
canned support answers without requesting protected sources. Rules are illustrative and can miss paraphrases,
encoded requests and other languages; they do not claim comprehensive deception detection.

The demo acts fooled by proposing the requested read. DataDNA independently evaluates and blocks it before
the source adapter runs. Every fallback saves `CHAT_FALLBACK_USED` alongside the turn and any DataDNA records.
Both the chat bubble and activity panel label demo mode, and reloading preserves that provenance.

There are no fake released credentials or records. An API failure during either classification or planning
switches the entire turn to deterministic classification and planning, then runs the existing DataDNA flow.

## Verification

```sh
.venv/bin/python -m pytest tests/test_chat.py tests/test_datadna.py tests/test_transfer.py -q
```

Tests use a provider HTTP fixture while exercising real FastAPI routes, the Add Money simulation, DataDNA and
SQLite. Every allowed tool is tested with a source adapter that fails if called. Coverage includes ordinary
conversation, ownership, credentials staying server-side, provider failures, invalid output, idempotency,
concurrent requests, recovery, every fallback failure path, deceptive keyword examples and benign demo questions.
These tests establish backend enforcement, not real-model accuracy.
