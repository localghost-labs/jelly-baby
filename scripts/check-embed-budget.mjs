import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

/**
 * The embed's first-visit transfer, measured from the build manifest, must fit
 * the budget the Smashbar design set for it (10 MB compressed). CI fails above
 * it, so a regression is caught in the repository that caused it.
 *
 * "The embed's transfer" is the static import graph from the document entry
 * plus the always-loaded runtime chunk and the optical transport worker,
 * together with the CSS and assets those chunks reference, the document
 * itself, and the font the embed's loading card requests. Chunks reached only
 * by dynamic import — the timber table, the lighting switch and its night
 * map, the playroom, the other worlds — are the playroom's and are excluded;
 * the leak check below fails the run if any of their assets is found on the
 * embed's side of the graph.
 */
const BUDGET_BYTES=10_000_000;
// Edge brotli on the fly sits around quality 4–6; quality 11 flatters the
// binary assets by ~15 %. Measure the way the bytes will actually be served.
const BROTLI_QUALITY=5;
const ALWAYS_LOADED=['index.html','src/app/runtime.ts'];
/** Vite builds workers as their own bundles and leaves them out of the manifest; find them in the output. */
const WORKER_FILE=/\.worker-[\w-]+\.js$/;
const FULL_ONLY=/night|wood_|grass_/;
/** Files under public/ the embed page requests that no chunk references. */
const PUBLIC_FETCHES=['fonts/inter-latin.woff2'];

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist');

function fail(message) {
  console.error(`\nembed budget: ${message}`);
  process.exit(1);
}

const manifestPath=join(dist,'.vite','manifest.json');
if(!existsSync(manifestPath))fail('dist/.vite/manifest.json is missing — run `npm run build` first (vite.config.js sets build.manifest).');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));

const files=new Set(['index.html']),seen=new Set();
function visit(key) {
  if(seen.has(key))return;seen.add(key);
  const chunk=manifest[key];
  if(!chunk)fail(`manifest has no entry for ${key}`);
  files.add(chunk.file);
  for(const css of chunk.css??[])files.add(css);
  // The document's own `assets` are its preload hints for BOTH modes; which of
  // them the embed fetches is decided by index.html's rel-flip script, and the
  // ones it does fetch are referenced again by the runtime chunk, so they are
  // counted there.
  if(key!=='index.html')for(const asset of chunk.assets??[])files.add(asset);
  for(const dependency of chunk.imports??[])visit(dependency);
}
ALWAYS_LOADED.forEach(visit);
const workers=readdirSync(join(dist,'assets')).filter(name=>WORKER_FILE.test(name)).map(name=>`assets/${name}`);
if(!workers.length)fail('dist/assets has no worker bundle; the optical transport worker must be counted');
for(const worker of workers)files.add(worker);
for(const file of PUBLIC_FETCHES)files.add(file);

const leaked=[...files].filter(file=>FULL_ONLY.test(file));
if(leaked.length)fail(`playroom-only assets are on the embed's side of the import graph:\n  ${leaked.join('\n  ')}\nMove the module that references them behind a dynamic import the embed does not take.`);

const rows=[...files].map(file=>{
  const path=join(dist,file);
  if(!existsSync(path))fail(`${file} is in the manifest but not in dist/`);
  const bytes=readFileSync(path);
  const compressed=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:BROTLI_QUALITY,[constants.BROTLI_PARAM_SIZE_HINT]:bytes.length}}).length;
  return {file,raw:bytes.length,compressed};
}).sort((a,b)=>b.compressed-a.compressed);

const mb=n=>(n/1e6).toFixed(2).padStart(6);
console.log(`embed first-visit transfer (brotli q${BROTLI_QUALITY}), budget ${mb(BUDGET_BYTES)} MB\n`);
console.log(`${'file'.padEnd(48)}${'raw MB'.padStart(8)}${'br MB'.padStart(8)}`);
for(const {file,raw,compressed} of rows)console.log(`${file.padEnd(48)}${mb(raw).padStart(8)}${mb(compressed).padStart(8)}`);
const total=rows.reduce((sum,row)=>sum+row.compressed,0),rawTotal=rows.reduce((sum,row)=>sum+row.raw,0);
console.log(`${'total'.padEnd(48)}${mb(rawTotal).padStart(8)}${mb(total).padStart(8)}`);
if(total>BUDGET_BYTES)fail(`${mb(total)} MB compressed exceeds the ${mb(BUDGET_BYTES)} MB budget`);
console.log(`\nwithin budget with ${mb(BUDGET_BYTES-total)} MB to spare`);
