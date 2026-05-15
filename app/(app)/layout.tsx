import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'

// ╔═ GE-009 ═╗ verifica autenticación y carga el perfil para el layout protegido
// ╚═ linked → PO-007 components/layout/Sidebar.tsx
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar profile={profile} />
        <AppShell>{children}</AppShell>
      </div>
    </div>
  )
}
