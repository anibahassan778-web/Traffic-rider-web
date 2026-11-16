import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Serves the workspace "assests/" directory at "/assets/*" during dev/preview
      // and copies it into "dist/assets/" on production build so exact paths like
      // "assets/bmw_s1000rr_2019.glb" load reliably without touching original files.
      {
        name: 'serve-assests-as-assets',
        configureServer(server) {
          const assestsDir = path.resolve(__dirname, 'assests');
          server.middlewares.use('/assets', (req, res, next) => {
            const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
            const target = path.resolve(assestsDir, rel);
            if (!target.startsWith(assestsDir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
              return next();
            }
            const ext = path.extname(target).toLowerCase();
            if (ext === '.glb') {
              res.setHeader('Content-Type', 'model/gltf-binary');
            }
            res.setHeader('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(target).pipe(res);
          });
        },
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssests = path.resolve(__dirname, 'assests');
          const distAssets = path.resolve(distDir, 'assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssests)) {
            fs.cpSync(srcAssests, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." still resolve in production builds.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
