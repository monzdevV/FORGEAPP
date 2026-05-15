/**
 * types.ts — Contrato completo de tipos TypeScript para la BD de Supabase.
 * Todas las entidades del proyecto derivan de esta fuente de verdad.
 * Nunca importar tipos directamente de Supabase; usar los alias del final del archivo.
 */

// Tipo genérico para columnas JSON de Supabase (permite anidación arbitraria)
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ── Enumeraciones de dominio ──────────────────────────────────────────────────

// Grupos musculares disponibles en la biblioteca de ejercicios
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'full_body'

// Categorías de ejercicio que determinan cómo se registra el esfuerzo
export type ExerciseCategory = 'strength' | 'cardio' | 'functional' | 'mobility'

// Estado del ciclo de vida de un entrenamiento
export type WorkoutStatus = 'in_progress' | 'completed' | 'cancelled'

// Estados posibles de una relación de amistad entre dos usuarios
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked'

// Niveles de rareza de los logros desbloqueables
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'legendary'

// Tipos de eventos que se publican en el feed de actividad social
export type ActivityType = 'workout_completed' | 'pr_achieved' | 'achievement_unlocked' | 'friend_added' | 'streak_milestone'

// ── Esquema completo de la base de datos ─────────────────────────────────────
// Estructura: Database.public.Tables.<tabla>.Row | Insert | Update
// - Row: forma completa de una fila leída de la BD
// - Insert: campos requeridos al insertar (excluye id y timestamps autogenerados)
// - Update: todos los campos son opcionales para actualizaciones parciales

