/**
 * useSessionStore.ts — Store de sesión de entrenamiento activa (patrón pub/sub manual).
 *
 * Gestiona el estado de la sesión en curso usando un singleton de módulo
 * en lugar de Context o Zustand, compatible con useSyncExternalStore de React 18.
 *
 * ARQUITECTURA:
 *   - _session:  estado mutable de la sesión (se muta en lugar de reemplazar)
 *   - _snapshot: copia shallow de _session que se recrea en cada notify().
 *                useSyncExternalStore exige que getSnapshot() devuelva una
 *                nueva referencia cuando el estado cambia; como _session se
 *                muta en lugar de reemplazarse, sin _snapshot React nunca
 *                detectaría el cambio y no re-renderizaría.
 *   - _listeners: callbacks suscritos con useSyncExternalStore
 *   - _timerInterval: setInterval del timer principal; vive en el módulo para
 *                     sobrevivir a la navegación entre páginas
 *
 * FLUJO DE UNA SESIÓN:
 *   startSession → addExerciseToSession → addSetToExercise → updateSet → completeSet → finishSession
 *
 * PERSISTENCIA: operaciones críticas (inicio/fin de sesión, series completadas)
 * escriben directamente en Supabase. El estado en memoria es la fuente de
 * verdad durante la sesión; Supabase almacena el estado persistido.
 *
 * NOTA CARDIO: los ejercicios de grupo muscular 'cardio' reutilizan los campos
 * weight (→ km) y reps (→ minutos) del modelo de datos para evitar añadir
 * columnas extra. La distinción se gestiona en la UI.
 */
'use client'
import { createClient } from '@/lib/supabase/client'

// ── Tipos del dominio de sesión ───────────────────────────────────────────────

/** Representa una serie dentro de un ejercicio durante la sesión activa */
export interface SessionSet {
  id?: string                  // ID de Supabase (disponible solo tras completar la serie)
  workout_exercise_id?: string
  set_number: number
  weight: string               // String para permitir input vacío · en cardio representa km
  reps: string                 // En cardio representa minutos
  rpe: string                  // Rate of Perceived Exertion — guardado en BD, no expuesto en UI
  is_completed: boolean
  is_pr: boolean               // true si supera el récord previo del ejercicio
}

/** Ejercicio añadido a la sesión, con su lista de series */
export interface SessionExercise {
  local_id: string             // ID temporal generado en cliente (ex_{timestamp})
  workout_exercise_id?: string // ID en Supabase, disponible tras guardar
  exercise_id: string          // Referencia al ejercicio de la biblioteca
  name: string
  muscle: string               // Grupo muscular (desnormalizado para evitar joins en UI)
  sets: SessionSet[]
}

/** Estado completo de la sesión activa */
export interface ActiveSession {
  workout_id: string
  name: string
  started_at: Date
  elapsed_seconds: number      // Segundos acumulados desde el inicio (gestionado por el timer del store)
  timer_running: boolean       // false cuando el usuario pausa manualmente el timer
  exercises: SessionExercise[]
}

// ── Estado singleton del módulo ───────────────────────────────────────────────

/** Sesión activa mutable; null cuando no hay ninguna en curso */
let _session: ActiveSession | null = null

// ╔═ GE-009 ═╗ snapshot inmutable que cambia de referencia en cada notify()
// ╚═ linked → PO-011 components/layout/Topbar.tsx
/**
 * useSyncExternalStore compara snapshots con Object.is. Como _session se muta
 * en el mismo objeto, la referencia nunca cambia y React no re-renderizaría.
 * _snapshot es una copia shallow que se recrea en cada notify() para garantizar
 * una referencia nueva y forzar el re-render.
 */
let _snapshot: ActiveSession | null = null

/** Lista de callbacks registrados con useSyncExternalStore */
let _listeners: Array<() => void> = []

// ╔═ GE-010 ═╗ intervalo del timer principal — vive en el módulo para sobrevivir a la navegación
// ╚═ linked → PO-011 components/layout/Topbar.tsx · PO-008 app/(app)/sesion/page.tsx
/** Referencia al setInterval del timer. Al vivir en el módulo, no se destruye
 *  cuando el usuario navega fuera de /sesion. */
let _timerInterval: ReturnType<typeof setInterval> | null = null

/** Crea un nuevo snapshot shallow y notifica a todos los suscriptores */
function notify() {
  _snapshot = _session ? { ..._session } : null
  _listeners.forEach(l => l())
}

