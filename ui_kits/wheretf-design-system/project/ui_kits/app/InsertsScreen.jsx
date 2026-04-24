/* globals React */
const { useState: insState, useMemo: insMemo } = React;

const TEMPLATES = ['All templates', 'Drawer · 6×4', 'Drawer · 4×2', 'Pegboard · 8×8', 'Tray · 3×3'];
const INTERFACES = ['All interfaces', 'Default', 'Shallow drawer', 'Deep drawer'];
const INSERTS = [
  { id: 'construction-screws', name: 'Construction screws',  items: 248, tags: 'cap screws', cols: 6, rows: 4, placedIdx: [0,1,2,3,4,5,  7,8,9,11] },
  { id: 'socket-head-m6',      name: 'Socket head M6',       items: 64,  tags: 'SHCS · M6',  cols: 4, rows: 3, placedIdx: [0,1,2,4,5,6,7,9,10] },
  { id: 'nylon-washers',       name: 'Nylon washers',        items: 120, tags: 'washers',    cols: 6, rows: 4, placedIdx: [0,2,4,6,8,10] },
  { id: 'hex-nuts-m3-m8',      name: 'Hex nuts M3–M8',       items: 96,  tags: 'nuts',       cols: 6, rows: 2, placedIdx: [0,1,2,3,6,7,8] },
  { id: 'resistors-1-4w',      name: 'Resistors 1/4W',       items: 410, tags: '0.25W',      cols: 8, rows: 5, placedIdx: Array.from({length: 22}, (_,i)=>i) },
];

