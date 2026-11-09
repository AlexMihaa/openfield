/** Run with npx tsx scripts/test-i18n.ts; no engine or network is needed. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { initialLocale, translate } from '../src/i18n.js';
import { ru } from '../src/locales/ru.js';
import { APPS, APP_CATS, badgeLabel } from '../src/catalog.js';
import { CAMERA_MOVES } from '../src/stage.js';
import { tierCapNote } from '../src/renderTier.js';

assert.equal(initialLocale(undefined, ['en-US', 'ru-RU']), 'ru');
assert.equal(initialLocale(undefined, ['en-US']), 'en');
assert.equal(initialLocale({ getItem: () => 'en' }, ['ru']), 'en');
assert.equal(initialLocale({ getItem: () => 'ru' }, ['en']), 'ru');
assert.equal(initialLocale({ getItem: () => 'invalid' }, ['ru']), 'ru');
assert.equal(initialLocale({ getItem: () => { throw new Error('blocked'); } }, ['ru']), 'ru');
assert.equal(translate('Setup', 'en'), 'Setup');
assert.equal(translate('Setup', 'ru'), 'Настройка');
assert.equal(translate('New upstream text', 'ru'), 'New upstream text');
assert.equal(translate('constructor', 'ru'), 'constructor');
assert.equal(translate('__proto__', 'ru'), '__proto__');
assert.equal(translate('take {0}', 'ru', { 0: '@Mara {1}' }), 'дубль @Mara {1}');
assert.equal(translate('take {0}', 'ru'), 'дубль {0}');
assert.equal(translate('Queued takes: {0}', 'ru', { 0: 5 }), 'Дубли в очереди: 5');
assert.equal(translate('npm run doctor', 'ru'), 'npm run doctor');
assert.equal(translate('ComfyUI', 'ru'), 'ComfyUI');
assert.equal(translate('models/', 'ru'), 'models/');
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
for (const [key, value] of Object.entries(ru)) {
  assert.ok(value.trim(), `Empty translation: ${key}`);
  assert.deepEqual(placeholders(value), placeholders(key), `Placeholders: ${key}`);
  assert.equal(value.match(/^\s*/)?.[0], key.match(/^\s*/)?.[0], `Leading space: ${key}`);
  assert.equal(value.match(/\s*$/)?.[0], key.match(/\s*$/)?.[0], `Trailing space: ${key}`);
}
for (const key of [...APPS.flatMap((a) => [a.name, a.blurb]), ...APP_CATS.map((c) => c.label), ...CAMERA_MOVES.map((m) => m.name), badgeLabel('top'), badgeLabel('new'), badgeLabel('soon'), tierCapNote('stage')!, tierCapNote('reshoot')!, tierCapNote('mirror')!]) {
  assert.ok(Object.hasOwn(ru, key), `Missing catalog display text: ${key}`);
}

// New UI messages must have a catalog entry; the English fallback is for
// dynamic engine errors and upstream data, not accidentally untranslated controls.
const root = resolve('src');
let messages = 0;
const missing = new Set<string>();
for (const file of readdirSync(root, { recursive: true }).filter((f) => typeof f === 'string' && f.endsWith('.tsx'))) {
  const path = resolve(root, String(file));
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      const key = node.arguments[0].text;
      if (!Object.hasOwn(ru, key)) missing.add(key);
      messages++;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
assert.deepEqual([...missing], [], 'Missing translations');
assert.ok(messages > 800);
console.log(`i18n passed: ${Object.keys(ru).length} entries, ${messages} UI messages; locale selection, fallback, placeholders, spacing and source coverage.`);
