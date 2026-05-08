import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { LoginPage } from './pages/LoginPage';
import { StudioPage } from './pages/StudioPage';
import { useSession } from './lib/session';

type Route =
  | { name: 'dashboard' }
  | { name: 'project'; id: string }
  | { name: 'studio' };

export function App() {
  const { session, loading } = useSession();
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });

  if (loading) {
    return (
      <div className="min-h-screen bg-foxhole-bg flex items-center justify-center text-foxhole-muted text-sm font-mono">
        Cargando sesion...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const activeKey = route.name === 'studio' ? 'studio' : 'dashboard';

  return (
    <div className="min-h-screen bg-foxhole-bg flex flex-col">
      <TopBar
        onNavigate={() => setRoute({ name: 'dashboard' })}
        onOpenStudio={() => setRoute({ name: 'studio' })}
        active={activeKey}
      />
      <main className="flex-1 overflow-auto">
        {route.name === 'dashboard' && (
          <DashboardPage onProjectClick={(id) => setRoute({ name: 'project', id })} />
        )}
        {route.name === 'project' && (
          <ProjectDetailPage projectId={route.id} onBack={() => setRoute({ name: 'dashboard' })} />
        )}
        {route.name === 'studio' && (
          <StudioPage onBack={() => setRoute({ name: 'dashboard' })} />
        )}
      </main>
    </div>
  );
}
