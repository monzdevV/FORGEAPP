/**
 * GraficasClient.tsx — Visualizaciones de progreso del usuario con Chart.js.
 *
 * Chart.js se carga dinámicamente desde CDN (no como dependencia npm) para
 * reducir el bundle inicial de la app. El flag chartsLoaded controla cuándo
 * es seguro instanciar los gráficos.
 *
 * GRÁFICAS:
 *   1. Volumen por sesión (barras): evolución del volumen total kg por entreno
 *   2. Progresión de récord (línea): máximos históricos de un ejercicio seleccionado
 *
 * Las instancias de Chart se guardan en refs para poder destruirlas antes de
 * redibujar (Chart.js no soporta múltiples instancias en el mismo canvas).
 *
 * STATS RESUMEN: 4 KPIs calculados desde los datos cargados en el servidor.
 */
'use client'
import { useEffect, useRef, useState } from 'react'

// Tipos locales que describen la forma de los datos recibidos del Server Component
interface WorkoutRow {
  id: string
  name: string
  started_at: string
  finished_at: string | null   // null si el entreno no fue completado (no debería llegarse aquí)
  total_volume: number | null  // Suma de peso × reps de todas las series completadas
  total_sets: number | null    // Número de series completadas en la sesión
}
interface ExerciseRow {
  id: string
  name: string
  muscle_group: string
}
interface PRRow {
  exercise_id: string
  value: number                            // Valor del récord en kg
  achieved_at: string | null               // Fecha en que se consiguió el récord
  exercises: { name: string } | null       // Nombre del ejercicio via join — null si fue eliminado
}

