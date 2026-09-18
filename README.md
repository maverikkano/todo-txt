# todo.txt

A minimal [todo.txt](https://github.com/todotxt/todo.txt)-style task manager.
Plain HTML, CSS and JavaScript — no framework, no build step.

## Run it

Open `index.html` in a browser. That's it.

Or serve the folder if you prefer a local origin:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Features

- Capture tasks with todo.txt syntax: `(A)` priority, `YYYY-MM-DD` dates,
  `+project` and `@context` tags.
- Check a task to complete it; the `x` marker and completion date are written
  back in todo.txt form. Reopening removes them.
- Set priority A–Z from the per-task dropdown.
- Double-click (or focus + Enter/F2) a task to edit it inline.
- Drag tasks to reorder.
- Live "done of total" count.

## Themes

Three themes are selectable from the button group in the header:

- **Light** — the default on first load.
- **Dark** — neutral gray dark mode.
- **Night** — near-black indigo dark mode.

The choice is saved under the `todo-txt.theme` localStorage key and applied on
reload. An unknown or missing saved value falls back to Light. Because
`color-scheme` is set per theme, native controls match too.

## Persistence

Tasks are saved to **your browser's localStorage** (key `todo-txt.tasks`) as
newline-separated todo.txt lines. They are keyed to the origin/device:

- No server, no account, no sync.
- Tasks are **not** shared across devices or browsers.
- Clearing browser data for this origin wipes the task list.

## Tests

The behaviour is covered by a jsdom harness that loads the real `index.html`
and `app.js` and exercises capture, priority, completion, editing, deletion,
drag reordering, persistence and the theme switcher.

Requires Node.js. One-time install, then run:

```sh
npm install
npm test
```

Each test prints `PASS`/`FAIL`; the process exits non-zero if any test fails.
