# InCasus

- Work directly in the Git repository. This project now uses native Vite/TanStack Start, Node and an independent Supabase-compatible backend; do not add editor-specific auth, build plugins, telemetry or AI gateways.
- Never rewrite published Git history or discard unrelated workspace changes.
- For a fresh independent database, use `infra/backend/migrations.json` in order. The old root schema migration is historical and differs from the current authentication contract.
- Client/case dossiers are durable PostgreSQL data scoped by office membership. A newly registered account always starts as client; role promotion is administrative.
- Case notes are internal, append-only versions. Originals are private and immutable to browser clients. File completion requires server verification of the stored bytes and a server-only RPC; never expose service-role credentials to the client.
- Validate the real Auth/REST/Storage path and the browser workflow; UI-only mocks do not establish backend correctness.


- Calendar date ranges and validation live in the calendar service, with a replaceable repository adapter; this keeps monthly/weekly views consistent.
- Existing calendar/process records use the configured authenticated backend. Legacy demo repositories elsewhere are not authorization or evidence of a production integration.
- Official legal audit is captured by database triggers on durable process, document and resource-permission records; authenticated owners can read but cannot append, modify or remove audit entries.
- Browser document-analysis activity is a separately labelled demo history and stores metadata only, never extracted document text or AI results.
- Reports use a pure filter service and data-driven paginated browser PDFs with an embedded local Unicode font; prepare the blob before a separate download click to preserve mobile user activation.
- Report periods refer to process last-movement dates and activity dates; never fabricate responsibility where the source has no assignment.
- Document questions and analysis call the configured OpenAI Responses adapter on the server, with store:false; citations must match the supplied source. Do not make live paid provider calls in tests.
- Document review rejects pending items and persists only confirmed edits through a replaceable, explicitly browser-local demo repository; audit remains metadata-only.
