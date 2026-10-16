import type { Desk } from './model';
import { decodeDeskFile, encodeDeskFile, MAX_DESK_FILE_BYTES } from './desk-file';
import { downloadDeskFilename } from './desk-identity';
import { headerIcon } from './header-icon';

export function createDeskFileControls(header: HTMLElement, desk: Desk, refresh: () => void, canLoad: () => boolean) {
  const save = document.createElement('button');
  save.id = 'save-desk'; headerIcon(save, 'save', '保存');
  const load = document.createElement('button');
  load.id = 'load-desk'; headerIcon(load, 'load', '読込');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.tabletop,.zip'; input.hidden = true; input.id = 'desk-file';
  header.append(save, load, input);
  const report = (text: string) => { document.querySelector('#message')!.textContent = text; };
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const revision = desk.revision;
      const filename = downloadDeskFilename(desk.settingsSnapshot().name);
      const bytes = await encodeDeskFile(desk);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      report(`revision ${revision} を保存しました`);
    } catch (error) { report(`保存失敗: ${error instanceof Error ? error.message : String(error)}`); }
    finally { save.disabled = false; }
  });
  load.addEventListener('click', () => { if (canLoad()) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.value = '';
    if (!file || !canLoad()) return;
    if (!confirm('現在の机をファイルの内容に置き換えます。未保存なら先に保存してください。読込後は「元に戻す」で戻せます。')) return;
    const revision = desk.revision;
    load.disabled = true;
    try {
      if (file.size > MAX_DESK_FILE_BYTES) throw new Error('File exceeds 50 MiB');
      const result = await decodeDeskFile(new Uint8Array(await file.arrayBuffer()));
      if (desk.revision !== revision || !canLoad()) throw new Error('Desk changed during loading; please retry');
      desk.replaceDocument({ objects: result.objects, settings: result.settings });
      refresh();
      report(result.warnings.length ? `読込完了（画像欠落 ${result.warnings.length} 件）` : '読込完了');
    } catch (error) { report(`読込失敗（机は変更していません）: ${error instanceof Error ? error.message : String(error)}`); }
    finally { load.disabled = false; }
  });
}
