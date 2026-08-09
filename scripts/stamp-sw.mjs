/* Stamps the built service worker with a version derived from the build's own asset names.
 *
 * The service worker is a static file, so without this its cache name would never change and
 * `activate` would never purge the previous build — leaving returning visitors on a stale
 * HTML shell that points at asset files from an earlier deploy. Hashing the asset filenames
 * means the version changes exactly when the build output does, and not on rebuilds that
 * produce identical output. */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = 'dist';
const swPath = join(dist, 'sw.js');

const assets = (await readdir(join(dist, 'assets')).catch(() => [])).sort();
const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);

const source = await readFile(swPath, 'utf8');
if (!source.includes('__SW_VERSION__')) {
  console.error(`stamp-sw: no __SW_VERSION__ placeholder in ${swPath} — refusing to ship an unversioned worker`);
  process.exit(1);
}

await writeFile(swPath, source.replaceAll('__SW_VERSION__', version));
console.log(`stamp-sw: cache version runway-${version} (${assets.length} assets)`);
