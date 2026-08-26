/**
 * Module resolution hook that teaches plain Node about the app's TypeScript
 * layout: the `@/` alias from tsconfig, and extensionless relative imports.
 *
 * Metro and Jest already understand both; this exists so the repo's own
 * scripts (puzzle generation, the dependency-free smoke check) can import the
 * app's real source instead of keeping a second copy of the logic.
 *
 * Usage: node --experimental-strip-types --import ./scripts/node-ts-resolver.mjs <entry>
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), '../src');

const HOOK = `
const SRC = ${JSON.stringify(SRC)};
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.json'];

function firstExisting(base) {
  if (existsSync(base) && !base.endsWith('/')) return base;
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolved(hit, context, next) {
  const url = pathToFileURL(hit).href;
  // Bundlers import JSON without an attribute; Node insists on one.
  if (hit.endsWith('.json')) {
    return { url, format: 'json', importAttributes: { type: 'json' }, shortCircuit: true };
  }
  return next(url, context);
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const hit = firstExisting(resolvePath(SRC, specifier.slice(2)));
    if (hit) return resolved(hit, context, next);
  }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const hit = firstExisting(resolvePath(dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return resolved(hit, context, next);
  }
  return next(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(HOOK)}`, import.meta.url);
