# SHB-149 — All six locale JSON bundles ship in the main JS chunk regardless of which the user picks

**Category**: open
**Severity**: LOW

## Hypothesis

Every browser session that loads the ODD Platform SPA — including English-only users on slow networks — downloads ~120 KB of locale JSON data even though only ONE of the six locales is active at a time. The i18n bootstrap uses static `import` declarations for all six bundles (English, Spanish, Chinese, French, Ukrainian, Armenian) into the main JS chunk; there is no dynamic `import()` per locale, no `i18next-http-backend`, no lazy resource loader. Adding a seventh locale grows the main bundle linearly.

## Evidence

- `odd-platform-ui/src/locales/i18n.ts:3-8` — six static `import` declarations (`import en from '.../en.json'`, etc.) ship into the main bundle at module-load time.
- `odd-platform-ui/src/locales/translations/{en,es,ch,fr,ua,hy}.json` — per the i18n.ts sidecar bug #4, six locale files at 16-25 KB each ≈ 120 KB uncompressed total.
- `odd-platform-ui/src/index.tsx:23` — side-effect import: `import 'locales/i18n';` runs at SPA boot, before `<App />` mounts — all six bundles are in memory at first paint.

## Notes

- Not a blocker today (~120 KB uncompressed → ~20 KB compressed, small relative to the React + MUI bundles), but a multi-locale roadmap (adding Japanese / Portuguese / Hindi for emerging markets) compounds.
- Trade-off: code-split locales = +1 network roundtrip per language switch + per-bundle cache. The static-load approach trades bytes for instant switching.
- The locale bundles are also unhashed in source (each JSON ships unchanged across releases) — they could be served as separate cacheable files.
- guess: nobody has benchmarked the locale-bundle weight against the SPA's time-to-interactive budget; the 120 KB number is from the analyser's `ls -la` not a real measurement.

## Next

1. Measure: what fraction of the gzipped main bundle is locale data today? `du -sh` the locales directory after `vite build`.
2. Decide whether the lazy-load complexity is worth the ~20 KB compressed savings.
3. File a forward-looking REFACTOR-NNN: "i18n — switch to lazy-loaded locale bundles when the project supports 8+ locales."

## Links

- cluster_with: [F-043, SHB-147, SHB-148]
- merged_into: (open)
- supersedes: []
