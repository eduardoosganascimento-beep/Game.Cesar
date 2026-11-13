// @ts-nocheck
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// Embute todos os arquivos de public/ dentro do bundle como data URI.
// Assim o jogo publicado precisa apenas de index.html + index.js + index.css
// e funciona em qualquer hospedagem (inclusive GitHub Pages em subpasta).
function embedPublicAssets(): Plugin {
  const virtualId = 'virtual:sandman-assets'
  const resolvedId = `\0${virtualId}`

  return {
    name: 'sandman-embed-assets',
    resolveId(id) {
      return id === virtualId ? resolvedId : null
    },
    load(id) {
      if (id !== resolvedId) return null

      const publicDir = path.resolve(process.cwd(), 'public')
      const files: Record<string, string> = {}

      const mimeFor = (file: string): string => {
        const ext = path.extname(file).toLowerCase()
        if (ext === '.png') return 'image/png'
        if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
        if (ext === '.webp') return 'image/webp'
        if (ext === '.svg') return 'image/svg+xml'
        if (ext === '.json') return 'application/json'
        if (ext === '.woff2') return 'font/woff2'
        return 'application/octet-stream'
      }

      const walk = (dir: string, prefix: string): void => {
        if (!fs.existsSync(dir)) return
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            walk(full, rel)
            continue
          }
          const buffer = fs.readFileSync(full)
          files[rel] = `data:${mimeFor(entry.name)};base64,${buffer.toString('base64')}`
        }
      }

      walk(publicDir, '')

      return `export const embeddedAssets = ${JSON.stringify(files)}\n`
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [embedPublicAssets()],
  // Os arquivos de public/ são embutidos no bundle, então não precisam ser
  // copiados para dist: o site publicado fica com poucos arquivos.
  publicDir: false,
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: '',
    target: 'es2020',
    // Nome com hash: cada build gera arquivos novos (e o navegador do
    // repositório nunca reaproveita um upload antigo).
    rollupOptions: {
      output: {
        entryFileNames: 'index-[hash].js',
        assetFileNames: 'index-[hash].[ext]',
      },
    },
  },
})
