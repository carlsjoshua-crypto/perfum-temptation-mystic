import { resolve } from 'path';

export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        modelTest: resolve(process.cwd(), 'model-test.html'),
      },
    },
    chunkSizeWarningLimit: 1000,
  },
};
