import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

type Route = { name: 'dashboard' } | { name: 'project'; id: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });

  return (
    <div className="min-h-screen bg-foxhole-bg flex flex-col">
      <TopBar onNavigate={() => setRoute({ name: 'dashboard' })} />
      <main className="flex-1 overflow-auto">
        {route.name === 'dashboard' && (
          <DashboardPage onProjectClick={(id) => setRoute({ name: 'project', id })} />
        )}
        {route.name === 'project' && (
          <ProjectDetailPage projectId={route.id} onBack={() => setRoute({ name: 'dashboard' })} />
        )}
      </main>
    </div>
  );
}
