/// <reference types="vite/client" />

declare module 'virtual:sandman-assets' {
  /** Mapa de caminho público -> data URI embutida no bundle. */
  export const embeddedAssets: Record<string, string>
}
