import type { Desk } from './model';
import { createIcon } from './icons';

/** Name drafts stay local until submitted; unrelated refreshes never replace the input. */
export function createDeskIdentityControls(header: HTMLElement, desk: Desk, canEdit: () => boolean, refresh: () => void, report: (text: string, error?: boolean) => void) {
  const group = document.createElement('div'); group.className = 'desk-identity';
  const name = document.createElement('span'); name.id = 'desk-name';
  const id = document.createElement('code'); id.id = 'desk-id'; id.textContent = desk.deskId; id.title = '今開いている棚の目印（保存ファイルには含みません）';
  id.setAttribute('aria-label', `棚ID ${desk.deskId}`);
  const edit = document.createElement('button'); edit.id = 'edit-desk-name'; edit.type = 'button'; edit.append(createIcon('pencil', 16));
  edit.title = '棚の名前を編集'; edit.setAttribute('aria-label', '棚の名前を編集');
  const form = document.createElement('form'); form.id = 'desk-name-form'; form.hidden = true;
  const input = document.createElement('input'); input.id = 'desk-name-input'; input.maxLength = 100; input.placeholder = '無題'; input.setAttribute('aria-label', '棚の名前');
  const apply = document.createElement('button'); apply.type = 'submit'; apply.textContent = '決定';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
  const actions = document.createElement('div'); actions.className = 'desk-name-actions'; actions.append(apply, cancel);
  form.append(input, actions); group.append(name, edit, id, form); header.querySelector('.brand')!.append(group);
  let expectedRevision = 0;
  const finish = () => { form.hidden = true; name.hidden = false; edit.hidden = false; edit.focus(); };
  edit.onclick = () => {
    if (!canEdit()) { report('編集中の操作を終えてから名前を変更してください', true); return; }
    expectedRevision = desk.revision; input.value = desk.settingsSnapshot().name;
    const frame = name.getBoundingClientRect();
    const minimumWidth = 8 * parseFloat(getComputedStyle(input).fontSize) + 16;
    form.style.width = `${Math.max(minimumWidth, frame.width)}px`; form.style.minHeight = `${frame.height}px`;
    form.hidden = false; name.hidden = true; edit.hidden = true; input.focus(); input.select();
  };
  cancel.onclick = finish;
  form.onkeydown = event => {
    // Keep application shortcuts from deleting objects or changing shared history while typing.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
  };
  form.onsubmit = event => {
    event.preventDefault();
    if (!canEdit()) { report('編集中の操作を終えてから名前を変更してください', true); return; }
    try {
      desk.execute({ operations: [{ kind: 'desk_rename', name: input.value }], actor: 'human', expectedRevision });
      finish(); refresh(); report('棚の名前を変更しました');
    } catch (error) { report(`${error instanceof Error ? error.message : String(error)}（取消して開き直してください）`, true); }
  };
  return {
    isEditing: () => !form.hidden,
    refresh: () => {
      const title = desk.settingsSnapshot().name || '無題';
      id.textContent=desk.deskId;id.setAttribute('aria-label',`棚ID ${desk.deskId}`);
      name.textContent = title; name.title = title;
      document.title = `${title} [${desk.deskId}] — Tabletop`;
    },
  };
}
