/* globals React */
const { useState } = React;

// ---------- Tiny icon helper ----------
window.WTFIcon = function WTFIcon({ name, size = 20, style, className }) {
  // renders the svg inline by URL so it inherits color via CSS filter? No — use <img> with currentColor is impossible.
  // Instead: we fetched-and-embed via a paths map. For speed, use object and inline via <svg use>? Fallback: object tag.
  // We'll use <img> and rely on presentation-only use. For colored icons we inline common ones.
  return React.createElement('img', {
    src: `../../assets/icons/${name}.svg`,
    width: size,
    height: size,
    style: { display: 'inline-block', verticalAlign: 'middle', ...style },
    className
  });
};

// ---------- Buttons ----------
window.WTFButton = function WTFButton({ variant = 'primary', size = 'md', children, onClick, icon, type = 'button', style }) {
  const cls = `wtf-btn wtf-btn--${variant} wtf-btn--${size}`;
  return React.createElement('button', { type, className: cls, onClick, style },
    icon && React.createElement(window.WTFIcon, { name: icon, size: size === 'lg' ? 18 : 16 }),
    children
  );
};

// ---------- Brand wordmark ----------
window.WTFWordmark = function WTFWordmark({ size = 32, color = 'var(--brand)', showWord = true }) {
  return React.createElement('span', { className: 'wtf-wordmark', style: { display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.3) } },
    React.createElement('img', { src: '../../assets/monogram.svg', height: size, alt: '' }),
    showWord && React.createElement('span', {
      style: { font: `700 ${Math.round(size * 0.95)}px/1 var(--font-sans)`, letterSpacing: '-0.03em', color }
    }, 'WhereTF')
  );
};

// ---------- Chip ----------
window.WTFChip = function WTFChip({ tone = 'neutral', children, dot = true }) {
  return React.createElement('span', { className: `wtf-chip wtf-chip--${tone}` },
    dot && tone !== 'neutral' && tone !== 'brand' && React.createElement('span', { className: 'wtf-chip__dot' }),
    children
  );
};

Object.assign(window, {
  WTFIcon: window.WTFIcon,
  WTFButton: window.WTFButton,
  WTFWordmark: window.WTFWordmark,
  WTFChip: window.WTFChip,
});
