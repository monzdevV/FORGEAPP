/**
 * next.config.ts — Configuración de Next.js para la aplicación FORGE.
 *
 * Este archivo se evalúa en tiempo de build y en cada inicio del servidor.
 * Solo afecta al comportamiento del framework, no al código de la aplicación.
 */
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // remotePatterns: lista blanca de dominios externos permitidos para el componente <Image>.
    // Sin esta configuración, cualquier imagen cargada desde un dominio externo lanzará un error.
    // El patrón '*.supabase.co' cubre tanto el Storage (avatars, banners) como las URLs
    // generadas por las funciones de Supabase (ej: avatars públicos en el bucket de Storage).
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
