/**
 * route.ts — Route Handler de Next.js para el callback OAuth de Supabase.
 *
 * FLUJO DE AUTENTICACIÓN (OAuth PKCE):
 *   1. El usuario hace clic en "Iniciar sesión con Google" (u otro proveedor).
 *   2. Supabase redirige al proveedor OAuth externo.
 *   3. El proveedor redirige de vuelta a esta URL con un parámetro ?code=<código>.
 *   4. Este handler intercepta esa redirección, toma el código y lo canjea
 *      por una sesión válida (tokens de acceso y refresco).
 *   5. Supabase escribe la sesión en cookies HTTP-only.
 *   6. El usuario se redirige al dashboard (/overview) ya autenticado.
 *
 * El parámetro `code` es de un solo uso y caduca en segundos —
 * debe canjearse inmediatamente con exchangeCodeForSession().
 *
 * Esta ruta debe estar configurada como "Redirect URL" en el panel de Supabase
 * (Authentication → URL Configuration → Redirect URLs).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ╔═ GE-001 ═╗ canjea el código OAuth y establece la sesión del usuario
// ╚═ linked → PO-005 app/auth/login/page.tsx
/**
 * Handler GET: recibe el callback del proveedor OAuth y establece la sesión.
 * @param request — Petición entrante con el parámetro ?code en la URL
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Para usuarios OAuth nuevos (ej. Google) que no tienen perfil todavía,
    // lo creamos aquí usando los metadatos que envía el proveedor.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        const fullName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          'Usuario'
        await supabase.from('profiles').insert({
          id: user.id,
          full_name: fullName,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        })
      }
    }
  }

  return NextResponse.redirect(`${origin}/overview`)
}
