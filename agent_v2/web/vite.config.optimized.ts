import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        // 手动代码分割策略
        manualChunks: {
          // 第三方库分离
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          // 图表库单独打包（只在统计页面使用）
          'charts': ['recharts'],
          // Markdown渲染单独打包（只在详情页使用）
          'markdown': ['react-markdown'],
        },
        // 确保 chunk 文件大小合理
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';
          if (/\.css$/.test(info)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // 压缩优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // 生成 source map（生产环境可关闭）
    sourcemap: false,
  },
  // 预构建优化
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
})
