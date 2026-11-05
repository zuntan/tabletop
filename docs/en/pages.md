# Use and publish static Pages

[日本語](../pages.md) · [Guide](README.md)

Static Pages opens Tabletop desks in a browser without running AI or MCP. Share a desk by URL, view it, make basic edits and download your own copy. Drawing, basic operations and `.tabletop` file format are shared with the normal edition.

## Open and keep a desk

Try the [Japanese tutorial](https://zuntan.github.io/tabletop/?desk=desks/tabletop-guide.tabletop). Without a desk parameter, Pages opens an empty desk. Use File → Upload for a local file.

Select a card and use Fit selection at the bottom right to read it. See [Basic operations](authoring.md) for editing.

Pages has no AI connection or server-side Save, Save as or Load. Use **File → Download** to keep changes. Editing a public desk does not overwrite its published original. Upload your saved file to continue later.

PDF and PNG export the composition, but cannot restore editable desk objects. Keep `.tabletop` too.

## Open a desk from a URL

Add `desk` to the application URL:

```text
https://zuntan.github.io/tabletop/?desk=desks/tabletop-guide.tabletop
```

The value can be relative to the app or a full HTTP(S) URL. For a desk file at `https://example.com/guide.tabletop`, use:

```text
https://zuntan.github.io/tabletop/?desk=https://example.com/guide.tabletop
```

These example.com addresses are placeholders; substitute your actual file host. URL-encode the entire desk value if its URL contains characters such as `&`.

Cross-origin hosting must permit browser access through CORS. Browsers may block an HTTP desk loaded from an HTTPS application.

## Choose the starting card

A saved initial-focus card produces a view like selecting that card and pressing Fit selection immediately after startup.

In the normal edition, ask AI to “Use this card as the initial view” or “Clear the initial view,” then save the desk. Desk appearance shows the registered ID read-only.

To link to another card, pass its ID in `focus`:

```text
https://zuntan.github.io/tabletop/?desk=desks/tabletop-guide.tabletop&focus=text-0cc36b55
```

URL focus overrides the saved target. Without either, the whole desk is fitted. A missing target falls back to the whole desk with a notice.

Initial focus applies to the desk loaded by `desk` at startup. It does not apply to normal Load or a later Upload / desk-link switch.

## Open a PDF after loading

Add `pdf=1`:

```text
https://zuntan.github.io/tabletop/?desk=desks/tabletop-guide.tabletop&pdf=1
```

Pages waits for the desk and Mermaid rendering, generates a PDF and opens it in the same tab. Remove `pdf` to reopen the desk UI. Loading or generation failures show an error on the desk.

- `desk`: startup desk URL; omitted means empty desk.
- `focus`: startup target ID; empty means no override.
- `pdf`: any nonempty value opens PDF. Normally use 1. **0 also enables it**; it does not mean off.

PDF takes precedence over URL focus and saved initial focus. Both focus and pdf apply to the startup desk parameter.

## Missing material

For HTTP 404, check that the desk file is available at that URL. A GitHub file-view page is different from a direct file URL.

External images and web references need access to their own hosts. Local absolute paths from your PC are not available to public Pages; use public or appropriate relative URLs for desk links.

“No AI needed” does not mean “no network needed.” Pages does not provide automatic offline caching.

## Publish your own site

Build and preview the static edition:

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Open the preview server URL, normally `http://127.0.0.1:4173/`. Do not open HTML files directly.

The output is `dist-pages`, separate from normal `dist`; generated output need not be committed. Put public `.tabletop` files under `docs/tabletop/`; the build copies them to `desks/`, preserving subdirectories. Developer desks are not copied unless placed there.

For this repository's GitHub Pages workflow, set Pages → Build and deployment → Source to GitHub Actions. Relevant changes pushed to main trigger deployment; “Deploy Tabletop Pages” can also be run manually.

When updating a desk, save and replace the source file before publishing. Review what it contains and verify the actual public URL afterward. English documentation on develop does not itself update the current public site.
