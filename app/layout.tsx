/**
 * layout.tsx (raíz) — Layout HTML global de la aplicación Next.js.
 *
 * Es el único lugar donde se define la estructura <html><body>.
 * Aplica globals.css a todas las rutas y configura los metadatos SEO base.
 * Todos los demás layouts anidan dentro del <body> de este componente.
 */
import type { Metadata } from 'next'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — CSS import handled by Next.js
import '@/styles/globals.css'

// Metadatos base — pueden ser sobreescritos por layouts o páginas hijas
export const metadata: Metadata = {
  title: 'FORGE — Entrenamiento de Élite',
  description: 'Tracker de gimnasio de élite',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
