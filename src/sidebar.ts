export function createSidebar(app: HTMLElement) {
  const aside = app.querySelector<HTMLElement>('aside')!;
  aside.id = 'sidebar'; aside.setAttribute('aria-label', '机の詳細');
  const sections = [...aside.querySelectorAll<HTMLElement>(':scope > section')];
  const tabs = document.createElement('div'); tabs.className = 'sidebar-tabs';
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '詳細の表示');
  const panels = document.createElement('div'); panels.className = 'sidebar-panels';
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
  aside.replaceChildren(tabs, panels);
  const toggle = document.createElement('button'); toggle.id = 'sidebar-toggle'; toggle.type = 'button';
  toggle.setAttribute('aria-controls', aside.id); app.querySelector('header')!.append(toggle);
  function visibility(show: boolean) {
    aside.hidden = !show; app.classList.toggle('sidebar-hidden', !show);
    toggle.setAttribute('aria-expanded', String(show));
    toggle.textContent = show ? '◧' : '◨';
    toggle.title = show ? '右ペインを隠す' : '右ペインを表示'; toggle.setAttribute('aria-label', toggle.title);
  }
  function select(id: string) {
    for (const item of controls) {
      const active = item.id === id;
      item.tab.setAttribute('aria-selected', String(active)); item.tab.tabIndex = active ? 0 : -1;
      item.panel.hidden = !active;
    }
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
