/**
 * PerfilClient.tsx — Vista editable del perfil de usuario.
 *
 * Gestiona dos pestañas:
 *   - 'info': formulario de edición de datos personales (nombre, bio, objetivo, medidas)
 *   - 'logros': cuadrícula de logros desbloqueados con rareza y descripción
 *
 * El estado del formulario se inicializa con el perfil cargado en el servidor
 * y se actualiza localmente en cada cambio. El guardado escribe solo los campos
 * editables (excluye xp, level, total_workouts, etc. que son calculados por BD).
 *
 * El feedback de guardado se muestra durante 2 segundos y luego desaparece.
 */
'use client'
import { useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

// Etiquetas legibles para los valores de enumeración de objetivo almacenados en BD
const GOAL_LABELS: Record<string, string> = {
  strength: 'Fuerza', muscle: 'Masa muscular', fat_loss: 'Definición', endurance: 'Resistencia',
}

// Etiquetas legibles para los niveles de experiencia del usuario
const EXP_LABELS: Record<string, string> = {
  beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado',
}

// Tipo del join user_achievements → achievements; el campo achievements puede ser null si el logro fue eliminado
interface AchievementRow {
  id: string
  unlocked_at: string | null
  achievements: {
    name: string; description: string; tier: string; icon: string | null
  } | null
}

// Colores por rareza de logro, siguiendo convención de juegos: bronce, plata, oro, legendario
const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', legendary: '#C9A84C',
}