window.InsertsScreen = function InsertsScreen() {
  const [sel, setSel] = insState('construction-screws');
  const [tpl, setTpl] = insState(TEMPLATES[0]);
  const [iface, setIface] = insState(INTERFACES[0]);
  const [tab, setTab] = insState('all');
  const [rightTab, setRightTab] = insState('assign');
  const [hover, setHover] = insState(null);
  const cur = insMemo(() => INSERTS.find(x => x.id === sel), [sel]);

  const total = cur.cols * cur.rows;
  const placed = new Set(cur.placedIdx);

  return React.createElement('div', { className: 'three-col' },
    /* ---------- middle list panel ---------- */
    React.createElement('section', { className: 'panel panel--list' },
      React.createElement('div', { className: 'panel__head' },
        React.createElement('div', null,
          React.createElement('h2', { className: 'panel__title' }, 'Inserts'),
          React.createElement('div', { className: 'panel__sub' }, 'Physical instances of templates')
        ),
        React.createElement('button', { className: 'btn btn--primary' }, '+ New')
      ),
      React.createElement('div', { className: 'panel__filters' },
        React.createElement('label', { className: 'field' },
          React.createElement('span', null, 'Template'),
          React.createElement('select', { value: tpl, onChange: e => setTpl(e.target.value) },
            TEMPLATES.map(t => React.createElement('option', { key: t, value: t }, t))
          )
        ),
        React.createElement('label', { className: 'field' },
          React.createElement('span', null, 'Interface'),
          React.createElement('select', { value: iface, onChange: e => setIface(e.target.value) },
            INTERFACES.map(t => React.createElement('option', { key: t, value: t }, t))
          )
        ),
        React.createElement('div', { className: 'seg' },
          ['all','placed','unplaced'].map(t =>
            React.createElement('button', {
              key: t, className: `seg__btn ${tab===t?'is-active':''}`, onClick: () => setTab(t)
            }, t[0].toUpperCase()+t.slice(1))
          )
        )
      ),
      React.createElement('div', { className: 'panel__list' },
        INSERTS.map(ins =>
          React.createElement('button', {
            key: ins.id,
            className: `insert-row ${sel === ins.id ? 'is-active' : ''}`,
            onClick: () => setSel(ins.id)
          },
            React.createElement('div', { className: 'insert-row__name' }, ins.name),
            React.createElement('div', { className: 'insert-row__meta' }, `Rows showing ${Math.min(ins.items, 20)}k`),
            React.createElement('div', { className: 'insert-row__tag' }, ins.tags)
          )
        )
      )
    ),

    /* ---------- main canvas ---------- */
    React.createElement('section', { className: 'canvas' },
      React.createElement('div', { className: 'canvas__head' },
        React.createElement('h1', { className: 'canvas__title' }, cur.name),
        React.createElement('div', { className: 'canvas__tools' },
          React.createElement('button', { className: 'btn btn--ghost' }, React.createElement('i', { className: 'ic ic-zoom-out' })),
          React.createElement('button', { className: 'btn btn--ghost' }, React.createElement('i', { className: 'ic ic-zoom-in' })),
          React.createElement('button', { className: 'btn btn--ghost' }, React.createElement('i', { className: 'ic ic-maximize' }))
        )
      ),
      React.createElement('div', { className: 'canvas__body' },
        React.createElement('div', { className: 'coord-col' }, ['A','B','C','D','E','F','G','H'].slice(0, cur.rows).map(r =>
          React.createElement('div', { key: r, className: 'coord' }, r)
        )),
        React.createElement('div', { className: 'canvas__grid-wrap' },
          React.createElement('div', { className: 'coord-row' }, Array.from({length: cur.cols}).map((_, i) =>
            React.createElement('div', { key: i, className: 'coord' }, i + 1)
          )),
          React.createElement('div', {
            className: 'bin-grid',
            style: { gridTemplateColumns: `repeat(${cur.cols}, 1fr)`, gridTemplateRows: `repeat(${cur.rows}, 1fr)` }
          },
            Array.from({ length: total }).map((_, i) => {
              const row = String.fromCharCode(65 + Math.floor(i / cur.cols));
              const col = (i % cur.cols) + 1;
              const code = `${row}${col}`;
              const isPlaced = placed.has(i);
              const isHover = hover === i;
              return React.createElement('div', {
                key: i,
                className: `bin ${isPlaced ? 'is-placed' : ''} ${isHover ? 'is-hover' : ''}`,
                onMouseEnter: () => setHover(i),
                onMouseLeave: () => setHover(null),
              },
                React.createElement('div', { className: 'bin__code' }, code),
                isPlaced && React.createElement('div', { className: 'bin__dot' })
              );
            })
          )
        )
      )
    ),

    /* ---------- right inspector ---------- */
    React.createElement('aside', { className: 'panel panel--inspector' },
      React.createElement('div', { className: 'insp-tabs' },
        React.createElement('button', {
          className: `insp-tabs__tab ${rightTab==='assign'?'is-active':''}`, onClick: () => setRightTab('assign')
        }, 'View / Assign'),
        React.createElement('button', {
          className: `insp-tabs__tab ${rightTab==='edit'?'is-active':''}`, onClick: () => setRightTab('edit')
        }, 'Edit')
      ),
      rightTab === 'assign' && React.createElement('div', { className: 'insp-body' },
        React.createElement('div', { className: 'insp-label' }, 'Placement'),
        React.createElement('div', { className: 'insp-heading' }, 'Unplaced'),
        React.createElement('input', { className: 'insp-search', placeholder: 'Filter…' }),
        React.createElement('div', { className: 'insp-list' },
          ['MUSE 1','MUSE 2','MUSE 3','MUSE 4','MUSE 5','MUSE 6'].map(x =>
            React.createElement('div', { key: x, className: 'insp-item' },
              React.createElement('i', { className: 'ic ic-grip' }),
              React.createElement('span', null, x),
              React.createElement('span', { className: 'insp-item__q' }, '·')
            )
          )
        ),
        React.createElement('div', { className: 'insp-hint' }, 'Press and hold to pick up, then drop on a bin.')
      ),
      rightTab === 'edit' && React.createElement('div', { className: 'insp-body' },
        React.createElement('div', { className: 'insp-label' }, 'Properties'),
        React.createElement('label', { className: 'field field--stack' },
          React.createElement('span', null, 'Name'),
          React.createElement('input', { defaultValue: cur.name })
        ),
        React.createElement('label', { className: 'field field--stack' },
          React.createElement('span', null, 'Tags'),
          React.createElement('input', { defaultValue: cur.tags })
        ),
        React.createElement('label', { className: 'field field--stack' },
          React.createElement('span', null, 'Template'),
          React.createElement('select', null, React.createElement('option', null, `${cur.cols} × ${cur.rows} grid`))
        ),
        React.createElement('button', { className: 'btn btn--ghost btn--danger' }, 'Archive insert')
      )
    )
  );
};
