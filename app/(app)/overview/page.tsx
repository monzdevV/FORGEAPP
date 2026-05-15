/**
 * page.tsx — Dashboard principal (Vista General).
 *
 * Server Component que carga en paralelo:
 *   - Perfil del usuario (nivel, racha, XP)
 *   - Últimos 5 entrenamientos completados
 *   - Últimos 3 récords personales
 *
 * Los datos se pasan directamente al JSX sin necesidad de Client Component,
 * ya que no hay interactividad en esta vista (solo lectura).
 */
import { createClient } from '@/lib/supabase/server'

/**
 * Formatea la fecha actual en español con formato largo.
 * Se convierte a mayúsculas para mantener la estética del design system.
 * Ejemplo de salida: "MARTES, 29 DE ABRIL DE 2026"
 */
function formatDate() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase()
}

// ╔═ GE-004 ═╗ carga perfil, últimos entrenos y récords personales del usuario
// ╚═ linked → PA-001 hooks/useSessionStore.ts
export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Las tres queries se lanzan en paralelo con Promise.all para minimizar el tiempo total de carga
  const [{ data: profile }, { data: recentWorkouts }, { data: prs }] = await Promise.all([
    // Perfil completo del usuario para mostrar nivel, racha y XP
    supabase.from('profiles').select('*').eq('id', user!.id).single(),

    // Solo entrenamientos con status='completed', del más reciente al más antiguo, máximo 5
    supabase.from('workouts').select('*').eq('user_id', user!.id)
      .eq('status', 'completed').order('finished_at', { ascending: false }).limit(5),

    // PRs con nombre del ejercicio via join (exercises.name), del más reciente al más antiguo
    supabase.from('personal_records').select('*, exercises(name)').eq('user_id', user!.id)
      .order('achieved_at', { ascending: false }).limit(3),
  ])

  // Extraer el primer nombre en mayúsculas para el saludo personalizado del hero
  const firstName = profile?.full_name?.split(' ')[0]?.toUpperCase() || 'ATLETA'

  // Volumen acumulado de los últimos 5 entrenos (no es el total histórico del perfil)
  // Se usa aquí solo para disponibilidad; actualmente no se muestra en el hero pero está preparado
  const totalVol = recentWorkouts?.reduce((s, w) => s + (Number(w.total_volume) || 0), 0) || 0

  return (
    // Animación de entrada de página definida como @keyframes panelIn en globals.css
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>

      {/* ── Hero: saludo personalizado con tres stats rápidos ── */}
      {/* position:relative + overflow:hidden son necesarios para el acento de línea absoluta superior */}
      <div style={{
        background: 'var(--s1)', border: '0.5px solid var(--bdr)',
        padding: '26px', marginBottom: '14px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Línea dorada en la parte superior del hero como acento decorativo */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--gold)' }} />

        {/* Fila: saludo a la izquierda, stats compactos a la derecha */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>

          {/* Bloque izquierdo: saludo + fecha */}
          <div>
            {/* Título de saludo en fuente display, tamaño fluido con clamp para adaptarse a la pantalla */}
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(26px,3vw,42px)', // Mínimo 26px, ideal 3vw, máximo 42px
              letterSpacing: '1px',
              lineHeight: 1,
            }}>
              BUENOS DÍAS,<br />
              {/* Nombre del usuario resaltado en dorado */}
              <span style={{ color: 'var(--gold)' }}>{firstName}</span>
            </div>
            {/* Fecha actual como contexto temporal */}
            <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--txt2)', marginTop: '4px', letterSpacing: '0.5px' }}>
              {formatDate()}
            </div>
          </div>

          {/* Bloque derecho: tres stats de un solo vistazo (racha, entrenos y nivel) */}
          <div style={{ display: 'flex', gap: '28px' }}>

            {/* Stat: racha actual de días consecutivos de entrenamiento */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '30px', color: 'var(--gold)', lineHeight: 1 }}>
                {profile?.current_streak || 0}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--txt2)', marginTop: '3px' }}>
                Días racha
              </div>
            </div>

            {/* Stat: total de entrenamientos completados históricamente */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '30px', color: 'var(--gold)', lineHeight: 1 }}>
                {profile?.total_workouts || 0}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--txt2)', marginTop: '3px' }}>
                Entrenos
              </div>
            </div>

            {/* Stat: nivel actual del usuario, calculado automáticamente por la BD según XP */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '30px', color: 'var(--gold)', lineHeight: 1 }}>
                {profile?.level || 1}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--txt2)', marginTop: '3px' }}>
                Nivel
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs: cuatro métricas detalladas en grid de cuatro columnas ── */}
      {/* La clase .g4 está definida en globals.css como grid de 4 columnas iguales */}
      <div className="g4" style={{ marginBottom: '14px' }}>

        {/* KPI: racha actual — igual que en el hero, pero con más contexto en kpi-sub */}
        <div className="kpi">
          <div className="kpi-lbl">Racha actual</div>
          <div className="kpi-val c-gold">{profile?.current_streak || 0}</div>
          <div className="kpi-sub c-muted">días consecutivos</div>
        </div>

        {/* KPI: mejor racha histórica — permite comparar la racha actual con el máximo conseguido */}
        <div className="kpi">
          <div className="kpi-lbl">Mejor racha</div>
          <div className="kpi-val">{profile?.best_streak || 0}</div>
          <div className="kpi-sub c-muted">días</div>
        </div>

        {/* KPI: número total de sesiones completadas */}
        <div className="kpi">
          <div className="kpi-lbl">Total entrenos</div>
          <div className="kpi-val">{profile?.total_workouts || 0}</div>
          <div className="kpi-sub c-muted">sesiones</div>
        </div>

        {/* KPI: puntos de XP acumulados — toLocaleString formatea el número con separadores de miles */}
        <div className="kpi">
          <div className="kpi-lbl">XP total</div>
          <div className="kpi-val c-gold">{(profile?.xp || 0).toLocaleString()}</div>
          <div className="kpi-sub c-muted">puntos</div>
        </div>
      </div>

      {/* ── Tablas de historial: entrenos recientes y récords personales en dos columnas ── */}
      {/* La clase .g2 está definida en globals.css como grid de 2 columnas iguales */}
      <div className="g2">

        {/* ── Tabla: últimos 5 entrenamientos completados ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Últimos entrenos</div>
          </div>

          {/* Estado vacío: primer acceso del usuario sin ningún entreno */}
          {!recentWorkouts?.length ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '12px 0' }}>
              Aún no has hecho ningún entreno. <br/>
              {/* Enlace de llamada a la acción directa a la página de sesión */}
              <a href="/sesion" style={{ color: 'var(--gold)' }}>¡Empieza ahora!</a>
            </div>
          ) : (
            // Lista de filas, una por entrenamiento completado
            recentWorkouts.map(w => (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '0.5px solid var(--bdr)', // Separador visual entre filas
              }}>
                {/* Columna izquierda: nombre del entreno y fecha de finalización */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 400 }}>{w.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>
                    {/* Fallback '—' si finished_at es null (no debería ocurrir en status=completed) */}
                    {w.finished_at ? new Date(w.finished_at).toLocaleDateString('es-ES') : '—'}
                  </div>
                </div>

                {/* Columna derecha: volumen total y número de series — alineados a la derecha */}
                <div style={{ textAlign: 'right' }}>
                  {/* Volumen total de la sesión en dorado como dato principal */}
                  <div style={{ fontSize: '12px', color: 'var(--gold)' }}>
                    {/* toLocaleString añade separadores de miles (ej: 1.250 kg) */}
                    {Number(w.total_volume || 0).toLocaleString()} kg
                  </div>
                  {/* Número de series como dato secundario */}
                  <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>{w.total_sets} series</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Tabla: últimos 3 récords personales ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Récords recientes</div>
          </div>

          {/* Estado vacío: ningún récord personal registrado todavía */}
          {!prs?.length ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '12px 0' }}>
              Aún no tienes récords personales registrados.
            </div>
          ) : (
            // Lista de filas, una por récord personal
            prs.map(pr => (
              <div key={pr.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '0.5px solid var(--bdr)', // Separador visual entre filas
              }}>
                {/* Columna izquierda: nombre del ejercicio y fecha del récord */}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 400 }}>
                    {/*
                      El join de Supabase devuelve exercises como objeto anidado.
                      TypeScript no infiere este tipo automáticamente, por eso se hace cast explícito.
                      Fallback '—' si el ejercicio fue eliminado de la BD.
                    */}
                    {(pr.exercises as { name: string } | null)?.name || '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>
                    {pr.achieved_at ? new Date(pr.achieved_at).toLocaleDateString('es-ES') : '—'}
                  </div>
                </div>

                {/* Columna derecha: valor del récord en fuente display grande */}
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', color: 'var(--gold)' }}>
                  {pr.value} kg
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
