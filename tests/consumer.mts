import {
  applyPatch,
  decodePointer,
  encodePointer,
  JsonPatchEditor,
  JsonPatchError,
  previewPatch,
  validatePatch,
  type JsonPatchEditorProps,
  type PatchOperation,
} from '../dist/esm/index.js';
const patch: PatchOperation[] = [{ op: 'replace', path: '/name', value: 'Ada' }];
const props: JsonPatchEditorProps = { document: { name: 'Grace' }, patch };
void [
  applyPatch,
  decodePointer,
  encodePointer,
  JsonPatchEditor,
  JsonPatchError,
  previewPatch,
  validatePatch,
  props,
];
