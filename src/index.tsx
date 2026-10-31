import * as React from 'react';

export type PatchOperation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'move' | 'copy'; from: string; path: string }
  | { op: 'test'; path: string; value: unknown };
export interface PatchResult {
  document: unknown;
  changed: boolean;
  operationIndex?: number;
}
export class JsonPatchError extends Error {
  constructor(
    message: string,
    public readonly operationIndex?: number,
  ) {
    super(message);
    this.name = 'JsonPatchError';
  }
}
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function decodePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/'))
    throw new JsonPatchError("JSON Pointer must be empty or begin with '/'.");
  return pointer
    .slice(1)
    .split('/')
    .map((part) => {
      if (/~(?![01])/u.test(part)) throw new JsonPatchError('Invalid JSON Pointer escape.');
      const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~');
      if (forbidden.has(decoded))
        throw new JsonPatchError(`Unsafe JSON Pointer segment: ${decoded}`);
      return decoded;
    });
}
export function encodePointer(parts: readonly string[]): string {
  return parts.length
    ? `/${parts.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`
    : '';
}
export function validatePatch(patch: readonly unknown[]): PatchOperation[] {
  return patch.map((entry, index) => {
    if (!entry || typeof entry !== 'object')
      throw new JsonPatchError('Operation must be an object.', index);
    const op = entry as Record<string, unknown>;
    if (!['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(String(op.op)))
      throw new JsonPatchError(`Unsupported operation: ${String(op.op)}`, index);
    if (typeof op.path !== 'string')
      throw new JsonPatchError('Operation path must be a string.', index);
    try {
      decodePointer(op.path);
      if (op.op === 'move' || op.op === 'copy') {
        if (typeof op.from !== 'string')
          throw new JsonPatchError('Operation from must be a string.');
        decodePointer(op.from);
      }
    } catch (error) {
      throw new JsonPatchError(error instanceof Error ? error.message : 'Invalid pointer.', index);
    }
    if (
      ['add', 'replace', 'test'].includes(String(op.op)) &&
      !Object.prototype.hasOwnProperty.call(op, 'value')
    )
      throw new JsonPatchError(`${String(op.op)} requires a value.`, index);
    return op as unknown as PatchOperation;
  });
}
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => equal(value, b[i]));
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}
function read(root: unknown, path: string): unknown {
  let node = root;
  for (const part of decodePointer(path)) {
    if (Array.isArray(node)) {
      if (!/^(0|[1-9]\d*)$/u.test(part) || Number(part) >= node.length)
        throw new JsonPatchError(`Array index does not exist: ${part}`);
      node = node[Number(part)];
    } else if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, part))
      node = (node as Record<string, unknown>)[part];
    else throw new JsonPatchError(`Path does not exist: ${path}`);
  }
  return node;
}
function write(
  root: unknown,
  path: string,
  value: unknown,
  mode: 'add' | 'replace' | 'remove',
): unknown {
  const parts = decodePointer(path);
  if (!parts.length) {
    if (mode === 'remove') throw new JsonPatchError('Removing the document root is unsupported.');
    return value;
  }
  const key = parts.pop() as string;
  let parent = root;
  for (const part of parts) {
    if (Array.isArray(parent) && /^(0|[1-9]\d*)$/u.test(part)) parent = parent[Number(part)];
    else if (
      parent &&
      typeof parent === 'object' &&
      Object.prototype.hasOwnProperty.call(parent, part)
    )
      parent = (parent as Record<string, unknown>)[part];
    else throw new JsonPatchError(`Parent path does not exist: ${path}`);
  }
  if (Array.isArray(parent)) {
    if (mode === 'add' && key === '-') {
      parent.push(value);
      return root;
    }
    if (!/^(0|[1-9]\d*)$/u.test(key)) throw new JsonPatchError(`Invalid array index: ${key}`);
    const index = Number(key);
    if (mode === 'add') {
      if (index > parent.length) throw new JsonPatchError('Array add index exceeds length.');
      parent.splice(index, 0, value);
    } else {
      if (index >= parent.length) throw new JsonPatchError('Array index does not exist.');
      if (mode === 'remove') parent.splice(index, 1);
      else parent[index] = value;
    }
  } else if (parent && typeof parent === 'object') {
    const object = parent as Record<string, unknown>;
    if (mode !== 'add' && !Object.prototype.hasOwnProperty.call(object, key))
      throw new JsonPatchError(`Path does not exist: ${path}`);
    if (mode === 'remove') delete object[key];
    else object[key] = value;
  } else throw new JsonPatchError(`Parent is not a container: ${path}`);
  return root;
}
export function applyPatch<T>(document: T, patch: readonly unknown[]): PatchResult {
  let working: unknown = structuredClone(document);
  const operations = validatePatch(patch);
  for (let i = 0; i < operations.length; i++) {
    try {
      const operation = operations[i];
      if (operation.op === 'add')
        working = write(working, operation.path, structuredClone(operation.value), 'add');
      else if (operation.op === 'remove')
        working = write(working, operation.path, undefined, 'remove');
      else if (operation.op === 'replace')
        working = write(working, operation.path, structuredClone(operation.value), 'replace');
      else if (operation.op === 'test') {
        if (!equal(read(working, operation.path), operation.value))
          throw new JsonPatchError('Test operation failed.');
      } else {
        const from = decodePointer(operation.from);
        const path = decodePointer(operation.path);
        if (
          operation.op === 'move' &&
          path.length > from.length &&
          from.every((part, at) => path[at] === part)
        )
          throw new JsonPatchError('Cannot move a value into its own descendant.');
        const value = structuredClone(read(working, operation.from));
        if (operation.op === 'move') working = write(working, operation.from, undefined, 'remove');
        working = write(working, operation.path, value, 'add');
      }
    } catch (error) {
      throw new JsonPatchError(error instanceof Error ? error.message : 'Patch failed.', i);
    }
  }
  return { document: working, changed: !equal(document, working) };
}
export function previewPatch(document: unknown, patch: readonly unknown[]): PatchResult {
  return applyPatch(document, patch);
}
export interface JsonPatchEditorProps {
  document: unknown;
  patch: readonly unknown[];
  onPatch?: (patch: readonly unknown[]) => void;
  className?: string;
}
export function JsonPatchEditor({
  document,
  patch,
  onPatch,
  className,
}: JsonPatchEditorProps): React.ReactElement {
  let preview: string;
  let error: string | undefined;
  try {
    preview = JSON.stringify(previewPatch(document, patch).document, null, 2);
  } catch (cause) {
    preview = '';
    error = cause instanceof Error ? cause.message : 'Patch error';
  }
  return (
    <section className={className ?? 'lp-json-patch'} aria-label="JSON patch editor">
      <h2>JSON patch</h2>
      <output aria-live="polite">{error ?? preview}</output>
      <button
        type="button"
        onClick={() => onPatch?.([...patch])}
        disabled={!onPatch || Boolean(error)}
      >
        Apply patch
      </button>
    </section>
  );
}
