/**
 * page.tsx — Página de sesión activa de entrenamiento.
 *
 * ARQUITECTURA:
 * - El estado de la sesión vive en useSessionStore (módulo singleton pub/sub).
 * - useSyncExternalStore sincroniza el estado del store con el ciclo de vida de React.
 * - El componente lee/escribe el store mediante las funciones exportadas del hook.
 *
 * ESTRUCTURA VISUAL (dos columnas):
 *   Izquierda (flex: 1): buscador de ejercicios + lista de bloques de ejercicio
 *   Derecha (220px fija): timer principal, temporizador de descanso, volumen total
 *
 * TIMERS:
 *   - Timer principal: cuenta segundos desde que empieza la sesión
 *   - Timer de descanso: cuenta regresiva configurable (60/90/120/180s)
 *     Se inicia automáticamente al completar una serie.
 *
 * TOAST: notificaciones temporales (3s) para feedback de acciones importantes.
 */
'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Play, Pause, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getSession, subscribeSession, startSession, addExerciseToSession,
  addSetToExercise, updateSet, completeSet, finishSession, removeExercise,
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

export default function SesionPage() {
  // Suscripción al store de sesión — se re-renderiza automáticamente cuando el store notifica
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)

  const [userId, setUserId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])      // Catálogo completo para búsqueda
  const [query, setQuery] = useState('')                           // Texto del buscador de ejercicios
  const [suggestions, setSuggestions] = useState<Exercise[]>([])  // Resultados del buscador
  const [showSugg, setShowSugg] = useState(false)                 // Visibilidad del dropdown
  const [mainSecs, setMainSecs] = useState(0)                     // Segundos del timer principal
  const [running, setRunning] = useState(false)                   // Estado del timer principal
  const [restSecs, setRestSecs] = useState(90)                    // Duración configurada del descanso
  const [restRemain, setRestRemain] = useState(90)                // Segundos restantes de descanso
  const [restRunning, setRestRunning] = useState(false)           // Estado del timer de descanso
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)  // Ref del intervalo principal
  const restRef  = useRef<ReturnType<typeof setInterval> | null>(null)  // Ref del intervalo de descanso

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
    supabase.from('exercises').select('*').order('name').then(({ data, error }) => {
      if (data) setExercises(data)
      if (error) console.error('Error cargando ejercicios:', error)
    })
  }, [])

  // ── Timer principal: se activa/desactiva con el estado running ──
  // El cleanup del useEffect limpia el intervalo al desmontar o cambiar running
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setMainSecs(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  // ── Timer de descanso: cuenta regresiva que se detiene al llegar a 0 ──
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

  /**
   * Filtra el catálogo de ejercicios por nombre o grupo muscular.
   * Limita a 7 resultados para mantener el dropdown compacto.
   */
  function searchEx(q: string) {
    setQuery(q)
    if (!q) { setSuggestions([]); setShowSugg(false); return }
    const filtered = exercises.filter(e =>
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      e.muscle_group.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 7)
    setSuggestions(filtered)
    setShowSugg(true)
  }

  // ╔═ PO-008 ═╗ inicia una nueva sesión de entrenamiento y arranca el timer
  // ╚═ linked → PO-001 hooks/useSessionStore.ts
  /** Inicia una nueva sesión en Supabase y arranca el timer principal */
  async function handleStart() {
    if (!userId) return
    await startSession(userId, 'Nuevo Entreno')
    setRunning(true)
    showToast('¡Sesión iniciada!', 'success')
  }

  // ╔═ PO-009 ═╗ añade el ejercicio seleccionado a la sesión activa
  // ╚═ linked → PO-002 hooks/useSessionStore.ts
  /** Añade el ejercicio seleccionado a la sesión y limpia el buscador */
  async function handleAddExercise(ex: Exercise) {
    await addExerciseToSession(ex.id, ex.name, ex.muscle_group)
    setQuery('')
    setSuggestions([])
    setShowSugg(false)
  }

  // ╔═ PO-010 ═╗ completa o desmarca una serie y activa el temporizador de descanso
  // ╚═ linked → PO-003 hooks/useSessionStore.ts
  /**
   * Completa/desmarca una serie y, si pasa a completada,
   * inicia automáticamente el temporizador de descanso.
   */
  async function handleCompleteSet(local_id: string, idx: number) {
    const set = await completeSet(local_id, idx)
    if (set?.is_completed) {
      setRestRemain(restSecs)   // Resetear el timer al tiempo configurado
      setRestRunning(true)       // Iniciar cuenta regresiva
    }
  }

  // ╔═ PA-005 ═╗ finaliza la sesión activa, detiene los timers y muestra confirmación
  // ╚═ linked → PA-001 hooks/useSessionStore.ts
  /** Finaliza la sesión, detiene timers y muestra confirmación */
  async function handleFinish() {
    const result = await finishSession()
    setRunning(false)
    setMainSecs(0)
    if (result) showToast('Sesión completada', 'success')
  }

  // Volumen total de la sesión: suma de (peso × reps) de todas las series completadas
  const totalVol = session?.exercises.reduce((t, ex) =>
    t + ex.sets.reduce((s, set) =>
      s + (set.is_completed && set.weight && set.reps
        ? Number(set.weight) * Number(set.reps) : 0), 0), 0) || 0

  // Porcentaje restante de descanso para la barra de progreso visual
  const restPct = (restRemain / restSecs) * 100

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Área principal: estado inicial o sesión activa ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>

        {/* Estado sin sesión: pantalla de inicio */}
        {!session && (
          <div style={{ textAlign: 'center', paddingTop: '80px' }}>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '48px',
              letterSpacing: '4px', color: 'var(--gold)', marginBottom: '12px',
            }}>¿LISTO?</div>
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '20px',
            }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '24px', letterSpacing: '2px' }}>
                  {session.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>
                  {session.started_at.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Toggle pausa/reanudar — solo afecta al timer, no a la sesión en BD */}
                <button
                  className="btn btn-outline"
                  onClick={() => setRunning(r => !r)}
                >
                  {running
                    ? <><Pause size={14} style={{ marginRight: 6 }} />Pausar</>
                    : <><Play  size={14} style={{ marginRight: 6 }} />Reanudar</>}
                </button>
                <button className="btn btn-gold" onClick={handleFinish} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Terminar
                </button>
              </div>
            </div>

            {/* Buscador de ejercicios con dropdown de sugerencias */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                className="form-input"
                placeholder="Buscar ejercicio..."
                value={query}
                onChange={e => searchEx(e.target.value)}
                onFocus={() => query && setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 200)}
              />
              {showSugg && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--s2)', border: '0.5px solid var(--bdr2)',
                }}>
                  {suggestions.map(ex => (
                    // onMouseDown en lugar de onClick para que se dispare antes del onBlur del input
                    <div key={ex.id}
                      onMouseDown={() => handleAddExercise(ex)}
                      style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '10px 16px', cursor: 'pointer', fontSize: '13px',
                        borderBottom: '0.5px solid var(--bdr)',
                      }}
                    >
                      <span>{ex.name}</span>
                      <span style={{ color: 'var(--txt2)', fontSize: '11px' }}>{ex.muscle_group}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estado vacío: instrucción para añadir el primer ejercicio */}
            {session.exercises.length === 0 && (
              <div style={{ color: 'var(--txt2)', fontSize: '13px', padding: '20px 0' }}>
                Busca y añade ejercicios para empezar ↑
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
          {/* Timer principal: color cambia según estado running/pausado */}
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tiempo</div>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '32px',
              color: running ? 'var(--gold)' : 'var(--txt2)', letterSpacing: '2px',
            }}>{fmtSeconds(mainSecs)}</div>
          </div>

          {/* Timer de descanso con barra de progreso y presets de tiempo */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Descanso</div>
            {/* Color rojo cuando quedan menos de 10 segundos — alerta visual */}
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '28px', textAlign: 'center',
              color: restRemain <= 10 ? 'var(--red)' : 'var(--gold)', letterSpacing: '2px',
            }}>
              {Math.floor(restRemain / 60)}:{pad2(restRemain % 60)}
            </div>
            {/* Barra de progreso: vacía cuando acaba el descanso, roja en los últimos 20% */}
            <div style={{
              height: '4px', background: 'var(--s3)', marginTop: '10px', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${restPct}%`, transition: 'width 1s linear',
                background: restPct < 20 ? 'var(--red)' : 'var(--gold)',
              }} />
            </div>
            {/* Presets de tiempo: seleccionar cambia el tiempo configurado y resetea el timer */}
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

          {/* Volumen total acumulado en la sesión actual */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="card-title" style={{ marginBottom: '8px' }}>Volumen total</div>
            <div style={{
              fontFamily: 'Bebas Neue, sans-serif', fontSize: '26px', color: 'var(--gold)',
            }}>{Math.round(totalVol).toLocaleString()} kg</div>
          </div>
        </div>
      )}

      {/* Toast de notificación — aparece en la esquina inferior derecha */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '22px', right: '22px', zIndex: 9999,
          background: 'var(--s2)', border: '0.5px solid var(--bdr2)',
          padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Indicador de tipo: verde para success, dorado para informativo */}
          <span style={{
            width: '7px', height: '7px', borderRadius: '50', display: 'inline-block',
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
 * Muestra la tabla de series con inputs editables para peso, reps y RPE.
 * El volumen por serie (peso × reps) se calcula en tiempo real.
 * Al completar una serie, el fondo cambia a verde suave para indicar éxito.
 *
 * @param ex — Datos del ejercicio (nombre, músculo, series)
 * @param onAddSet — Callback para añadir una nueva serie vacía
 * @param onUpdateSet — Callback para actualizar un campo de una serie
 * @param onCompleteSet — Callback para marcar/desmarcar una serie como completada
 * @param onRemove — Callback para eliminar el ejercicio de la sesión
 */
function ExerciseBlock({ ex, onAddSet, onUpdateSet, onCompleteSet, onRemove }: {
  ex: SessionExercise
  onAddSet: () => void
  onUpdateSet: (idx: number, field: string, val: string | boolean) => void
  onCompleteSet: (idx: number) => void
  onRemove: () => void
}) {
  return (
    <div style={{
      background: 'var(--s1)', border: '0.5px solid var(--bdr)',
      marginBottom: '12px', overflow: 'hidden',
    }}>
      {/* Cabecera del ejercicio: nombre, músculo y botón de eliminar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', borderBottom: '0.5px solid var(--bdr)',
      }}>
        <span style={{ fontWeight: 500, fontSize: '14px', flex: 1 }}>{ex.name}</span>
        <span style={{
          fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
          color: 'var(--txt2)', background: 'var(--s3)', padding: '3px 8px',
        }}>{ex.muscle}</span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', color: 'var(--txt3)', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}><X size={14} /></button>
      </div>

      {/* Cabecera de la tabla de series: N (número), kg, Reps, RPE, Vol (volumen), ✓ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 60px 36px',
        gap: '6px', padding: '8px 16px',
        fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--txt3)',
      }}>
        <div>N</div><div>kg</div><div>Reps</div><div>RPE</div><div>Vol.</div><div style={{ display: 'flex', justifyContent: 'center' }}><Check size={11} /></div>
      </div>

      {/* Filas de series */}
      {ex.sets.map((set, idx) => {
        // Volumen de esta serie: solo se calcula si tiene datos completos
        const vol = set.weight && set.reps ? Math.round(Number(set.weight) * Number(set.reps)) : 0
        return (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '30px 1fr 1fr 1fr 60px 36px',
            gap: '6px', padding: '6px 16px', alignItems: 'center',
            // Fondo verde muy suave cuando la serie está completada
            background: set.is_completed ? 'rgba(59,158,117,0.06)' : 'transparent',
            borderTop: '0.5px solid var(--bdr)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--txt2)' }}>{idx + 1}</div>
            <input
              type="number" placeholder="kg" value={set.weight}
              onChange={e => onUpdateSet(idx, 'weight', e.target.value)}
              style={{
                background: 'var(--s2)', border: '0.5px solid var(--bdr2)', color: 'var(--txt)',
                padding: '5px 8px', fontSize: '12px', width: '100%', outline: 'none',
              }}
            />
            <input
              type="number" placeholder="reps" value={set.reps}
              onChange={e => onUpdateSet(idx, 'reps', e.target.value)}
              style={{
                background: 'var(--s2)', border: '0.5px solid var(--bdr2)', color: 'var(--txt)',
                padding: '5px 8px', fontSize: '12px', width: '100%', outline: 'none',
              }}
            />
            {/* Select de RPE con escala estándar de entrenamiento: 6 (muy fácil) a 10 (máximo esfuerzo) */}
            <select value={set.rpe} onChange={e => onUpdateSet(idx, 'rpe', e.target.value)}
              style={{
                background: 'var(--s2)', border: '0.5px solid var(--bdr2)',
                color: set.rpe ? 'var(--txt)' : 'var(--txt3)',  // Gris si no hay valor seleccionado
                padding: '5px 4px', fontSize: '11px', width: '100%', outline: 'none',
              }}>
              <option value="">—</option>
              {[6,6.5,7,7.5,8,8.5,9,9.5,10].map(r => <option key={r} value={String(r)}>{r}</option>)}
            </select>
            {/* Volumen calculado en tiempo real */}
            <div style={{ fontSize: '11px', color: 'var(--txt2)', textAlign: 'center' }}>
              {vol ? vol.toLocaleString() : '—'}
            </div>
            {/* Botón de completar serie: fondo verde cuando está marcada */}
            <button onClick={() => onCompleteSet(idx)} style={{
              width: '30px', height: '30px', border: '0.5px solid var(--bdr2)',
              background: set.is_completed ? 'var(--grn)' : 'none',
              color: set.is_completed ? '#fff' : 'var(--txt3)',
              cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {set.is_completed ? <Check size={14} /> : null}
            </button>
          </div>
        )
      })}

      {/* Acción para añadir una nueva serie al ejercicio */}
      <div style={{ padding: '10px 16px' }}>
        <button onClick={onAddSet} style={{
          background: 'none', border: 'none', color: 'var(--gold)',
          fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer',
        }}>+ Serie</button>
      </div>
    </div>
  )
}
