import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite configuration
// Note: gzip / brotli compression is handled automatically by Vercel's CDN.
// No external compression plugin is needed.
export default defineConfig({
  // Serve the app from the root when deployed
  base: '/',

  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    // Custom output folder for production builds (instead of default 'dist')
    outDir: 'build',
    assetsDir: 'assets',
    sourcemap: false,
    // Use Rolldown's built-in minifier (Vite 8 default, esbuild no longer bundled)
    minify: true,
    // Warn when individual chunks exceed 500 kB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split react/react-dom into a separate vendor chunk for better caching
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
        },
      },
    },
  },

  // Preview server — run with: npm run preview
  preview: {
    port: 5000,
    strictPort: true,
  },
});
