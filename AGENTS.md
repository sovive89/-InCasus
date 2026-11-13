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
