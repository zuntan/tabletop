import type {Page} from 'playwright';

export async function respondToConfirm(page:Page,choice:'proceed'|'cancel'|'save'='proceed'){
  const dialog=page.locator('#confirm-dialog');await dialog.waitFor();
  const selector=choice==='proceed'?'[data-dialog-choice="discard"], [data-dialog-choice="confirm"]':`[data-dialog-choice="${choice}"]`;
  await dialog.locator(selector).click();await dialog.waitFor({state:'detached'});
}
