import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

// https://vitejs.dev/config/
const base = process.env.VITE_BASE_PATH ?? '/DecFileViewer/'

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'create-nojekyll',
      closeBundle() {
        writeFileSync('dist/.nojekyll', '')
      }
    }
  ],
})

