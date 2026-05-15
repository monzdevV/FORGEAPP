# FORGE — Entrenamiento de Élite

App de tracking de gimnasio construida con Next.js 15 + Supabase.

## Stack

- **Next.js 15** (App Router)
- **Supabase** (Auth + PostgreSQL + RLS)
- **TypeScript**
- **Chart.js** (gráficas de progresión)

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/overview` | Dashboard con KPIs, últimos entrenos y PRs |
| `/sesion` | Sesión activa — ejercicios, series, timers, descanso |
| `/graficas` | Gráficas de volumen y progresión por ejercicio |
| `/biblioteca` | Catálogo de 26 ejercicios globales con filtros |
| `/perfil` | Editar perfil, ver logros desbloqueados |
| `/amigos` | Amigos, solicitudes, actividad y clasificación |

## Base de datos (Supabase)

Tablas: `profiles`, `exercises`, `workouts`, `workout_exercises`, `workout_sets`, `personal_records`, `achievements`, `user_achievements`, `friendships`, `activity_feed`

Todas las tablas tienen **Row Level Security** activado.

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Arrancar
npm run dev
```

## Deploy

Vercel + Supabase. Añade las variables de entorno en el dashboard de Vercel.
