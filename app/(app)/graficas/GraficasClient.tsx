/**
 * GraficasClient.tsx — Visualizaciones de progreso del usuario con Chart.js.
 *
 * Chart.js se carga dinámicamente desde CDN (no como dependencia npm) para
 * reducir el bundle inicial de la app. El flag chartsReady controla cuándo
 * es seguro instanciar los gráficos.
 *
 * GRÁFICAS:
 *   1. Volumen por sesión (barras verticales): evolución del volumen total kg por entreno
 *   2. Récord por ejercicio (barras horizontales): peso máximo histórico de cada ejercicio.
 *      Un pico (barra) por ejercicio, ordenados de mayor a menor.
 *      Los ejercicios de cardio muestran km en lugar de kg.
 *
 * Las instancias de Chart se guardan en refs para poder destruirlas antes de
 * redibujar (Chart.js no soporta múltiples instancias en el mismo canvas).
 *
 * STATS RESUMEN: 4 KPIs calculados desde los datos cargados en el servidor:
 *   sesiones totales, volumen total (toneladas), series totales, tiempo total (minutos).
 *
 * Los datos llegan ya procesados del Server Component (graficas/page.tsx):
 * workouts con sus ejercicios y series anidados.
 */
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

// ── Tipos de los datos recibidos del Server Component ────────────────────────

interface SetRow {
  weight: number | null
  reps: number | null
  is_completed: boolean
}

/**
 * Fila de workout_exercise con ejercicio y series anidados.
 * La relación FK workout_exercises → exercises es muchos-a-uno pero
 * Supabase puede inferirla como array; se normaliza en exerciseMap.
 */
interface WERow {
  exercise_id: string
  exercises: { name: string; muscle_group: string }[] | { name: string; muscle_group: string } | null
  workout_sets: SetRow[]
}

interface WorkoutRow {
  id: string
  finished_at: string
  total_volume: number | null
  total_sets: number | null
  duration_seconds: number | null
  workout_exercises: WERow[]
}

/** Tipo interno del constructor de Chart.js cargado desde CDN */
type ChartInstance = { destroy: () => void }
type ChartCtor     = new (...args: unknown[]) => ChartInstance

