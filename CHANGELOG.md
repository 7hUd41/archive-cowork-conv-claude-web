# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 2026-10-07
### Added
- English interface with a French translation (`i18n.js`), language selector in the popup and the archive page; exports follow the selected language.
- README, TODO (quality roadmap), CHANGELOG, MIT license, end-to-end tests with synthetic fixtures.
### Changed
- ZIP layout names in English (`written-files/`, `days/`, `…-day-<date>.md`, `…-by-day-….zip`).
- Compaction summaries are labelled "not a message from the user".
- `turnCost` accepts both cloud (`modelUsage`) and local (`total_cost_usd`) result events, so the engine is reused as-is by the desktop viewer.

## [0.9.2] — 2026-09-21
### Added
- Display time zone support (`window.DISPLAY_TZ`) applied to the preview, the day split and every export; the zone is written in `transcript.md`, the by-day `.md` and `manifest.json`.
- Host hook (`ARCHIVE_EXTRA`) so a host page can add files to the ZIP.

## [0.9.0] — 2026-09-16
### Added
- Export of a single day as Markdown (full text, meant to be fed back after a mid-day compaction) and **ZIP by day** (one folder per day with images and written files, plus `index.md`).
- Day filter in the preview.
- Compaction summaries detected and rendered as a distinct card, in the preview and in the transcripts.
- Long base64 payloads returned by tools replaced by a short note in transcripts (`stripBinary`).
### Changed
- Uniform message headers ("You · time"), native tooltips removed in favour of the CSS tooltip.

## [0.1.0 → 0.8.x] — 2026-09-11
### Added
- Session id detection from the Cowork tab URL (`cse_…` / `session_…`).
- Full fetch of `…/sessions/{id}/events` with the required `anthropic-version` header, automatic detection of the pagination parameter, deduplication and sequence-gap reporting.
- Extraction of uploaded images (base64 in the log), files written by Claude, referenced and delivered files; `manifest.json`.
- Chat-style preview (reading / full-details modes), activity timeline with sub-agent blocks, file cards, image lightbox, Libertinus Serif and Fira Code embedded; standalone `transcript.html`.
