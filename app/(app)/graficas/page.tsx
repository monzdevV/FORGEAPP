/**
 * page.tsx — Página de gráficas y estadísticas (Server Component).
 *
 * Carga en una sola query anidada todos los datos necesarios para las visualizaciones:
 *   - workouts: historial completo de sesiones completadas del usuario
 *   - workout_exercises: ejercicios realizados en cada sesión (con nombre y grupo muscular)
 *   - workout_sets: series individuales de cada ejercicio (peso, reps, completada)
 *
 * La query única con relaciones anidadas evita múltiples roundtrips a Supabase
 * y simplifica la transferencia de datos al componente cliente.
 *
 * Los workouts se ordenan cronológicamente (ascending) porque las gráficas
 * muestran evolución temporal de izquierda a derecha.
 *
 * El Client Component (GraficasClient) recibe el array de workouts con toda la
 * información anidada y calcula los datos de gráficas en cliente con useMemo.
 */
import { createClient } from '@/lib/supabase/server'
import GraficasClient from './GraficasClient'

// ╔═ GE-007 ═╗ carga historial completo de entrenamientos con ejercicios y series anidados
// ╚═ linked → GE-012 app/(app)/graficas/GraficasClient.tsx
/**
 * Handler del Server Component: carga datos de Supabase y pasa el resultado
 * al Client Component para que renderice las gráficas.
 */
export default async function GraficasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Query única con relaciones anidadas:
  //   workouts → workout_exercises → exercises (nombre, grupo muscular)
  //                               → workout_sets (peso, reps, estado)
  // Se filtran solo workouts completados con fecha de fin registrada
  const { data: workouts } = await supabase
    .from('workouts')
    .select(`
      id, finished_at, total_volume, total_sets, duration_seconds,
      workout_exercises(
        exercise_id,
        exercises(name, muscle_group),
        workout_sets(weight, reps, is_completed)
      )
    `)
    .eq('user_id', user!.id)
    .eq('status', 'completed')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: true })

  return <GraficasClient workouts={workouts || []} />
}