// ── API pública del store (compatible con useSyncExternalStore) ───────────────

/**
 * Devuelve el snapshot actual de la sesión.
 * getSnapshot debe devolver el mismo valor entre llamadas salvo que haya habido
 * un notify() entre medias; el snapshot se recrea en cada notify() para cumplirlo.
 */
export function getSession() { return _snapshot }

/**
 * Suscribe un listener a los cambios del store.
 * Devuelve la función de limpieza (unsubscribe) que React llama al desmontar.
 */
export function subscribeSession(listener: () => void) {
  _listeners.push(listener)
  return () => { _listeners = _listeners.filter(l => l !== listener) }
}

// ── Timer del módulo ──────────────────────────────────────────────────────────

/**
 * Arranca el intervalo que incrementa elapsed_seconds cada segundo.
 * Se llama al iniciar la sesión o al reanudar el timer.
 * Destruye cualquier intervalo previo antes de crear uno nuevo para evitar duplicados.
 */
function startTimerInterval() {
  if (_timerInterval) clearInterval(_timerInterval)
  _timerInterval = setInterval(() => {
    if (_session?.timer_running) {
      _session.elapsed_seconds += 1
      notify()
    }
  }, 1000)
}

/**
 * Detiene y limpia el intervalo del timer.
 * Se llama al finalizar la sesión para liberar recursos.
 */
function clearTimerInterval() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
}

// ── Acciones asíncronas ───────────────────────────────────────────────────────

// ╔═ PO-001 ═╗ crea un nuevo workout en Supabase e inicializa la sesión local
// ╚═ linked → PA-001 hooks/useSessionStore.ts
/**
 * Crea un nuevo workout en Supabase, inicializa el estado local e inicia el timer.
 * @param userId — ID del usuario autenticado
 * @param name   — Nombre del entrenamiento
 */
export async function startSession(userId: string, name = 'Entreno') {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, name, status: 'in_progress', started_at: new Date().toISOString() })
    .select().single()
  if (error || !data) throw error
  _session = {
    workout_id: data.id,
    name: data.name,
    started_at: new Date(data.started_at),
    elapsed_seconds: 0,
    timer_running: true,
    exercises: [],
  }
  startTimerInterval()
  notify()
  return _session
}

// ╔═ PO-011 ═╗ pausa / reanuda el timer principal sin afectar a la sesión en BD
// ╚═ linked → PO-008 app/(app)/sesion/page.tsx · GE-011 components/layout/Topbar.tsx
/**
 * Pausa el timer de la sesión activa (no afecta a la sesión en Supabase).
 * El indicador del Topbar refleja el estado pausado cambiando de color.
 */
export function pauseTimer() {
  if (!_session) return
  _session.timer_running = false
  notify()
}

/**
 * Reanuda el timer de la sesión activa tras una pausa.
 */
export function resumeTimer() {
  if (!_session) return
  _session.timer_running = true
  notify()
}

// ╔═ PO-002 ═╗ añade un ejercicio a la sesión activa y lo persiste en workout_exercises
// ╚═ linked → PO-009 app/(app)/sesion/page.tsx
/**
 * Añade un ejercicio a la sesión activa.
 * Persiste en Supabase y genera un local_id temporal.
 * Inicializa con una primera serie vacía.
 * @param exerciseId — ID del ejercicio de la biblioteca
 * @param name       — Nombre del ejercicio (desnormalizado)
 * @param muscle     — Grupo muscular (desnormalizado; 'cardio' cambia la UI de inputs)
 */
export async function addExerciseToSession(exerciseId: string, name: string, muscle: string) {
  if (!_session) return
  const supabase = createClient()
  const order = _session.exercises.length
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: _session.workout_id, exercise_id: exerciseId, order_index: order })
    .select().single()
  if (error || !data) throw error
  const local_id = `ex_${Date.now()}`
  _session.exercises.push({
    local_id, workout_exercise_id: data.id, exercise_id: exerciseId, name, muscle,
    sets: [{ set_number: 1, weight: '', reps: '', rpe: '', is_completed: false, is_pr: false }],
  })
  notify()
}

/**
 * Añade una nueva serie vacía al ejercicio identificado por local_id.
 * El número de serie se asigna secuencialmente.
 */
