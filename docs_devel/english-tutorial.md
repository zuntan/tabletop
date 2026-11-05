# English tutorial desk — v0.1.1

The separate file is `docs/tabletop/tabletop-guide-en.tabletop`. Its Japanese layout source, `tabletop-guide.tabletop`, remains unchanged. UI language is not stored in either desk.

## Content and layout

The English desk retains all 774 object IDs, ordering, bindings, pin series IDs, wayfinder routes, sample relationships and initial focus (`text-0cc36b55`). Text, descriptions and series names are translated. Japanese stamp artwork remains available with English explanations. Reviewed sample stamps may use English designs: DONE, HANDLE WITH CARE, COPY & PASTE ONLY and Excellent; the large reward sample uses the smiling Japanese design. These five dated choices from the human review are recorded in the overrides. The temporary-area sample uses the separate English prop. The logo tagline is English. The camera example is captured again from English content.

The tour covers 44 tools. Explanations of stamps, stickers, reactions, keyboard operations and grid settings are updated for v0.1.1 rather than reproducing older instructions. Original construction-note cards are retained as translated history. The desk-link sample uses the repository-relative English tutorial path; it requires the normal edition, the file, and the repository root as server working directory. Pages has no server-side LOAD.

## Editing and rebuilding

Edit `scripts/data/tutorial-en.json`: object IDs map to translated fields and any reviewed layout adjustments. Run:

```sh
python3 scripts/build-english-tutorial.py
```

Use `--output /tmp/review.tabletop` to generate a comparison file without overwriting a desk edited by hand. Save human changes first, compare decoded documents and carry the reviewed differences into the overrides before rebuilding.

The generator copies the Japanese layout, applies these explicit overrides, translates series names, replaces the temporary-area/logo/camera assets, rejects remaining Japanese text fields, removes orphaned assets and writes a separate archive. It never modifies the Japanese file. Japanese lettering inside intentional stamp artwork is not translated.

`docs/images/tabletop-camera-en.png` is an application raster capture of the translated camera scene. The English workflow and collaboration SVGs are rendered from the translated Mermaid sources with an opaque white background so dark page themes cannot obscure the labels. When changing these samples, regenerate the images in a browser and review them as well as the desk.

The normal build does not need this script. `scripts/prepare-pages.mjs` already includes all deliberately placed `.tabletop` files under `docs/tabletop`, so the English desk will ship on the next Pages deployment. README and English docs distinguish the branch file from the not-yet-deployed public English URL.

## Review

Browser measurement checks every supported text/rectangular sample. Review central introduction, detailed cards, diagrams, stickers/stamps and camera at readable zoom. Follow the initial green wayfinder, detail/return routes, a pin pair and the camera extension. Human review can concentrate on text size, spacing and arrangement.
