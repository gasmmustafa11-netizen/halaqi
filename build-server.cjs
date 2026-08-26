const esbuild = require('esbuild');

Promise.all([
  esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/server.cjs',
  }),
  esbuild.build({
    entryPoints: ['src/server/app.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/api.cjs',
  }),
]).then(() => {
  console.log('SERVER + API BUILD OK');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
