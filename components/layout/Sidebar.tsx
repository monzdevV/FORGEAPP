/**
 * Sidebar.tsx — Barra de navegación lateral izquierda de la aplicación.
 *
 * ESTRUCTURA VISUAL (de arriba a abajo):
 *   1. Logo + punto de estado activo (animación pulse)
 *   2. Secciones de navegación: "Entrenos" y "Social"
 *   3. Pie: avatar + nombre + nivel del usuario (clic → logout)
 *
 * El sidebar es un Server Component en el árbol de layout, pero necesita
 * 'use client' para:
 *   - Leer el pathname actual con usePathname() y marcar el ítem activo
 *   - Llamar a supabase.auth.signOut() al hacer clic en el pie de usuario
 *   - Usar useRouter() para redirigir tras el logout
 *
 * ÍTEM ACTIVO: se compara el pathname exacto con href — no admite rutas anidadas.
 * Si en el futuro se añaden subrutas (ej: /biblioteca/ejercicio/123), habría
 * que cambiar a pathname.startsWith(item.href) para que sigan activos.
 */
'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Dumbbell, TrendingUp, BookOpen, User, Users, LogOut, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

/**
 * Definición estática de las secciones de navegación.
 * Cada sección agrupa ítems bajo una etiqueta (ej: "Entrenos", "Social").
 * El tipo LucideIcon permite pasar el componente de icono directamente,
 * que se instancia con <item.icon /> en el render.
 */
const NAV_SECTIONS: { label: string; items: { icon: LucideIcon; label: string; href: string }[] }[] = [
  {
    label: 'Entrenos',
    items: [
      { icon: LayoutDashboard, label: 'Vista general', href: '/overview'    },
      { icon: Dumbbell,        label: 'Sesión activa', href: '/sesion'      },
      { icon: TrendingUp,      label: 'Gráficas',      href: '/graficas'    },
      { icon: BookOpen,        label: 'Biblioteca',    href: '/biblioteca'  },
    ],
  },
  {
    label: 'Social',
    items: [
      { icon: User,  label: 'Perfil',  href: '/perfil'  },
      { icon: Users, label: 'Amigos',  href: '/amigos'  },
    ],
  },
]

/**
 * Padding horizontal unificado para todos los elementos del sidebar.
 * Se usa una constante para garantizar alineación consistente entre
 * etiquetas de sección, ítems de navegación y el pie de usuario.
 */
const PX = '16px'

interface SidebarProps { profile: Profile | null }

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al hacer clic fuera de él
  useEffect(() => {
    if (!showMenu) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showMenu])

  // ╔═ PO-007 ═╗ cierra la sesión del usuario y redirige al login
  // ╚═ linked → PO-006 app/auth/login/page.tsx
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  /**
   * Calcula las iniciales del avatar a partir del nombre completo.
   * Toma la primera letra de cada palabra, convierte a mayúsculas y limita a 2 caracteres.
   * Ejemplo: "Juan García López" → "JG"
   * Fallback '?' si el perfil es null (usuario sin nombre configurado).
   */
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    // Contenedor principal: columna flex con ancho fijo definido en --sidebar-w (210px)
    // zIndex:10 asegura que el sidebar quede sobre el contenido principal al hacer scroll
    <div style={{
      width: 'var(--sidebar-w)', flexShrink: 0, background: 'var(--s1)',
      borderRight: '0.5px solid var(--bdr)', display: 'flex', flexDirection: 'column', zIndex: 10,
    }}>

      {/* ── Secciones de navegación generadas desde NAV_SECTIONS ── */}
      {NAV_SECTIONS.map(section => (
        <div key={section.label}>
          {/* Etiqueta de sección: tipografía de etiqueta (11px, uppercase, tracking amplio) */}
          <div style={{
            padding: `14px ${PX} 5px`,
            fontSize: '10px', letterSpacing: '2.5px',
            textTransform: 'uppercase', color: 'var(--txt2)', fontWeight: 500,
          }}>{section.label}</div>

          {/* Ítems de navegación: gap:1px crea separación mínima entre ítems */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: `0 ${PX}` }}>
            {section.items.map(item => {
              // Comparación exacta con el pathname para marcar el ítem activo
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 8px',
                  fontSize: '13px', fontWeight: 400, textDecoration: 'none',
                  // Ítem activo: texto dorado + fondo semitransparente + borde izquierdo dorado
                  color: active ? 'var(--gold)' : 'var(--txt)',
                  background: active ? 'var(--gold-g)' : 'transparent',
                  borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                  // marginLeft:-2px compensa el borde de 2px para que el texto no se desplace
                  // al activarse: sin esta corrección, el texto se movería 2px a la derecha al hacer clic
                  marginLeft: '-2px',
                  transition: 'all 0.25s',
                }}
                  // Hover en JS porque es difícil condicionar :hover a (active === false) en estilos inline
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt)' }}
                >
                  {/* Icono de Lucide — flexShrink:0 evita que se comprima si el label es largo */}
                  <item.icon size={15} style={{ flexShrink: 0 }} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Pie del sidebar: perfil del usuario + menú de logout ── */}
      <div ref={menuRef} style={{ marginTop: 'auto', borderTop: '0.5px solid var(--bdr)', padding: `8px ${PX}`, position: 'relative' }}>

        {/* Menú de confirmación de cierre de sesión */}
        {showMenu && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: PX,
            right: PX,
            background: 'var(--s1)',
            border: '0.5px solid var(--bdr)',
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
          }}>
            <div style={{
              padding: '10px 12px 8px',
              fontSize: '10px', color: 'var(--txt2)',
              letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500,
              borderBottom: '0.5px solid var(--bdr)',
            }}>
              Cuenta
            </div>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '9px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: '#e05252', textAlign: 'left',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,82,82,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <LogOut size={13} style={{ flexShrink: 0 }} />
              Cerrar sesión
            </button>
            <button
              onClick={() => setShowMenu(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '9px 12px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: 'var(--txt2)', textAlign: 'left',
                borderTop: '0.5px solid var(--bdr)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <X size={13} style={{ flexShrink: 0 }} />
              Cancelar
            </button>
          </div>
        )}

        {/* Botón de usuario — abre el menú en lugar de hacer logout directo */}
        <div
          onClick={() => setShowMenu(prev => !prev)}
          style={{
            display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 8px',
            borderRadius: '3px', cursor: 'pointer', transition: 'background 0.3s',
            background: showMenu ? 'var(--gold-g)' : 'transparent',
          }}
          onMouseEnter={e => { if (!showMenu) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { if (!showMenu) e.currentTarget.style.background = 'transparent' }}
        >
          {/* Avatar circular con iniciales */}
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: 'var(--gold-d)', border: '1.5px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 500, color: 'var(--gold-l)', flexShrink: 0,
          }}>{initials}</div>

          {/* Nombre y nivel */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{profile?.full_name || 'Usuario'}</div>
            <div style={{ fontSize: '10px', color: 'var(--txt2)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Nv. {profile?.level || 1}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
