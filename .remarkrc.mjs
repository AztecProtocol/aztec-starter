import { remarkIncludeCode } from 'include_code';

export default {
  plugins: [
    [remarkIncludeCode, {
      codeDir: '.',
      repository: { owner: 'AztecProtocol', name: 'aztec-starter' },
      commitTag: 'main',
      validation: 'error',
    }]
  ]
};
