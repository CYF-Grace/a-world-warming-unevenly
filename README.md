# A World Warming Unevenly · Team 404

## Project structure and responsibilities

| Section | Entry point | Content and responsibility |
|---|---|---|
| Main navigation | `index.html` | Four-part navigation, maintained by Yifei |
| Part 1 | `part1/index.html` | Bill: CO₂ emissions inequality |
| Part 2 | `part2/index.html` | Bill: industrial emissions in `industry/`; emissions and warming in `warming/` |
| Part 3 | `part3/index.html` | Yifei: hexagonal world map, Brazil, California, and India; Mianzhi: China in `part3/china/` |
| Part 4 | `part4/index.html` | Mianzhi: not yet completed; currently a placeholder |

## China section

Mianzhi’s existing China-related files are grouped under `part3/china/`:

- `index.html`: China section entry point.
- `yangtze.html`: historical Yangtze-region chapter.
- `regions.html`: scenario comparison page.
- Supporting JavaScript, CSS, `world.geojson`, D3, and both data-export scripts are kept in the same directory.

Place the generated `yangtze.json` and `climate.json` files in this directory as well. Missing data should remain explicitly identified; do not substitute fabricated values.

Do not commit large raw NPZ files.

The China section belongs to Part 3. Part 4 is a separate section assigned to Mianzhi and has not yet been completed.

## Team workflow

- Edit files within your assigned directories.
- Coordinate changes to shared entry points through pull requests.
- Yifei maintains the root `index.html`; do not overwrite it with an individual section’s homepage.
- Sync with `main` before starting work, create a working branch, and submit a pull request when ready.
- Independent iframe documents isolate scripts and styles at runtime. Directory ownership and code review are still needed to prevent files from being overwritten in Git.
- Preview the site using Live Server or GitHub Pages rather than opening HTML files directly.

Bill’s figures have been moved from the former `part 1 and 2/` directory into their respective part folders. The old directory is no longer used.

`.DS_Store` is macOS directory metadata, not project content, and is excluded through `.gitignore`.
