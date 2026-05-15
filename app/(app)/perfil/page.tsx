/**
 * page.tsx — Página de perfil del usuario (Server Component).
 *
 * Carga el perfil del usuario y sus logros desbloqueados con join a la tabla
 * de definiciones de logros, pasándolos al Client Component para edición.
 *
 * El join 'achievements(*)' devuelve la definición completa de cada logro
 * (nombre, descripción, tier, icono) junto con la fecha de desbloqueo.
 */
import { createClient } from '@/lib/supabase/server'
import PerfilClient from './PerfilClient'

// ╔═ GE-005 ═╗ carga perfil del usuario y sus logros desbloqueados
// ╚═ linked → PA-004 app/(app)/perfil/PerfilClient.tsx
export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  // Join con la tabla achievements para obtener nombre, descripción y tier de cada logro
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select('*, achievements(*)')
    .eq('user_id', user!.id)

  return <PerfilClient profile={profile} achievements={achievements || []} userId={user!.id} />
}
