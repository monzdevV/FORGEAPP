/**
 * useSessionStore.ts — Store de sesión de entrenamiento activa (patrón pub/sub manual).
 *
 * Gestiona el estado de la sesión en curso usando un singleton de módulo
 * en lugar de Context o Zustand, compatible con useSyncExternalStore de React 18.
 *
 * ARQUITECTURA:
 *   - _session: estado global de la sesión (null si no hay sesión activa)
 *   - _listeners: lista de callbacks suscritos a cambios de estado
 *   - notify(): llama a todos los listeners para forzar re-render de consumidores
 *
 * FLUJO DE UNA SESIÓN:
 *   startSession → addExerciseToSession → addSetToExercise → updateSet → completeSet → finishSession
 *
 * PERSISTENCIA: cada acción que modifica datos críticos (series completadas,
 * inicio/fin de sesión) escribe directamente en Supabase. El estado en memoria
 * es la fuente de verdad durante la sesión activa; Supabase es el estado persistido.
 */
'use client'
import { createClient } from '@/lib/supabase/client'

// ── Tipos del dominio de sesión ───────────────────────────────────────────────

/** Representa una serie dentro de un ejercicio durante la sesión activa */
export interface SessionSet {
  id?: string                  // ID de Supabase (disponible solo tras completar la serie)
  workout_exercise_id?: string
  set_number: number
  weight: string               // String para permitir input vacío en el formulario
  reps: string
  rpe: string                  // Rate of Perceived Exertion (6–10)
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
  workout_id: string    // ID del workout en Supabase
  name: string
  started_at: Date
  exercises: SessionExercise[]
}

// ── Estado singleton del módulo ───────────────────────────────────────────────

/** Sesión activa; null cuando no hay ninguna en curso */
let _session: ActiveSession | null = null

/** Lista de callbacks registrados con useSyncExternalStore */
let _listeners: Array<() => void> = []

/** Notifica a todos los suscriptores que el estado ha cambiado */
function notify() { _listeners.forEach(l => l()) }

// ── API pública del store (compatible con useSyncExternalStore) ───────────────

/** Devuelve el snapshot actual de la sesión — función getter requerida por useSyncExternalStore */
export function getSession() { return _session }

/**
 * Suscribe un listener a los cambios del store.
 * Devuelve la función de limpieza (unsubscribe) que React llama automáticamente.
 */
export function subscribeSession(listener: () => void) {
  _listeners.push(listener)
  return () => { _listeners = _listeners.filter(l => l !== listener) }
}

// ── Acciones asíncronas ───────────────────────────────────────────────────────

// ╔═ PO-001 ═╗ crea un nuevo workout en Supabase e inicializa la sesión local
// ╚═ linked → PA-001 hooks/useSessionStore.ts
/**
 * Crea un nuevo workout en Supabase e inicializa el estado local de la sesión.
 * @param userId — ID del usuario autenticado
 * @param name — Nombre del entrenamiento (por defecto 'Entreno')
 * @throws Si Supabase devuelve error al insertar el workout
 */
export async function startSession(userId: string, name = 'Entreno') {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, name, status: 'in_progress', started_at: new Date().toISOString() })
    .select().single()
  if (error || !data) throw error
  _session = { workout_id: data.id, name: data.name, started_at: new Date(data.started_at), exercises: [] }
  notify()
  return _session
}

// ╔═ PO-002 ═╗ añade un ejercicio a la sesión activa y lo persiste en workout_exercises
// ╚═ linked → PO-009 app/(app)/sesion/page.tsx
/**
 * Añade un ejercicio a la sesión activa.
 * Persiste la línea workout_exercise en Supabase y genera un local_id temporal.
 * Inicializa automáticamente con una primera serie vacía.
 * @param exerciseId — ID del ejercicio de la biblioteca
 * @param name — Nombre del ejercicio (desnormalizado)
 * @param muscle — Grupo muscular (desnormalizado)
 */
export async function addExerciseToSession(exerciseId: string, name: string, muscle: string) {
  if (!_session) return
  const supabase = createClient()
  const order = _session.exercises.length  // Posición en la sesión (0-based)
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: _session.workout_id, exercise_id: exerciseId, order_index: order })
    .select().single()
  if (error || !data) throw error
  const local_id = `ex_${Date.now()}`  // ID único temporal para referenciar en la UI
  _session.exercises.push({
    local_id, workout_exercise_id: data.id, exercise_id: exerciseId, name, muscle,
    sets: [{ set_number: 1, weight: '', reps: '', rpe: '', is_completed: false, is_pr: false }],
  })
  notify()
}