export interface Database {
  public: {
    Tables: {

      // Perfil extendido del usuario, complementa la tabla auth.users de Supabase
      profiles: {
        Row: {
          id: string                      // UUID sincronizado con auth.users.id
          full_name: string
          username: string | null         // Identificador público único (@handle)
          avatar_url: string | null       // URL en Supabase Storage
          bio: string | null
          goal: 'strength' | 'muscle' | 'fat_loss' | 'endurance' | null
          experience: 'beginner' | 'intermediate' | 'advanced' | null
          banner_theme: string | null
          banner_image_url: string | null
          height_cm: number | null
          weight_kg: number | null
          level: number | null            // Nivel calculado en base a XP acumulada
          xp: number | null              // Puntos de experiencia totales
          total_workouts: number | null  // Contador desnormalizado para rendimiento
          current_streak: number | null  // Días consecutivos de actividad
          best_streak: number | null     // Máximo histórico de racha
          last_workout_at: string | null // ISO 8601 — usado para calcular racha activa
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; full_name: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }

      // Biblioteca de ejercicios, puede ser global (is_global=true) o creado por el usuario
      exercises: {
        Row: {
          id: string
          user_id: string | null   // null cuando el ejercicio es global/predefinido
          name: string
          slug: string             // Versión URL-safe del nombre para rutas futuras
          muscle_group: MuscleGroup
          category: ExerciseCategory | null
          equipment: string | null // Equipamiento necesario (barra, mancuerna, máquina…)
          description: string | null
          tags: string[] | null    // Etiquetas adicionales para filtrado
          is_global: boolean | null
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['exercises']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['exercises']['Row']>
      }

      // Sesión de entrenamiento completa — cabecera que agrupa ejercicios y series
      workouts: {
        Row: {
          id: string
          user_id: string
          name: string
          notes: string | null
          status: WorkoutStatus
          started_at: string
          finished_at: string | null
          duration_seconds: number | null   // Calculado al finalizar la sesión
          total_volume: number | null       // Suma de (peso × reps) de todas las series completadas
          total_sets: number | null         // Número de series completadas en la sesión
          prs_count: number | null          // Récords personales logrados en esta sesión
          created_at: string | null
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['workouts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['workouts']['Row']>
      }

      // Línea de ejercicio dentro de un entrenamiento (tabla intermedia workout ↔ exercise)
      workout_exercises: {
        Row: {
          id: string
          workout_id: string
          exercise_id: string
          order_index: number  // Posición del ejercicio en la sesión (0-based)
          notes: string | null
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['workout_exercises']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['workout_exercises']['Row']>
      }

      // Serie individual dentro de un ejercicio de sesión
      workout_sets: {
        Row: {
          id: string
          workout_exercise_id: string
          set_number: number           // Número de serie dentro del ejercicio (1-based)
          weight: number | null        // Peso en kg; null si es ejercicio con peso corporal
          reps: number | null
          rpe: number | null           // Rate of Perceived Exertion: escala 6–10
          is_completed: boolean | null
          is_pr: boolean | null        // true si esta serie superó el récord previo
          volume: number | null        // Calculado en BD: weight * reps
          rest_seconds: number | null  // Descanso tomado antes de la siguiente serie
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['workout_sets']['Row'], 'id' | 'created_at' | 'volume'>
        Update: Partial<Database['public']['Tables']['workout_sets']['Row']>
      }

      // Récord personal: máximo histórico de un usuario en un ejercicio y tipo concreto
      personal_records: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          workout_id: string | null   // Sesión donde se consiguió el récord
          set_id: string | null       // Serie exacta que estableció el récord
          record_type: 'weight' | 'volume' | 'reps' | 'endurance'
          value: number               // Valor del récord (kg, kg·reps, reps, segundos)
          reps: number | null         // Solo relevante para record_type='weight'
          achieved_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['personal_records']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['personal_records']['Row']>
      }

      // Definición de logros desbloqueables (catálogo estático gestionado en BD)
      achievements: {
        Row: {
          id: string
          code: string              // Identificador único legible (ej: 'first_workout')
          name: string
          description: string
          tier: AchievementTier
          icon: string | null       // Emoji o código de icono
          criteria_type: string     // Campo o evento evaluado para desbloquear
          criteria_value: number    // Umbral numérico que activa el logro
          xp_reward: number | null  // XP otorgada al desbloquearlo
          is_active: boolean | null
        }
        Insert: Omit<Database['public']['Tables']['achievements']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['achievements']['Row']>
      }

      // Relación usuario ↔ logro desbloqueado (muchos a muchos)
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          unlocked_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['user_achievements']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['user_achievements']['Row']>
      }

      // Relación de amistad bidireccional entre dos usuarios
      // La dirección (requester → receiver) determina quién envió la solicitud
      friendships: {
        Row: {
          id: string
          requester_id: string     // Usuario que envió la solicitud
          receiver_id: string      // Usuario que la recibe
          status: FriendshipStatus
          created_at: string | null
          accepted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['friendships']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['friendships']['Row']>
      }

      // Eventos públicos/privados generados por acciones del usuario (feed social)
      activity_feed: {
        Row: {
          id: string
          user_id: string
          type: ActivityType
          reference_id: string | null  // ID del objeto relacionado (workout_id, achievement_id…)
          message: string | null       // Texto legible del evento, generado en el servidor
          metadata: Json | null        // Datos adicionales específicos del tipo de evento
          visibility: 'public' | 'friends' | 'private' | null
          created_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['activity_feed']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_feed']['Row']>
      }
    }
  }
}

// ── Alias de conveniencia ─────────────────────────────────────────────────────
// Usar estos tipos en todo el código en lugar de acceder a Database['public']['Tables'][…]['Row']
export type Profile         = Database['public']['Tables']['profiles']['Row']
export type Exercise        = Database['public']['Tables']['exercises']['Row']
export type Workout         = Database['public']['Tables']['workouts']['Row']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type WorkoutSet      = Database['public']['Tables']['workout_sets']['Row']
export type PersonalRecord  = Database['public']['Tables']['personal_records']['Row']
export type Achievement     = Database['public']['Tables']['achievements']['Row']
export type Friendship      = Database['public']['Tables']['friendships']['Row']
export type ActivityFeed    = Database['public']['Tables']['activity_feed']['Row']
