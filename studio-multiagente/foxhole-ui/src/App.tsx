import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { LoginPage } from './pages/LoginPage';
import { StudioPage } from './pages/StudioPage';
import { NewProjectWizardPage } from './pages/NewProjectWizardPage';
import { BillingPage } from './pages/BillingPage';
import { SiteVisitActsPage } from './pages/SiteVisitActsPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { ClientUpdatesPage } from './pages/ClientUpdatesPage';
import { useSession } from './lib/session';

type Route =
  | { name: 'dashboard' }
  | { name: 'project'; id: string }
  | { name: 'studio' }
  | { name: 'wizard' }
  | { name: 'billing' }
  | { name: 'acts' }
  | { name: 'incidents' }
  | { name: 'client-updates' };

export function App() {
  const { session, loading } = useSession();
  const [route, setRoute] = useState<Route>(() => {
    // Detectar #billing en URL al cargar (compatible con Stripe success_url y deep links)
    if (typeof window !== 'undefined' && window.location.hash === '#billing') {
      return { name: 'billing' };
    }
    return { name: 'dashboard' };
  });

  // Sincronizar hash con la ruta (back/forward del navegador)
  useEffect(() => {
    const handler = () => {
      if (window.location.hash === '#billing' && route.name !== 'billing') {
        setRoute({ name: 'billing' });
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [route.name]);

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

  const activeKey: 'dashboard' | 'studio' | 'billing' | 'acts' | 'incidents' | 'client-updates' =
    route.name === 'studio'
      ? 'studio'
      : route.name === 'billing'
        ? 'billing'
        : route.name === 'acts'
          ? 'acts'
          : route.name === 'incidents'
            ? 'incidents'
            : route.name === 'client-updates'
              ? 'client-updates'
              : 'dashboard';

  return (
    <div className="min-h-screen bg-foxhole-bg flex flex-col">
      <TopBar
        onNavigate={() => {
          setRoute({ name: 'dashboard' });
          if (window.location.hash) window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }}
        onOpenStudio={() => setRoute({ name: 'studio' })}
        onOpenBilling={() => {
          setRoute({ name: 'billing' });
          window.location.hash = 'billing';
        }}
        onOpenActs={() => setRoute({ name: 'acts' })}
        onOpenIncidents={() => setRoute({ name: 'incidents' })}
        onOpenClientUpdates={() => setRoute({ name: 'client-updates' })}
        active={activeKey}
      />
      <main className="flex-1 overflow-auto">
        {route.name === 'dashboard' && (
          <DashboardPage
            onProjectClick={(id) => setRoute({ name: 'project', id })}
            onNewProject={() => setRoute({ name: 'wizard' })}
          />
        )}
        {route.name === 'project' && (
          <ProjectDetailPage
            projectId={route.id}
            onBack={() => setRoute({ name: 'dashboard' })}
            onOpenStudio={() => {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('arquitai.activeProjectId', route.id);
                const url = new URL(window.location.href);
                url.searchParams.set('project', route.id);
                window.history.replaceState({}, '', url.toString());
              }
              setRoute({ name: 'studio' });
            }}
          />
        )}
        {route.name === 'studio' && (
          <StudioPage onBack={() => setRoute({ name: 'dashboard' })} />
        )}
        {route.name === 'wizard' && (
          <NewProjectWizardPage
            onBack={() => setRoute({ name: 'dashboard' })}
            onCreated={(id) => setRoute({ name: 'project', id })}
          />
        )}
        {route.name === 'billing' && (
          <BillingPage
            onBack={() => {
              setRoute({ name: 'dashboard' });
              if (window.location.hash) window.history.replaceState({}, '', window.location.pathname + window.location.search);
            }}
          />
        )}
        {route.name === 'acts' && (
          <SiteVisitActsPage onBack={() => setRoute({ name: 'dashboard' })} />
        )}
        {route.name === 'incidents' && (
          <IncidentsPage onBack={() => setRoute({ name: 'dashboard' })} />
        )}
        {route.name === 'client-updates' && (
          <ClientUpdatesPage onBack={() => setRoute({ name: 'dashboard' })} />
        )}
      </main>
    </div>
  );
}