/**
 * Añade una nueva serie vacía al ejercicio identificado por local_id.
 * El número de serie se asigna secuencialmente (sets.length + 1).
 */
export async function addSetToExercise(local_id: string) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  const next = ex.sets.length + 1
  ex.sets.push({ set_number: next, weight: '', reps: '', rpe: '', is_completed: false, is_pr: false })
  notify()
}

/**
 * Actualiza un campo de una serie en el estado local (sin persistir en Supabase).
 * La persistencia ocurre solo al completar la serie con completeSet().
 * @param local_id — Identificador local del ejercicio
 * @param setIdx — Índice de la serie (0-based)
 * @param field — Campo a modificar ('weight' | 'reps' | 'rpe' | …)
 * @param value — Nuevo valor del campo
 */
export function updateSet(local_id: string, setIdx: number, field: string, value: string | boolean) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(ex.sets[setIdx] as any)[field] = value
  notify()
}

// ╔═ PO-003 ═╗ completa una serie y la persiste en workout_sets si pasa a completada
// ╚═ linked → PO-010 app/(app)/sesion/page.tsx
/**
 * Alterna el estado completado de una serie y, si pasa a completada,
 * persiste la serie en Supabase (workout_sets).
 * Al completar, devuelve la serie actualizada para que el componente
 * pueda iniciar el temporizador de descanso.
 * @param local_id — Identificador local del ejercicio
 * @param setIdx — Índice de la serie (0-based)
 * @returns La serie modificada, o undefined si no se encontró
 */
export async function completeSet(local_id: string, setIdx: number) {
  if (!_session) return
  const ex = _session.exercises.find(e => e.local_id === local_id)
  if (!ex) return
  const set = ex.sets[setIdx]
  set.is_completed = !set.is_completed

  // Solo persiste en Supabase cuando la serie pasa a "completada" (no al desmarcar)
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
        rpe: toNum(set.rpe),
        is_completed: true,
      })
      .select().single()
    if (data) set.id = data.id  // Guardamos el ID de Supabase para referencias futuras
  }
  notify()
  return set
}

// ╔═ PA-001 ═╗ finaliza la sesión, actualiza el workout y publica en el feed de actividad
// ╚═ linked → PO-001 hooks/useSessionStore.ts
/**
 * Finaliza la sesión activa:
 *   1. Calcula volumen total y número de series completadas
 *   2. Actualiza el workout en Supabase (status=completed, métricas calculadas)
 *   3. Publica un evento en activity_feed para el feed social
 *   4. Intenta incrementar el contador de entrenos del perfil (RPC)
 *   5. Limpia el estado local (_session = null)
 *
 * @returns La sesión completada (antes de limpiar el estado)
 */
export async function finishSession() {
  if (!_session) return
  const supabase = createClient()

  // Calcular métricas de la sesión: solo series completadas con datos válidos
  const totalVolume = _session.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((s, set) =>
      s + (set.is_completed && set.weight && set.reps
        ? Number(set.weight) * Number(set.reps) : 0), 0), 0)
  const totalSets = _session.exercises.reduce((s, ex) =>
    s + ex.sets.filter(set => set.is_completed).length, 0)

  // Actualizar estado del workout en BD con métricas y tiempo total
  await supabase.from('workouts').update({
    status: 'completed',
    finished_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - _session.started_at.getTime()) / 1000),
    total_volume: totalVolume,
    total_sets: totalSets,
  }).eq('id', _session.workout_id)

  // Publicar evento en el feed social para que los amigos lo vean
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('activity_feed').insert({
      user_id: user.id,
      type: 'workout_completed',
      reference_id: _session.workout_id,
      message: `Completó "${_session.name}" — ${Math.round(totalVolume).toLocaleString()} kg`,
    })
    // Incrementar contador de entrenos en perfil via RPC (función de BD)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await (supabase.rpc as any)('increment_workout_count', { user_id: user.id }) } catch { /* ignorar si la función RPC no existe */ }
  }

  const completed = _session
  _session = null  // Limpiar estado: la próxima sesión empezará desde cero
  notify()
  return completed
}

/**
 * Elimina un ejercicio de la sesión activa en memoria.
 * No elimina los datos ya guardados en Supabase (workout_exercise y workout_sets).
 * @param local_id — Identificador local del ejercicio a eliminar
 */
export function removeExercise(local_id: string) {
  if (!_session) return
  _session.exercises = _session.exercises.filter(e => e.local_id !== local_id)
  notify()
}
