export function createSidebar(app: HTMLElement) {
  const aside = app.querySelector<HTMLElement>('aside')!;
  aside.id = 'sidebar'; aside.setAttribute('aria-label', '机の詳細');
  const sections = [...aside.querySelectorAll<HTMLElement>(':scope > section')];
  const tabs = document.createElement('div'); tabs.className = 'sidebar-tabs';
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '詳細の表示');
  const panels = document.createElement('div'); panels.className = 'sidebar-panels';
  const objectFilter = document.createElement('section'); objectFilter.id = 'object-filter'; objectFilter.className = 'object-filter'; objectFilter.hidden = true;
  const filterTitle = document.createElement('h2'); filterTitle.textContent = 'フィルター'; objectFilter.append(filterTitle);
  const applySwitch = document.createElement('button'); applySwitch.id = 'object-filter-apply'; applySwitch.type = 'button';
  applySwitch.setAttribute('role', 'switch'); applySwitch.setAttribute('aria-label', '適用'); applySwitch.setAttribute('aria-checked', 'false');
  const applyLabel = document.createElement('span'); applyLabel.textContent = '適用';
  const applyTrack = document.createElement('span'); applyTrack.className = 'thinking-switch-track'; applyTrack.setAttribute('aria-hidden', 'true');
  const applyState = document.createElement('span'); applyState.className = 'thinking-switch-state'; applyState.textContent = 'OFF'; applyState.setAttribute('aria-hidden', 'true');
  applySwitch.append(applyLabel, applyTrack, applyState);
  applySwitch.onkeydown = event => event.stopPropagation();
  applySwitch.onclick = () => {
    const enabled = applySwitch.getAttribute('aria-checked') !== 'true';
    applySwitch.setAttribute('aria-checked', String(enabled)); applyState.textContent = enabled ? 'ON' : 'OFF';
    notifyFilterChange('apply');
  };
  const applyRow = document.createElement('div'); applyRow.className = 'object-filter-apply-row'; applyRow.append(applySwitch);
  const categories = document.createElement('div'); categories.className = 'object-filter-categories';
  categories.setAttribute('role', 'group'); categories.setAttribute('aria-label', 'フィルター対象');
  const notifyFilterChange = (kind: 'apply' | 'category') => app.dispatchEvent(new CustomEvent('object-filter-change', { detail: { kind } }));
  for (const [id, label] of [['clips', 'クリップ'], ['pins', 'ピン'], ['text', 'テキスト'], ['shapes', '図形'], ['lines', '線'], ['images', '画像'], ['other', 'その他']]) {
    const button = document.createElement('button'); button.id = `object-filter-${id}`; button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-pressed', String(id === 'pins')); button.onclick = () => {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
      notifyFilterChange('category');
    };
    button.onkeydown = event => event.stopPropagation(); categories.append(button);
  }
  const bulkActions = document.createElement('div'); bulkActions.className = 'object-filter-bulk-actions';
  for (const [label, enabled] of [['All ON', true], ['All OFF', false]] as const) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.id = enabled ? 'object-filter-all-on' : 'object-filter-all-off';
    button.onclick = () => {
      let changed = false;
      for (const categoryButton of categories.querySelectorAll<HTMLButtonElement>('button')) {
        if ((categoryButton.getAttribute('aria-pressed') === 'true') !== enabled) {
          categoryButton.setAttribute('aria-pressed', String(enabled)); changed = true;
        }
      }
      if (changed) notifyFilterChange('category');
    };
    button.onkeydown = event => event.stopPropagation(); bulkActions.append(button);
  }
  applyRow.append(bulkActions);
  objectFilter.append(applyRow, categories);
  const entries = [['properties', 'プロパティ', [sections[0], sections[1]]], ['objects', 'オブジェクト', [sections[2]]],
    ['history', '履歴', [sections[3]]], ['connection', '接続', [sections[4]]]] as const;
  const controls = entries.map(([id, label, content]) => {
    const tab = document.createElement('button'); tab.id = `tab-${id}`; tab.textContent = label;
    tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `panel-${id}`);
    const panel = document.createElement('div'); panel.id = `panel-${id}`; panel.className = 'sidebar-panel';
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id); panel.tabIndex = 0;
    panel.append(...content); tabs.append(tab); panels.append(panel);
    return { id, tab, panel };
  });
  const heading = document.createElement('div'); heading.className = 'sidebar-heading';
  heading.append(tabs); aside.replaceChildren(heading, objectFilter, panels);
  const workspace = app.querySelector<HTMLElement>('#workspace')!;
  const toggle = document.createElement('button'); toggle.id = 'sidebar-toggle'; toggle.type = 'button';
  toggle.setAttribute('aria-controls', aside.id); heading.append(toggle);
  function visibility(show: boolean) {
    const focused = document.activeElement === toggle;
    aside.hidden = !show; app.classList.toggle('sidebar-hidden', !show);
    (show ? heading : workspace).append(toggle);
    toggle.setAttribute('aria-expanded', String(show));
    toggle.textContent = show ? '›' : '‹';
    toggle.title = show ? '右ペインを隠す' : '右ペインを表示'; toggle.setAttribute('aria-label', toggle.title);
    if (focused) toggle.focus({ preventScroll: true });
  }
  function select(id: string) {
    for (const item of controls) {
      const active = item.id === id;
      item.tab.setAttribute('aria-selected', String(active)); item.tab.tabIndex = active ? 0 : -1;
      item.panel.hidden = !active;
    }
    objectFilter.hidden = id !== 'objects';
  }
  toggle.onclick = () => visibility(aside.hidden);
  for (const { id, tab } of controls) tab.onclick = () => select(id);
  tabs.addEventListener('keydown', event => {
    const index = controls.findIndex(item => item.tab === event.target); if (index < 0) return;
    const next = event.key === 'ArrowRight' ? (index + 1) % controls.length : event.key === 'ArrowLeft'
      ? (index + controls.length - 1) % controls.length : event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); event.stopPropagation(); select(controls[next].id); controls[next].tab.focus();
  });
  // Explicit series settings should be visible even when another tab was chosen.
  app.addEventListener('click', event => {
    if ((event.target as Element).closest('#numbering-settings')) { visibility(true); select('properties'); }
  });
  visibility(true); select('properties');
}
