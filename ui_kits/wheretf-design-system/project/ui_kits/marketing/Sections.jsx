/* globals React */

window.HowItWorks = function HowItWorks() {
  const steps = [
    { n: '01', title: 'Define the thing', body: 'Build items as deeply as you care. Not a quantity — a type: M6×30 SHCS, hex drive, fully threaded, natural finish.', ico: 'item' },
    { n: '02', title: 'Describe the storage', body: 'A Module is whatever you already own — shelving unit, chest of drawers, bench organizer. WhereTF maps its locations.', ico: 'module' },
    { n: '03', title: 'Link item to location', body: 'One item, one bin. Preferably. The graph holds the rest: drawer, tray, cell, label.', ico: 'pin' },
    { n: '04', title: 'Find the thing', body: 'Search any scrap you remember. Item name, part number, location code. Get a pin.', ico: 'search' },
  ];
  return React.createElement('section', { className: 'mkt-section', id: 'how' },
    React.createElement('div', { className: 'mkt-section__head' },
      React.createElement('span', { className: 'wtf-label' }, 'How it works'),
      React.createElement('h2', null, 'Four steps, then it\'s yours forever.'),
      React.createElement('p', null, 'WhereTF is intentionally boring in the middle. The magic is the first step — naming the thing well — and the last step — finding it fast.')
    ),
    React.createElement('div', { className: 'mkt-steps' },
      steps.map(s => React.createElement('div', { key: s.n, className: 'mkt-step' },
        React.createElement('div', { className: 'mkt-step__n' }, s.n),
        React.createElement('img', { className: 'mkt-step__ico', src: `../../assets/icons/${s.ico}.svg`, alt: '' }),
        React.createElement('h3', null, s.title),
        React.createElement('p', null, s.body)
      ))
    )
  );
};

window.ModulesSection = function ModulesSection() {
  return React.createElement('section', { className: 'mkt-section mkt-section--alt', id: 'modules' },
    React.createElement('div', { className: 'mkt-section__head' },
      React.createElement('span', { className: 'wtf-label' }, 'Modules'),
      React.createElement('h2', null, 'Your shop, modeled.'),
      React.createElement('p', null, 'A Module is a physical container of storage. Not a warehouse. Not a room. The shelving unit in the corner. The bench organizer. The red toolbox. Model what you own.')
    ),
    React.createElement('div', { className: 'mkt-module-grid' }, [
      { name: 'Bench organizer', code: 'MOD-A', bins: 24, filled: 18 },
      { name: 'Drawer chest', code: 'MOD-B', bins: 20, filled: 7 },
      { name: 'SMD parts cabinet', code: 'MOD-C', bins: 72, filled: 64 },
    ].map(m => React.createElement('div', { key: m.code, className: 'mkt-module-card' },
      React.createElement('div', { className: 'mkt-module-card__head' },
        React.createElement('span', { className: 'mkt-module-card__name' }, m.name),
        React.createElement('span', { className: 'mkt-module-card__code' }, m.code)
      ),
      React.createElement('div', { className: `mkt-module-card__grid mkt-module-card__grid--${m.bins > 40 ? 'dense' : m.bins > 22 ? 'med' : 'med'}` },
        Array.from({ length: m.bins }).map((_, i) =>
          React.createElement('div', { key: i, className: `mkt-cell ${i < m.filled ? 'is-filled' : ''}` })
        )
      ),
      React.createElement('div', { className: 'mkt-module-card__meta' },
        React.createElement('span', null, `${m.filled}/${m.bins} bins linked`),
        React.createElement('span', { className: 'mkt-module-card__pct' }, `${Math.round(m.filled / m.bins * 100)}%`)
      )
    )))
  );
};

Object.assign(window, { HowItWorks: window.HowItWorks, ModulesSection: window.ModulesSection });
