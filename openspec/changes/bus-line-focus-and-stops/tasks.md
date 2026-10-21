## 1. Data

- [x] 1.1 `line-stops.json`: stops in calling order per trip pattern, merged stops, consecutive repeats dropped, patterns folded into the longer ones containing them, busiest first, at most 6 per direction, and the line's extent
- [x] 1.2 Archived lines keep the variants of the last build; `BUILD_VERSION` 6
- [x] 1.3 Unit tests for ordering, directions, folding and the archived fallback

## 2. Map

- [x] 2.1 One colour per line across map, cards, chips and focus bar (`lineColors.ts`)
- [x] 2.2 Zoom phasing: stops and number pills from 12, stop names from 14; pills drawn as one image per colour
- [x] 2.3 Focus: bold line over a white casing, its stops from 8 and names from 11, the rest dimmed; one tap handler for every network, stop before line, focused line before others
- [x] 2.4 Focus bar; a tap on empty map clears the focus
- [x] 2.5 "Cadrer la ligne" frames the line's extent in one move, below the focus bar, and closes the card

## 3. Cards

- [x] 3.1 Line card: rail with termini, stop list, variant picker, "Sens inverse", stop rows opening the stop's card
- [x] 3.2 Day tiles, notes block, booking pill only when the status is known
- [x] 3.3 Card capped to the visible map, scrolling inside, map panned to show it whole
- [x] 3.4 Stop card: line rows, phone beside lines that must be booked

## 4. Explore

- [x] 4.1 Matched lines' stops from zoom 12; first chip tap focuses and frames, second opens the card

## 5. Checks

- [x] 5.1 Checked on a preview, desktop and phone, with `line-stops.json` built for every network
