/* globals React, WTFWordmark, WTFButton */
const { useState: useNavState } = React;

window.MarketingNav = function MarketingNav({ onNavigate, theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useNavState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    { label: 'How it works', id: 'how' },
    { label: 'Modules', id: 'modules' },
    { label: 'Pricing', id: 'pricing' },
    { label: 'Docs', id: 'docs' },
  ];
  return React.createElement('header', { className: `mkt-nav ${scrolled ? 'is-scrolled' : ''}` },
    React.createElement('div', { className: 'mkt-nav__inner' },
      React.createElement('a', { href: '#', className: 'mkt-nav__brand', onClick: e => { e.preventDefault(); onNavigate('home'); } },
        React.createElement(WTFWordmark, { size: 26 })
      ),
      React.createElement('nav', { className: 'mkt-nav__links' },
        links.map(l => React.createElement('a', { key: l.id, href: `#${l.id}` }, l.label))
      ),
      React.createElement('div', { className: 'mkt-nav__actions' },
        React.createElement('button', { className: 'mkt-nav__theme', onClick: onToggleTheme, 'aria-label': 'Toggle theme' },
          theme === 'dark' ? '☾' : '☀'
        ),
        React.createElement('a', { href: '#', className: 'wtf-btn wtf-btn--ghost wtf-btn--sm', onClick: e => { e.preventDefault(); onNavigate('app'); } }, 'Log in'),
        React.createElement(WTFButton, { variant: 'primary', size: 'sm', onClick: () => onNavigate('app') }, 'Start free')
      )
    )
  );
};

Object.assign(window, { MarketingNav: window.MarketingNav });