export default function PerfilClient({
  profile: initial, achievements, userId,
}: {
  profile: Profile | null      // Perfil leído en el servidor; puede ser null si aún no existe
  achievements: AchievementRow[] // Logros desbloqueados con datos del catálogo de logros
  userId: string               // ID del usuario autenticado para identificar qué fila actualizar
}) {
  // Estado local del perfil: permite edición sin re-fetch al servidor en cada tecla
  const [profile, setProfile] = useState(initial)
  // true mientras la petición de guardado está en curso — desactiva el botón para evitar doble envío
  const [saving, setSaving] = useState(false)
  // true durante 2 segundos tras guardar con éxito — muestra confirmación visual al usuario
  const [saved, setSaved] = useState(false)
  // Pestaña activa: 'info' muestra el formulario, 'logros' muestra la cuadrícula de logros
  const [tab, setTab] = useState<'info' | 'logros'>('info')

  // Cliente de Supabase para el navegador — usado solo al guardar cambios
  const supabase = createClient()

  // ╔═ PA-004 ═╗ guarda los campos editables del perfil del usuario en Supabase
  // ╚═ linked → GE-005 app/(app)/perfil/page.tsx
  /**
   * Guarda los campos editables del perfil en Supabase.
   * Solo actualiza los campos que el usuario puede modificar.
   * Los campos calculados (xp, level, streaks, total_workouts) son gestionados
   * exclusivamente por triggers de base de datos y no se envían aquí.
   */
  async function handleSave() {
    // Protección: no hacer nada si el estado del perfil es null (caso improbable)
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name:  profile.full_name,
      bio:        profile.bio,
      goal:       profile.goal,
      experience: profile.experience,
      height_cm:  profile.height_cm,
      weight_kg:  profile.weight_kg,
    }).eq('id', userId)
    setSaving(false)
    setSaved(true)
    // Ocultar el mensaje de confirmación tras 2 segundos para no distraer al usuario
    setTimeout(() => setSaved(false), 2000)
  }

  // Calcular iniciales del avatar: primera letra de cada palabra, máximo 2 caracteres
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    // Animación de entrada de página definida como @keyframes panelIn en globals.css
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>
      {/* Disposición en dos columnas: información fija a la izquierda, formulario a la derecha */}
      <div style={{ display: 'flex', gap: '20px' }}>

        {/* ── Columna izquierda: avatar + estadísticas de solo lectura ── */}
        {/* Ancho fijo de 220px — el formulario ocupa el espacio restante con flex: 1 */}
        <div style={{ width: '220px', flexShrink: 0 }}>
          <div className="card" style={{ textAlign: 'center', marginBottom: '12px' }}>

            {/* Avatar circular con iniciales como placeholder hasta implementar foto de perfil */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'var(--gold-d)',        // Fondo oscuro dorado para contrastar con las iniciales
              border: '2px solid var(--gold)',     // Borde dorado como marco visual del avatar
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 500, color: 'var(--gold-l)',
              margin: '0 auto 14px',              // Centrado horizontal con margen inferior
            }}>{initials}</div>

            {/* Nombre completo del usuario en tipografía display */}
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', letterSpacing: '1px', marginBottom: '4px' }}>
              {profile?.full_name || 'Atleta'}
            </div>

            {/* Nivel y XP actuales — calculados en BD, no editables aquí */}
            <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
              Nivel {profile?.level || 1} · {profile?.xp || 0} XP
            </div>

            {/* Mini-grid 2×2 con estadísticas desnormalizadas del perfil */}
            {/* Se usan valores desnormalizados del perfil (no queries adicionales) para rendimiento */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { l: 'Entrenos',     v: profile?.total_workouts || 0 },
                { l: 'Racha',        v: `${profile?.current_streak || 0}d` },
                { l: 'Mejor racha',  v: `${profile?.best_streak || 0}d` },
                // GOAL_LABELS convierte el valor de BD a texto legible; '—' si no hay objetivo definido
                { l: 'Objetivo',     v: GOAL_LABELS[profile?.goal || ''] || '—' },
              ].map(s => (
                <div key={s.l} style={{
                  padding: '10px 8px', background: 'var(--s2)', border: '0.5px solid var(--bdr)',
                  textAlign: 'center',
                }}>
                  {/* Valor principal en fuente display */}
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', color: 'var(--gold)' }}>{s.v}</div>
                  {/* Etiqueta de la métrica en letra pequeña */}
                  <div style={{ fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--txt2)', marginTop: '2px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Columna derecha: formulario editable + cuadrícula de logros ── */}
        <div style={{ flex: 1 }}>

          {/* Selector de pestaña: Información / Logros con el conteo total */}
          <div className="tabs">
            {(['info', 'logros'] as const).map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'info' ? 'Información' : `Logros (${achievements.length})`}
              </button>
            ))}
          </div>

          {/* ── Pestaña: formulario de edición de datos personales ── */}
          {/* Solo se renderiza si la pestaña 'info' está activa Y el perfil existe */}
          {tab === 'info' && profile && (
            <div className="card">

              {/* Fila 1: nombre y username en dos columnas */}
              <div className="g2">
                {/* Campo: nombre completo — actualiza el estado local con spread para no perder otros campos */}
                <div className="form-group">
                  <label className="form-label">Nombre completo</label>
                  <input
                    className="form-input"
                    value={profile.full_name || ''}
                    // Patrón spread: { ...profile, campo: nuevo_valor } preserva todos los demás campos
                    onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  />
                </div>

                {/* Campo: username público (@handle) — visible a otros usuarios en búsquedas */}
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    value={profile.username || ''}
                    onChange={e => setProfile({ ...profile, username: e.target.value })}
                    placeholder="@tuusuario"
                  />
                </div>
              </div>

              {/* Campo: bio en textarea — resize:vertical permite al usuario ajustar la altura manualmente */}
              <div className="form-group">
                <label className="form-label">Biografía</label>
                <textarea
                  className="form-input"
                  value={profile.bio || ''}
                  onChange={e => setProfile({ ...profile, bio: e.target.value })}
                  rows={3}
                  placeholder="Cuéntanos algo sobre ti..."
                  style={{ resize: 'vertical' }}  // Solo redimensionable en vertical para no romper el layout
                />
              </div>

              {/* Fila 2: objetivo, experiencia, altura y peso en grid de 2 columnas */}
              <div className="g2">

                {/* Campo: objetivo de entrenamiento — mapeado desde clave BD a texto legible */}
                <div className="form-group">
                  <label className="form-label">Objetivo</label>
                  <select
                    className="form-input"
                    value={profile.goal || ''}
                    // Cast explícito necesario porque TypeScript no infiere el tipo unión de la BD
                    onChange={e => setProfile({ ...profile, goal: e.target.value as Profile['goal'] })}
                  >
                    <option value="">Sin definir</option>
                    {/* Renderizar opciones dinámicamente desde el mapa de etiquetas */}
                    {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Campo: nivel de experiencia — determina las sugerencias de carga en futuros módulos */}
                <div className="form-group">
                  <label className="form-label">Nivel de experiencia</label>
                  <select
                    className="form-input"
                    value={profile.experience || ''}
                    onChange={e => setProfile({ ...profile, experience: e.target.value as Profile['experience'] })}
                  >
                    <option value="">Sin definir</option>
                    {Object.entries(EXP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Campo: altura en centímetros — se convierte a null si el input queda vacío */}
                <div className="form-group">
                  <label className="form-label">Altura (cm)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={profile.height_cm || ''}
                    // String vacío → null en BD; string con valor → Number para la BD
                    onChange={e => { const n = Number(e.target.value); setProfile({ ...profile, height_cm: e.target.value && !isNaN(n) ? n : null }) }}
                    placeholder="175"
                  />
                </div>

                {/* Campo: peso en kilogramos — step="0.5" permite medias unidades (ej: 79.5 kg) */}
                <div className="form-group">
                  <label className="form-label">Peso (kg)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"  // Incrementos de 0.5 kg para mayor precisión
                    value={profile.weight_kg || ''}
                    onChange={e => { const n = Number(e.target.value); setProfile({ ...profile, weight_kg: e.target.value && !isNaN(n) ? n : null }) }}
                    placeholder="80"
                  />
                </div>
              </div>

              {/* Botón de guardar: el texto cambia progresivamente según el estado de la operación */}
              {/* Deshabilitado mientras guarda para evitar múltiples envíos simultáneos */}
              <button className="btn btn-gold" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {saving ? 'Guardando...' : saved ? <><Check size={14} /> Guardado</> : 'Guardar cambios'}
              </button>
            </div>
          )}

          {/* ── Pestaña: cuadrícula de logros desbloqueados ── */}
          {tab === 'logros' && (
            // Grid responsive: mínimo 200px por tarjeta, se ajusta al espacio disponible
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>

              {/* Estado vacío: se muestra cuando el usuario no tiene ningún logro todavía */}
              {achievements.length === 0 ? (
                // gridColumn: '1/-1' hace que el mensaje ocupe todas las columnas del grid
                <div style={{ color: 'var(--txt2)', fontSize: '13px', padding: '20px 0', gridColumn: '1/-1' }}>
                  Aún no has desbloqueado ningún logro. ¡A entrenar!
                </div>
              ) : achievements.map(a => (
                // El color del borde es el color del tier con opacidad del 25% (sufijo '40' en hexadecimal)
                <div key={a.id} style={{
                  background: 'var(--s1)',
                  border: `0.5px solid ${TIER_COLORS[a.achievements?.tier || 'bronze']}40`,
                  padding: '16px',
                }}>
                  {/* Icono del logro — emoji o símbolo definido en el catálogo de achievements */}
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                    {a.achievements?.icon ?? <Trophy size={24} />}
                  </div>

                  {/* Nivel de rareza del logro en color codificado por tier */}
                  <div style={{
                    fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
                    color: TIER_COLORS[a.achievements?.tier || 'bronze'], marginBottom: '4px',
                  }}>{a.achievements?.tier}</div>

                  {/* Nombre del logro */}
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{a.achievements?.name}</div>

                  {/* Descripción del logro: explica qué acción lo desbloquea */}
                  <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>{a.achievements?.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
