# Static D&D Gemstone Tracker

A pure static website for tracking player gemstone inventory in your campaign.

## Included Pages

- `index.html`: player tracker dashboard with card grid, colored diamond icons, warnings, and color mode controls.
- `rules.html`: full gemstone codex grouped by cost tier.

## Features

- Read-only browser UI (no in-page edits).
- Data-driven from `data/gemstone-tracker.json`.
- Crystal visual style with light/dark variants.
- Color mode control: `Auto`, `Light`, `Dark`.
- Edge-aware floating tooltips with keyboard focus support.
- Per-player validation badges for:
  - clear cap exceeded
  - colored cap exceeded
  - unknown gem IDs
  - non-integer counts
  - negative counts
- Global data warnings if schema fields are missing/normalized.

## Run Locally

Open from a local web server (recommended), not `file://`.

```bash
cd /Users/jaxsnjohnson/github/inspo.hiraeth
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/index.html`
- `http://localhost:8000/rules.html`

## Data File

Path: `data/gemstone-tracker.json`

Top-level keys:

- `meta`
- `gems`
- `players`
- `ledger`

### Cap Model

```json
"capModel": {
  "clearMax": 3,
  "coloredTotalMax": 3
}
```

### Player Identity (v2)

Each player now uses:

- `uuid`: canonical stable player identifier
- `initials`: short display label used on cards
- `name`: optional compatibility/display fallback

### Update Player Inventory

Edit each player record in `players`:

- `clearGems`: integer count
- `colored`: object mapping `gem_id -> integer count`

Example:

```json
{
  "uuid": "4f9b6ed8-1fd0-4c9a-90f6-6d4152ff0a8d",
  "initials": "P1",
  "name": "Player 1",
  "clearGems": 2,
  "colored": {
    "gem_minor_healing": 1,
    "gem_swiftness": 1
  },
  "notes": ""
}
```

### Ledger (Gain/Spend History)

Use `ledger` to append immutable gem transactions.

Each event supports:

- `id`: event UUID
- `timestamp`: ISO datetime
- `playerUuid`: player UUID
- `assetType`: `clear` or `colored`
- `gemId`: required only when `assetType` is `colored`
- `delta`: integer (`+` gained, `-` spent)
- `note`: optional text
- `source`: optional origin label

Example:

```json
{
  "id": "c130b86e-2f1d-4da8-bf34-d423f5fd8877",
  "timestamp": "2026-03-01T17:24:00Z",
  "playerUuid": "4f9b6ed8-1fd0-4c9a-90f6-6d4152ff0a8d",
  "assetType": "colored",
  "gemId": "gem_minor_healing",
  "delta": 1,
  "note": "Session award",
  "source": "session"
}
```

The tracker computes:

- Per-player recent activity lists
- Campaign-wide gained/spent/net totals
- Gem-level activity totals from ledger events

## Color Mode Persistence

Color mode preference is stored in browser `localStorage` under key `gemstoneTracker.colorMode`.

- `Auto`: follows your OS/browser `prefers-color-scheme`
- `Light`: forces light mode
- `Dark`: forces dark mode

## Notes

- The site intentionally does not include auth, cloud sync, or trade workflow logic.
- If JSON syntax is invalid, the UI shows an error panel with recovery hints.
