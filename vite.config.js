import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';

// Vite configuration with custom base path, output folder, and compression
export default defineConfig({
  // Serve the app under the /game/ subdirectory when deployed
  base: '/game/',
  plugins: [
    react(),
    tailwindcss(),
    // Gzip compression
    compression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
  ],
  build: {
    // Custom output folder for production builds
    outDir: 'build',
    assetsDir: 'assets',
    sourcemap: false,
  },
  // Preview options can be overridden via CLI (e.g., --port)
  preview: {},
});
