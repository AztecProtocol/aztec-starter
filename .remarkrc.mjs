import { remarkIncludeCode } from 'include_code';

export default {
  plugins: [
    [remarkIncludeCode, {
      codeDir: './src',
      repository: { owner: 'AztecProtocol', name: 'aztec-starter' },
      commitTag: 'main',
      validation: 'error',
    }]
  ]
};
