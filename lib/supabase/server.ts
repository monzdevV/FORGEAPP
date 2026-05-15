/**
 * server.ts — Cliente de Supabase para Server Components y Route Handlers de Next.js.
 *
 * Usa createServerClient de @supabase/ssr, que lee y escribe cookies mediante
 * la API de Next.js (next/headers). Solo puede usarse en contextos de servidor.
 *
 * El bloque try/catch en setAll es necesario porque los Server Components
 * no pueden escribir cookies directamente; solo los Route Handlers pueden.
 * El error se silencia de forma segura: la sesión no se pierde, simplemente
 * no se renueva en esa petición.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea y devuelve un cliente Supabase configurado con las cookies del servidor.
 * Debe llamarse con await dentro de un Server Component o Route Handler.
 * No puede usarse en componentes con 'use client'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient() {
  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Devuelve todas las cookies de la petición entrante
        getAll() { return cookieStore.getAll() },

        // Escribe cookies de sesión actualizadas en la respuesta.
        // El try/catch evita que falle en Server Components donde las cookies son de solo lectura.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: Record<string, unknown> }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component — la cookie se actualizará en el middleware */ }
        },
      },
    }
  )
}
