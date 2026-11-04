// Stable transport message shared by the store and browser. Never branch on localized UI text.
export const FILE_EXISTS_MESSAGE = 'A file with this name already exists. Confirm before overwriting.';
export const isFileExistsError = (error: unknown) => error instanceof Error && error.message === FILE_EXISTS_MESSAGE;
