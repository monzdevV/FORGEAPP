/**
 * page.tsx — Página de amigos (Server Component).
 *
 * Carga los datos necesarios en el servidor y los pasa al Client Component:
 *   1. friendships: amistades aceptadas (bidireccionales, filtradas por estado)
 *   2. requests: solicitudes pendientes recibidas por el usuario actual
 *   3. feed: actividad reciente de los amigos (últimos 20 eventos)
 *
 * La extracción de IDs de amigos (friendIds) se hace aquí para poder
 * filtrar el feed con una query .in() eficiente, evitando cargar
 * todo el activity_feed y filtrar en cliente.
 */
import { createClient } from '@/lib/supabase/server'
import AmigosClient from './AmigosClient'

// ╔═ GE-003 ═╗ carga amistades, solicitudes pendientes y feed de actividad
// ╚═ linked → PO-004 app/(app)/amigos/AmigosClient.tsx
export default async function AmigosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Amistades aceptadas: incluye datos de ambos perfiles (requester y receiver)
  // para poder identificar cuál es "el amigo" independientemente de la dirección
  const { data: friendships } = await supabase
    .from('friendships')
    .select('*, requester:requester_id(id, full_name, username, level, current_streak, last_workout_at), receiver:receiver_id(id, full_name, username, level, current_streak, last_workout_at)')
    .or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
    .eq('status', 'accepted')

  // Solicitudes pendientes recibidas (el usuario actual es el receiver)
  const { data: requests } = await supabase
    .from('friendships')
    .select('*, requester:requester_id(id, full_name, username)')
    .eq('receiver_id', user!.id)
    .eq('status', 'pending')

  // Extraer IDs de amigos: en cada amistad, el amigo es el que NO es el usuario actual
  const friendIds = (friendships || []).map(f =>
    (f.requester as { id: string }).id === user!.id
      ? (f.receiver as { id: string }).id
      : (f.requester as { id: string }).id
  )

  // Feed solo si hay amigos; evita una query innecesaria con array vacío en .in()
  let feed: unknown[] = []
  if (friendIds.length > 0) {
    const { data } = await supabase
      .from('activity_feed')
      .select('*, profiles(full_name)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(20)
    feed = data || []
  }

  return (
    <AmigosClient
      friendships={friendships || []}
      requests={requests || []}
      feed={feed}
      userId={user!.id}
    />
  )
}
