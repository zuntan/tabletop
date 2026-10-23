import deskArtwork from './assets/desk-link.svg?raw';
import {plainDeskColors,wallpaperChoice,wallpaperPatch} from './desk-appearance';
import type { Desk } from './model';
import type { Settings } from './settings';
import { createIcon } from './icons';
import { frameColors } from './frame-colors';
import packageSource from '../package.json?raw';
import './desk-menu.css';

export function createDeskMenu(header: HTMLElement, desk: Desk, change: (patch: Partial<Settings['background']>) => void, preview: (patch?: Partial<Settings['background']>) => void, bhPreview?: () => void) {
  const button = document.createElement('button');
  button.id = 'desk-menu'; button.type = 'button'; button.className = 'header-icon';
  button.title = 'メニュー'; button.setAttribute('aria-label', 'メニュー');
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  const icon = createIcon('minus', 20);
  icon.querySelector('path')!.setAttribute('d', 'M4 6h16 M4 12h16 M4 18h16');
  icon.setAttribute('data-icon', 'menu'); button.append(icon);
  (header.querySelector('#file-menu') ?? header.querySelector('#load-desk'))!.after(button);
  const panel = document.createElement('section'); panel.id = 'desk-menu-panel'; panel.popover = 'auto';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'メニュー');
  document.querySelector('#app')!.append(panel);
  button.setAttribute('aria-controls', panel.id);
  // Keep desk shortcuts (Delete, Space, Escape selection clearing) out of this UI.
  panel.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); panel.hidePopover(); button.focus(); }
  });
  let sync = () => {};
  function heading(title: string) {
    panel.replaceChildren();panel.classList.remove('desk-about');
    const row = document.createElement('div'); row.className = 'desk-menu-heading';
    const h = document.createElement('h2'); h.textContent = title;
    const close = document.createElement('button'); close.type = 'button'; close.title = '閉じる'; close.setAttribute('aria-label', '閉じる');
    close.append(createIcon('x', 18)); close.onclick = () => { panel.hidePopover(); button.focus(); };
    row.append(h, close); panel.append(row); sync = () => {};
    panel.setAttribute('aria-label', title);
  }
  function action(label: string, run: () => void) {
    const item = document.createElement('button'); item.type = 'button'; item.textContent = label;
    item.className = 'desk-menu-item'; item.onclick = () => { run(); panel.querySelector<HTMLElement>('input,select,button')?.focus(); };
    panel.append(item); return item;
  }
  function appearance() {
    heading('机の見た目');
    const label = (text: string, control: HTMLElement) => {
      const node = document.createElement('label'); node.className = 'desk-menu-field';
      const caption = document.createElement('span'); caption.textContent = text; node.append(caption, control); panel.append(node);
    };
    const wallpaper = document.createElement('select'); wallpaper.setAttribute('aria-label', '壁紙');
    for (const [value, text] of [['none', '無地'], ...plainDeskColors.map(p=>[p.value,p.label]), ['wood-1', '木目1'], ['wood-2', '木目2'], ['wood', 'フローリング'], ['cutting-mat', 'カッターマット'], ['pink-notebook', 'ピンクのノート'], ['charcoal', 'チャコール']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; wallpaper.append(option);
    }
    wallpaper.onchange = () => change(wallpaperPatch(wallpaper.value));
    label('壁紙', wallpaper);
    const titleColor=document.createElement('input');titleColor.type='color';titleColor.setAttribute('aria-label','タイトル背景色');
    titleColor.onchange=()=>change({titleBackground:titleColor.value});
    const resetTitle=document.createElement('button');resetTitle.type='button';resetTitle.textContent='標準に戻す';resetTitle.setAttribute('aria-label','タイトル背景色を標準に戻す');
    resetTitle.onclick=()=>change({titleBackground:null});
    const titleRow=document.createElement('div');titleRow.className='desk-menu-colors';titleRow.append(titleColor,resetTitle);label('タイトル背景色',titleRow);

    const opacity = document.createElement('input'); opacity.type = 'range'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.setAttribute('aria-label', '壁紙の不透明度');
    const output = document.createElement('output'); output.htmlFor = opacity.id = 'wallpaper-opacity';
    const range = document.createElement('div'); range.className = 'desk-menu-range'; range.append(opacity, output);
    opacity.oninput = () => { output.value = opacity.value + '%'; preview({ opacity: Number(opacity.value) / 100 }); };
    opacity.onchange = () => change({ opacity: Number(opacity.value) / 100 });
    label('壁紙の不透明度', range);
    const brightness = document.createElement('input'); brightness.type = 'range'; brightness.min = '0'; brightness.max = '100'; brightness.step = '1'; brightness.dir = 'rtl'; brightness.setAttribute('aria-label', '下地の明るさ');
    const brightnessOutput = document.createElement('output'); brightnessOutput.htmlFor = brightness.id = 'wallpaper-underlay-brightness';
    const brightnessRow = document.createElement('div'); brightnessRow.className = 'desk-menu-range';
    const white = document.createElement('span'); white.textContent = '白';
    const black = document.createElement('span'); black.textContent = '黒';
    brightnessRow.append(white, brightness, black, brightnessOutput);
    brightness.oninput = () => { brightnessOutput.value = brightness.value + '%'; preview({ underlayBrightness: Number(brightness.value) / 100 }); };
    brightness.onchange = () => change({ underlayBrightness: Number(brightness.value) / 100 });
    label('下地の明るさ', brightnessRow);
    const note = document.createElement('p'); note.className = 'desk-menu-note'; note.textContent = '壁紙の不透明度0%で下地だけになります。下地は白から黒まで調整できます。パーツの色は変わりません。'; panel.append(note);
    const colors: { key: 'selectionColor' | 'pointingColor'; input: HTMLInputElement; auto: HTMLInputElement }[] = [];
    for (const [key, title] of [['selectionColor', '選択枠'], ['pointingColor', 'AIの指差し枠']] as const) {
      const row = document.createElement('div'); row.className = 'desk-menu-colors';
      const input = document.createElement('input'); input.type = 'color'; input.setAttribute('aria-label', title + 'の色');
      input.onchange = () => change({ [key]: input.value });
      const auto = document.createElement('input'); auto.type = 'checkbox'; auto.setAttribute('aria-label', title + 'を壁紙に合わせる');
      auto.onchange = () => change({ [key]: auto.checked ? null : input.value });
      const autoLabel = document.createElement('label'); autoLabel.append(auto, '壁紙に合わせる');
      row.append(input, autoLabel); label(title, row); colors.push({ key, input, auto });
    }
    sync = () => {
      const bg = desk.settingsSnapshot().background, resolved = frameColors(bg);
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
    const saved = document.createElement('p'); saved.className = 'desk-menu-note'; saved.textContent = 'この机に保存される設定です。ライト／ダークの切り替えとは独立しています。'; panel.append(saved);
  }
  function about() {
    heading('Tabletopについて');
    panel.classList.add('desk-about');
    const artwork=document.createElement('img');artwork.className='about-desk-artwork';artwork.src=`data:image/svg+xml;base64,${btoa(deskArtwork)}`;
    artwork.alt='ランプと紙とマグカップ、笑顔の引き出しがある机';artwork.width=230;artwork.height=158;
    const text = document.createElement('h3');text.className='about-app-name';
    const releaseLink=document.createElement('a');releaseLink.textContent='Tabletop '+JSON.parse(packageSource).version;releaseLink.href='https://github.com/zuntan/tabletop/releases';releaseLink.target='_blank';releaseLink.rel='noopener noreferrer';
    text.append(releaseLink);
    const description = document.createElement('p'); description.className='about-description';description.textContent = '人間とAIが同じ机を囲んで考えるための作業机。';
    const link = document.createElement('a'); link.href = 'https://github.com/zuntan/tabletop'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'プロジェクト → GitHub Repository';
    const license = document.createElement('a'); license.href = '/licenses/tabler-icons.txt'; license.target = '_blank'; license.rel = 'noopener noreferrer'; license.textContent = 'Tabler Icons · MIT License';
    const licenses = document.createElement('p'); licenses.append(license);
    const mermaidLicense = document.createElement('a'); mermaidLicense.href = '/licenses/mermaid.txt'; mermaidLicense.target = '_blank'; mermaidLicense.rel = 'noopener noreferrer'; mermaidLicense.textContent = 'Mermaid · MIT License';
    licenses.append(document.createElement('br'), mermaidLicense);
    const credits=document.createElement('dl');credits.className='about-credits';
    for(const [role,name]of [
      ['プログラマー','センパイ（GPT Sol 6.1 ～）'],
      ['アドバイザー','おっさん〈だらっくだ〉（ChatGPT GPT 6 ～）'],
      ['企画・ディレクション','ずんたん〈zuntan〉'],
    ]){
      const title=document.createElement('dt');title.textContent=role;
      const value=document.createElement('dd');value.textContent=name;
      credits.append(title,value);
    }
    const projectLinks=document.createElement('div');projectLinks.className='about-project-links';
    const repositoryLine=document.createElement('p');repositoryLine.append(link);
    const fanLetters=document.createElement('a');fanLetters.textContent='ファンレター・感想 → GitHub Discussions';
    fanLetters.href='https://github.com/zuntan/tabletop/discussions/categories/fan-letters';fanLetters.target='_blank';fanLetters.rel='noopener noreferrer';
    const feedbackLine=document.createElement('p');feedbackLine.append(fanLetters);projectLinks.append(repositoryLine,feedbackLine);
    const projectLicense=document.createElement('section');projectLicense.className='about-project-license';
    const projectHeading=document.createElement('h4');projectHeading.className='about-library-label';projectHeading.textContent='ライセンス';
    const projectText=document.createElement('p');
    const mit=document.createElement('a');mit.textContent='MIT License';mit.href='https://github.com/zuntan/tabletop/blob/main/LICENSE';mit.target='_blank';mit.rel='noopener noreferrer';
    projectText.append('Tabletop — ',mit,' · Copyright © 2026 zuntan');
    projectLicense.append(projectHeading,projectText);
    const links=document.createElement('div');links.className='about-links';
    const licenseHeading=document.createElement('h4');licenseHeading.className='about-library-label';licenseHeading.textContent='ライブラリライセンス';
    links.append(licenseHeading,licenses);
    panel.append(artwork,text,description,credits,projectLinks,projectLicense,links);
  }
  button.onclick = () => {
    if (panel.matches(':popover-open')) { panel.hidePopover(); return; }
    heading('メニュー'); action('机の見た目…', appearance); action('Tabletopについて…', about);
    // Keep the experimental entry for internal verification, outside the visible menu.
    if (bhPreview) action('BH比較（実験）…', () => { panel.hidePopover(); bhPreview(); }).hidden = true;
    panel.showPopover();
  };
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
