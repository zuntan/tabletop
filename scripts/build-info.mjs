import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

/** Git wins for checkouts; only matching, validated release metadata is used in source ZIPs. */
export function buildCommit(root) {
  if (existsSync(join(root,'.git'))) {
    try {
      const hash=execFileSync('git',['rev-parse','--short=7','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
      if (/^[0-9a-f]{7,40}$/.test(hash)) return hash;
    } catch { /* A source distribution may still carry release metadata. */ }
  }
  try {
    const info=JSON.parse(readFileSync(join(root,'release-info.json'),'utf8'));
    const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
    if(info.version===pkg.version&&info.tag===`v${pkg.version}`&&/^[0-9a-f]{40}$/.test(info.commit))return info.commit.slice(0,7);
  } catch { /* GitHub's automatic source archives have no metadata. */ }
  return '';
}
