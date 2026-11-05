import { DeskError, type DeskErrorCode } from '../desk-errors';
import diagnostics from './en/errors.json';
import { getUiLanguage, t } from './index';
import type { UiLanguage } from './resources';

// Older/string-only transports retain the canonical message. Match only complete static
// diagnostics for display; this lookup never controls an operation or parses user data.
const staticCodes = new Map(Object.entries(diagnostics).filter(([, value]) => !value.includes('{{'))
  .map(([key, value]) => [value, key as DeskErrorCode]));
export function uiErrorMessage(error: unknown, language: UiLanguage = getUiLanguage()): string {
  if (error instanceof DeskError) return t(`errors:${error.code}`, { lng: language, replace: error.values });
  const message = error instanceof Error ? error.message : String(error);
  const code = staticCodes.get(message);
  return code ? t(`errors:${code}`, { lng: language }) : message;
}
