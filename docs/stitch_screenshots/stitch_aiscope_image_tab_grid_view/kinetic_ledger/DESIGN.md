# Design System Strategy: The Kinetic Vault

## 1. Overview & Creative North Star
This design system is built upon the "Kinetic Vault" philosophy. We are merging the impenetrable security of Bitcoin’s decentralized ledger with the fluid, high-octane creativity of AI-driven filmmaking. This is not a standard SaaS dashboard; it is a high-precision instrument.

The "Kinetic Vault" breaks the traditional grid-template look by utilizing **intentional asymmetry** and **tonal depth**. We favor overlapping elements and extreme typographic contrast to guide the eye. Every interface should feel like a custom-machined piece of hardware—tactile, expensive, and technically superior. We do not "place" elements on a page; we "mount" them within a pressurized dark-matter environment.

## 2. Colors & Atmospheric Depth
The palette is rooted in the `background` (`#111317`)—a "true void" that allows our accent colors to vibrate with digital energy.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. They create visual "noise" that cheapens the premium feel. Instead, boundaries must be defined solely through:
- **Background Color Shifts:** Use `surface_container_low` against a `surface` background to define regions.
- **Tonal Transitions:** Use vertical white space from our spacing scale (e.g., `spacing.16`) to create mental breaks without physical lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the Material Design surface tokens to create "nested" depth:
1.  **Base Layer:** `surface_dim` or `background`.
2.  **Sectioning:** `surface_container_low`.
3.  **Interactive Cards:** `surface_container_high`.
4.  **Floating Overlays:** `surface_bright` with Glassmorphism.

### The "Glass & Gradient" Rule
To elevate the UI beyond a standard "flat" look, use Glassmorphism (`backdrop-blur` with 60% opacity `surface_variant`) for any element that floats above the main content (e.g., tooltips, dropdowns, or mobile navigation). Apply the linear gradient (`#EA580C` to `#F7931A`) to primary CTAs and key headline text to provide a "soul" to the technical environment.

### Signature Textures
- **Grid Pattern:** Overlay a 50px grid at 2% opacity with a radial fade across the entire background.
- **Atmospheric Blobs:** Place `7%` opacity radial blurs using `primary_container` (Bitcoin orange) behind key content clusters to create an "under-lit" studio effect.

## 3. Typography
Our typography is a dialogue between human-centric legibility and machine precision.

- **Display & Headlines:** **Space Grotesk**. This geometric, technical typeface should be used for all high-level messaging. Utilize the `display-lg` scale for hero sections, often applying the signature orange gradient.
- **Body & Titles:** **Inter**. A neutral, high-legibility sans-serif that handles the heavy lifting of filmmaking metadata and tool descriptions. 
- **Labels & Precision Data:** **JetBrains Mono**. All timestamps, frame rates, and crypto-hash strings must use this mono-spaced font to reinforce the "trading terminal" aesthetic.

## 4. Elevation & Depth
In this system, elevation is conveyed through light and stacking, never through artificial black shadows.

- **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` section to create a soft, natural lift. The eye perceives the shift in value as a change in physical height.
- **Ambient Shadows:** When an element must "float" (like a modal), use an extra-diffused colored glow. Shadow values should be large (30px-60px blur) and use `primary_container` or `secondary_container` at `4%-8%` opacity. **Black shadows are forbidden.**
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at `15%` opacity. It should feel like a faint reflection on the edge of a lens, not a drawn line.

## 5. Components

### Buttons
- **Primary:** Pill-shaped (`roundedness.full`). Background: linear-gradient (`#EA580C` to `#F7931A`). Text: `on_primary_fixed` (JetBrains Mono, Uppercase).
- **Secondary:** Pill-shaped. Background: `surface_container_highest`. Text: `on_surface`.
- **States:** On hover, apply a `primary` glow shadow (12px blur, 20% opacity).

### Cards & Containers
- **Radius:** `16px` (`roundedness.DEFAULT`).
- **Styling:** No dividers. Use `spacing.8` to separate internal headers from content. Use `surface_container_high` for the card body against a `surface_container_low` background.

### Input Fields
- **Design:** Use `surface_container_lowest` for the field background.
- **Active State:** The field should not change color, but rather gain a "Ghost Border" of `tertiary` (Digital Gold) and a subtle 4% gold glow.

### Filmmaking/DeFi Specifics
- **The Timeline Scrobbler:** Use `secondary_container` for the playhead and `outline_variant` for the track.
- **Node Connectors:** When mapping AI logic, use `1px` paths using `primary` at `30%` opacity with a small `10px` radial glow at the connection points.

## 6. Do’s and Don’ts

### Do:
- **Use Asymmetry:** Place a large `display-md` headline on the left with a `body-sm` description tucked into the bottom-right of a container.
- **Embrace the Void:** Use the `spacing.24` scale to let elements breathe. Premium feels "expensive" because it isn't crowded.
- **Color your Light:** Ensure every "light source" (glows, highlights) uses the Bitcoin orange or Gold tones.

### Don’t:
- **Don’t use Dividers:** Never use a horizontal rule `<hr>` to separate content. Use a `4px` height block of `surface_container_highest` or simply more whitespace.
- **Don’t use Pure White for Body:** Use `muted` (`#94A3B8`) for long-form text to reduce eye strain in this dark environment; reserve `white` for headings.
- **Don’t use Sharp Corners:** Except for the grid texture, everything should feel "machined" with our defined `roundedness` scale. No 0px radii.