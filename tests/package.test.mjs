import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const dom = new JSDOM("<!doctype html><div id='root'></div>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const api = await import('../dist/esm/index.js');
const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
test('ESM and CommonJS expose the same runtime API', () =>
  assert.deepEqual(
    Object.keys(cjs)
      .filter((key) => key !== '__esModule')
      .sort(),
    Object.keys(api).sort(),
  ));
test('implements safe patch operations and JSON Pointer escaping', () => {
  assert.equal(api.encodePointer(['a/b', '~x']), '/a~1b/~0x');
  assert.deepEqual(api.decodePointer('/a~1b/~0x'), ['a/b', '~x']);
  assert.throws(() => api.decodePointer('/bad~2escape'), api.JsonPatchError);
  assert.throws(() => api.validatePatch([{ op: 'wat', path: '/' }]), api.JsonPatchError);
  const result = api.applyPatch({ list: [1, 3] }, [
    { op: 'add', path: '/list/1', value: 2 },
    { op: 'test', path: '/list/2', value: 3 },
  ]);
  assert.deepEqual(result.document, { list: [1, 2, 3] });
  assert.equal(result.changed, true);
  assert.deepEqual(
    api.previewPatch({ name: 'old' }, [{ op: 'replace', path: '/name', value: 'new' }]).document,
    { name: 'new' },
  );
  assert.throws(
    () => api.applyPatch({}, [{ op: 'add', path: '/__proto__/polluted', value: true }]),
    api.JsonPatchError,
  );
  assert.equal({}.polluted, undefined);
  assert.throws(
    () => api.applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 2 }]),
    /Test operation failed/u,
  );
});
test('renders preview and disables invalid patches', async () => {
  const root = createRoot(document.getElementById('root'));
  let applied = false;
  await React.act(async () =>
    root.render(
      React.createElement(api.JsonPatchEditor, {
        document: {},
        patch: [{ op: 'remove', path: '/missing' }],
        onPatch: () => {
          applied = true;
        },
      }),
    ),
  );
  assert.ok(document.querySelector('button')?.disabled);
  assert.match(document.body.textContent, /does not exist/u);
  assert.equal(applied, false);
  await React.act(async () => root.unmount());
});
