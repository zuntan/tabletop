export type PairingState = 'waiting-for-AI' | 'new-pairing-open' | 'paired';

/** Guidance only: never opens acceptance, restores credentials or changes a connection. */
export function connectionGuidance(browserConnected: boolean, pairingState: PairingState) {
  const bootstrapReady = pairingState === 'new-pairing-open';
  if (browserConnected && !bootstrapReady) return {
    bootstrapReady,
    nextAction: { kind: 'call-tool', tool: 'desk_connections' },
    message: 'Browser connected. Read desk_connections, then retain each desk_pairing_info record privately by deskId. Never publish recovery credentials.',
  };
  if (bootstrapReady) return {
    bootstrapReady,
    nextAction: { kind: 'browser-connect', verifyWith: 'desk_connection_info' },
    message: 'New/manual pairing acceptance is open for an additional endpoint. Existing desks may already be connected. For an approved local browser launch, call desk_browser_open; otherwise present the connection URL for manual opening. Verify the new endpoint in desk_connections afterward; an existing browserConnected:true does not establish that the new browser connected. Do not reload an existing unsaved tab.',
  };
  if (pairingState === 'paired') return {
    bootstrapReady,
    nextAction: { kind: 'wait-for-browser', verifyWith: 'desk_connection_info' },
    message: 'A pairing is registered, but no browser is connected. Wait briefly for the known browser to reconnect, then check browserConnected. Do not open new acceptance automatically. If it does not reconnect, ask the user about the existing tab; do not reload it or replace its pairing without approval.',
  };
  return {
    bootstrapReady,
    nextAction: { kind: 'ask-user', topic: 'new-or-manual-pairing-vs-recovery' },
    message: 'Acceptance is closed and no recovery pairing is registered. Do not present the URL as ready to connect: opening it alone cannot connect. Determine whether this is new/manual pairing or recovery. For new/manual pairing, obtain user approval, call desk_pairing_open({confirm:true}), then get desk_connection_info and use desk_browser_open for local launch or present its URL for manual opening. For recovery, restore the exact privately retained record with desk_pairing_restore instead; never open acceptance as a recovery shortcut. If the record is lost, ask the user to save or manually reconnect the existing tab without reload and obtain approval before replacement.',
  };
}
