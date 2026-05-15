'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const TITLES: Record<string, string> = {
  '/overview':   'Vista General',
  '/sesion':     'Sesión Activa',
  '/graficas':   'Gráficas',
  '/biblioteca': 'Biblioteca',
  '/perfil':     'Perfil',
  '/amigos':     'Amigos',
}

export default function Topbar() {
  const pathname = usePathname()
  const title = TITLES[pathname] || 'FORGE'

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
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '0.5px solid var(--bdr)',
          textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        <div style={{ position: 'relative', width: '96px', height: '48px' }}>
          <Image
            src="/forge-icon-transparent.png"
            alt="FORGE"
            fill
            priority
            sizes="96px"
            style={{
              objectFit: 'contain',
              objectPosition: 'center',
              filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.35))',
            }}
          />
        </div>
      </Link>

      {/* Sección de título + botón */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <Link
          href="/overview"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '20px',
            letterSpacing: '2px',
            color: 'var(--txt)',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt)' }}
        >
          {title}
        </Link>

        <Link href="/sesion" className="btn btn-gold">
          <span>+ Nuevo entreno</span>
        </Link>
      </div>
    </div>
  )
}
