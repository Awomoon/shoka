// Single source of truth for colors, spacing and font sizes.
// Rule: no component ever hardcodes a color — everything comes from here.

export const palettes = {
  light: {
    primary: '#0B5D3B',
    onPrimary: '#FFFFFF',
    accent: '#F5B700',
    onAccent: '#1A1A1A',
    danger: '#C62828',
    onDanger: '#FFFFFF',
    background: '#FAF8F4',
    card: '#FFFFFF',
    raised: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B6B6B',
    border: '#E7E2D9',
    subtle: '#F0EDE5',
    tint: '#E4F0E9', // quiet green wash — bar fills behind data rows
    overlay: 'rgba(0, 0, 0, 0.55)',
    overlayText: '#FFFFFF',
    toastBg: 'rgba(26, 26, 26, 0.92)',
    toastText: '#FFFFFF',
  },
  dark: {
    // dark greens vanish on dark backgrounds, so primary is lightened
    primary: '#2E9E6B',
    onPrimary: '#FFFFFF',
    accent: '#F5B700',
    onAccent: '#1A1A1A',
    danger: '#EF5350',
    onDanger: '#FFFFFF',
    background: '#121212',
    card: '#1E1E1E',
    raised: '#262626', // dark mode raises surfaces by color step, not shadow
    text: '#F2F2F2',
    muted: '#9E9E9E',
    border: '#2C2C2C',
    subtle: '#2A2A2A',
    tint: '#1F3A2D',
    overlay: 'rgba(0, 0, 0, 0.65)',
    overlayText: '#FFFFFF',
    toastBg: 'rgba(245, 245, 245, 0.95)',
    toastText: '#1A1A1A',
  },
};

// Nothing square-cornered remains except full-width dividers.
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
};

// Elevation recipe per theme. Light mode floats cards with a soft shadow;
// dark mode uses the `raised` surface color step instead — shadows are
// invisible on dark backgrounds, so `dark` stays empty on purpose.
export const elevations = {
  light: {
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dark: {},
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Price numbers are the hero of every screen.
export const type = {
  hero: 34,
  price: 26,
  screenTitle: 24,
  title: 18,
  body: 16,
  cardName: 15,
  label: 13,
  small: 12,
};

export const touch = {
  minTarget: 56,
  button: 64,
};
