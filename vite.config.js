import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'postprocessing': ['three/examples/jsm/postprocessing/EffectComposer', 'three/examples/jsm/postprocessing/RenderPass']
        }
      }
    }
  },
  assetsInclude: ['**/*.mp4', '**/*.glb', '**/*.gltf']
});
