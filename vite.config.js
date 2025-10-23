import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: 'particle-simulation.js',
        assetFileNames: 'particle-simulation.[ext]'
      }
    }
  },
  server: {
    open: true,
    allowedHosts: ['exports-attention-paxil-devon.trycloudflare.com']
  }
})