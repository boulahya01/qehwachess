import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const TournamentsPage = lazy(() =>
  import('@/pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage }))
);
const MeetupsPage = lazy(() =>
  import('@/pages/MeetupsPage').then((m) => ({ default: m.MeetupsPage }))
);
const PlayersPage = lazy(() =>
  import('@/pages/PlayersPage').then((m) => ({ default: m.PlayersPage }))
);
const EventMapPage = lazy(() =>
  import('@/pages/EventMapPage').then((m) => ({ default: m.EventMapPage }))
);
const ClubManagementPage = lazy(() =>
  import('@/pages/ClubManagementPage').then((m) => ({ default: m.ClubManagementPage }))
);
const MessagesPage = lazy(() =>
  import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage }))
);
const TournamentDetailPage = lazy(() =>
  import('@/pages/TournamentDetailPage').then((m) => ({ default: m.TournamentDetailPage }))
);
const ClubsPage = lazy(() => import('@/pages/ClubsPage').then((m) => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() =>
  import('@/pages/ClubDetailPage').then((m) => ({ default: m.ClubDetailPage }))
);
const CitiesPage = lazy(() =>
  import('@/pages/CitiesPage').then((m) => ({ default: m.CitiesPage }))
);
const CityDetailPage = lazy(() =>
  import('@/pages/CityDetailPage').then((m) => ({ default: m.CityDetailPage }))
);
const SignInPage = lazy(() =>
  import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage }))
);
const SignUpPage = lazy(() =>
  import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage }))
);
const PlayerDashboard = lazy(() =>
  import('@/pages/PlayerDashboard').then((m) => ({ default: m.PlayerDashboard }))
);
const OrganizerDashboard = lazy(() =>
  import('@/pages/OrganizerDashboard').then((m) => ({ default: m.OrganizerDashboard }))
);
const AdminDashboard = lazy(() =>
  import('@/pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);

function AppRoutes() {
  const { route } = useRouter();
  const { t } = useLanguage();
  const { profile } = useAuth();

  const renderPage = () => {
    switch (route.name) {
      case 'home':
        return <HomePage />;
      case 'tournaments':
        return <TournamentsPage />;
      case 'tournament':
        return <TournamentDetailPage key={route.id} id={route.id} />;
      case 'meetups':
        return <MeetupsPage />;
      case 'players':
        return <PlayersPage />;
      case 'map':
        return <EventMapPage />;
      case 'clubManagement':
        return <ClubManagementPage />;
      case 'messages':
        return <MessagesPage playerId={route.playerId} meetupId={route.meetupId} />;
      case 'clubs':
        return <ClubsPage />;
      case 'club':
        return <ClubDetailPage key={route.id} id={route.id} />;
      case 'cities':
        return <CitiesPage />;
      case 'city':
        return <CityDetailPage key={route.id} id={route.id} />;
      case 'signin':
        return <SignInPage />;
      case 'signup':
        return <SignUpPage />;
      case 'dashboard':
        if (profile?.role === 'organizer') return <OrganizerDashboard />;
        if (profile?.role === 'admin') return <AdminDashboard />;
        return <PlayerDashboard />;
      case 'organizer':
        return <OrganizerDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <HomePage />;
    }
  };

  const isAuthPage = route.name === 'signin' || route.name === 'signup';

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar />
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {t('Skip to content')}
      </a>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <PageErrorBoundary
          key={`${route.name}:${'id' in route ? route.id : ''}`}
          message={t('This page could not be loaded. Please reload and try again.')}
          reloadLabel={t('Reload')}
        >
          <Suspense
            fallback={
              <div className="pt-24">
                <PageLoader />
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </PageErrorBoundary>
      </main>
      {!isAuthPage && <Footer />}
    </div>
  );
}

function AppShell() {
  const { loading, error } = useAuth();
  const { t } = useLanguage();
  if (loading)
    return (
      <div className="v2-container pt-24">
        <PageLoader />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <ErrorState message={t(error)} />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="action action-link action-primary"
        >
          {t('Reload')}
        </button>
      </div>
    );
  return <AppRoutes />;
}
export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <RouterProvider>
            <AppShell />
          </RouterProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
