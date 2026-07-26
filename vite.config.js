import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite configuration
// Note: gzip / brotli compression is handled automatically by Vercel's CDN.
// No external compression plugin is needed.
export default defineConfig({
  // Serve the app under the /game/ subdirectory when deployed
  base: '/game/',

  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    // Custom output folder for production builds (instead of default 'dist')
    outDir: 'build',
    assetsDir: 'assets',
    sourcemap: false,
    // Use esbuild minification (built-in, zero extra deps)
    minify: 'esbuild',
    // Warn when individual chunks exceed 500 kB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Split vendor libs into a separate chunk for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
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
