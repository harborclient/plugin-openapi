import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const rendererOptions = {
  bundle: true,
  format: 'esm',
  logLevel: 'info',
  entryPoints: ['src/renderer.tsx'],
  outfile: 'dist/renderer.js',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: '@harborclient/sdk',
  alias: {
    'react/jsx-runtime': '@harborclient/sdk/jsx-runtime',
    'react/jsx-dev-runtime': '@harborclient/sdk/jsx-dev-runtime'
  },
  external: ['react', 'react-dom']
};

const context = await esbuild.context(rendererOptions);

if (watch) {
  await context.watch();
  console.log('Watching for changes…');
} else {
  await context.rebuild();
  await context.dispose();
}
