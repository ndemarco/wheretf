/* globals React */
const { useState: sbState } = React;

window.AppSidebar = function AppSidebar({ section, onNavigate }) {
  const [collapsed, setCollapsed] = sbState(false);
  const main = [
    { id: 'modules',  label: 'Modules',  icon: 'grid' },
    { id: 'inserts',  label: 'Inserts',  icon: 'layers' },
    { id: 'items',    label: 'Items',    icon: 'box' },
    { id: 'activity', label: 'Activity', icon: 'activity' },
  ];
  const admin = [
    { id: 'new-module', label: 'New Module', icon: 'plus-square' },
    { id: 'templates',  label: 'Templates',  icon: 'template' },
    { id: 'taxonomy',   label: 'Taxonomy',   icon: 'tree' },
    { id: 'interfaces', label: 'Interfaces', icon: 'puzzle' },
    { id: 'tour',       label: 'Tour',       icon: 'help' },
  ];
  const item = (n) => React.createElement('button', {
    key: n.id,
    className: `sb-nav__item ${section === n.id ? 'is-active' : ''}`,
    onClick: () => onNavigate(n.id),
    title: collapsed ? n.label : undefined,
  },
    React.createElement('i', { className: `ic ic-${n.icon}` }),
    !collapsed && React.createElement('span', null, n.label)
  );
  return React.createElement('aside', { className: `sb ${collapsed ? 'is-collapsed' : ''}` },
    React.createElement('div', { className: 'sb__head' },
      !collapsed && React.createElement('div', { className: 'sb__brand' },
        React.createElement('img', { src: '../../assets/monogram.svg', width: 22, height: 26, alt: '' }),
        React.createElement('span', null, 'WhereTF')
      ),
      React.createElement('button', { className: 'sb__toggle', onClick: () => setCollapsed(c => !c), 'aria-label': 'Collapse' },
        React.createElement('i', { className: `ic ic-chev-${collapsed ? 'right' : 'left'}` })
      )
    ),
    React.createElement('nav', { className: 'sb-nav' }, main.map(item)),
    React.createElement('div', { className: 'sb-nav__divider' }, !collapsed && React.createElement('span', null, 'ADMIN')),
    React.createElement('nav', { className: 'sb-nav' }, admin.map(item)),
    React.createElement('div', { className: 'sb__spacer' }),
    React.createElement('div', { className: 'sb__user' },
      React.createElement('div', { className: 'sb__avatar' }, 'DM'),
      !collapsed && React.createElement('div', null,
        React.createElement('div', { className: 'sb__username' }, 'DeMarco'),
        React.createElement('div', { className: 'sb__userplan' }, 'Free · upgrade')
      )
    )
  );
};
