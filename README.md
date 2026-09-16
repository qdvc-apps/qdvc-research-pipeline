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
- **Timeline** — every paper with dated events on a shared date axis. Bars show
  the gap between consecutive events, coloured by review-cycle role (under review
  R0/R1/R2…, with authors, or other); a striped bar is the current step to today.
  A toolbar offers: a paper selector (papers without events are omitted), a sort
  control (Paper ID earliest/latest, first event, last event — each asc/desc), and
  a toggle to merge a journal paper with its source conference paper. The axis
  header shows years and month numbers and stays fixed while panning; a crosshair
  with a floating date follows the mouse. Event markers carry icons (submission,
  resubmission, revise, reject ✗, accept ✓). The timeline toolbar state is saved.

### Academic calendar
From the sidebar, add teaching semesters, breaks, or other periods, each with a
start date, end date, name, and a workload impact from Most relaxed (−3) to
Busiest (+3). These render as shaded bands behind the timeline. Overlaps stack
additively: busy over busy shades darker; a relaxed period over a busy one
lightens it (weights sum, and the running total drives the shade).

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
          05-board.js  06-timeline.js  07-calendar.js  08-app.js
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
