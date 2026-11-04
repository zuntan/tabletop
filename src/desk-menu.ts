import {addNumberPresets,addPresetPalette} from './number-presets';
import {publicAsset} from './runtime-mode';
import thirdParty from '../public/licenses/generated/manifest.json';
import deskArtwork from './assets/desk-link.svg?raw';
import {plainDeskColors,wallpaperChoice,wallpaperPatch} from './desk-appearance';
import type { Desk } from './model';
import type { Settings } from './settings';
import { createIcon } from './icons';
import { frameColors } from './frame-colors';
import packageSource from '../package.json?raw';
import './desk-menu.css';
import { getUiLanguage, isUiLanguage, languageChangeEvent, setUiLanguage, t } from './i18n';

export function createDeskMenu(header: HTMLElement, desk: Desk, change: (patch: Partial<Settings['background']>) => void, preview: (patch?: Partial<Settings['background']>) => void, bhPreview?: () => void, changeGrid?: (patch:Partial<Settings['grid']>)=>void, canChangeLanguage: () => boolean = () => true) {
  const button = document.createElement('button');
  button.id = 'desk-menu'; button.type = 'button'; button.className = 'header-icon';
  button.title = t('menu:title'); button.setAttribute('aria-label', t('menu:title'));
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  const icon = createIcon('minus', 20);
  icon.querySelector('path')!.setAttribute('d', 'M4 6h16 M4 12h16 M4 18h16');
  icon.setAttribute('data-icon', 'menu'); button.append(icon);
  (header.querySelector('#file-menu') ?? header.querySelector('#load-desk'))!.after(button);
  const panel = document.createElement('section'); panel.id = 'desk-menu-panel'; panel.popover = 'auto';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', t('menu:title'));
  document.querySelector('#app')!.append(panel);
  button.setAttribute('aria-controls', panel.id);
  // Keep desk shortcuts (Delete, Space, Escape selection clearing) out of this UI.
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); panel.hidePopover(); button.focus(); }
  });
  let sync = () => {};
  let page: 'root' | 'language' | 'other' = 'root';
  function heading(title: string) {
    page = 'other';
    panel.replaceChildren();panel.classList.remove('desk-about','desk-appearance');
    const row = document.createElement('div'); row.className = 'desk-menu-heading';
    const h = document.createElement('h2'); h.textContent = title;
    const close = document.createElement('button'); close.type = 'button'; close.title = t('close'); close.setAttribute('aria-label', t('close'));
    close.append(createIcon('x', 18)); close.onclick = () => { panel.hidePopover(); button.focus(); };
    row.append(h, close); panel.append(row); sync = () => {};
    panel.setAttribute('aria-label', title);
  }
  function action(label: string, run: () => void) {
    const item = document.createElement('button'); item.type = 'button'; item.textContent = label;
    item.className = 'desk-menu-item'; item.onclick = () => { run(); panel.querySelector<HTMLElement>('input,select,button')?.focus(); };
    panel.append(item); return item;
  }
  function languageSettings() {
    heading(t('menu:language')); page = 'language';
    const label = document.createElement('label'); label.className = 'desk-menu-field';
    const caption = document.createElement('span'); caption.textContent = t('menu:language');
    const select = document.createElement('select'); select.id = 'ui-language';
    select.setAttribute('aria-label', t('menu:language'));
    for (const [value, name] of [['ja', '日本語'], ['en', 'English']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option);
    }
    select.value = getUiLanguage(); label.append(caption, select); panel.append(label);
    for (const key of ['menu:languageNote', 'menu:partialNote'] as const) {
      const note = document.createElement('p'); note.className = 'desk-menu-note'; note.textContent = t(key); panel.append(note);
    }
    const status = document.createElement('p'); status.className = 'desk-menu-note'; status.setAttribute('role', 'status'); panel.append(status);
    select.onchange = async () => {
      if (!canChangeLanguage()) { select.value = getUiLanguage(); status.textContent = t('menu:busy'); return; }
      if (!isUiLanguage(select.value)) { select.value = getUiLanguage(); return; }
      select.disabled = true;
      try { await setUiLanguage(select.value); }
      finally { select.disabled = false; panel.querySelector<HTMLSelectElement>('#ui-language')?.focus(); }
    };
  }
  const plainLabelKeys = {"plain-ivory": "menu:plainIvory", "plain-blue": "menu:plainBlue", "plain-green": "menu:plainGreen", "plain-pink": "menu:plainPink", "plain-purple": "menu:plainPurple"} as const;
  function appearance() {
    heading(t('menu:appearanceTitle'));panel.classList.add('desk-appearance');
    const label = (text: string, control: HTMLElement) => {
      const node = document.createElement('label'); node.className = 'desk-menu-field';
      const caption = document.createElement('span'); caption.textContent = text; node.append(caption, control); panel.append(node);return node;
    };
    const wallpaper = document.createElement('select'); wallpaper.setAttribute('aria-label', t('menu:wallpaper'));
    for (const [value, text] of [['none', t('menu:plain')], ...plainDeskColors.map(p=>[p.value,t(plainLabelKeys[p.value])]), ['wood-1', t('menu:woodOne')], ['wood-2', t('menu:woodTwo')], ['wood', t('menu:floor')], ['cutting-mat', t('menu:cuttingMat')], ['pink-notebook', t('menu:pinkNotebook')], ['charcoal', t('menu:charcoal')]]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; wallpaper.append(option);
    }
    wallpaper.onchange = () => change(wallpaperPatch(wallpaper.value));
    label(t('menu:wallpaper'), wallpaper);
    const titleColor=document.createElement('input');titleColor.type='color';titleColor.setAttribute('aria-label',t('menu:titleColor'));
    titleColor.onchange=()=>change({titleBackground:titleColor.value});
    const resetTitle=document.createElement('button');resetTitle.type='button';resetTitle.textContent=t('menu:reset');resetTitle.setAttribute('aria-label',t('menu:resetTitleColor'));
    resetTitle.onclick=()=>change({titleBackground:null});
    const titleRow=document.createElement('div');titleRow.className='desk-menu-colors';titleRow.append(titleColor,resetTitle);label(t('menu:titleColor'),titleRow).classList.add('desk-menu-inline-field');

    const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.setAttribute('aria-label', t('menu:opacity'));
    const output = document.createElement('output'); output.htmlFor = opacity.id = 'wallpaper-opacity';
    const range = document.createElement('div'); range.className = 'desk-menu-range'; range.append(opacity, output);
    opacity.oninput = () => { output.value = opacity.value + '%'; preview({ opacity: Number(opacity.value) / 100 }); };
    opacity.onchange = () => change({ opacity: Number(opacity.value) / 100 });
    label(t('menu:opacity'), range).classList.add('desk-menu-inline-field');
    const brightness = document.createElement('input'); brightness.type = 'range'; brightness.min = '0'; brightness.max = '100'; brightness.step = '1'; brightness.dir = 'rtl'; brightness.setAttribute('aria-label', t('menu:brightness'));
    const brightnessOutput = document.createElement('output'); brightnessOutput.htmlFor = brightness.id = 'wallpaper-underlay-brightness';
    const brightnessRow = document.createElement('div'); brightnessRow.className = 'desk-menu-range';
    const white = document.createElement('span'); white.textContent = t('menu:white');
    const black = document.createElement('span'); black.textContent = t('menu:black');
    brightnessRow.append(white, brightness, black, brightnessOutput);
    brightness.oninput = () => { brightnessOutput.value = brightness.value + '%'; preview({ underlayBrightness: Number(brightness.value) / 100 }); };
    brightness.onchange = () => change({ underlayBrightness: Number(brightness.value) / 100 });
    label(t('menu:brightness'), brightnessRow).classList.add('desk-menu-inline-field');
    const note = document.createElement('p'); note.className = 'desk-menu-note'; note.textContent = t('menu:opacityNote'); panel.append(note);
    const colors: { key: 'selectionColor' | 'pointingColor'; input: HTMLInputElement; auto: HTMLInputElement }[] = [];
    for (const [key, title] of [['selectionColor', t('menu:selectionFrame')], ['pointingColor', t('menu:pointingFrame')]] as const) {
      const row = document.createElement('div'); row.className = 'desk-menu-colors';
      const input = document.createElement('input'); input.type = 'color'; input.setAttribute('aria-label', t('menu:frameColor', { name: title }));
      input.onchange = () => change({ [key]: input.value });
      const auto = document.createElement('input'); auto.type = 'checkbox'; auto.setAttribute('aria-label', t('menu:frameAuto', { name: title }));
      auto.onchange = () => change({ [key]: auto.checked ? null : input.value });
      const autoLabel = document.createElement('label'); autoLabel.append(auto, t('menu:matchWallpaper'));
      row.append(input, autoLabel); label(title, row).classList.add('desk-menu-frame-color'); colors.push({ key, input, auto });
    }
    const axes=document.createElement('input');axes.type='checkbox';axes.setAttribute('aria-label',t('menu:showAxes'));
    axes.onchange=()=>change({originAxes:axes.checked});
    const axesLabel=document.createElement('label');axesLabel.append(axes,t('menu:show'));
    const axesColor=document.createElement('input');axesColor.type='color';axesColor.setAttribute('aria-label',t('menu:axesColor'));
    axesColor.onchange=()=>change({originAxesColor:axesColor.value});
    const axesRow=document.createElement('div');axesRow.className='desk-menu-colors';axesRow.append(axesLabel,axesColor);label(t('menu:axes'),axesRow).classList.add('desk-menu-inline-field');
    const gridVisible=document.createElement('input');gridVisible.type='checkbox';gridVisible.setAttribute('aria-label',t('menu:showGrid'));
    gridVisible.onchange=()=>change({showGrid:gridVisible.checked});
    const gridLabel=document.createElement('label');gridLabel.append(gridVisible,t('menu:show'));
    const gridColor=document.createElement('input');gridColor.type='color';gridColor.setAttribute('aria-label',t('menu:gridColor'));gridColor.onchange=()=>change({gridColor:gridColor.value});
    const gridStyle=document.createElement('select');gridStyle.setAttribute('aria-label',t('menu:gridStyle'));for(const [value,title]of [['dots',t('menu:dots')],['lines',t('menu:lines')],['both',t('menu:dotsLines')]]){const option=document.createElement('option');option.value=value;option.textContent=title;gridStyle.append(option);}gridStyle.onchange=()=>change({gridStyle:gridStyle.value as 'dots'|'lines'|'both'});
    const gridControls=document.createElement('div');gridControls.className='desk-menu-colors desk-menu-grid-controls';gridControls.append(gridLabel,gridColor,gridStyle);
    label(t('menu:grid'),gridControls).classList.add('desk-menu-grid-field');
    const interval=document.createElement('input');interval.type='number';interval.id='grid-interval';interval.min='1';interval.max='100000';interval.step='any';interval.required=true;interval.setAttribute('aria-label',t('menu:gridInterval'));interval.disabled=!changeGrid;
    interval.title=t('menu:gridInterval');label(t('menu:gridInterval'),interval).classList.add('desk-menu-inline-field','desk-menu-grid-interval');
    const intervalPicker=addNumberPresets(interval,[24,48,72,96,120,144,168,192,216,240],t('menu:gridInterval'));panel.append(intervalPicker.popup);
    interval.onchange=()=>{if(!interval.checkValidity()){interval.reportValidity();sync();return;}changeGrid?.({interval:Number(interval.value)});};
    const divisions=document.createElement('select');divisions.hidden=true;divisions.setAttribute('aria-label',t('menu:snapInterval'));divisions.disabled=!changeGrid;
    for(const value of [1,2,3,4]){const option=document.createElement('option');option.value=String(value);option.textContent=`${value}:1`;divisions.append(option);}
    label(t('menu:snapInterval'),divisions).classList.add('desk-menu-inline-field');
    const divisionPicker=addPresetPalette(divisions,['1','2','3','4'],t('menu:snapInterval'));divisionPicker.wrapper.classList.add('line-style-picker');panel.append(divisionPicker.popup);
    for(const button of divisionPicker.choices.querySelectorAll<HTMLButtonElement>('button'))button.textContent=button.dataset.value+':1';
    divisions.onchange=()=>changeGrid?.({snapDivisions:Number(divisions.value)});
    const initialFocus=document.createElement('output');initialFocus.id='initial-focus-id';
    label(t('menu:initialFocus'),initialFocus).classList.add('desk-menu-inline-field');
    sync = () => {
      const settings=desk.settingsSnapshot(),bg = settings.background, resolved = frameColors(bg);
      initialFocus.textContent=settings.initialFocusId??t('menu:notSet');
      divisions.value=String(settings.grid.snapDivisions??1);divisionPicker.menu.textContent=divisions.value+':1';
      gridColor.value=bg.gridColor??'#cbd5e1';gridStyle.value=bg.gridStyle??'dots';
      gridVisible.checked=bg.showGrid??bg.wallpaper==='none';interval.value=String(settings.grid.interval);
      axes.checked=bg.originAxes??false;axesColor.value=bg.originAxesColor??'#94a3b8';
      brightness.value = String(Math.round(bg.underlayBrightness * 100)); brightnessOutput.value = brightness.value + '%';
      titleColor.value=bg.titleBackground??'#0f172a';resetTitle.disabled=!bg.titleBackground;
      wallpaper.value = wallpaperChoice(bg); opacity.value = String(Math.round(bg.opacity * 100)); output.value = opacity.value + '%';
      for (const { key, input, auto } of colors) {
        const color = key === 'selectionColor' ? resolved.selection : resolved.pointing;
        input.value = /^#[0-9a-f]{6}$/i.test(color) ? color : '#808080';
        auto.checked = bg[key] === null;
      }
    };
    sync();
    const saved = document.createElement('p'); saved.className = 'desk-menu-note'; saved.textContent = t('menu:savedNote'); panel.append(saved);
  }
  function about() {
    heading(t('menu:aboutTitle'));
    panel.classList.add('desk-about');
    const artwork=document.createElement('img');artwork.className='about-desk-artwork';artwork.src=`data:image/svg+xml;base64,${btoa(deskArtwork)}`;
    artwork.alt=t('menu:artworkAlt');artwork.width=230;artwork.height=158;
    const text = document.createElement('h3');text.className='about-app-name';
    const releaseLink=document.createElement('a');releaseLink.textContent='Tabletop '+JSON.parse(packageSource).version+(__TABLETOP_COMMIT__?' ('+__TABLETOP_COMMIT__+')':'');releaseLink.href='https://github.com/zuntan/tabletop/releases';releaseLink.target='_blank';releaseLink.rel='noopener noreferrer';
    text.append(releaseLink);
    const description = document.createElement('p'); description.className='about-description';description.textContent = t('menu:aboutDescription');
    const link = document.createElement('a'); link.href = 'https://github.com/zuntan/tabletop'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = t('menu:repository');
    const credits=document.createElement('dl');credits.className='about-credits';
    for(const [role,name]of [
      [t('menu:programmer'),t('menu:senpai')],
      [t('menu:advisor'),t('menu:ossan')],
      [t('menu:direction'),t('menu:author')],
    ]){
      const title=document.createElement('dt');title.textContent=role;
      const value=document.createElement('dd');value.textContent=name;
      credits.append(title,value);
    }
    const projectLinks=document.createElement('div');projectLinks.className='about-project-links';
    const repositoryLine=document.createElement('p');repositoryLine.append(link);
    const fanLetters=document.createElement('a');fanLetters.textContent=t('menu:fanLetters');
    fanLetters.href='https://github.com/zuntan/tabletop/discussions/categories/fan-letters';fanLetters.target='_blank';fanLetters.rel='noopener noreferrer';
    const feedbackLine=document.createElement('p');feedbackLine.append(fanLetters);projectLinks.append(repositoryLine,feedbackLine);
    const projectLicense=document.createElement('section');projectLicense.className='about-project-license';
    const projectHeading=document.createElement('h4');projectHeading.className='about-library-label';projectHeading.textContent=t('menu:license');
    const projectText=document.createElement('p');
    const mit=document.createElement('a');mit.textContent='MIT License';mit.href='https://github.com/zuntan/tabletop/blob/main/LICENSE';mit.target='_blank';mit.rel='noopener noreferrer';
    projectText.append('Tabletop — ',mit,' · Copyright © 2026 zuntan');
    projectLicense.append(projectHeading,projectText);
    const links=document.createElement('div');links.className='about-links';
    const licenseHeading=document.createElement('h4');licenseHeading.className='about-library-label';licenseHeading.textContent=t('menu:libraryLicenses');
    const licenseList=document.createElement('div');licenseList.className='about-license-list';
    licenseList.tabIndex=0;licenseList.setAttribute('role','region');licenseList.setAttribute('aria-label',t('menu:libraryList'));
    const directNames=[...new Set(['Tabler Icons','mermaid','markdown-it','@simonwep/pickr',...Object.keys(JSON.parse(packageSource).dependencies)])];
    for(const name of directNames){
      const entry=thirdParty.entries.find(entry=>entry.name===name);
      if(!entry)continue;
      const row=document.createElement('p'),a=document.createElement('a');
      a.textContent=`${entry.name} · ${entry.license}`;a.href=publicAsset('licenses/'+entry.notice);
      a.target='_blank';a.rel='noopener noreferrer';a.title=t('menu:noticeTitle', { name: entry.name, version: entry.version });
      row.append(a);licenseList.append(row);
    }
    const all=document.createElement('p'),allLink=document.createElement('a');
    allLink.textContent=t('menu:allLicenses');allLink.href=publicAsset('licenses/THIRD_PARTY_NOTICES.txt');allLink.target='_blank';allLink.rel='noopener noreferrer';
    all.append(allLink);links.append(licenseHeading,licenseList,all);
    panel.append(artwork,text,description,credits,projectLinks,projectLicense,links);
  }
  function rootMenu() {
    heading(t('menu:title')); page = 'root';
    action(t('menu:appearance'), appearance); action(t('menu:languageAction'), languageSettings); action(t('menu:about'), about);
    // Keep the experimental entry for internal verification, outside the visible menu.
    if (bhPreview) action(t('menu:bhPreview'), () => { panel.hidePopover(); bhPreview(); }).hidden = true;
  }
  button.onclick = () => {
    if (panel.matches(':popover-open')) { panel.hidePopover(); return; }
    rootMenu(); panel.showPopover();
  };
  document.addEventListener(languageChangeEvent, () => {
    button.title = t('menu:title'); button.setAttribute('aria-label', t('menu:title'));
    if (!panel.matches(':popover-open')) return;
    if (page === 'language') languageSettings();
    else if (page === 'root') rootMenu();
  });
  panel.addEventListener('beforetoggle', event => {
    if ((event as ToggleEvent).newState === 'closed') preview();
  });
  panel.addEventListener('toggle', () => {
    const open = panel.matches(':popover-open');
    button.setAttribute('aria-expanded', String(open));
    if (!open) preview();
  });
  return { refresh: () => sync() };
}
