/**
 * middleware.ts (raíz) — Punto de entrada del middleware de Next.js.
 *
 * Delega toda la lógica a updateSession (lib/supabase/middleware.ts),
 * que renueva tokens y protege rutas de la aplicación.
 *
 * El matcher excluye archivos estáticos y de imagen para no procesar
 * peticiones que nunca necesitan autenticación, optimizando el rendimiento.
 */
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Procesa todas las rutas excepto archivos estáticos de Next.js y assets de imagen
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
