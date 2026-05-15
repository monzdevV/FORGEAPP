/**
 * AmigosClient.tsx — Vista interactiva del sistema de amigos.
 *
 * Responsabilidades:
 *   - Mostrar lista de amigos con estado de actividad (activo hoy / último entreno)
 *   - Gestionar solicitudes pendientes (aceptar / rechazar)
 *   - Buscador de usuarios por nombre o @username para enviar solicitudes
 *   - Feed de actividad de amigos (entrenamientos, PRs, logros)
 *   - Leaderboard de racha entre amigos
 *
 * Las mutaciones (aceptar/rechazar/enviar solicitud) actualizan Supabase directamente
 * y luego llaman a router.refresh() para refrescar los datos del Server Component padre.
 */
'use client'
import { useState } from 'react'
import { Dumbbell, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Tipos locales para los datos recibidos del Server Component
// FriendProfile: datos básicos del perfil necesarios para la vista de amigos
interface FriendProfile { id: string; full_name: string; username: string | null; level: number | null; current_streak: number | null; last_workout_at: string | null }
// FriendshipRow: fila de la tabla friendships con los perfiles del solicitante y receptor ya resueltos via join
interface FriendshipRow { id: string; requester: FriendProfile; receiver: FriendProfile; accepted_at: string | null }
// RequestRow: solicitud pendiente recibida — solo necesitamos los datos del solicitante
interface RequestRow { id: string; requester: FriendProfile }
// FeedRow: entrada del feed de actividad — profiles es el join al perfil del autor del evento
interface FeedRow { id: string; message: string | null; type: string; created_at: string | null; profiles: { full_name: string } | null }

/**
 * Genera las iniciales de un nombre completo (máximo 2 caracteres).
 * Se usa como contenido del avatar circular cuando no hay foto de perfil.
 * Ejemplo: "Juan García" → "JG"
 */
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Asigna un color de fondo de avatar determinista basado en el nombre.
 * El algoritmo de hash (h * 31 + charCode) es una variante de djb2 simplificada.
 * Garantiza que el mismo nombre siempre produce el mismo color — evita parpadeos en re-renders.
 * Los colores son tonos oscuros del design system para contrastar con el texto dorado de las iniciales.
 */
function avatarColor(name: string) {
  // Paleta de cinco colores oscuros temáticos — suficientemente distintos entre sí para diferenciar usuarios
  const colors = ['#7A6030','#2D5A4F','#4A3060','#3A4A60','#60302D']
  // Hash de los caracteres del nombre: multiplica por 31 (número primo) para dispersar bien los valores
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length
  return colors[h]
}

/**
 * Convierte una fecha ISO a tiempo relativo legible (ej: "5m", "2h", "3d").
 * Solo devuelve la unidad más significativa para mantener la UI compacta.
 * No usa librería externa para evitar aumentar el bundle de la app.
 */
function timeAgo(date: string) {
  // Diferencia en milisegundos entre ahora y la fecha del evento
  const diff = Date.now() - new Date(date).getTime()
  // Convertir a minutos para la primera condición
  const m = Math.floor(diff / 60000)
  // Si menos de 60 minutos, mostrar en minutos
  if (m < 60) return `${m}m`
  // Si menos de 24 horas, mostrar en horas
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  // En cualquier otro caso, mostrar en días
  return `${Math.floor(h / 24)}d`
}

export default function AmigosClient({ friendships, requests, feed, userId }: {
  // Amistades aceptadas del usuario — incluye perfiles de ambos lados de la relación
  friendships: FriendshipRow[]
  // Solicitudes de amistad recibidas y todavía pendientes de respuesta
  requests: RequestRow[]
  // Feed de actividad de amigos — tipado como unknown[] porque Supabase no infiere joins complejos
  feed: unknown[]
  // ID del usuario autenticado — necesario para saber qué lado de la amistad somos nosotros
  userId: string
}) {
  // Pestaña activa del panel principal: 'lista' muestra amigos, 'actividad' muestra el feed
  const [tab, setTab] = useState<'lista' | 'actividad'>('lista')
  // Texto del campo de búsqueda — puede ser nombre o @username del usuario a buscar
  const [searchQuery, setSearchQuery] = useState('')  // nombre o @username del usuario a buscar
  // true mientras la query de búsqueda está en curso — deshabilita el botón para evitar doble envío
  const [searching, setSearching] = useState(false)
  // Perfil del usuario encontrado en la última búsqueda — null si no se ha buscado o no se encontró
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null)
  // Mensaje de error de búsqueda — se muestra bajo el formulario si no se encuentra el usuario
  const [searchError, setSearchError] = useState('')
  // true mientras se está insertando la solicitud de amistad en BD — deshabilita el botón de añadir
  const [sendingReq, setSendingReq] = useState(false)
  // true tras enviar una solicitud exitosamente — muestra el mensaje de confirmación verde
  const [reqSent, setReqSent] = useState(false)

  // Router de Next.js para llamar a router.refresh() tras mutaciones y recargar el Server Component
  const router = useRouter()
  // Cliente de Supabase para el navegador — usado en todas las operaciones de lectura/escritura aquí
  const supabase = createClient()

  // Extraer el perfil del amigo de cada fila de amistad bidireccional.
  // En una amistad, una persona es el solicitante (requester) y otra el receptor (receiver).
  // El "amigo" es siempre el que no somos nosotros — se determina comparando los IDs.
  const friends = friendships.map(f =>
    f.requester.id === userId ? f.receiver : f.requester
  )

  // ╔═ GE-002 ═╗ busca usuarios en perfiles por nombre o @username
  // ╚═ linked → PO-004 app/(app)/amigos/AmigosClient.tsx
  /**
   * Maneja el envío del formulario de búsqueda de usuario.
   * Busca por username exacto (@handle) O por nombre parcial (ilike para insensibilidad de mayúsculas).
   * Excluye al usuario actual para evitar enviarse solicitud a sí mismo.
   * Si no encuentra ningún usuario, muestra error; si encuentra uno, actualiza searchResult.
   */
  async function handleSearch(e: React.FormEvent) {
    // Prevenir el comportamiento nativo del formulario (recarga de página)
    e.preventDefault()
    if (!searchQuery.trim()) return
    // Activar estado de carga y limpiar resultados anteriores
    setSearching(true)
    setSearchResult(null)
    setSearchError('')
    const { data, error } = await supabase
      .from('profiles')
      // Solo los campos necesarios para la previsualización del usuario encontrado
      .select('id, full_name, username, level, current_streak, last_workout_at')
      // Buscar por username exacto (sin @) O por nombre que contenga el texto buscado
      .or(`username.eq.${searchQuery},full_name.ilike.%${searchQuery}%`)
      // Excluir al propio usuario — no tiene sentido enviarse solicitud a uno mismo
      .neq('id', userId)
      // Solo necesitamos el primer resultado para la previsualización
      .limit(1)
      .single()
    // Desactivar estado de carga independientemente del resultado
    setSearching(false)
    // Si no hay datos o hay error, mostrar mensaje al usuario y salir
    if (error || !data) { setSearchError('Usuario no encontrado'); return }
    // Cast explícito necesario — .single() devuelve el tipo genérico de Supabase, no FriendProfile
    setSearchResult(data as FriendProfile)
  }

  // ╔═ PO-004 ═╗ inserta una solicitud de amistad pendiente en friendships
  // ╚═ linked → GE-003 app/(app)/amigos/page.tsx
  /**
   * Inserta una solicitud de amistad en la tabla friendships con status='pending'.
   * Tras el envío, limpia el formulario y muestra el mensaje de confirmación.
   * No llama a router.refresh() porque la solicitud enviada no cambia los datos del Server Component
   * (solo afecta al receptor, no al remitente).
   */
  async function sendFriendRequest() {
    // Protección: no hacer nada si el resultado de búsqueda fue limpiado
    if (!searchResult) return
    // Deshabilitar el botón durante el envío para evitar solicitudes duplicadas
    setSendingReq(true)
    await supabase.from('friendships').insert({
      requester_id: userId,       // Siempre el usuario actual como solicitante
      receiver_id: searchResult.id, // El usuario encontrado como receptor
      status: 'pending',          // Estado inicial — el receptor debe aceptar o rechazar
    })
    setSendingReq(false)
    // Mostrar confirmación y resetear el formulario de búsqueda
    setReqSent(true)
    setSearchResult(null)
    setSearchQuery('')
  }

  // ╔═ PA-002 ═╗ acepta una solicitud de amistad actualizando su estado a accepted
  // ╚═ linked → PO-004 app/(app)/amigos/AmigosClient.tsx
  /**
   * Acepta una solicitud de amistad actualizando su estado a 'accepted' en BD.
   * También registra la fecha de aceptación en accepted_at para tener historial.
   * Llama a router.refresh() para que el Server Component recargue las amistades aceptadas.
   */
  async function acceptRequest(friendshipId: string) {
    await supabase.from('friendships').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(), // Fecha de aceptación en formato ISO para la BD
    }).eq('id', friendshipId)
    // Refrescar el Server Component para que la amistad aparezca en la lista principal
    router.refresh()
  }

  // ╔═ PA-003 ═╗ rechaza una solicitud de amistad actualizando su estado a rejected
  // ╚═ linked → PO-004 app/(app)/amigos/AmigosClient.tsx
  /**
   * Rechaza una solicitud pendiente actualizando su estado a 'rejected'.
   * No elimina la fila para mantener el historial y poder implementar bloqueos en el futuro.
   * router.refresh() elimina la solicitud de la lista de pendientes en la UI.
   */
  async function declineRequest(friendshipId: string) {
    await supabase.from('friendships').update({ status: 'rejected' }).eq('id', friendshipId)
    // Refrescar para que la solicitud rechazada desaparezca de la lista de pendientes
    router.refresh()
  }

  // Cast explícito de unknown[] a FeedRow[] — Supabase tipifica los joins complejos como unknown
  // porque el tipo retornado depende del query dinámico construido en el Server Component
  const typeFeedRow = feed as FeedRow[]

  return (
    // Animación de entrada de página definida como @keyframes panelIn en globals.css
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>
      {/* Disposición en dos columnas: panel principal a la izquierda, panel lateral a la derecha */}
      <div style={{ display: 'flex', gap: '20px' }}>

        {/* ── Columna principal (flex:1): ocupa todo el espacio restante dejado por el panel lateral ── */}
        <div style={{ flex: 1 }}>

          {/* Pestañas de navegación: "Amigos (N)" y "Actividad" */}
          <div className="tabs">
            {/* Pestaña de lista de amigos — muestra el conteo total entre paréntesis */}
            <button className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
              Amigos ({friends.length})
            </button>
            {/* Pestaña de feed de actividad reciente de los amigos */}
            <button className={`tab ${tab === 'actividad' ? 'active' : ''}`} onClick={() => setTab('actividad')}>
              Actividad
            </button>
          </div>

          {/* ── Contenido de la pestaña "Amigos" ── */}
          {tab === 'lista' && (
            <>
              {/* Bloque de solicitudes pendientes — solo se renderiza si hay solicitudes */}
              {requests.length > 0 && (
                <div className="card" style={{ marginBottom: '14px' }}>
                  {/* Cabecera con título a la izquierda y badge de conteo a la derecha */}
                  <div className="card-hd">
                    <div className="card-title">Solicitudes pendientes</div>
                    {/* Badge dorado con número de solicitudes — llama la atención del usuario */}
                    <span style={{
                      background: 'var(--gold)', color: 'var(--blk)',
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '2px',
                    }}>{requests.length}</span>
                  </div>

                  {/* Una fila por cada solicitud pendiente recibida */}
                  {requests.map(req => (
                    <div key={req.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 0',
                      borderBottom: '0.5px solid var(--bdr)', // Separador visual entre solicitudes
                    }}>
                      {/* Avatar circular del solicitante con iniciales y color determinista */}
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: avatarColor(req.requester.full_name), // Color único basado en el nombre
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', color: 'var(--gold-l)', // Iniciales en dorado claro
                      }}>{initials(req.requester.full_name)}</div>

                      {/* Bloque central: nombre completo y @username — flex:1 para empujar botones al extremo */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{req.requester.full_name}</div>
                        {/* Username con @ prefijado — '—' si no tiene username configurado */}
                        <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>@{req.requester.username || '—'}</div>
                      </div>

                      {/* Botones de acción: aceptar (dorado, primario) e ignorar (outline, secundario) */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {/* Aceptar solicitud — span requerido por .btn-gold para el efecto ripple */}
                        <button className="btn btn-gold btn-sm" onClick={() => acceptRequest(req.id)}>
                          <span>Aceptar</span>
                        </button>
                        {/* Ignorar (rechazar) — sin span porque .btn-outline no tiene ripple */}
                        <button className="btn btn-outline btn-sm" onClick={() => declineRequest(req.id)}>
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de amigos con indicador de actividad */}
              {/* Estado vacío: se muestra cuando el usuario no tiene amigos todavía */}
              {friends.length === 0 ? (
                <div style={{ color: 'var(--txt2)', fontSize: '13px', padding: '20px 0' }}>
                  Aún no tienes amigos. Busca usuarios en el panel de la derecha.
                </div>
              ) : (
                // Una fila por cada amigo aceptado
                friends.map(f => {
                  // Activo = ha entrenado en las últimas 24 horas (86400000 ms = 24h)
                  // last_workout_at puede ser null si el amigo no ha hecho ningún entreno nunca
                  const isActive = f.last_workout_at &&
                    (Date.now() - new Date(f.last_workout_at).getTime()) < 24 * 60 * 60 * 1000
                  return (
                    // Fila de amigo: borde se intensifica en hover para dar feedback visual sin enlace
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', background: 'var(--s2)',
                      border: '0.5px solid var(--bdr)', marginBottom: '6px',
                      transition: 'border-color 0.3s',
                    }}
                    // Hover: borde dorado más visible para simular elemento interactivo
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--bdr2)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bdr)')}>

                      {/* Contenedor del avatar: position:relative para posicionar el punto de presencia absoluto */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {/* Avatar circular con iniciales y color determinista basado en el nombre */}
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: avatarColor(f.full_name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', color: 'var(--gold-l)',
                          border: '1.5px solid var(--bdr2)', // Borde dorado semitransparente como marco
                        }}>{initials(f.full_name)}</div>

                        {/* Punto de presencia: posicionado absolute sobre la esquina inferior-derecha del avatar */}
                        {/* Dorado = activo hoy, gris (txt3) = no ha entrenado hoy */}
                        {/* border:1.5px solid var(--s2) crea el efecto de separación del avatar */}
                        <span style={{
                          position: 'absolute', bottom: '1px', right: '1px',
                          width: '9px', height: '9px', borderRadius: '50%',
                          border: '1.5px solid var(--s2)', // Borde del color del fondo para "recortar" el punto del avatar
                          background: isActive ? 'var(--gold)' : 'var(--txt3)',
                        }} />
                      </div>

                      {/* Bloque central: nombre y estado de actividad — flex:1 para empujar la racha al extremo */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.full_name}</div>
                        {/* Subtexto de actividad: emoji de gym si activo hoy, fecha del último entreno si no, "Sin actividad" si nunca entrenó */}
                        <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>
                          {isActive
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Dumbbell size={11} /> Entrenando hoy</span>
                            : f.last_workout_at
                              ? `Último entreno: ${new Date(f.last_workout_at).toLocaleDateString('es-ES')}`
                              : 'Sin actividad'}
                        </div>
                      </div>

                      {/* Bloque derecho: racha actual en fuente display grande — flexShrink:0 para no comprimirse */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {/* Número de días de racha en Bebas Neue — el dato más relevante del leaderboard */}
                        <div style={{
                          fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px',
                          color: 'var(--gold)', lineHeight: 1,
                        }}>
                          {f.current_streak || 0}
                        </div>
                        {/* Etiqueta de unidad en letras pequeñas con tracking */}
                        <div style={{ fontSize: '11px', color: 'var(--txt2)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          días racha
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}

          {/* ── Contenido de la pestaña "Actividad": feed de eventos recientes de los amigos ── */}
          {tab === 'actividad' && (
            <div className="card">
              <div className="card-hd">
                <div className="card-title">Actividad reciente</div>
              </div>

              {/* Estado vacío: ningún amigo ha generado actividad todavía */}
              {typeFeedRow.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '12px 0' }}>
                  Sin actividad reciente de tus amigos.
                </div>
              ) : (
                // Una fila por cada evento del feed (entrenamiento, PR, logro)
                typeFeedRow.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px', // flex-start porque el texto puede ser multilinea
                    fontSize: '13px', color: 'var(--txt2)',
                    padding: '10px 0',
                    borderBottom: '0.5px solid var(--bdr)', // Separador visual entre eventos
                  }}>
                    {/* Punto de color codificado por tipo de evento del feed */}
                    {/* marginTop:4px para alinear visualmente con la primera línea del texto */}
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                      // Dorado = récord personal (pr_achieved), verde = entreno completado, gris = otros eventos
                      background: item.type === 'pr_achieved' ? 'var(--gold)' :
                        item.type === 'workout_completed' ? 'var(--grn)' : 'var(--txt3)',
                    }} />

                    {/* Cuerpo del evento: nombre del autor en texto primario + mensaje del evento */}
                    <span style={{ flex: 1 }}>
                      {/* Nombre en negrita y color primario para destacar el autor del evento */}
                      <b style={{ color: 'var(--txt)' }}>{item.profiles?.full_name || '—'}</b>{' '}
                      {/* Mensaje del evento — generado en BD al insertar en activity_feed */}
                      {item.message}
                    </span>

                    {/* Tiempo relativo del evento (ej: "5m", "2h", "3d") — alineado a la derecha */}
                    {/* flexShrink:0 evita que se comprima cuando el mensaje es largo */}
                    <span style={{ fontSize: '12px', color: 'var(--txt3)', flexShrink: 0 }}>
                      {item.created_at ? timeAgo(item.created_at) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Panel lateral derecho (ancho fijo 240px): buscador + leaderboard ── */}
        {/* flexShrink:0 evita que el panel se comprima si la columna principal necesita más espacio */}
        <div style={{ width: '240px', flexShrink: 0 }}>

          {/* ── Card: buscador de usuarios para enviar solicitudes de amistad ── */}
          <div className="card">
            <div className="card-hd">
              <div className="card-title">Buscar usuario</div>
            </div>

            {/* Formulario de búsqueda: onSubmit en lugar de onClick para que funcione con Enter */}
            <form onSubmit={handleSearch}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <input
                  className="form-input"
                  placeholder="Nombre o @username"
                  value={searchQuery}
                  // Al escribir: actualizar el texto y limpiar errores y confirmaciones anteriores
                  onChange={e => { setSearchQuery(e.target.value); setSearchError(''); setReqSent(false) }}
                />
              </div>
              {/* Botón deshabilitado mientras busca O si el campo está vacío */}
              <button type="submit" className="btn btn-outline btn-full btn-sm" disabled={searching || !searchQuery}>
                {/* Texto cambia durante la búsqueda para dar feedback de estado */}
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {/* Error de búsqueda: se muestra si no se encontró ningún usuario */}
            {searchError && (
              <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '10px' }}>{searchError}</div>
            )}
            {/* Confirmación de envío exitoso: se muestra tras enviar la solicitud */}
            {reqSent && (
              <div style={{ color: 'var(--grn)', fontSize: '12px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>¡Solicitud enviada! <Check size={12} /></div>
            )}

            {/* Previsualización del usuario encontrado: aparece entre la búsqueda y el botón de añadir */}
            {/* Solo se renderiza si searchResult no es null (usuario encontrado con éxito) */}
            {searchResult && (
              <div style={{
                marginTop: '14px', padding: '14px', background: 'var(--s2)',
                border: '0.5px solid var(--bdr2)', // Borde dorado más visible para destacar el resultado
              }}>
                {/* Cabecera de la previsualización: avatar + nombre + nivel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  {/* Avatar del usuario encontrado — misma lógica que en la lista de amigos */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(searchResult.full_name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', color: 'var(--gold-l)',
                  }}>{initials(searchResult.full_name)}</div>

                  {/* Nombre y nivel del usuario encontrado */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{searchResult.full_name}</div>
                    {/* Nivel como dato relevante para identificar si es el usuario correcto */}
                    <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>Nivel {searchResult.level || 1}</div>
                  </div>
                </div>

                {/* Botón de añadir amigo: span requerido por .btn-gold para el efecto de brillo */}
                {/* btn-full ocupa el ancho completo del contenedor */}
                <button className="btn btn-gold btn-full btn-sm" onClick={sendFriendRequest} disabled={sendingReq}>
                  <span>{sendingReq ? 'Enviando...' : '+ Añadir amigo'}</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Card: leaderboard de racha entre amigos ── */}
          <div className="card" style={{ marginTop: '12px' }}>
            <div className="card-hd">
              <div className="card-title">Clasificación racha</div>
            </div>

            {/* Ordenar copia de amigos por racha descendente y tomar top 5 */}
            {/* [...friends] evita mutar el array original con .sort() */}
            {[...friends].sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0)).slice(0, 5).map((f, i) => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 0',
                borderBottom: '0.5px solid var(--bdr)', // Separador visual entre posiciones
              }}>
                {/* Número de posición con colores de podio estándar */}
                {/* #FFD700 = oro, #C0C0C0 = plata, #CD7F32 = bronce, var(--txt3) = resto de posiciones */}
                <div style={{
                  fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px', minWidth: '20px',
                  color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--txt3)',
                }}>{i + 1}</div>

                {/* Avatar mini (24px) del amigo en la clasificación */}
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  background: avatarColor(f.full_name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: 'var(--gold-l)',
                }}>{initials(f.full_name)}</div>

                {/* Nombre del amigo: overflow hidden + ellipsis para nombres largos en el panel estrecho */}
                <div style={{ flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.full_name}
                </div>

                {/* Valor de racha con sufijo 'd' (días) en fuente display dorada */}
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '16px', color: 'var(--gold)' }}>
                  {f.current_streak || 0}d
                </div>
              </div>
            ))}

            {/* Estado vacío del leaderboard: se muestra cuando no hay amigos todavía */}
            {friends.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>Añade amigos para ver la clasificación.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
