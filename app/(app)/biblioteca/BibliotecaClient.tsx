/**
 * BibliotecaClient.tsx — Biblioteca interactiva de ejercicios con filtros.
 *
 * Permite buscar y filtrar ejercicios por:
 *   - Texto libre: nombre o nombre del grupo muscular en español
 *   - Categoría (grupo muscular): botones de selección rápida
 *
 * El filtrado es completamente en cliente (sin peticiones adicionales a BD)
 * porque el listado completo ya se carga en el Server Component.
 * Esto es viable mientras el catálogo sea menor de ~500 ejercicios.
 */
'use client'
import { useState } from 'react'
import type { Exercise } from '@/lib/supabase/types'

// Mapa de clave de BD (muscle_group) a etiqueta legible en español para el usuario
const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pecho', back: 'Espalda', legs: 'Piernas', shoulders: 'Hombros',
  arms: 'Brazos', core: 'Core', cardio: 'Cardio', full_body: 'Full Body',
}

// Lista de categorías disponibles como filtros rápidos
// 'all' es el valor especial que desactiva el filtro de grupo muscular
const CATS = [
  { key: 'all',       label: 'Todos' },
  { key: 'chest',     label: 'Pecho' },
  { key: 'back',      label: 'Espalda' },
  { key: 'legs',      label: 'Piernas' },
  { key: 'shoulders', label: 'Hombros' },
  { key: 'arms',      label: 'Brazos' },
  { key: 'core',      label: 'Core' },
  { key: 'cardio',    label: 'Cardio' },
]

export default function BibliotecaClient({ exercises }: { exercises: Exercise[] }) {
  // Categoría de filtro activa — 'all' significa sin filtro por grupo muscular
  const [cat, setCat] = useState('all')
  // Texto de búsqueda libre para filtrar por nombre o grupo muscular
  const [q, setQ] = useState('')

  /**
   * Lista de ejercicios filtrada que se renderiza en el grid.
   * Aplica ambos filtros simultáneamente:
   *   1. Grupo muscular: si cat !== 'all', solo muestra ejercicios de ese grupo
   *   2. Búsqueda libre: compara texto con nombre del ejercicio Y con el nombre del grupo en español
   * La comparación es insensible a mayúsculas/minúsculas en ambos lados.
   */
  const filtered = exercises.filter(e =>
    (cat === 'all' || e.muscle_group === cat) &&
    (!q || e.name.toLowerCase().includes(q.toLowerCase()) ||
      MUSCLE_LABELS[e.muscle_group]?.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    // Animación de entrada definida como @keyframes panelIn en globals.css
    <div style={{ padding: '22px', animation: 'panelIn 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>

      {/* ── Barra de filtros: campo de texto + botones de categoría ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Campo de búsqueda libre — actualiza q en cada tecla para filtrado en tiempo real */}
        <input
          className="form-input"
          placeholder="Buscar ejercicio..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: '220px', padding: '8px 14px', fontSize: '12px' }}
        />

        {/* Botones de filtro por grupo muscular */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {CATS.map(c => (
            <button
              key={c.key}
              // Botón activo usa estilo dorado sólido; inactivo usa borde semitransparente
              className={`btn btn-sm ${cat === c.key ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => setCat(c.key)}
            >
              {/* El <span> es requerido por .btn-gold para el posicionamiento del efecto ripple */}
              {cat === c.key ? <span>{c.label}</span> : c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de tarjetas de ejercicio ── */}
      {/* auto-fill con minmax: crea tantas columnas como quepan con un mínimo de 260px */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '10px',
      }}>
        {filtered.map(ex => (
          // Tarjeta de ejercicio: borde se intensifica en hover para dar feedback visual
          // cursor:default porque las tarjetas no son clicables (no hay ruta de detalle todavía)
          <div
            key={ex.id}
            style={{
              background: 'var(--s1)',
              border: '0.5px solid var(--bdr)',
              padding: '16px',
              transition: 'border-color 0.3s',
              cursor: 'default',
            }}
            // Hover: se aumenta la opacidad del borde dorado para indicar que el elemento es interactivo
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--bdr2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bdr)')}
          >
            {/* Etiqueta del grupo muscular en dorado — funciona como categoría visual */}
            {/* Usa MUSCLE_LABELS para mostrar texto en español; fallback al valor de BD si no existe */}
            <div style={{
              fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: '6px',
            }}>
              {MUSCLE_LABELS[ex.muscle_group] || ex.muscle_group}
            </div>

            {/* Nombre del ejercicio — elemento principal de la tarjeta */}
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>
              {ex.name}
            </div>

            {/* Descripción del ejercicio — texto secundario con color muted */}
            <div style={{ fontSize: '12px', color: 'var(--txt2)', fontWeight: 300, marginBottom: '10px' }}>
              {ex.description}
            </div>

            {/* ── Chips de etiquetas y equipamiento ── */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>

              {/* Tags: etiquetas genéricas del ejercicio (ej: "compound", "isolation") */}
              {/* El fallback [] evita error si ex.tags es null en la BD */}
              {(ex.tags || []).map(tag => (
                <span key={tag} style={{
                  fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
                  padding: '3px 8px',
                  background: 'var(--s3)',          // Fondo de superficie para diferenciar del card
                  color: 'var(--txt2)',
                  border: '0.5px solid var(--bdr)',
                }}>{tag}</span>
              ))}

              {/* Equipamiento: solo se muestra si el ejercicio requiere material específico */}
              {/* Usa acento dorado para diferenciarse visualmente de los tags genéricos */}
              {ex.equipment && (
                <span style={{
                  fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase',
                  padding: '3px 8px',
                  background: 'var(--gold-a)',      // Fondo dorado muy transparente (10% opacidad)
                  color: 'var(--gold)',
                  border: '0.5px solid var(--bdr2)',
                }}>{ex.equipment}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Estado vacío: ningún ejercicio coincide con los filtros activos */}
      {filtered.length === 0 && (
        <div style={{ color: 'var(--txt2)', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>
          No se encontraron ejercicios
        </div>
      )}
    </div>
  )
}
