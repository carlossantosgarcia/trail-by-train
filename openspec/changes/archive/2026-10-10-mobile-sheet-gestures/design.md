## Context

Every mobile sheet comes from `BottomSheet`: the persistent layers/tracks/profile
sheet (`MobileSheet`) and the transient hike box and Explore results. Heights are
three CSS tokens (`--sheet-peek`, `--sheet-half` 46vh, `--sheet-full` 88vh) and
the sheet always takes one of them, whatever it holds. Line and stop details are
a MapLibre popup on every viewport.

## Decisions

### Content-fitted heights

The sheet measures its head and its content (a wrapper inside the scrolling
body, observed with `ResizeObserver`) and publishes the sum as
`--sheet-content`. The half and full heights become
`min(var(--sheet-half), var(--sheet-content))` and
`min(var(--sheet-full), var(--sheet-content))`. Dragging snaps among the
distinct heights only: when the content fits under the half cap, half and full
are the same height and the sheet has a single open state.

Measuring the content wrapper, not the body, avoids a loop: the body's own
height follows the sheet's.

### Map gestures

`src/lib/mapGestures.ts` is a small pub/sub that `Map.tsx` feeds with two
events: `pan` on a user-initiated `movestart` (an event that carries an
`originalEvent`, so a programmatic `fitBounds` does not count), and `tap` on a
map click. Feature click handlers run on the same click and call `claimMapTap()`
(transit lines and stops, curated hikes — including a route Explore drew — and
GR trails), so
the `tap` is published on the next tick together with whether a handler claimed
it. Listeners:

- the persistent sheet lowers to peek on `pan` and on any `tap`;
- the Explore results lower to peek on `pan` and on an unclaimed `tap`;
- the transit sheet closes on an unclaimed `tap`, as the desktop popup does with
  `closeOnClick`.

The hike box already closes on a click away from a hike and is left alone.

A tap on a hike or a line lowering the persistent sheet changes the old rule
that a transient sheet leaves the persistent one exactly as it was. The segment
is still preserved; the height is not, because the user has turned to the map.

### Back action

`src/lib/backStack.ts` keeps a stack of open surfaces. Opening one pushes a
history entry (`history.pushState`, same URL); `popstate` closes the top one.
Closing a surface by any other means while it is on top consumes its entry with
`history.back()`, flagged so the resulting `popstate` is ignored. A surface
closed out of order is dropped from the stack without touching history.

The persistent sheet registers while it is above peek; transient sheets while
they are shown. Explore mode itself is not on the stack.

### Quick toggles in the collapsed head

At peek the persistent sheet's head is a single row: four `OverlayToggle`s
(curated hikes, GR, trains section, buses section) and an icon-only expand button (upward chevron) that
opens the sheet. Above peek the head shows the segmented control, or the
"Calques" title when there is one segment. The row keeps the existing 72 px peek
token, so the scale bar, attribution and fit padding need no new offsets.

The trains and buses toggles drive the section eyes, so they hide or show the
whole section without touching the per-overlay choices made in the full panel.

### Transit details as a sheet

On mobile `TransitPopup` renders `LineBody`/`StopBody` inside a transient
`BottomSheet` opening at half, with the line chip and name (or stop name) and a
close button in the head. Desktop keeps the MapLibre popup. A chip in a stop
sheet replaces the stop with the line, as it does in the popup.

### Alternatives considered

- **Two fixed heights (closed, open) for every sheet**: simpler, but a hike or a
  stop with little content would still open as a mostly empty half screen.
- **Keeping the zoom readout smaller on phones**: it carries no information a
  hiker needs that the scale bar does not, and it is the item that collides
  with the Explore card.

## Risks

- `history.pushState` entries are visible to the user's back history. Each is
  consumed when its surface closes, so a session does not accumulate them.
- Content measuring runs on every content resize; it writes one custom property
  and is cheap.
