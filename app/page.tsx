/**
 * page.tsx (raíz) — Página de entrada de la aplicación (ruta '/').
 *
 * No renderiza contenido visual; actúa como guardia de redirección:
 * - Usuario autenticado → /overview (dashboard principal)
 * - Usuario no autenticado → /auth/login
 *
 * El middleware (middleware.ts) también protege las rutas de la app,
 * pero este componente gestiona el caso de la ruta raíz '/' directamente.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ╔═ GE-010 ═╗ redirige según estado de autenticación del usuario
// ╚═ linked → GE-004 app/(app)/overview/page.tsx
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // redirect() lanza una excepción interna de Next.js — no hay return después
  redirect(user ? '/overview' : '/auth/login')
}
