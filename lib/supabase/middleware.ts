/**
 * middleware.ts (lib) — Lógica de renovación de sesión y protección de rutas.
 *
 * Esta función se llama desde middleware.ts (raíz) en cada petición.
 * Responsabilidades:
 *   1. Refrescar el token de sesión de Supabase antes de que caduque.
 *   2. Redirigir a /auth/login si el usuario no está autenticado y accede a rutas protegidas.
 *   3. Redirigir a /overview si ya está autenticado e intenta acceder al login.
 *
 * El patrón de doble asignación de supabaseResponse garantiza que las cookies
 * actualizadas de la sesión lleguen al cliente en la respuesta.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ╔═ GE-011 ═╗ renueva la sesión Supabase y protege rutas según autenticación
// ╚═ linked → none
/**
 * Renueva la sesión de Supabase y aplica las redirecciones de protección de rutas.
 * @param request — Petición entrante de Next.js middleware
 * @returns NextResponse con cookies actualizadas o redireccionamiento
 */
export async function updateSession(request: NextRequest) {
  // Se usa NextResponse.next() como base para poder mutar sus cookies más adelante
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        // Escribe las cookies en la petición Y en la respuesta para mantener coherencia
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtener usuario actual — también renueva el token si está próximo a caducar
  const { data: { user } } = await supabase.auth.getUser()

  // Rutas que requieren autenticación (el grupo (app) de Next.js)
  const isAppRoute = request.nextUrl.pathname.startsWith('/overview') ||
    request.nextUrl.pathname.startsWith('/sesion') ||
    request.nextUrl.pathname.startsWith('/graficas') ||
    request.nextUrl.pathname.startsWith('/biblioteca') ||
    request.nextUrl.pathname.startsWith('/perfil') ||
    request.nextUrl.pathname.startsWith('/amigos')

  // Usuario no autenticado intentando acceder a ruta protegida → login
  if (!user && isAppRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Usuario autenticado intentando acceder al login → dashboard
  if (user && request.nextUrl.pathname.startsWith('/auth/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/overview'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