export default function GraficasClient({ workouts }: { workouts: WorkoutRow[] }) {
  // Referencias a los elementos <canvas> donde Chart.js dibuja
  const volCanvasRef = useRef<HTMLCanvasElement>(null)
  const exCanvasRef  = useRef<HTMLCanvasElement>(null)

  // Instancias activas de Chart para poder destruirlas antes de redibujar
  const volChart = useRef<ChartInstance | null>(null)
  const exChart  = useRef<ChartInstance | null>(null)

  // Controla si Chart.js está disponible en window (se carga de forma asíncrona desde CDN)
  const [chartsReady, setChartsReady] = useState(false)

  // ── Carga de Chart.js desde CDN al montar el componente ──
  useEffect(() => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
    // Solo cuando el script ha cargado completamente se marca como disponible
    s.onload = () => setChartsReady(true)
    document.head.appendChild(s)
  }, [])

  // ╔═ GE-012 ═╗ mapa de progresión por ejercicio — peso máximo por sesión
  // ╚═ linked → GE-007 app/(app)/graficas/page.tsx
  /**
   * Construye un mapa exerciseId → { name, muscle, points[] } donde cada punto
   * contiene la fecha de la sesión y el peso máximo levantado en ese día.
   * Para cardio el campo weight almacena km.
   * Se calcula con useMemo para no recalcular en cada re-render del componente.
   */
  const exerciseMap = useMemo(() => {
    const m = new Map<string, { name: string; muscle: string; points: { date: string; maxWeight: number }[] }>()
    for (const w of workouts) {
      for (const we of (w.workout_exercises ?? [])) {
        // Normaliza la relación exercises (puede llegar como array o como objeto)
        const exInfo = Array.isArray(we.exercises) ? we.exercises[0] : we.exercises
        if (!exInfo) continue

        // Solo series marcadas como completadas con peso registrado
        const done = (we.workout_sets ?? []).filter(s => s.is_completed && s.weight != null)
        if (done.length === 0) continue

        const maxW = Math.max(...done.map(s => s.weight!))
        if (!m.has(we.exercise_id)) {
          m.set(we.exercise_id, { name: exInfo.name, muscle: exInfo.muscle_group, points: [] })
        }
        m.get(we.exercise_id)!.points.push({
          date: new Date(w.finished_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          maxWeight: maxW,
        })
      }
    }
    return m
  }, [workouts])

  /**
   * Pico histórico por ejercicio: toma el máximo absoluto de todos los puntos
   * y ordena de mayor a menor. Se limita a 15 ejercicios para que la gráfica
   * horizontal sea legible.
   * Los ejercicios de cardio muestran km; el resto muestran kg.
   */
  const exercisePeaks = useMemo(() =>
    Array.from(exerciseMap.entries())
      .map(([id, d]) => ({
        id,
        name: d.name,
        muscle: d.muscle,
        peak: Math.max(...d.points.map(p => p.maxWeight)),
        isCardio: d.muscle === 'cardio',
      }))
      .sort((a, b) => b.peak - a.peak)
      .slice(0, 15),
    [exerciseMap])

  // ── Gráfica 1: volumen total por sesión (barras verticales) ──
  // Se redibuja cuando Chart.js carga o cambian los workouts
  useEffect(() => {
    if (!chartsReady || !volCanvasRef.current) return
    const Chart = (window as unknown as { Chart?: ChartCtor }).Chart
    if (!Chart) return

    // Destruir instancia previa — Chart.js lanza error si el canvas ya tiene una instancia
    volChart.current?.destroy()

    // Etiquetas del eje X: fecha corta de cada sesión completada
    const labels = workouts.map(w =>
      new Date(w.finished_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))

    // Datos del eje Y: volumen total de cada sesión en kg
    const data = workouts.map(w => Number(w.total_volume || 0))

    volChart.current = new Chart(volCanvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(201,168,76,0.14)',
          borderColor: '#C9A84C',
          borderWidth: 1,
          borderRadius: 2,
        }],
      },
      options: buildChartOptions(),
    } as unknown as [])
  }, [chartsReady, workouts])

  // ── Gráfica 2: pico histórico por ejercicio (barras horizontales) ──
  // Una barra por ejercicio — el eje Y son los nombres, el eje X es el peso máximo.
  // Se redibuja cuando cambian los picos calculados o cuando Chart.js carga.
  useEffect(() => {
    if (!chartsReady || !exCanvasRef.current) return
    const Chart = (window as unknown as { Chart?: ChartCtor }).Chart
    if (!Chart) return

    // Destruir instancia previa antes de redibujar
    exChart.current?.destroy()
    exChart.current = null

    if (exercisePeaks.length === 0) return

    exChart.current = new Chart(exCanvasRef.current, {
      type: 'bar',
      data: {
        labels: exercisePeaks.map(e => e.name),
        datasets: [{
          data: exercisePeaks.map(e => e.peak),
          // Cardio en azul, fuerza en dorado — distinción visual de unidades (km vs kg)
          backgroundColor: exercisePeaks.map(e =>
            e.isCardio ? 'rgba(59,130,246,0.2)' : 'rgba(201,168,76,0.2)'),
          borderColor: exercisePeaks.map(e =>
            e.isCardio ? '#3B82F6' : '#C9A84C'),
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        // indexAxis 'y' convierte las barras verticales en horizontales
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Muestra la unidad correcta según el tipo de ejercicio
              label: (ctx: unknown) => {
                const item = exercisePeaks[(ctx as { dataIndex: number }).dataIndex]
                const unit = item.isCardio ? 'km' : 'kg'
                return ` ${(ctx as { raw: number }).raw} ${unit}`
              },
            },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(201,168,76,0.06)' }, ticks: { color: '#7A7570', font: { size: 10 } } },
          y: { grid: { color: 'rgba(201,168,76,0.06)' }, ticks: { color: '#7A7570', font: { size: 11 } } },
        },
      },
    } as unknown as [])
  }, [chartsReady, exercisePeaks])

  // ── KPIs: calculados en cliente desde los datos ya cargados ──
  const totalVolume = workouts.reduce((s, w) => s + Number(w.total_volume || 0), 0)
  const totalSets   = workouts.reduce((s, w) => s + Number(w.total_sets || 0), 0)
  const totalMins   = Math.round(workouts.reduce((s, w) => s + Number(w.duration_seconds || 0), 0) / 60)

  // Altura dinámica de la gráfica de ejercicios según número de barras (min 200, max ~420 px)
  const exChartHeight = Math.max(200, exercisePeaks.length * 28)

  return (
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>

      {/* ── Las dos gráficas en grid de dos columnas ── */}
      <div className="g2" style={{ marginBottom: '14px' }}>

        {/* Gráfica de barras: volumen total por sesión de entrenamiento */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Volumen por sesión</div>
          </div>
          {/* Estado vacío: no hay entrenamientos completados todavía */}
          {workouts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '20px 0' }}>
              Completa entrenamientos para ver datos.
            </div>
          ) : (
            <div style={{ height: '200px' }}>
              <canvas ref={volCanvasRef} />
            </div>
          )}
        </div>

        {/* Gráfica horizontal: récord (pico) por ejercicio
            Un pico por ejercicio, ordenados de mayor a menor.
            Dorado = fuerza (kg) · Azul = cardio (km) */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Récord por ejercicio</div>
          </div>
          {exercisePeaks.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '20px 0' }}>
              Completa entrenamientos para ver datos.
            </div>
          ) : (
            // Altura adaptada al número de ejercicios para que todas las barras sean legibles
            <div style={{ height: `${exChartHeight}px` }}>
              <canvas ref={exCanvasRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs de resumen ── */}
      <div className="g4">

        {/* Total de sesiones completadas históricamente */}
        <div className="kpi">
          <div className="kpi-lbl">Sesiones totales</div>
          <div className="kpi-val c-gold">{workouts.length}</div>
          <div className="kpi-sub c-muted">completadas</div>
        </div>

        {/* Volumen total histórico en toneladas */}
        <div className="kpi">
          <div className="kpi-lbl">Volumen total</div>
          <div className="kpi-val">
            {Math.round(totalVolume / 1000).toLocaleString()}
          </div>
          <div className="kpi-sub c-muted">toneladas</div>
        </div>

        {/* Total de series completadas en todas las sesiones */}
        <div className="kpi">
          <div className="kpi-lbl">Series totales</div>
          <div className="kpi-val">{totalSets}</div>
          <div className="kpi-sub c-muted">completadas</div>
        </div>

        {/* Tiempo total de entrenamiento en minutos */}
        <div className="kpi">
          <div className="kpi-lbl">Tiempo total</div>
          <div className="kpi-val">{totalMins.toLocaleString()}</div>
          <div className="kpi-sub c-muted">minutos</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Opciones base de Chart.js compartidas por ambas gráficas (escalas, grid, tipografía).
 * Se exporta como función para evitar referencias circulares al mutar el objeto.
 */
function buildChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(201,168,76,0.06)' }, ticks: { color: '#7A7570', font: { size: 10 } } },
      y: { grid: { color: 'rgba(201,168,76,0.06)' }, ticks: { color: '#7A7570', font: { size: 10 } } },
    },
  }
}