export default function GraficasClient({ workouts, exercises, prs }: {
  workouts: WorkoutRow[]
  exercises: ExerciseRow[]
  prs: PRRow[]
}) {
  // Referencia al elemento <canvas> donde Chart.js dibujará la gráfica de volumen
  const volChartRef = useRef<HTMLCanvasElement>(null)
  // Referencia al elemento <canvas> donde Chart.js dibujará la gráfica de PRs
  const prChartRef  = useRef<HTMLCanvasElement>(null)

  // ID del ejercicio seleccionado en el selector de la gráfica de PRs
  // Se inicializa con el primer ejercicio del catálogo para tener datos visibles de inmediato
  const [selectedEx, setSelectedEx] = useState(exercises[0]?.id || '')

  // Controla si Chart.js ya está disponible en window (se carga de forma asíncrona desde CDN)
  const [chartsLoaded, setChartsLoaded] = useState(false)

  // Guarda la instancia activa de la gráfica de volumen para poder destruirla antes de redibujar
  const volChartInstance = useRef<unknown>(null)
  // Guarda la instancia activa de la gráfica de PRs para poder destruirla antes de redibujar
  const prChartInstance  = useRef<unknown>(null)

  // ── Carga de Chart.js desde CDN al montar el componente ──
  // Se añade como script al <head> para que esté disponible en window.Chart
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
    // Solo cuando el script ha cargado completamente se marca como disponible
    script.onload = () => setChartsLoaded(true)
    document.head.appendChild(script)
  }, []) // Sin dependencias: solo se ejecuta al montar, una sola vez

  // ── Gráfica de barras: volumen total por sesión ──
  // Se redibuja cuando Chart.js carga o cuando cambian los datos de workouts
  useEffect(() => {
    if (!chartsLoaded) return  // Esperar a que Chart.js esté disponible en window
    const Chart = (window as unknown as { Chart?: new (...args: unknown[]) => { destroy: () => void } }).Chart
    if (!Chart) return

    if (volChartRef.current) {
      // Destruir instancia previa si existe — Chart.js lanza error si se intenta usar el mismo canvas dos veces
      if (volChartInstance.current) (volChartInstance.current as { destroy: () => void }).destroy()

      // Etiquetas del eje X: fecha corta en español (ej: "15 ene") de cada entrenamiento completado
      const labels = workouts.map(w => w.finished_at
        ? new Date(w.finished_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : '')  // String vacío si por alguna razón no hay fecha de finalización

      // Datos del eje Y: volumen total de cada sesión en kg (0 si no se registró)
      const data = workouts.map(w => Number(w.total_volume || 0))

      // Crear instancia de gráfica de barras con paleta dorada del design system
      volChartInstance.current = new Chart(volChartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: 'rgba(201,168,76,0.14)', // Dorado muy semitransparente para el relleno de barras
            borderColor: '#C9A84C',                   // Borde dorado sólido (--gold del design system)
            borderWidth: 1,
            borderRadius: 2,                          // Esquinas ligeramente redondeadas para estética
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // Permite que el canvas use la altura del contenedor padre
          plugins: {
            legend: { display: false }, // Sin leyenda: el título de la card ya identifica la gráfica
          },
          scales: {
            // Eje X: líneas de cuadrícula sutiles en dorado, texto en color muted del design system
            x: {
              grid: { color: 'rgba(201,168,76,0.06)' },
              ticks: { color: '#7A7570', font: { size: 10 } },
            },
            // Eje Y: misma configuración que X, sin sufijos de unidad (el título implica kg)
            y: {
              grid: { color: 'rgba(201,168,76,0.06)' },
              ticks: { color: '#7A7570', font: { size: 10 } },
            },
          },
        },
      })
    }
  }, [chartsLoaded, workouts]) // Se redibuja si los workouts cambian (ej: se completa un nuevo entreno)

  // ── Gráfica de línea: progresión del récord personal por ejercicio ──
  // Se redibuja cuando cambia el ejercicio seleccionado, los PRs, o cuando Chart.js carga
  useEffect(() => {
    if (!chartsLoaded || !selectedEx) return // Necesita Chart.js cargado y un ejercicio válido seleccionado
    const Chart = (window as unknown as { Chart?: new (...args: unknown[]) => { destroy: () => void } }).Chart
    if (!Chart) return

    if (prChartRef.current) {
      // Destruir instancia previa para evitar error de canvas duplicado
      if (prChartInstance.current) (prChartInstance.current as { destroy: () => void }).destroy()

      // Filtrar PRs del ejercicio seleccionado — ya llegan en orden cronológico desde el servidor
      const exPrs = prs.filter(p => p.exercise_id === selectedEx)

      // Etiquetas del eje X: fecha corta de cada récord personal conseguido
      const labels = exPrs.map(p => p.achieved_at
        ? new Date(p.achieved_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : '')

      // Datos del eje Y: valor del récord en kg en cada punto temporal
      const data = exPrs.map(p => p.value)

      // Crear instancia de gráfica de línea con área rellena bajo la curva
      prChartInstance.current = new Chart(prChartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data,
            borderColor: '#C9A84C',                      // Línea principal en dorado
            borderWidth: 2,
            backgroundColor: 'rgba(201,168,76,0.05)',    // Área bajo la curva muy sutil
            fill: true,                                  // Rellenar el área bajo la línea
            tension: 0.4,                                // Suavizar la curva (0=recto, 1=muy curvo)
            pointBackgroundColor: '#C9A84C',             // Puntos de datos en dorado sólido
            pointRadius: 4,                              // Tamaño visible de los puntos en el gráfico
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { color: 'rgba(201,168,76,0.06)' },
              ticks: { color: '#7A7570', font: { size: 10 } },
            },
            y: {
              grid: { color: 'rgba(201,168,76,0.06)' },
              ticks: {
                color: '#7A7570',
                font: { size: 10 },
                // Añadir sufijo ' kg' a cada valor del eje Y para indicar la unidad
                callback: (v: unknown) => v + ' kg',
              },
            },
          },
        },
      })
    }
  }, [chartsLoaded, selectedEx, prs]) // Se redibuja al cambiar ejercicio seleccionado o al llegar nuevos PRs

  return (
    // Animación de entrada de página definida como @keyframes panelIn en globals.css
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>

      {/* ── Sección superior: las dos gráficas en grid de dos columnas ── */}
      <div className="g2" style={{ marginBottom: '14px' }}>

        {/* Gráfica de barras: volumen total por sesión de entrenamiento */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Volumen por sesión</div>
          </div>
          {/* Estado vacío: se muestra cuando no hay entrenamientos completados todavía */}
          {workouts.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '20px 0' }}>
              Completa entrenamientos para ver datos aquí.
            </div>
          ) : (
            // Contenedor con altura fija: Chart.js necesita un padre con altura definida cuando maintainAspectRatio=false
            <div style={{ height: '200px' }}>
              <canvas ref={volChartRef} />
            </div>
          )}
        </div>

        {/* Gráfica de línea: progresión del récord personal por ejercicio */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Progresión de récord</div>
            {/* Selector de ejercicio: permite cambiar qué récord se visualiza en la gráfica */}
            <select
              value={selectedEx}
              onChange={e => setSelectedEx(e.target.value)}
              style={{
                background: 'var(--s2)',             // Fondo de superficie para integrarse con el card
                border: '0.5px solid var(--bdr2)',   // Borde sutil en dorado semitransparente
                color: 'var(--txt)',
                padding: '4px 8px',
                fontSize: '11px',
                outline: 'none',                     // Eliminar el outline nativo del navegador
              }}
            >
              {/* Renderizar una opción por cada ejercicio del catálogo */}
              {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>

          {/* Estado vacío: el ejercicio seleccionado no tiene PRs registrados todavía */}
          {prs.filter(p => p.exercise_id === selectedEx).length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--txt2)', padding: '20px 0' }}>
              Sin récords para este ejercicio.
            </div>
          ) : (
            <div style={{ height: '200px' }}>
              <canvas ref={prChartRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs de resumen: estadísticas globales calculadas en cliente ── */}
      {/* Los valores se calculan en cliente a partir de los datos ya cargados; no hay queries adicionales */}
      <div className="g4">

        {/* Total de sesiones de entrenamiento completadas históricamente */}
        <div className="kpi">
          <div className="kpi-lbl">Sesiones totales</div>
          <div className="kpi-val c-gold">{workouts.length}</div>
          <div className="kpi-sub c-muted">completadas</div>
        </div>

        {/* Volumen total histórico, convertido de kg a toneladas para mejor legibilidad con valores grandes */}
        <div className="kpi">
          <div className="kpi-lbl">Volumen total</div>
          <div className="kpi-val">
            {/* Dividir entre 1000 para convertir a toneladas; Math.round elimina decimales */}
            {Math.round(workouts.reduce((s, w) => s + Number(w.total_volume || 0), 0) / 1000).toLocaleString()}
          </div>
          <div className="kpi-sub c-muted">toneladas</div>
        </div>

        {/* Total de series completadas en todas las sesiones históricas */}
        <div className="kpi">
          <div className="kpi-lbl">Series totales</div>
          <div className="kpi-val">
            {workouts.reduce((s, w) => s + Number(w.total_sets || 0), 0)}
          </div>
          <div className="kpi-sub c-muted">completadas</div>
        </div>

        {/* Número de récords personales logrados — cada fila en la tabla personal_records es un récord */}
        <div className="kpi">
          <div className="kpi-lbl">PRs logrados</div>
          <div className="kpi-val c-gold">{prs.length}</div>
          <div className="kpi-sub c-muted">récords personales</div>
        </div>
      </div>
    </div>
  )
}
