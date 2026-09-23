/**
 * page.tsx — Página de sesión activa de entrenamiento.
 *
 * ARQUITECTURA:
 *   - El estado de la sesión vive en useSessionStore (módulo singleton pub/sub).
 *   - useSyncExternalStore sincroniza el snapshot del store con el ciclo de vida de React.
 *   - El timer principal vive en el store para sobrevivir a la navegación entre páginas;
 *     también se refleja en la Topbar mientras el usuario está en otras secciones.
 *
 * BÚSQUEDA DE EJERCICIOS:
 *   - Input de texto + chips de grupo muscular (Todos / Pecho / Espalda / …)
 *   - Panel scrollable que se abre cuando hay texto o filtro activo
 *   - Sin límite de resultados (muestra todos los ejercicios que coincidan)
 *
 * INPUTS DE SERIE:
 *   - Ejercicios de fuerza: kg (peso) + reps (repeticiones)
 *   - Ejercicios cardio (muscle_group = 'cardio'): km (distancia) + min (tiempo)
 *   - Los inputs son no controlados (defaultValue + onBlur) para evitar re-renders
 *     en cada pulsación de tecla — updateSet no llama a notify()
 *
 * TIMERS:
 *   - Timer principal: gestionado por el store (elapsed_seconds / timer_running)
 *   - Timer de descanso: estado local de este componente, se inicia al completar serie
 *
 * TOAST: notificaciones temporales (3 s) para feedback de acciones.
 */
'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Play, Pause, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getSession, subscribeSession, startSession, addExerciseToSession,
  addSetToExercise, updateSet, completeSet, finishSession, removeExercise,
  pauseTimer, resumeTimer,
  type SessionExercise,
} from '@/hooks/useSessionStore'
import type { Exercise } from '@/lib/supabase/types'

/** Formatea un número a 2 dígitos con padding de cero (ej: 5 → "05") */
function pad2(n: number) { return String(n).padStart(2, '0') }

/**
 * Convierte segundos totales a formato HH:MM:SS.
 * Usado para el timer principal de la sesión.
 */
function fmtSeconds(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
}

// ╔═ PO-012 ═╗ etiquetas de grupo muscular en español para los chips de búsqueda
// ╚═ linked → PO-009 (búsqueda de ejercicios) · GE-012 app/(app)/graficas/GraficasClient.tsx
/**
 * Mapa de muscle_group (valor de BD) → etiqueta en español.
 * Se usa tanto en los chips de búsqueda como en los badges de los bloques de ejercicio.
 */
const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pecho', back: 'Espalda', legs: 'Piernas',
  shoulders: 'Hombros', arms: 'Brazos', core: 'Core',
  cardio: 'Cardio', full_body: 'Cuerpo Completo',
}
const MUSCLE_KEYS = Object.keys(MUSCLE_LABELS)

