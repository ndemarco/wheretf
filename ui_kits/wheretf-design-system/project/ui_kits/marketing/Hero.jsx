/* globals React, WTFButton, WTFChip */
window.Hero = function Hero({ onCta }) {
  return React.createElement('section', { className: 'mkt-hero' },
    React.createElement('div', { className: 'mkt-hero__peg' }),
    React.createElement('div', { className: 'mkt-hero__inner' },
      React.createElement('span', { className: 'mkt-eyebrow' }, '✱ Now in early access'),
      React.createElement('h1', { className: 'mkt-hero__h1' },
        'Bin there, ', React.createElement('span', { className: 'mkt-brand' }, 'found that.')
      ),
      React.createElement('p', { className: 'mkt-hero__sub' },
        "A deep catalog for everything small. Define your items once — screws, resistors, yarn, beads, bits — link each to a bin, and never again stand in the shop yelling the product name."
      ),
      React.createElement('div', { className: 'mkt-hero__cta' },
        React.createElement(WTFButton, { variant: 'primary', size: 'lg', onClick: onCta }, 'Start free · 1 workshop'),
        React.createElement(WTFButton, { variant: 'secondary', size: 'lg' }, 'See how it works')
      ),
      React.createElement('div', { className: 'mkt-hero__foot' },
        React.createElement('span', null, 'Free forever for one user.'),
        React.createElement('span', { className: 'dot' }, '·'),
        React.createElement('span', null, 'No card. No stock-counting. No bullshit.')
      )
    ),
    React.createElement(HeroShowcase, null)
  );
};

function HeroShowcase() {
  return React.createElement('div', { className: 'mkt-hero__showcase' },
    React.createElement('div', { className: 'mkt-showcase-card' },
      React.createElement('div', { className: 'mkt-showcase-card__bar' },
        React.createElement('span', { className: 'mkt-traffic' }),
        React.createElement('span', { className: 'mkt-showcase-card__title' }, 'where is · 0603 1kΩ')
      ),
      React.createElement('div', { className: 'mkt-showcase-card__body' },
        React.createElement('div', { className: 'mkt-showcase-hit' },
          React.createElement('div', { className: 'mkt-showcase-hit__ico' },
            React.createElement('svg', { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
              React.createElement('line', { x1: 4, y1: 24, x2: 12, y2: 24 }),
              React.createElement('path', { d: 'M 12 24 L 16 16 L 20 32 L 24 16 L 28 32 L 32 16 L 36 24' }),
              React.createElement('line', { x1: 36, y1: 24, x2: 44, y2: 24 })
            )
          ),
          React.createElement('div', { className: 'mkt-showcase-hit__body' },
            React.createElement('div', { className: 'mkt-showcase-hit__name' }, '1kΩ · 0603 · 1%'),
            React.createElement('div', { className: 'mkt-showcase-hit__loc' }, 'MOD-B · TRAY-1 · C4')
          ),
          React.createElement(WTFChip, { tone: 'go' }, 'Found')
        ),
        React.createElement('div', { className: 'mkt-showcase-module' },
          Array.from({ length: 24 }).map((_, i) =>
            React.createElement('div', { key: i, className: `mkt-cell ${i === 14 ? 'is-hit' : i % 3 === 0 ? 'is-filled' : ''}` })
          )
        )
      )
    )
  );
};

Object.assign(window, { Hero: window.Hero });
