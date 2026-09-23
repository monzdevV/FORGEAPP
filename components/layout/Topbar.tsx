/**
 * Topbar.tsx — Barra superior de navegación de la aplicación.
 *
 * ESTRUCTURA (de izquierda a derecha):
 *   1. Logo de FORGE (ancho fijo = sidebar) con link a /overview
 *   2. Título dinámico de la página actual
 *   3. Timer de sesión activa (si existe una sesión en curso y no se está en /sesion)
 *   4. Botón "+ Nuevo entreno" con link a /sesion
 *
 * TIMER DE SESIÓN:
 *   Se suscribe al store de sesión con useSyncExternalStore. El timer vive en
 *   el módulo singleton (useSessionStore) y sigue corriendo aunque el usuario
 *   navegue fuera de /sesion. Cuando hay sesión activa y el usuario está en
 *   otra página, el pill dorado muestra el tiempo acumulado y actúa como
 *   link de regreso a la sesión.
 */
'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { getSession, subscribeSession } from '@/hooks/useSessionStore'

const TITLES: Record<string, string> = {
  '/overview':   'Vista General',
  '/sesion':     'Sesión Activa',
  '/graficas':   'Gráficas',
  '/biblioteca': 'Biblioteca',
  '/perfil':     'Perfil',
  '/amigos':     'Amigos',
}

/** Formatea un número a 2 dígitos con padding de cero (ej: 5 → "05") */
function pad2(n: number) { return String(n).padStart(2, '0') }

/**
 * Convierte segundos totales a formato HH:MM:SS.
 * Idéntica a la de sesion/page.tsx — se mantiene local para no crear
 * una dependencia de módulo innecesaria entre componentes de layout.
 */
function fmtSeconds(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
}

// ╔═ GE-011 ═╗ muestra el timer de sesión activa en la barra superior
// ╚═ linked → GE-010 hooks/useSessionStore.ts · PO-011 hooks/useSessionStore.ts
export default function Topbar() {
  const pathname = usePathname()
  const title    = TITLES[pathname] || 'FORGE'

  // Suscripción al store — el store notifica cada segundo cuando el timer corre,
  // lo que provoca el re-render del Topbar para actualizar el tiempo mostrado
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)

  return (
    <div style={{
      height: 'var(--topbar-h)',
      borderBottom: '0.5px solid var(--bdr)',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      background: 'var(--blk)',
    }}>
      {/* Sección del logo — ancho igual al sidebar para alineación perfecta */}
      <Link
        href="/overview"
        style={{
          width: 'var(--sidebar-w)', flexShrink: 0, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRight: '0.5px solid var(--bdr)', textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        <div style={{ position: 'relative', width: '96px', height: '48px' }}>
          <Image
            src="/forge-icon-transparent.png"
            alt="FORGE"
            fill priority sizes="96px"
            style={{ objectFit: 'contain', objectPosition: 'center', filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.35))' }}
          />
        </div>
      </Link>

      {/* Sección central + derecha: título, timer activo y botón */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Link
          href="/overview"
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '20px', letterSpacing: '2px', color: 'var(--txt)', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt)' }}
        >
          {title}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Timer pill — solo se muestra cuando hay sesión activa y el usuario NO está en /sesion.
              El punto de color indica si el timer está corriendo (dorado) o pausado (gris). */}
          {session && pathname !== '/sesion' && (
            <Link
              href="/sesion"
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                fontFamily: 'Bebas Neue, sans-serif', fontSize: '15px', letterSpacing: '2px',
                color: session.timer_running ? 'var(--gold)' : 'var(--txt2)',
                border: `0.5px solid ${session.timer_running ? 'rgba(201,168,76,0.35)' : 'var(--bdr2)'}`,
                padding: '4px 12px', textDecoration: 'none', transition: 'border-color 0.2s',
              }}
            >
              {/* Indicador de estado: dorado = corriendo, gris = pausado */}
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: session.timer_running ? 'var(--gold)' : 'var(--txt3)',
              }} />
              {fmtSeconds(session.elapsed_seconds)}
            </Link>
          )}

          <Link href="/sesion" className="btn btn-gold">
            <span>+ Nuevo entreno</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
