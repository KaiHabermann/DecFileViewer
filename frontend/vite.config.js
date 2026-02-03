import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/DecFileViewer/',
  plugins: [
    react(),
    {
      name: 'create-nojekyll',
      closeBundle() {
        // Create .nojekyll file to prevent GitHub Pages from using Jekyll
        writeFileSync('dist/.nojekyll', '')
      }
    }
  ],
})

