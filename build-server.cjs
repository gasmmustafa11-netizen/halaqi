const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: 'dist/server.cjs',
}).then(() => {
  console.log('SERVER BUILD OK');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
