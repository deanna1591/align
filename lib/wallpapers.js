'use client';

// lib/wallpapers.js
// Swappable Y2K wallpapers for the app background. Each returns the CSS props
// for the root container. Pure CSS (gradients/patterns) — no image files.

export const WALLPAPERS = [
  {
    id: 'pinkgrid',
    label: 'Pink Grid',
    swatch: '#FDF1F9',
    css: {
      backgroundColor: '#FEFBFD',
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
    },
  },
  {
    id: 'bliss',
    label: 'Bliss Hills',
    swatch: '#7DB8E8',
    css: {
      backgroundColor: '#8Fc2ee',
      backgroundImage:
        'linear-gradient(180deg, #6FB3EC 0%, #9BD0F5 45%, #BFE3A6 62%, #8FCB6E 100%)',
    },
  },
  {
    id: 'butterfly',
    label: 'Butterflies',
    swatch: '#C9A7F0',
    css: {
      backgroundColor: '#F3ECFD',
      backgroundImage:
        'radial-gradient(circle at 20% 30%, rgba(255,143,203,0.18) 0 8px, transparent 9px), radial-gradient(circle at 70% 60%, rgba(155,92,255,0.16) 0 10px, transparent 11px), radial-gradient(circle at 45% 80%, rgba(63,184,222,0.15) 0 7px, transparent 8px), linear-gradient(180deg, #F6EEFE, #FBEFF7)',
      backgroundSize: '180px 180px, 220px 220px, 160px 160px, 100% 100%',
    },
  },
  {
    id: 'holo',
    label: 'Holographic',
    swatch: '#B8E0E8',
    css: {
      backgroundColor: '#EAF6FB',
      backgroundImage:
        'linear-gradient(135deg, #FBE3F1 0%, #E4ECFB 25%, #DDF6EC 50%, #FCEFD8 75%, #F3E0FB 100%)',
    },
  },
  {
    id: 'lavalamp',
    label: 'Lava Lamp',
    swatch: '#FF8FCB',
    css: {
      backgroundColor: '#2B1740',
      backgroundImage:
        'radial-gradient(ellipse 40% 30% at 30% 25%, rgba(255,95,176,0.55), transparent 70%), radial-gradient(ellipse 35% 28% at 70% 65%, rgba(155,92,255,0.5), transparent 70%), radial-gradient(ellipse 30% 22% at 50% 90%, rgba(252,217,61,0.4), transparent 70%), linear-gradient(180deg, #3A1D5C, #241038)',
    },
  },
  {
    id: 'cloud',
    label: 'Dreamy Clouds',
    swatch: '#FBD3E9',
    css: {
      backgroundColor: '#FBD3E9',
      backgroundImage:
        'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.85) 0 40px, transparent 60px), radial-gradient(circle at 75% 35%, rgba(255,255,255,0.7) 0 55px, transparent 75px), radial-gradient(circle at 50% 75%, rgba(255,255,255,0.8) 0 50px, transparent 70px), linear-gradient(180deg, #FBD9EC, #E7D6FA)',
      backgroundSize: '300px 300px, 360px 360px, 320px 320px, 100% 100%',
    },
  },
];

export const WALLPAPER_BY_ID = Object.fromEntries(WALLPAPERS.map(w => [w.id, w]));

export function getWallpaper() {
  try {
    const id = localStorage.getItem('align_wallpaper');
    return WALLPAPER_BY_ID[id] || WALLPAPERS[0];
  } catch {
    return WALLPAPERS[0];
  }
}

export function setWallpaper(id) {
  try { localStorage.setItem('align_wallpaper', id); } catch {}
}
