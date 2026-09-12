# Asset Editor

The Asset Editor finds [Asset Headers](asset-headers.md) in your source — small JSON
descriptors inside comments — and turns the data block that follows into
an editable bitmap, tilemap, or palette. Edits are written straight back
into the source text, preserving the original number base and formatting
of each literal.

## Asset List

Open the **Asset Editor** from the sidebar to see every editable asset in
your project in one scrolling list. Assets are grouped by file — a heading
with the filename, then each asset underneath, in the order it appears in
the source.

Each asset shows a **line number** you can click to jump to that spot in
the code (and highlight it), the [Asset Header](asset-headers.md) as
written in the file, and the **editor** itself — a picture, a palette, or
a tilemap. If something is wrong with an asset, a red error message
appears in place of its editor.

Click an asset to start editing; the editor scrolls into view, and your
selection is saved in the address bar so you can bookmark or share it.
You don't need to understand the header format to edit graphics, but if
you want to add or change one, [Asset Headers](asset-headers.md) explains
it.

### Editing images

Assets with a width and height show a **grid of thumbnails** — one per
image. Click the one you want, and a large editor opens beside it.

To paint, just click and drag on the image. Pick a color from the row of
swatches below it (each labelled with its palette index). Starting a drag
on a pixel that's already the color you picked will erase instead of
paint.

The toolbar above the image has quick transforms: **flip** it
horizontally or vertically, **rotate** it, **nudge** it in any direction,
and **copy/paste** it. Copy and paste work between any two images in the
session, and they keep the palette indices intact, so a tile copied from
one asset still looks right in another even if the colors differ.

If more than one palette in your project matches the image's color count,
a dropdown appears under the thumbnails so you can try them out — the
previews update instantly.

In Apple II artifact-color mode (`art:1`), the artifact column is edited
separately and is left alone by the transforms.

### Editing palettes

Palettes are edited one color at a time. The palette appears as a small
table; click any cell to open a color picker. Small, indexed palettes show
a grid of swatches to choose from — hover over one to see its value and
hex color. Larger, direct-color palettes get color sliders instead. As you
change a color, the source code is updated right away.

### Editing tilemaps

NES nametable assets (`map:"nesnt"`) show the whole tilemap composited
from your project's graphics and palette, as a single preview.

### Undo and redo

Use `Ctrl/Cmd+Z` to undo and `Ctrl/Cmd+Shift+Z` to redo your edits. The
history starts fresh each time you open the Asset Editor, so undo only
affects the changes you've made in this session.

