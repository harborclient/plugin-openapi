import { buildRenderer } from '@harborclient/sdk/build';

await buildRenderer({
  jsxRuntime: 'runtime',
  watch: process.argv.includes('--watch')
});
