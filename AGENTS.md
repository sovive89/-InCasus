<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Calendar date ranges and validation live in the calendar service, with a replaceable repository adapter; this keeps monthly/weekly views consistent.
- The calendar currently uses browser-local demo storage shared across demo profiles, never as real authorization; cross-device access requires authenticated Cloud persistence.
- Official legal audit is captured by database triggers on durable process, document and resource-permission records; authenticated owners can read but cannot append, modify or remove audit entries.
- Browser document-analysis activity is a separately labelled demo history and stores metadata only, never extracted document text or AI results.
- Reports use a pure filter service and data-driven paginated browser PDFs with an embedded local Unicode font; prepare the blob before a separate download click to preserve mobile user activation.
- Report periods refer to process last-movement dates and activity dates; never fabricate responsibility where the source has no assignment.
- Document questions and analysis use typed AI Gateway Responses calls with the existing model; document text stays transient and citations must match the supplied source.
- Document review rejects pending items and persists only confirmed edits through a replaceable, explicitly browser-local demo repository; audit remains metadata-only.
