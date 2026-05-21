import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({ exclude: [] }),
      {
        name: 'copy-anti-detection',
        closeBundle() {
          copyFileSync(
            resolve('src/main/anti-detection.js'),
            resolve('out/main/anti-detection.js')
          )
        }
      }
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
