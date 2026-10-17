# Icon studio

Open [index.html](index.html) directly in a browser, or run `npm run icons` from
the project root to open it at <http://localhost:1003/tools/favicon-studio/>.

Choose a main symbol, an optional second symbol, colors, and a background shape.
Try the presets or switch between flat silhouettes and outlines. The previews
include actual favicon sizes, a browser tab, and a home-screen icon. The current
design is saved in browser storage; **Save design** downloads a JSON file you can
load later.

The **Corner overlap** placement separates the symbols with a margin following
the second symbol's silhouette. Adjust **Outline margin** to control the gap.
The gap shows the background color, or stays transparent for transparent exports.

**SVG logo** exports vector artwork for the README. **PNG** exports the selected
size. **Download favicon kit** creates a ZIP containing SVG, ICO, PNG files, a web
manifest, the editable design, and `SETUP.txt` with the integration steps for this
Vite project. Home-screen exports use an opaque square background and include a
separate maskable version with extra padding.

The current app icons were made from
[`trail-by-train.design.json`](trail-by-train.design.json): load it to start
from them.

Everything runs locally without network requests or additional dependencies.
Symbols are original SVG artwork covered by the project's MIT license. The
studio is a development tool; it is not linked from or bundled into the map app.
