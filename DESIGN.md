# Design System: Tío José María
**Project ID:** TBD

## 1. Visual Theme & Atmosphere
The design should evoke a "Rural Luxury" atmosphere: historic, warm, and authentic. It combines 19th-century Spanish architectural soul with 21st-century digital clarity. The vibe is "Sophisticated Rustic"—clean layouts, high-quality imagery, and elegant serif typography.

## 2. Color Palette & Roles
* **Heritage Olive (#556B2F):** Primary brand color. Used for key call-to-actions, navigation active states, and decorative elements.
* **Warm Earth (#8C8468):** Secondary neutral. Used for sub-headers and subtle UI accents.
* **Antique Sand (#D6CEB8):** Tertiary/Accent. Used for hover states, light borders, and secondary backgrounds.
* **Rustic Cream (#FCFBF9):** Primary background color. Provides a warm, paper-like feel.
* **Glass Background (rgba(252, 251, 249, 0.6)):** Used for floating navigation and overlays.
* **Forest Black (#2C3319):** Primary text color. 

## 3. Typography Rules
* **Headings:** *Playfair Display*. Elegant, high-contrast serif. Used for H1, H2, and title components to emphasize the historic nature.
* **Body:** *Lato*. Rational, legible sans-serif. Used for all descriptive text and small UI elements.
* **Character:** Generous line-height (1.6+) and subtle tracking on uppercase labels.

## 4. Component Stylings
* **Navigation (Liquid Glass):** 
    * Floating bar design.
    * `backdrop-filter: blur(24px)`.
    * Background: `rgba(252, 251, 249, 0.6)` (Rustic Cream with 60% opacity).
    * Borders: Subtle 1px solid `rgba(85, 107, 47, 0.1)`.
    * Shape: `rounded-2xl` or pill-shaped.
    * Hover: Menu items should have a soft underline or color shift to Heritage Olive.
* **Buttons (Interactive):** 
    * Primary: Heritage Olive background, white text, pill-shaped (`rounded-full`).
    * Hover: Subtle lift (`transform: translateY(-2px)`), increase shadow depth, and a soft glow effect using primary color.
    * Secondary: Transparent with Heritage Olive border.
* **Cards/Services (Grid):** 
    * Subtly rounded corners (`rounded-xl`), soft diffused shadows.
    * Interaction: On hover, cards should display a subtle luminous border (glow) using Antique Sand (#D6CEB8) and a slight scale-up (1.02x).
* **Video Presentation (Remotion):**
    * Centered container with `aspect-video`.
    * Soft shadows and `rounded-2xl` corners.
    * Auto-play or smooth play/pause interaction.
    * Overlays using *Playfair Display* for a cinematic feel.
* **Images:** Wrapped in soft shadows, occasionally overlapping or with elegant frames to suggest a photo album feel.

## 5. Layout & Animation Principles
* **Whitespace:** Generous "breathing room" between sections.
* **Backgrounds (Dynamic):** Avoid flat solid colors for large sections. Use subtle mesh gradients (Heritage Olive to Rustic Cream at 5%) or smooth `SimpleParallax` effects on background images.
* **Transitions:** 
    * **Scroll Reveals:** All major sections and text blocks should use a "Fade In Up" animation as they enter the viewport.
    * **Interactive State:** Hover effects should have a transition duration of `300ms` with `cubic-bezier(0.4, 0, 0.2, 1)`.
* **Grid:** Balanced 12-column grid, using asymmetrical layouts.
