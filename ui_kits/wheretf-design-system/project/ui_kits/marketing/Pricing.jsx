/* globals React, WTFButton, WTFChip */
window.Pricing = function Pricing({ onCta }) {
  return React.createElement('section', { className: 'mkt-section', id: 'pricing' },
    React.createElement('div', { className: 'mkt-section__head' },
      React.createElement('span', { className: 'wtf-label' }, 'Pricing'),
      React.createElement('h2', null, 'Free for the shop. Pro for the team.'),
      React.createElement('p', null, 'One user, one workshop, forever free. Upgrade when you outgrow the drawer.')
    ),
    React.createElement('div', { className: 'mkt-price-grid' },
      React.createElement(PriceCard, {
        name: 'Free',
        tagline: 'For one stubborn hobbyist.',
        price: '$0', per: 'forever',
        features: ['1 user', 'Up to 3 Modules', 'Up to 250 Items', 'Full search + scan', 'No card, no trial'],
        cta: 'Start free',
        onCta,
      }),
      React.createElement(PriceCard, {
        featured: true,
        name: 'Pro',
        tagline: 'For workshops and small teams.',
        price: '$—', per: 'per month · coming soon',
        features: ['Up to 10 users', 'Unlimited Modules', 'Unlimited Items', 'Shared catalogs', 'Roles + audit'],
        cta: 'Join the waitlist',
        onCta,
      })
    ),
    React.createElement('p', { className: 'mkt-price-fine' }, 'Pro pricing TBD. We\'ll ask the waitlist before anyone pays a nickel.')
  );
};

function PriceCard({ name, tagline, price, per, features, cta, featured, onCta }) {
  return React.createElement('div', { className: `mkt-price ${featured ? 'is-featured' : ''}` },
    featured && React.createElement('span', { className: 'mkt-price__badge' }, 'Pro'),
    React.createElement('div', { className: 'mkt-price__name' }, name),
    React.createElement('div', { className: 'mkt-price__tag' }, tagline),
    React.createElement('div', { className: 'mkt-price__amt' },
      React.createElement('span', { className: 'mkt-price__n' }, price),
      React.createElement('span', { className: 'mkt-price__p' }, per)
    ),
    React.createElement('ul', { className: 'mkt-price__list' },
      features.map(f => React.createElement('li', { key: f },
        React.createElement('img', { src: '../../assets/icons/check-bold.svg', width: 16, height: 16 }),
        f))
    ),
    React.createElement(WTFButton, { variant: featured ? 'primary' : 'secondary', size: 'lg', onClick: onCta }, cta)
  );
}

window.CTA = function CTA({ onCta }) {
  return React.createElement('section', { className: 'mkt-bigcta' },
    React.createElement('div', { className: 'mkt-bigcta__inner' },
      React.createElement('h2', null, 'Where the hell did you put it?'),
      React.createElement('p', null, 'Probably in a drawer. Definitely not labeled. Fix that once.'),
      React.createElement('div', { className: 'mkt-hero__cta' },
        React.createElement(WTFButton, { variant: 'primary', size: 'lg', onClick: onCta }, 'Start free')
      )
    )
  );
};

window.MarketingFooter = function MarketingFooter() {
  return React.createElement('footer', { className: 'mkt-foot' },
    React.createElement('div', { className: 'mkt-foot__inner' },
      React.createElement('img', { src: '../../assets/monogram.svg', height: 28 }),
      React.createElement('span', { className: 'mkt-foot__copy' }, '© WhereTF · Bin there, found that.'),
      React.createElement('nav', null,
        ['Docs','Changelog','Privacy','Contact'].map(x => React.createElement('a', { key: x, href: '#' }, x))
      )
    )
  );
};

Object.assign(window, { Pricing: window.Pricing, CTA: window.CTA, MarketingFooter: window.MarketingFooter });
