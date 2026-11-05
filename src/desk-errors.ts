import diagnostics from './i18n/en/errors.json';
export type DeskErrorCode = keyof typeof diagnostics;
export type DeskErrorValues = Readonly<Record<string, string | number>>;

/** Shared diagnostics are always English; UI translation happens only at the display boundary. */
export class DeskError extends Error {
  readonly code!: DeskErrorCode;
  readonly values!: DeskErrorValues;
  constructor(code: DeskErrorCode, values: DeskErrorValues = {}) {
    super(diagnostics[code].replace(/{{(\w+)}}/g, (placeholder, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : placeholder));
    // Keep incidental Error serialization unchanged; these are internal display hints.
    Object.defineProperties(this, {
      name: { value: 'DeskError', configurable: true },
      code: { value: code, enumerable: false, writable: false },
      values: { value: Object.freeze({ ...values }), enumerable: false, writable: false },
    });
  }
}
