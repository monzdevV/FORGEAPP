/**
 * client.ts — Cliente de Supabase para uso en el navegador (componentes 'use client').
 *
 * Usa createBrowserClient de @supabase/ssr, que gestiona automáticamente
 * las cookies de sesión en el lado del cliente.
 *
 * IMPORTANTE: llamar a esta función dentro del componente o hook,
 * no en el módulo, para evitar instancias compartidas entre peticiones.
 */
import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea y devuelve un cliente Supabase para el navegador.
 * Lee las variables de entorno públicas (NEXT_PUBLIC_*) definidas en .env.local.
 * El tipo 'any' evita importar el tipo Database completo en el bundle del cliente.
 */
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
