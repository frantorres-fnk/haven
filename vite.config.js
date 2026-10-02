import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tests de DB (PGlite: Postgres real en memoria) tardan > 5 s en crear la instancia
  test: { testTimeout: 30000, hookTimeout: 30000 },
})
