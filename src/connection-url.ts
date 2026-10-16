const invalidUrl = '接続URLを確認してください。http://127.0.0.1:ポート/ または http://localhost:ポート/ の形式で貼り付けてください。';

/** Parse only local Tabletop URLs; never navigate to or fetch the pasted address. */
export function parseConnectionUrl(value: string): { port: string; token: string | null } {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(invalidUrl); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search) throw new Error(invalidUrl);
  const params = new URLSearchParams(url.hash.slice(1));
  if ([...params.keys()].some(key => !['token', 'port'].includes(key)) ||
      params.getAll('token').length > 1 || params.getAll('port').length > 1) throw new Error(invalidUrl);
  const port = url.port || '80';
  if (Number(port) < 1) throw new Error(invalidUrl);
  const fragmentPort = params.get('port');
  if (fragmentPort !== null && (!/^\d+$/.test(fragmentPort) || Number(fragmentPort) !== Number(port))) {
    throw new Error('接続URLのポート番号が一致していません。URLを確認してください。');
  }
  const token = params.get('token');
  if (token !== null && (token.length < 22 || token.length > 4096 || /\s/.test(token))) {
    throw new Error('接続URLのトークンが正しくありません。URLを確認してください。');
  }
  return { port, token };
}