export default function SesionPage() {
  // Suscripción al snapshot del store — re-renderiza cuando el store llama a notify()
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)

  const [userId, setUserId]             = useState<string | null>(null)
  const [exercises, setExercises]       = useState<Exercise[]>([])      // Catálogo completo cargado al montar
  const [query, setQuery]               = useState('')                  // Texto del buscador
  const [muscleFilter, setMuscleFilter] = useState('')                  // Chip de grupo muscular activo
  const [restSecs, setRestSecs]         = useState(90)                  // Duración configurada del descanso
  const [restRemain, setRestRemain]     = useState(90)                  // Segundos restantes de descanso
  const [restRunning, setRestRunning]   = useState(false)               // Estado del timer de descanso
  const [toast, setToast]               = useState<{ msg: string; type?: string } | null>(null)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)   // Ref del intervalo de descanso

  /** Muestra un toast durante 3 segundos y luego lo oculta */
  function showToast(msg: string, type = '') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ╔═ GE-008 ═╗ carga el usuario autenticado y el catálogo de ejercicios al montar
  // ╚═ linked → none
  // ── Carga inicial: usuario autenticado + catálogo de ejercicios ──
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    supabase.from('exercises').select('*').order('name').then(({ data }) => {
      if (data) setExercises(data)
    })
  }, [])

  // ── Timer de descanso: cuenta regresiva local que se detiene al llegar a 0 ──
  useEffect(() => {
    if (restRunning) {
      restRef.current = setInterval(() => {
        setRestRemain(r => {
          if (r <= 1) {
            clearInterval(restRef.current!)
            setRestRunning(false)
            showToast('¡Descanso terminado!')
            return 0
          }
          return r - 1
        })
      }, 1000)
    } else {
      if (restRef.current) clearInterval(restRef.current)
    }
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [restRunning])

  // ╔═ PO-009 ═╗ panel de búsqueda de ejercicios con filtro por grupo muscular
  // ╚═ linked → PO-002 hooks/useSessionStore.ts
  /**
   * El panel se muestra cuando hay texto en el input O hay un chip activo (distinto de "Todos").
   * Filtra el catálogo completo en cliente — no hace queries adicionales.
   */
  const showPanel = query.length > 0 || muscleFilter !== ''

  const filteredExercises = exercises.filter(e => {
    const matchesMuscle = !muscleFilter || e.muscle_group === muscleFilter
    const matchesQuery  = !query || e.name.toLowerCase().includes(query.toLowerCase())
    return matchesMuscle && matchesQuery
  })

  // ╔═ PO-008 ═╗ inicia una nueva sesión de entrenamiento en Supabase y arranca el timer del store
  // ╚═ linked → PO-001 hooks/useSessionStore.ts
  /** Inicia una nueva sesión en Supabase, arranca el timer del store y muestra confirmación */
  async function handleStart() {
    if (!userId) return
    await startSession(userId, 'Nuevo Entreno')
    showToast('¡Sesión iniciada!', 'success')
  }

  // ╔═ PO-009 ═╗ añade el ejercicio seleccionado a la sesión y cierra el panel de búsqueda
  // ╚═ linked → PO-002 hooks/useSessionStore.ts
  /** Añade el ejercicio a la sesión, limpia el buscador y cierra el panel */
  async function handleAddExercise(ex: Exercise) {
    await addExerciseToSession(ex.id, ex.name, ex.muscle_group)
    setQuery('')
    setMuscleFilter('')
  }

  // ╔═ PO-010 ═╗ completa o desmarca una serie y activa el temporizador de descanso
  // ╚═ linked → PO-004 hooks/useSessionStore.ts
  /**
   * Completa/desmarca una serie y, si pasa a completada,
   * inicia automáticamente el temporizador de descanso local.
   */
  async function handleCompleteSet(local_id: string, idx: number) {
    const set = await completeSet(local_id, idx)
    if (set?.is_completed) {
      setRestRemain(restSecs)
      setRestRunning(true)
    }
  }

  // ╔═ PA-005 ═╗ finaliza la sesión activa y muestra confirmación
  // ╚═ linked → PA-001 hooks/useSessionStore.ts
  /** Finaliza la sesión en Supabase (detiene timer, calcula métricas) y muestra toast */
  async function handleFinish() {
    const result = await finishSession()
    if (result) showToast('Sesión completada', 'success')
  }

  // Volumen total acumulado: solo ejercicios de fuerza (peso × reps).
  // Los ejercicios cardio se excluyen porque sus campos son km y minutos,
  // no kg y repeticiones, por lo que incluirlos distorsionaría el total.
  const totalVol = session?.exercises.reduce((t, ex) => {
    if (ex.muscle === 'cardio') return t
    return t + ex.sets.reduce((s, set) =>
      s + (set.is_completed && set.weight && set.reps
        ? Number(set.weight) * Number(set.reps) : 0), 0)
  }, 0) || 0

  // Porcentaje restante de descanso para la barra de progreso
  const restPct = (restRemain / restSecs) * 100

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Área principal: estado inicial o sesión activa ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>

        {/* Estado sin sesión: pantalla de inicio */}
        {!session && (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '48px', letterSpacing: '4px', color: 'var(--gold)', marginBottom: '12px' }}>
              ¿LISTO?
            </div>
            <div style={{ color: 'var(--txt2)', fontSize: '14px', marginBottom: '32px' }}>
              Empieza una nueva sesión de entrenamiento
            </div>
            <button className="btn btn-gold" onClick={handleStart} style={{ fontSize: '12px', padding: '14px 40px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Play size={14} /> Iniciar sesión
            </button>
          </div>
        )}

        {/* Estado con sesión activa */}
        {session && (
          <>
            {/* Cabecera: nombre de sesión + controles de pausa/finalizar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '24px', letterSpacing: '2px' }}>
                  {session.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>
                  {session.started_at.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Pausa/reanuda el timer del store — no afecta a la sesión en BD */}
                <button className="btn btn-outline" onClick={() => session.timer_running ? pauseTimer() : resumeTimer()}>
                  {session.timer_running
                    ? <><Pause size={14} style={{ marginRight: 6 }} />Pausar</>
                    : <><Play  size={14} style={{ marginRight: 6 }} />Reanudar</>}
                </button>
                <button className="btn btn-gold" onClick={handleFinish} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Terminar
                </button>
              </div>
            </div>

            {/* ── Buscador + filtros de grupo muscular ── */}
            <div style={{ marginBottom: '20px' }}>
              <input
                className="form-input"
                placeholder="Buscar ejercicio..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ marginBottom: '10px' }}
              />

              {/* Chips de grupo muscular — "Todos" desactiva el filtro */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['', ...MUSCLE_KEYS].map(key => (
                  <button
                    key={key || 'all'}
                    onClick={() => setMuscleFilter(muscleFilter === key ? '' : key)}
                    style={{
                      background: muscleFilter === key ? 'rgba(201,168,76,0.1)' : 'none',
                      border: `0.5px solid ${muscleFilter === key ? 'var(--gold)' : 'var(--bdr2)'}`,
                      color: muscleFilter === key ? 'var(--gold)' : 'var(--txt3)',
                      padding: '4px 12px', fontSize: '10px', letterSpacing: '1px',
                      textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {key === '' ? 'Todos' : MUSCLE_LABELS[key]}
                  </button>
                ))}
              </div>

              {/* Panel de resultados: scrollable, se cierra al añadir un ejercicio */}
              {showPanel && (
                <div style={{
                  marginTop: '10px', maxHeight: '280px', overflowY: 'auto',
                  border: '0.5px solid var(--bdr2)', background: 'var(--s2)',
                }}>
                  {filteredExercises.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '13px', color: 'var(--txt3)', textAlign: 'center' }}>
                      Sin resultados
                    </div>
                  ) : filteredExercises.map(ex => (
                    // onMouseDown en lugar de onClick para que se dispare antes del onBlur del input
                    <div
                      key={ex.id}
                      onMouseDown={() => handleAddExercise(ex)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px', cursor: 'pointer',
                        borderBottom: '0.5px solid var(--bdr)', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: '13px' }}>{ex.name}</span>
                      <span style={{
                        fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
                        color: 'var(--gold)', background: 'rgba(201,168,76,0.08)',
                        padding: '2px 8px', flexShrink: 0,
                      }}>
                        {MUSCLE_LABELS[ex.muscle_group] ?? ex.muscle_group}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estado vacío: instrucción para añadir el primer ejercicio */}
            {session.exercises.length === 0 && !showPanel && (
              <div style={{ color: 'var(--txt2)', fontSize: '13px', padding: '20px 0' }}>
                Selecciona un grupo muscular o busca un ejercicio para empezar ↑
              </div>
            )}

            {/* Lista de bloques de ejercicio */}
            {session.exercises.map(ex => (
              <ExerciseBlock
                key={ex.local_id} ex={ex}
                onAddSet={() => addSetToExercise(ex.local_id)}
                onUpdateSet={(idx, field, val) => updateSet(ex.local_id, idx, field, val)}
                onCompleteSet={idx => handleCompleteSet(ex.local_id, idx)}
                onRemove={() => removeExercise(ex.local_id)}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Panel lateral derecho: herramientas de sesión ── */}
      {session && (
        <div style={{
          width: '220px', flexShrink: 0, borderLeft: '0.5px solid var(--bdr)',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px',
          overflowY: 'auto',
        }}>
          {/* Timer principal: lee elapsed_seconds del store (también visible en Topbar) */}
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tiempo</div>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '32px', letterSpacing: '2px',
              color: session.timer_running ? 'var(--gold)' : 'var(--txt2)',
            }}>
              {fmtSeconds(session.elapsed_seconds)}
            </div>
          </div>

          {/* Timer de descanso con barra de progreso y presets */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Descanso</div>
            {/* Color rojo cuando quedan menos de 10 segundos — alerta visual */}
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '28px', textAlign: 'center', letterSpacing: '2px',
              color: restRemain <= 10 ? 'var(--red)' : 'var(--gold)',
            }}>
              {Math.floor(restRemain / 60)}:{pad2(restRemain % 60)}
            </div>
            {/* Barra de progreso: roja en los últimos 20% */}
            <div style={{ height: '4px', background: 'var(--s3)', marginTop: '10px', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${restPct}%`, transition: 'width 1s linear',
                background: restPct < 20 ? 'var(--red)' : 'var(--gold)',
              }} />
            </div>
            {/* Presets de tiempo — seleccionar resetea el timer al valor elegido */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[60, 90, 120, 180].map(s => (
                <button key={s} className="btn btn-outline btn-sm"
                  style={{ flex: 1, borderColor: restSecs === s ? 'var(--gold)' : undefined, color: restSecs === s ? 'var(--gold)' : undefined }}
                  onClick={() => { setRestSecs(s); setRestRemain(s); setRestRunning(false) }}>
                  {s}s
                </button>
              ))}
            </div>
            <button className="btn btn-gold btn-full" style={{ marginTop: '8px' }}
              onClick={() => { setRestRemain(restSecs); setRestRunning(true) }}>
              <span>Iniciar descanso</span>
            </button>
          </div>

          {/* Volumen total acumulado en la sesión */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-title" style={{ marginBottom: '8px' }}>Volumen total</div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '26px', color: 'var(--gold)' }}>
              {Math.round(totalVol).toLocaleString()} kg
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificación — esquina inferior derecha */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '22px', right: '22px', zIndex: 9999,
          background: 'var(--s2)', border: '0.5px solid var(--bdr2)',
          padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block',
            background: toast.type === 'success' ? 'var(--grn)' : 'var(--gold)',
          }} />
          <span style={{ fontSize: '12px' }}>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

// ── Componente de bloque de ejercicio ─────────────────────────────────────────

/**
 * ExerciseBlock — Tarjeta de un ejercicio dentro de la sesión activa.
 *
 * INPUTS NO CONTROLADOS: los campos de peso/reps usan defaultValue + onBlur
 * en lugar de value + onChange. Esto evita que cada pulsación de tecla llame
 * a updateSet → notify() → re-render completo de la página. El store se
 * actualiza silenciosamente en onBlur, justo antes de que completeSet lo lea.
 *
 * CARDIO: cuando ex.muscle === 'cardio' los inputs cambian a km / min y el
 * encabezado de la tabla refleja las unidades correspondientes.
 *
 * @param ex            — Datos del ejercicio (nombre, músculo, series)
 * @param onAddSet      — Callback para añadir una nueva serie vacía
 * @param onUpdateSet   — Callback para actualizar un campo de una serie (llamado en onBlur)
 * @param onCompleteSet — Callback para marcar/desmarcar una serie como completada
 * @param onRemove      — Callback para eliminar el ejercicio de la sesión
 */
function ExerciseBlock({ ex, onAddSet, onUpdateSet, onCompleteSet, onRemove }: {
  ex: SessionExercise
  onAddSet: () => void
  onUpdateSet: (idx: number, field: string, val: string | boolean) => void
  onCompleteSet: (idx: number) => void
  onRemove: () => void
}) {
  // ╔═ PO-012 ═╗ modo cardio — cambia unidades de los inputs (kg→km, reps→min)
  // ╚═ linked → PO-002 hooks/useSessionStore.ts
  /** Los ejercicios de cardio muestran km y minutos en lugar de kg y repeticiones */
  const isCardio = ex.muscle === 'cardio'

  return (
    <div style={{ background: 'var(--s1)', border: '0.5px solid var(--bdr)', marginBottom: '12px', overflow: 'hidden' }}>
      {/* Cabecera: nombre del ejercicio, badge de músculo y botón eliminar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '0.5px solid var(--bdr)' }}>
        <span style={{ fontWeight: 500, fontSize: '14px', flex: 1 }}>{ex.name}</span>
        <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--txt2)', background: 'var(--s3)', padding: '3px 8px' }}>
          {MUSCLE_LABELS[ex.muscle] ?? ex.muscle}
        </span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <X size={14} />
        </button>
      </div>

      {/* Cabecera de la tabla — unidades adaptadas según tipo de ejercicio */}
      <div style={{
        display: 'grid', gridTemplateColumns: '30px 1fr 1fr 60px 36px',
        gap: '6px', padding: '8px 16px',
        fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--txt3)',
      }}>
        <div>N</div>
        <div>{isCardio ? 'km' : 'kg'}</div>
        <div>{isCardio ? 'Tiempo' : 'Reps'}</div>
        <div>{isCardio ? 'Dist.' : 'Vol.'}</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Check size={11} /></div>
      </div>

      {/* Filas de series */}
      {ex.sets.map((set, idx) => {
        // Columna de resultado:
        //   Cardio  → ritmo (min/km) = minutos / km. Ej: 25 min / 5 km = 5.0 min/km
        //   Fuerza  → volumen (kg × reps). Ej: 80 kg × 10 reps = 800
        const result = set.weight && set.reps
          ? isCardio
            ? `${(Number(set.reps) / Number(set.weight)).toFixed(1)} min/km`
            : Math.round(Number(set.weight) * Number(set.reps)).toLocaleString()
          : '—'

        return (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '30px 1fr 1fr 60px 36px',
            gap: '6px', padding: '6px 16px', alignItems: 'center',
            // Fondo verde muy suave cuando la serie está completada
            background: set.is_completed ? 'rgba(59,158,117,0.06)' : 'transparent',
            borderTop: '0.5px solid var(--bdr)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>{idx + 1}</div>

            {/* Input no controlado: defaultValue solo se aplica al montar, onBlur sincroniza al store */}
            <input
              type="number"
              placeholder={isCardio ? 'km' : 'kg'}
              defaultValue={set.weight}
              onBlur={e => onUpdateSet(idx, 'weight', e.target.value)}
              style={{ background: 'var(--s2)', border: '0.5px solid var(--bdr2)', color: 'var(--txt)', padding: '5px 8px', fontSize: '12px', width: '100%', outline: 'none' }}
            />
            <input
              type="number"
              placeholder={isCardio ? 'min' : 'reps'}
              defaultValue={set.reps}
              onBlur={e => onUpdateSet(idx, 'reps', e.target.value)}
              style={{ background: 'var(--s2)', border: '0.5px solid var(--bdr2)', color: 'var(--txt)', padding: '5px 8px', fontSize: '12px', width: '100%', outline: 'none' }}
            />

            {/* Resultado calculado: distancia (cardio) o volumen (fuerza) */}
            <div style={{ fontSize: '11px', color: 'var(--txt2)', textAlign: 'center' }}>
              {result}
            </div>

            {/* Botón de completar serie: verde cuando está marcada */}
            <button onClick={() => onCompleteSet(idx)} style={{
              width: '30px', height: '30px', border: '0.5px solid var(--bdr2)',
              background: set.is_completed ? 'var(--grn)' : 'none',
              color: set.is_completed ? '#fff' : 'var(--txt3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {set.is_completed ? <Check size={14} /> : null}
            </button>
          </div>
        )
      })}

      {/* Acción para añadir una nueva serie */}
      <div style={{ padding: '10px 16px' }}>
        <button onClick={onAddSet} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>
          + Serie
        </button>
      </div>
    </div>
  )
}
