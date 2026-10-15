import * as nativePath from 'node:path';

type PathOperations = Pick<typeof nativePath, 'relative' | 'isAbsolute' | 'sep'>;

// Lexical containment only: the build directory must contain trusted files.
export function isStaticPathInside(root: string, target: string, paths: PathOperations = nativePath): boolean {
  const relative = paths.relative(root, target);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative);
}
