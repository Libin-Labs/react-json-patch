# @lp-labs/react-json-patch

An immutable-input JSON Patch validator, applier, previewer, and small controlled React preview for the supported RFC 6902 operations.

## Example

```tsx
import { applyPatch, JsonPatchEditor, type PatchOperation } from "@lp-labs/react-json-patch";
import "@lp-labs/react-json-patch/styles.css";

const patch: PatchOperation[] = [
  { op: "test", path: "/profile/name", value: "Grace" },
  { op: "replace", path: "/profile/name", value: "Ada" },
  { op: "add", path: "/tags/-", value: "verified" },
];
const result = applyPatch({ profile: { name: "Grace" }, tags: [] }, patch);
function Preview() { return <JsonPatchEditor document={{ profile: { name: "Grace" }, tags: [] }} patch={patch} />; }
```

## React API

`JsonPatchEditorProps` is `{document: unknown; patch: readonly unknown[]; onPatch?: (patch: readonly unknown[]) => void; className?: string}`. `JsonPatchEditor` defaults its class to `lp-json-patch`; it previews the transformed JSON and error text in an `aria-live` output. The optional button calls `onPatch` with a shallow copy of the validated input operations; it does not mutate or replace the supplied document. It is disabled without a callback or if preview fails.

## Helpers and types

- `PatchOperation` is the union of RFC-shaped `add`, `remove`, `replace`, `move`, `copy`, and `test` operations. Add/replace/test carry `value`; move/copy carry `from`. Values are arbitrary cloneable JSON-compatible values.
- `JsonPatchError` extends `Error`; `operationIndex?: number` identifies the operation that failed (validation or application).
- `decodePointer(pointer: string): string[]` and `encodePointer(parts: readonly string[]): string` decode/encode RFC 6901 escaping (`~1` slash, `~0` tilde). Invalid pointer structure or escapes throw `JsonPatchError`. Unsafe segments `__proto__`, `prototype`, and `constructor` are rejected on decode.
- `validatePatch(patch: readonly unknown[]): PatchOperation[]` validates operation names, required properties, path and from pointers. Returns the original validated operation references and throws `JsonPatchError` with an index on invalid input.
- `PatchResult` is `{document: unknown; changed: boolean; operationIndex?: number}`. `applyPatch<T>(document: T, patch: readonly unknown[]): PatchResult` clones the document, then applies operations in order without mutating input. `test` uses structural equality. Array indices must be canonical nonnegative decimal integers; add permits index equal to length and `-` for append. Object add creates/replaces a key; remove/replace require an existing key. Root add/replace are supported; root removal is not. Move into a descendant is rejected. Errors throw `JsonPatchError` with the operation index.
- `previewPatch(document: unknown, patch: readonly unknown[]): PatchResult` is an alias in behavior for `applyPatch`.
- `JsonPatchEditorProps` is the component props type.

## Standards subset and limits

Implements the RFC 6902 operation set and RFC 6901 pointer escaping, with deliberately stricter prototype-related path rejection. It does not handle non-JSON values, custom equality, streaming/large documents, JSON text parsing, conflict resolution, or partial results: any failed operation throws and leaves the original document unchanged. `structuredClone` must be supported by the runtime. The preview component does not offer a JSON editing surface; callers supply patch data. Output is an accessible live region but does not implement a line-oriented diff. React is the only runtime peer; declarations accompany ESM/CJS builds.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
