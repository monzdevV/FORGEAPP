/**
 * page.tsx — Página de biblioteca de ejercicios (Server Component).
 *
 * Carga todos los ejercicios ordenados alfabéticamente y los pasa
 * al Client Component para filtrado interactivo en el cliente.
 * No requiere autenticación de usuario porque la biblioteca es global.
 */
import { createClient } from '@/lib/supabase/server'
import BibliotecaClient from './BibliotecaClient'

// ╔═ GE-006 ═╗ carga el catálogo completo de ejercicios ordenado por nombre
// ╚═ linked → none
export default async function BibliotecaPage() {
  const supabase = await createClient()

  // Cargar todos los ejercicios (globales y del usuario) ordenados por nombre
  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .order('name')

  return <BibliotecaClient exercises={exercises || []} />
}
