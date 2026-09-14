/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const darkPalette = {
  // Legacy aliases (kept for scaffold compatibility)
  text: '#f4efff',
  tint: '#bf7bff',

  // Velmora surfaces
  background: '#07060d',
  foreground: '#f4efff',
  card: '#12101d',
  cardForeground: '#f4efff',
  primary: '#b56cff',
  primaryForeground: '#10091b',
  secondary: '#1b1728',
  secondaryForeground: '#e9ddff',
  muted: '#211b31',
  mutedForeground: '#9688ae',
  accent: '#7b42c7',
  accentForeground: '#f8f1ff',
  destructive: '#dc5b86',
  destructiveForeground: '#fff4f8',
  border: '#332749',
  input: '#2b2140',
};

const colors = {
  // The app has a deliberately dark cinematic identity even when the device
  // itself is set to light mode. A matching dark key keeps useColors happy.
  light: darkPalette,
  dark: darkPalette,

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
