; tree-sitter queries for the ui_shell axis (TypeScript / TSX).
;
; Queries land in commit 2 on this branch. Skeleton kept here so the
; queries directory exists and the package layout is complete.
;
; Planned queries:
;
; 1. Side-effect import (`import 'locales/i18n'`) → ui-shell-bootstrap
; 2. JSX element mounted inside <AppToolbar> render → ui-shell-widget
; 3. Top-level export from a file under shared/elements/AppToolbar/<X>/<X>.tsx → ui-shell-widget
; 4. JSDoc `@docs` tag adjacent to a top-level export → documents: annotation
;
; See https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
