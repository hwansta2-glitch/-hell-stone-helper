import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readdirSync, readFileSync } from 'node:fs'

const MIME = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

// EMBED=1 이면 public/ 의 그림을 전부 data: 주소로 넣는다 (한 파일로 미리보기용)
function images(embed) {
  const id = 'virtual:images'
  return {
    name: 'embedded-images',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null
      if (!embed) return 'export default {}'
      const out = {}
      for (const dir of ['pets', 'items', 'chars', 'maps'])
        for (const f of readdirSync(`public/${dir}`)) {
          const type = MIME[f.split('.').pop().toLowerCase()]
          if (type) out[`${dir}/${f}`] = `data:${type};base64,${readFileSync(`public/${dir}/${f}`).toString('base64')}`
        }
      return `export default ${JSON.stringify(out)}`
    },
  }
}

const SINGLE = !!process.env.SINGLE || !!process.env.EMBED
export default defineConfig({
  base: './',
  publicDir: process.env.EMBED ? false : 'public',
  plugins: [react(), images(!!process.env.EMBED), ...(SINGLE ? [viteSingleFile()] : [])],
})