export async function addSetToExercise(local_id: string) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  ex.sets.push({ set_number: ex.sets.length + 1, weight: '', reps: '', rpe: '', is_completed: false, is_pr: false })
  notify()
}

// ╔═ PO-003 ═╗ actualiza un campo de serie en memoria sin notificar (inputs no controlados)
// ╚═ linked → PO-010 app/(app)/sesion/page.tsx
/**
 * Actualiza un campo de una serie en el estado local sin llamar a notify().
 * Los inputs de la UI son no controlados (defaultValue + onBlur), por lo que
 * no hace falta re-render al escribir — se llama en onBlur justo antes de
 * completeSet, que sí llama a notify().
 * @param local_id — Identificador local del ejercicio
 * @param setIdx   — Índice de la serie (0-based)
 * @param field    — Campo a modificar ('weight' | 'reps')
 * @param value    — Nuevo valor del campo
 */
export function updateSet(local_id: string, setIdx: number, field: string, value: string | boolean) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ex.sets[setIdx] as any)[field] = value
}

// ╔═ PO-004 ═╗ completa o desmarca una serie y la persiste en workout_sets si pasa a completada
// ╚═ linked → PO-010 app/(app)/sesion/page.tsx
/**
 * Alterna el estado completado de una serie y, si pasa a completada,
 * persiste la serie en Supabase (workout_sets).
 * Para ejercicios cardio: weight → km, reps → minutos (no tiene sentido calcular rpe).
 * @param local_id — Identificador local del ejercicio
 * @param setIdx   — Índice de la serie (0-based)
 * @returns La serie modificada, o undefined si no se encontró
 */
export async function completeSet(local_id: string, setIdx: number) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  const set = ex.sets[setIdx]
  set.is_completed = !set.is_completed

  if (set.is_completed && ex.workout_exercise_id) {
    const supabase = createClient()
    const toNum = (v: string) => { const n = Number(v); return v && !isNaN(n) ? n : null }
    const { data } = await supabase
      .from('workout_sets')
      .insert({
        workout_exercise_id: ex.workout_exercise_id,
        set_number: set.set_number,
        weight: toNum(set.weight),
        reps: toNum(set.reps),
        rpe: null,  // RPE no expuesto en UI
        is_completed: true,
      })
      .select().single()
    if (data) set.id = data.id
  }
  notify()
  return set
}

// ╔═ PA-001 ═╗ finaliza la sesión, actualiza el workout y publica en el feed de actividad
// ╚═ linked → PO-001 hooks/useSessionStore.ts
/**
 * Finaliza la sesión activa:
 *   1. Detiene el timer del módulo
 *   2. Calcula volumen total y número de series completadas
 *   3. Actualiza el workout en Supabase (status=completed, métricas)
 *   4. Publica un evento en activity_feed
 *   5. Limpia el estado local (_session = null)
 *
 * Usa _session.elapsed_seconds como duración real (en lugar de Date.now() - started_at)
 * para reflejar correctamente los períodos pausados.
 */
export async function finishSession() {
  if (!_session) return
  clearTimerInterval()
  const supabase = createClient()

  const totalVolume = _session.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) =>
      s + (set.is_completed && set.weight && set.reps
        ? Number(set.weight) * Number(set.reps) : 0), 0), 0)
  const totalSets = _session.exercises.reduce((s, ex) =>
    s + ex.sets.filter(set => set.is_completed).length, 0)

  await supabase.from('workouts').update({
    status: 'completed',
    finished_at: new Date().toISOString(),
    duration_seconds: _session.elapsed_seconds,
    total_volume: totalVolume,
    total_sets: totalSets,
  }).eq('id', _session.workout_id)

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('activity_feed').insert({
      user_id: user.id,
      type: 'workout_completed',
      reference_id: _session.workout_id,
      message: `Completó "${_session.name}" — ${Math.round(totalVolume).toLocaleString()} kg`,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (supabase.rpc as any)('increment_workout_count', { user_id: user.id }) } catch { /* ignorar si la RPC no existe */ }
  }

  const completed = _session
  _session = null
  notify()
  return completed
}

/**
 * Elimina un ejercicio de la sesión activa en memoria.
 * No elimina los datos ya guardados en Supabase.
 * @param local_id — Identificador local del ejercicio a eliminar
 */
export function removeExercise(local_id: string) {
  if (!_session) return
  _session.exercises = _session.exercises.filter(e => e.local_id !== local_id)
  notify()
}
