import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    // Base URL for deployment (use '/' for root deployment)
    base: '/',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    preview: {
      port: 4173,
      host: '0.0.0.0',
    },

    plugins: [react()],

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Add app version for debugging
      'process.env.APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || 'development'),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },

    build: {
      // Output directory
      outDir: 'dist',

      // Generate source maps for production debugging (optional)
      sourcemap: false,

      // Minification settings
      minify: 'esbuild',

      // Target modern browsers for smaller bundle
      target: 'es2020',

      // Chunk size warning limit (in KB)
      chunkSizeWarningLimit: 1000,

      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            'vendor-react': ['react', 'react-dom'],
            'vendor-pdf': ['pdfjs-dist'],
            'vendor-icons': ['lucide-react'],
            'vendor-google': ['@google/genai'],
          },
          // Asset file naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          // Entry file naming
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },

      // CSS code splitting
      cssCodeSplit: true,

      // Enable CSS minification
      cssMinify: true,

      // Report compressed size
      reportCompressedSize: true,
    },

    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', '@google/genai'],
      exclude: ['pdfjs-dist'],
    },

    // Enable gzip/brotli compression analysis
    esbuild: {
      // Drop console.log in production
      drop: isProduction ? ['console', 'debugger'] : [],
    },
  };
});
