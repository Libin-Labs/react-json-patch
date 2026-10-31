import api = require('../dist/cjs/index.js');
const patch: api.PatchOperation[] = [{ op: 'replace', path: '/name', value: 'Ada' }];
const props: api.JsonPatchEditorProps = { document: { name: 'Grace' }, patch };
void [
  api.applyPatch,
  api.decodePointer,
  api.encodePointer,
  api.JsonPatchEditor,
  api.JsonPatchError,
  api.previewPatch,
  api.validatePatch,
  props,
];
