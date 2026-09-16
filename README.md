# QDVC Research Pipeline

A single-file web app for academics to track research papers from ideation
through submission, revision, and publication. No dependencies, no build tools
beyond a shell — all data lives in your browser's LocalStorage.

## Using it

Open `dist/index.html` in any modern browser. Data persists locally per browser.
Use **Export JSON** / **Import JSON** (bottom-left) to back up or move your data.

### Views
- **Papers** — data table with full create / read / update / delete, search, filters, and column sort.
- **Board** — kanban grouped by work status; drag a card between columns to change its status.
- **Timeline** — every paper on a shared date axis. Bars show the gap between
  consecutive events; a striped amber bar is the current step measured to today.
  Filter which papers appear, and toggle whether a journal paper shares a lane
  with the conference paper it was developed from.

### Paper fields
- **ID** — format `00AA` (two digits, two capitals), entered manually and validated for format and uniqueness.
- Title, coauthors, work status, publication route (conference / journal / other).
- **Events** — each has a date, an optional route-specific type, optional detail
  fields (decision outcome; volume & issue), and an optional note. Event types
  are filtered to the paper's route; "other" papers take untagged events only.
- Journal papers can link to the conference paper they were developed from.

## Project layout

```
src/
  css/    01-base.css  02-components.css  03-views.css
  js/     01-store.js  02-util.js  03-table.js  04-modal.js
          05-board.js  06-timeline.js  07-app.js
  html/   body.html
build.sh          assembles the above into dist/index.html
dist/index.html   the built, self-contained app
```

## Building

```bash
./build.sh
```

Concatenates the CSS and JS modules and the HTML body into a single
self-contained `dist/index.html`. Works on Linux and macOS (bash). Edit files
under `src/` and re-run to rebuild.
