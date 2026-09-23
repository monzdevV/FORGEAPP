# FORGE — Elite Gym Tracker

Tracker de gimnasio de élite. Next.js 15 App Router con Server/Client Components, Supabase como backend completo (Auth + DB) y un store singleton de sesión activa. El flujo principal es: login → dashboard → iniciar sesión de entrenamiento → registrar series en tiempo real → finalizar y persistir.

---

## Comandos

```bash
npm run dev      # desarrollo en localhost:3000
npm run build    # compilar para producción
npm run start    # servidor de producción (requiere build previo)
```

Variables de entorno necesarias en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Restricciones duras

- **Nunca** importar tipos desde Supabase directamente — siempre desde `@/lib/supabase/types`
- **Nunca** usar `lib/supabase/server.ts` en componentes `'use client'` ni viceversa
- **Nunca** instalar Chart.js como dependencia npm — se carga desde CDN en `useEffect`
- **No usar** Tailwind, Context API ni Zustand — el proyecto no los tiene
- **No tocar** `styles/globals.css` sin revisar las clases que ya existen — muchas páginas dependen de ellas
- `removeExercise()` del store solo borra en memoria — los datos ya persistidos en BD quedan intactos

---

## Estructura de archivos

```
app/
  page.tsx                  → redirect: auth→/overview, no auth→/auth/login
  layout.tsx                → <html><body> + globals.css + metadata
  auth/login/page.tsx       → Login/Register ('use client', tabs, supabase auth)
  auth/callback/route.ts    → OAuth code exchange → redirect /overview
  (app)/layout.tsx          → guard sesión + carga Sidebar/AppShell
  (app)/overview/page.tsx   → Server, Promise.all(perfil + workouts + prs)
  (app)/sesion/page.tsx     → 'use client', useSessionStore + timers + toast
  (app)/graficas/page.tsx   → Server → GraficasClient.tsx (Chart.js CDN)
  (app)/biblioteca/page.tsx → Server → BibliotecaClient.tsx (filtros cliente)
  (app)/perfil/page.tsx     → Server → PerfilClient.tsx (edición + logros)
  (app)/amigos/page.tsx     → Server → AmigosClient.tsx (solicitudes + feed)
components/layout/
  Sidebar.tsx   → 'use client' | props: profile:Profile|null
  Topbar.tsx    → 'use client' | props: pathname:string
  AppShell.tsx  → 'use client' | usePathname() → pasa pathname a Topbar
hooks/useSessionStore.ts    → singleton pub/sub, useSyncExternalStore
lib/supabase/
  client.ts     → createBrowserClient  ('use client' únicamente)
  server.ts     → createServerClient async (Server Components únicamente)
  middleware.ts → updateSession: refresca token + protege rutas
  types.ts      → ÚNICA fuente de verdad de tipos TS
styles/globals.css          → design system completo (228 líneas)
```

**Patrón estándar:** `page.tsx` (server, carga datos) → `XxxClient.tsx` ('use client', UI interactiva)
**Middleware:** no auth + ruta protegida → `/auth/login` · auth en login → `/overview`
**Rutas protegidas:** `/overview` `/sesion` `/graficas` `/biblioteca` `/perfil` `/amigos`

---

## Design system (globals.css)

```css
--gold:#C9A84C  --gold-l:#E8C96B  --gold-d:#7A6030
--gold-a:rgba(201,168,76,.10)  --gold-g:rgba(201,168,76,.05)
--blk:#060606  --s1:#0E0E0E  --s2:#141414  --s3:#1A1A1A  --s4:#222222
--txt:#F5F2EE  --txt2:#A8A39D  --txt3:#706D6A
--bdr:rgba(201,168,76,.10)  --bdr2:rgba(201,168,76,.24)  --bdr3:rgba(201,168,76,.44)
--red:#E24B4A  --red-a:rgba(226,75,74,.12)
--grn:#3B9E75  --grn-a:rgba(59,158,117,.12)
--sidebar-w:210px  --topbar-h:54px
```

**Fuentes:** `Bebas Neue` (display/números) · `DM Sans` (UI) — Google Fonts en globals.css
**Clases disponibles:** `.g2` `.g4` · `.card` `.card-hd` `.card-title` · `.kpi` `.kpi-lbl` `.kpi-val` `.kpi-sub` · `.btn` `.btn-gold` `.btn-outline` `.btn-sm` `.btn-full` · `.form-input` · `.c-gold` `.c-grn` `.c-red` `.c-muted` · `.font-display` `.label-sm`
**Animaciones:** `panelIn` (entrada página) · `fadeUp` (toast) · `pulse` (punto dorado sidebar)

