import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posix, win32 } from 'node:path';
import { isStaticPathInside } from '../src/static-path';

for (const [platform, paths, root] of [
  ['POSIX', posix, '/dev/tabletop/dist'],
  ['Windows', win32, 'C:\\dev\\tabletop\\dist'],
] as const) {
  test(`${platform}: static files inside the build directory are allowed`, () => {
    for (const file of ['index.html', 'assets/main.js', 'assets/main.css', '..cache/file.js']) {
      assert.equal(isStaticPathInside(root, paths.resolve(root, file), paths), true, file);
    }
  });

  test(`${platform}: static paths cannot escape into parents or sibling directories`, () => {
    for (const file of ['.', '..', '../README.md', '../dist-other/index.html', 'assets/../../src/server.ts']) {
      assert.equal(isStaticPathInside(root, paths.resolve(root, file), paths), false, file);
    }
  });
}

test('Windows: forward slashes, mixed separators and case-insensitive paths are supported', () => {
  const root = 'C:/dev/tabletop/dist';
  assert.equal(isStaticPathInside(root, 'C:/dev/tabletop/dist/index.html', win32), true);
  assert.equal(isStaticPathInside(root, 'c:\\DEV\\tabletop\\dist\\assets/main.js', win32), true);
  assert.equal(isStaticPathInside(root, 'C:/dev/tabletop/dist/..\\README.md', win32), false);
});

test('Windows: other drives and UNC shares are outside the build directory', () => {
  const root = 'C:\\dev\\tabletop\\dist';
  assert.equal(isStaticPathInside(root, 'D:\\dev\\tabletop\\dist\\index.html', win32), false);
  assert.equal(isStaticPathInside(root, '\\\\server\\share\\index.html', win32), false);
  const uncRoot = '\\\\server\\share\\dist';
  assert.equal(isStaticPathInside(uncRoot, `${uncRoot}\\index.html`, win32), true);
  assert.equal(isStaticPathInside(uncRoot, '\\\\server\\other\\dist\\index.html', win32), false);
});
