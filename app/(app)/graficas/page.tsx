/**
 * page.tsx — Página de gráficas y estadísticas (Server Component).
 *
 * Carga en paralelo los datos necesarios para las visualizaciones:
 *   - workouts: historial completo de sesiones completadas (para gráfica de volumen)
 *   - exercises: catálogo completo (para el selector de ejercicio en gráfica de PRs)
 *   - prs: todos los récords personales del usuario (para gráfica de progresión)
 *
 * Los workouts se ordenan cronológicamente (ascending) porque las gráficas
 * muestran evolución temporal de izquierda a derecha.
 */
import { createClient } from '@/lib/supabase/server'
import GraficasClient from './GraficasClient'

// ╔═ GE-007 ═╗ carga historial de entrenamientos, ejercicios y récords para las gráficas
// ╚═ linked → PA-001 hooks/useSessionStore.ts
export default async function GraficasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Tres queries en paralelo — el orden cronológico es clave para las gráficas de línea
  const [{ data: workouts }, { data: exercises }, { data: prs }] = await Promise.all([
    supabase.from('workouts').select('id, name, started_at, finished_at, total_volume, total_sets')
      .eq('user_id', user!.id).eq('status', 'completed').order('finished_at', { ascending: true }),

    // Todos los ejercicios para poblar el selector de la gráfica de PRs
    supabase.from('exercises').select('id, name, muscle_group').order('name'),

    // PRs en orden cronológico para mostrar la progresión en el tiempo
    supabase.from('personal_records').select('*, exercises(name)')
      .eq('user_id', user!.id).order('achieved_at', { ascending: true }),
  ])

  return <GraficasClient workouts={workouts || []} exercises={exercises || []} prs={prs || []} />
}