---

## Base de datos — Supabase

| Tabla | Campos principales |
|---|---|
| `profiles` | `id` `full_name` `username` `avatar_url` `bio` `goal`(strength/muscle/fat_loss/endurance) `experience`(beginner/intermediate/advanced) `level` `xp` `total_workouts` `current_streak` `best_streak` `last_workout_at` `height_cm` `weight_kg` `banner_theme` `banner_image_url` |
| `exercises` | `id` `user_id`(null=global) `name` `slug` `muscle_group`(chest/back/legs/shoulders/arms/core/cardio/full_body) `category`(strength/cardio/functional/mobility) `equipment` `tags` `is_global` |
| `workouts` | `id` `user_id` `name` `status`(in_progress/completed/cancelled) `started_at` `finished_at` `duration_seconds` `total_volume` `total_sets` `prs_count` |
| `workout_exercises` | `id` `workout_id` `exercise_id` `order_index`(0-based) |
| `workout_sets` | `id` `workout_exercise_id` `set_number` `weight` `reps` `rpe`(6-10) `is_completed` `is_pr` `volume`(calculado BD) `rest_seconds` |
| `personal_records` | `id` `user_id` `exercise_id` `record_type`(weight/volume/reps/endurance) `value` `achieved_at` |
| `achievements` | `id` `code` `name` `tier`(bronze/silver/gold/legendary) `criteria_type` `criteria_value` `xp_reward` |
| `user_achievements` | `id` `user_id` `achievement_id` `unlocked_at` |
| `friendships` | `id` `requester_id` `receiver_id` `status`(pending/accepted/rejected/blocked) |
| `activity_feed` | `id` `user_id` `type`(workout_completed/pr_achieved/achievement_unlocked/friend_added/streak_milestone) `reference_id` `message` `metadata` `visibility`(public/friends/private) |

**Alias** (desde `@/lib/supabase/types`): `Profile` `Exercise` `Workout` `WorkoutExercise` `WorkoutSet` `PersonalRecord` `Achievement` `Friendship` `ActivityFeed`

---

## useSessionStore — API

Store singleton en memoria. Nunca usar Context ni Zustand para la sesión activa.

```ts
const session = useSyncExternalStore(subscribeSession, getSession, getSession)
// Tipos: ActiveSession { workout_id, name, started_at:Date, exercises:SessionExercise[] }
// SessionExercise: { local_id:'ex_{ts}', workout_exercise_id?, exercise_id, name, muscle, sets }
// SessionSet: { weight:string, reps:string, rpe:string, is_completed, is_pr, id? }
```

| Función | Persiste en BD | Notas |
|---|---|---|
| `startSession(userId, name?)` | ✅ workout | Inicializa estado local |
| `addExerciseToSession(id, name, muscle)` | ✅ workout_exercise | Añade con 1 serie vacía |
| `addSetToExercise(local_id)` | ❌ | Solo memoria |
| `updateSet(local_id, idx, field, value)` | ❌ | Solo memoria |
| `completeSet(local_id, idx)` | ✅ workout_sets (si pasa a true) | Toggle completado |
| `finishSession()` | ✅ workout + activity_feed | RPC increment_workout_count (try/catch) |
| `removeExercise(local_id)` | ❌ | No borra datos ya guardados |

---

## Problemas conocidos / trampas frecuentes

- `ws.max_row` de openpyxl en read-only devuelve `None` en muchos archivos — no usarlo para contar filas
- Chart.js: destruir la instancia anterior antes de redibujar (`chartInstance.current?.destroy()`), no soporta múltiples instancias en el mismo canvas
- `completeSet()` usa `onMouseDown` en el dropdown de búsqueda (no `onClick`) para que se dispare antes del `onBlur` del input
- El join bidireccional de `friendships` devuelve `requester` y `receiver` como objetos anidados — hacer cast explícito: `(f.requester as { id: string }).id`
- `createClient()` de `lib/supabase/server.ts` es `async` — siempre `await createClient()`
- Las cookies en Server Components son de solo lectura — el `try/catch` en `setAll` es intencional, no eliminarlo
- `total_volume` se calcula al finalizar la sesión (`finishSession()`), no en tiempo real en BD
- Imágenes del logo: usar siempre `/forge-logo-removebg-preview.png` con `mixBlendMode:'screen'` para ocultar el fondo oscuro del PNG
- `increment_workout_count` es una RPC de Supabase opcional — si no existe, el error se silencia con try/catch
- El middleware excluye `_next/static`, `_next/image` y extensiones de imagen del matcher — no añadir rutas estáticas ahí
