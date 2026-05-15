'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // ╔═ PO-005 ═╗ inicia el flujo OAuth con Google y redirige al proveedor
  // ╚═ linked → GE-001 app/auth/callback/route.ts
  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  // ╔═ PO-006 ═╗ autentica al usuario con email/contraseña o crea una cuenta nueva
  // ╚═ linked → PO-007 components/layout/Sidebar.tsx
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
          return
        }

        router.push('/overview')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          setError(error.message)
          return
        }

        router.push('/overview')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at center, #11100D 0%, #060606 48%, #020202 100%)',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* FONDO GRID */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(201,168,76,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.04) 1px,transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage:
            'radial-gradient(ellipse 85% 75% at 50% 50%,black 10%,transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 75% at 50% 50%,black 10%,transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* GLOWS DE FONDO */}
      <div
        style={{
          position: 'absolute',
          width: '760px',
          height: '620px',
          background:
            'radial-gradient(ellipse,rgba(201,168,76,0.09) 0%,transparent 66%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '520px',
          height: '420px',
          background:
            'radial-gradient(ellipse,rgba(201,168,76,0.1) 0%,transparent 65%)',
          top: '-140px',
          left: '-140px',
          borderRadius: '50%',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: '440px',
          height: '360px',
          background:
            'radial-gradient(ellipse,rgba(201,168,76,0.08) 0%,transparent 65%)',
          bottom: '-100px',
          right: '-90px',
          borderRadius: '50%',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      {/* ESQUINAS DECORATIVAS */}
      <div style={{ position: 'absolute', top: '32px', left: '32px', pointerEvents: 'none' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderTop: '1px solid rgba(201,168,76,0.35)',
            borderLeft: '1px solid rgba(201,168,76,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            width: '50px',
            height: '50px',
            borderTop: '0.5px solid rgba(201,168,76,0.15)',
            borderLeft: '0.5px solid rgba(201,168,76,0.15)',
          }}
        />
      </div>

      <div style={{ position: 'absolute', top: '32px', right: '32px', pointerEvents: 'none' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderTop: '1px solid rgba(201,168,76,0.35)',
            borderRight: '1px solid rgba(201,168,76,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '50px',
            height: '50px',
            borderTop: '0.5px solid rgba(201,168,76,0.15)',
            borderRight: '0.5px solid rgba(201,168,76,0.15)',
          }}
        />
      </div>

      <div style={{ position: 'absolute', bottom: '32px', left: '32px', pointerEvents: 'none' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderBottom: '1px solid rgba(201,168,76,0.35)',
            borderLeft: '1px solid rgba(201,168,76,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            width: '50px',
            height: '50px',
            borderBottom: '0.5px solid rgba(201,168,76,0.15)',
            borderLeft: '0.5px solid rgba(201,168,76,0.15)',
          }}
        />
      </div>

      <div style={{ position: 'absolute', bottom: '32px', right: '32px', pointerEvents: 'none' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderBottom: '1px solid rgba(201,168,76,0.35)',
            borderRight: '1px solid rgba(201,168,76,0.35)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '50px',
            height: '50px',
            borderBottom: '0.5px solid rgba(201,168,76,0.15)',
            borderRight: '0.5px solid rgba(201,168,76,0.15)',
          }}
        />
      </div>

      {/* BORDES EXTERIORES */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(to right, transparent, rgba(201,168,76,0.4) 20%, rgba(201,168,76,0.4) 80%, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(to right, transparent, rgba(201,168,76,0.4) 20%, rgba(201,168,76,0.4) 80%, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '1px',
          background:
            'linear-gradient(to bottom, transparent, rgba(201,168,76,0.3) 20%, rgba(201,168,76,0.3) 80%, transparent)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '1px',
          background:
            'linear-gradient(to bottom, transparent, rgba(201,168,76,0.3) 20%, rgba(201,168,76,0.3) 80%, transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* TEXTOS LATERALES */}
      <div
        style={{
          position: 'absolute',
          left: '20px',
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          fontSize: '9px',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          color: 'rgba(201,168,76,0.18)',
          fontFamily: "'Bebas Neue', sans-serif",
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        FORGE · ELITE TRAINING · EST. 2025
      </div>

      <div
        style={{
          position: 'absolute',
          right: '20px',
          top: '50%',
          transform: 'translateY(-50%) rotate(90deg)',
          fontSize: '9px',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          color: 'rgba(201,168,76,0.18)',
          fontFamily: "'Bebas Neue', sans-serif",
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        PERFORMANCE · STRENGTH · DISCIPLINE
      </div>

      {/* DIAMANTES LATERALES */}
      <div
        style={{
          position: 'absolute',
          left: '48px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.6,
            marginBottom: '24px',
          }}
        />
        <div
          style={{
            width: '5px',
            height: '5px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.3,
            marginLeft: '1.5px',
            marginBottom: '24px',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.6,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          right: '48px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.6,
            marginBottom: '24px',
          }}
        />
        <div
          style={{
            width: '5px',
            height: '5px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.3,
            marginLeft: '1.5px',
            marginBottom: '24px',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            background: '#C9A84C',
            transform: 'rotate(45deg)',
            opacity: 0.6,
          }}
        />
      </div>

      {/* PUNTOS SUPERIORES */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '16px',
          pointerEvents: 'none',
        }}
      >
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: `rgba(201,168,76,${
                0.08 + (i === 3 ? 0.3 : i === 2 || i === 4 ? 0.15 : 0.05)
              })`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '16px',
          pointerEvents: 'none',
        }}
      >
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: `rgba(201,168,76,${
                0.08 + (i === 3 ? 0.3 : i === 2 || i === 4 ? 0.15 : 0.05)
              })`,
            }}
          />
        ))}
      </div>

      {/* CONTENIDO CENTRAL */}
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* LOGO INTEGRADO */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 'min(82vw, 345px)',
              height: '170px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              isolation: 'isolate',
            }}
          >
            {/* Aura detrás del logo */}
            <div
              style={{
                position: 'absolute',
                inset: '20px 12px 0px',
                background:
                  'radial-gradient(ellipse at center, rgba(201,168,76,0.26) 0%, rgba(201,168,76,0.1) 36%, transparent 72%)',
                filter: 'blur(34px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Sombra para que no parezca pegado */}
            <div
              style={{
                position: 'absolute',
                bottom: '14px',
                left: '18%',
                right: '18%',
                height: '20px',
                background: 'rgba(0,0,0,0.7)',
                filter: 'blur(18px)',
                borderRadius: '50%',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            <Image
              src="/forge-logo-removebg-preview.png"
              alt="FORGE"
              fill
              priority
              sizes="(max-width: 480px) 82vw, 345px"
              style={{
                objectFit: 'contain',
                objectPosition: 'center',
                zIndex: 1,

                /*
                  Esto ayuda a ocultar el fondo negro del PNG.
                  Lo ideal sigue siendo usar un PNG transparente.
                */
                mixBlendMode: 'screen',
                }}
            />
          </div>

          
        </div>

        {/* SEPARADOR */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '0.5px',
              background:
                'linear-gradient(to right, transparent, rgba(201,168,76,0.4))',
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '4px',
                height: '4px',
                background: 'rgba(201,168,76,0.4)',
                transform: 'rotate(45deg)',
              }}
            />
            <div
              style={{
                width: '6px',
                height: '6px',
                background: '#C9A84C',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 8px rgba(201,168,76,0.6)',
              }}
            />
            <div
              style={{
                width: '4px',
                height: '4px',
                background: 'rgba(201,168,76,0.4)',
                transform: 'rotate(45deg)',
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              height: '0.5px',
              background:
                'linear-gradient(to left, transparent, rgba(201,168,76,0.4))',
            }}
          />
        </div>

        {/* CARD FORMULARIO */}
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(14,14,13,0.96) 0%, rgba(7,7,7,0.98) 100%)',
            border: '0.5px solid rgba(201,168,76,0.24)',
            backdropFilter: 'blur(30px)',
            padding: '32px 32px 36px',
            position: 'relative',
            boxShadow:
              '0 0 80px rgba(201,168,76,0.07), 0 40px 80px rgba(0,0,0,0.75), inset 0 0 0 0.5px rgba(201,168,76,0.05)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '1px',
              background:
                'linear-gradient(to right, transparent, #C9A84C, transparent)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: '-1px',
              left: '-1px',
              width: '28px',
              height: '28px',
              borderTop: '2px solid #C9A84C',
              borderLeft: '2px solid #C9A84C',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-1px',
              right: '-1px',
              width: '28px',
              height: '28px',
              borderTop: '2px solid #C9A84C',
              borderRight: '2px solid #C9A84C',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-1px',
              left: '-1px',
              width: '28px',
              height: '28px',
              borderBottom: '2px solid #C9A84C',
              borderLeft: '2px solid #C9A84C',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '28px',
              height: '28px',
              borderBottom: '2px solid #C9A84C',
              borderRight: '2px solid #C9A84C',
            }}
          />

          {/* TABS */}
          <div
            style={{
              display: 'flex',
              borderBottom: '0.5px solid rgba(201,168,76,0.12)',
              marginBottom: '28px',
            }}
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '2.5px',
                  textTransform: 'uppercase',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all .25s',
                  borderBottom:
                    mode === m
                      ? '1.5px solid #C9A84C'
                      : '1.5px solid transparent',
                  color: mode === m ? '#C9A84C' : '#4A4745',
                }}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* FORMULARIO */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '9px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: '#5A5653',
                  marginBottom: '8px',
                }}
              >
                Email
              </label>

              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(16,16,16,0.9)',
                  border: '0.5px solid rgba(201,168,76,0.18)',
                  color: '#F5F2EE',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  padding: '13px 16px',
                  outline: 'none',
                  transition: 'border-color .3s, box-shadow .3s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C9A84C'
                  e.currentTarget.style.boxShadow =
                    '0 0 0 3px rgba(201,168,76,0.06)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.18)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '9px',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  color: '#5A5653',
                  marginBottom: '8px',
                }}
              >
                Contraseña
              </label>

              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(16,16,16,0.9)',
                  border: '0.5px solid rgba(201,168,76,0.18)',
                  color: '#F5F2EE',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  padding: '13px 16px',
                  outline: 'none',
                  transition: 'border-color .3s, box-shadow .3s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C9A84C'
                  e.currentTarget.style.boxShadow =
                    '0 0 0 3px rgba(201,168,76,0.06)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.18)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  color: '#E24B4A',
                  fontSize: '12px',
                  marginBottom: '16px',
                  padding: '10px 14px',
                  background: 'rgba(226,75,74,0.07)',
                  border: '0.5px solid rgba(226,75,74,0.2)',
                  borderLeft: '2px solid #E24B4A',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 20px',
                background: loading
                  ? 'rgba(201,168,76,0.5)'
                  : 'linear-gradient(105deg, #9A7020 0%, #C9A84C 30%, #E8C96B 55%, #C9A84C 80%, #9A7020 100%)',
                color: '#060606',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '3.5px',
                textTransform: 'uppercase',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'box-shadow .3s, transform .15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow =
                    '0 0 30px rgba(201,168,76,0.45), 0 8px 24px rgba(0,0,0,0.4)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          {/* SEPARADOR GOOGLE */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '22px 0 16px',
            }}
          >
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(201,168,76,0.12)' }} />
            <span
              style={{
                fontSize: '9px',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                color: 'rgba(201,168,76,0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              O continúa con
            </span>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(201,168,76,0.12)' }} />
          </div>

          {/* BOTÓN GOOGLE */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: 'rgba(16,16,16,0.9)',
              border: '0.5px solid rgba(201,168,76,0.22)',
              color: '#F5F2EE',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'border-color .25s, box-shadow .25s',
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(201,168,76,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(201,168,76,0.22)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Icono oficial de Google */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </button>

          {/* FOOTER CARD */}
          <div
            style={{
              marginTop: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                flex: 1,
                height: '0.5px',
                background: 'rgba(201,168,76,0.1)',
              }}
            />

            <span
              style={{
                fontSize: '9px',
                letterSpacing: '2px',
                color: 'rgba(201,168,76,0.25)',
                textTransform: 'uppercase',
              }}
            >
              Forge Elite
            </span>

            <div
              style={{
                flex: 1,
                height: '0.5px',
                background: 'rgba(201,168,76,0.1)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}