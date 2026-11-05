const errors = {
  invalidUrl: 'Check the connection URL. Use a localhost or authorized LAN HTTP URL.',
  portMismatch: 'The connection URL port numbers do not match.',
  invalidToken: 'The connection URL token is invalid.',
};
/** Canonical diagnostic only. Human-facing callers translate the stable code, never the URL. */
export class ConnectionUrlError extends Error {
  constructor(readonly code: keyof typeof errors) { super(errors[code]); this.name='ConnectionUrlError'; }
}

/** Extra LAN hosts must come from the serving server, never the pasted address. */
export function parseConnectionUrl(value: string, allowedHosts: string[] = ['127.0.0.1', 'localhost']): { host: string; port: string; token: string | null } {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new ConnectionUrlError('invalidUrl'); }
  if (url.protocol !== 'http:' || !allowedHosts.includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search) throw new ConnectionUrlError('invalidUrl');
  const params = new URLSearchParams(url.hash.slice(1));
  if ([...params.keys()].some(key => !['token', 'port'].includes(key)) ||
      params.getAll('token').length > 1 || params.getAll('port').length > 1) throw new ConnectionUrlError('invalidUrl');
  const port = url.port || '80';
  if (Number(port) < 1) throw new ConnectionUrlError('invalidUrl');
  const fragmentPort = params.get('port');
  if (fragmentPort !== null && (!/^\d+$/.test(fragmentPort) || Number(fragmentPort) !== Number(port))) {
    throw new ConnectionUrlError('portMismatch');
  }
  const token = params.get('token');
  if (token !== null && (token.length < 22 || token.length > 4096 || /\s/.test(token))) {
    throw new ConnectionUrlError('invalidToken');
  }
  return { host: url.hostname, port, token };
}
