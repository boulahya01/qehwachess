import { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import { Language, LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Spinner, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const TournamentsPage = lazy(() => import('@/pages/TournamentsPage').then((m) => ({ default: m.TournamentsPage })));
const MeetupsPage = lazy(() => import('@/pages/MeetupsPage').then((m) => ({ default: m.MeetupsPage })));
const PlayersPage = lazy(() => import('@/pages/PlayersPage').then((m) => ({ default: m.PlayersPage })));
const EventMapPage = lazy(() => import('@/pages/EventMapPage').then((m) => ({ default: m.EventMapPage })));
const ClubManagementPage = lazy(() => import('@/pages/ClubManagementPage').then((m) => ({ default: m.ClubManagementPage })));
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const TournamentDetailPage = lazy(() => import('@/pages/TournamentDetailPage').then((m) => ({ default: m.TournamentDetailPage })));
const ClubsPage = lazy(() => import('@/pages/ClubsPage').then((m) => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() => import('@/pages/ClubDetailPage').then((m) => ({ default: m.ClubDetailPage })));
const CitiesPage = lazy(() => import('@/pages/CitiesPage').then((m) => ({ default: m.CitiesPage })));
const CityDetailPage = lazy(() => import('@/pages/CityDetailPage').then((m) => ({ default: m.CityDetailPage })));
const SignInPage = lazy(() => import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const PlayerDashboard = lazy(() => import('@/pages/PlayerDashboard').then((m) => ({ default: m.PlayerDashboard })));
const OrganizerDashboard = lazy(() => import('@/pages/OrganizerDashboard').then((m) => ({ default: m.OrganizerDashboard })));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));

function AppRoutes() {
  const { route } = useRouter();
  const { t } = useLanguage();
  const { profile } = useAuth();

  const renderPage = () => {
    switch (route.name) {
      case 'home': return <HomePage />;
      case 'tournaments': return <TournamentsPage />;
      case 'tournament': return <TournamentDetailPage key={route.id} id={route.id} />;
      case 'meetups': return <MeetupsPage />;
      case 'players': return <PlayersPage />;
      case 'map': return <EventMapPage />;
      case 'clubManagement': return <ClubManagementPage />;
      case 'messages': return <MessagesPage playerId={route.playerId} meetupId={route.meetupId} />;
      case 'clubs': return <ClubsPage />;
      case 'club': return <ClubDetailPage key={route.id} id={route.id} />;
      case 'cities': return <CitiesPage />;
      case 'city': return <CityDetailPage key={route.id} id={route.id} />;
      case 'signin': return <SignInPage />;
      case 'signup': return <SignUpPage />;
      case 'dashboard':
        if (profile?.role === 'organizer') return <OrganizerDashboard />;
        if (profile?.role === 'admin') return <AdminDashboard />;
        return <PlayerDashboard />;
      case 'organizer': return <OrganizerDashboard />;
      case 'admin': return <AdminDashboard />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  const isAuthPage = route.name === 'signin' || route.name === 'signup';

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <PageErrorBoundary key={`${route.name}:${'id' in route ? route.id : ''}`} message={t('This page could not be loaded. Please reload and try again.')} reloadLabel={t('Reload')}>
          <Suspense fallback={<div className="pt-24"><PageLoader /></div>}>
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
  const { language, hasChosenLanguage, chooseLanguage, languageNames, t } = useLanguage();
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center px-4">
        <ErrorState message={t(error)} />
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-brand-500 px-5 py-3 text-white">
          {t('Reload')}
        </button>
      </div>
    );
  }

  return (
    <>
      <AppRoutes />
      {!hasChosenLanguage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-950/90 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 p-8 shadow-2xl">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Qehwa Chess</h1>
              <h2 className="mt-3 text-xl font-semibold text-white">{t('Choose your language')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('You can change this anytime from the menu.')}</p>
            </div>
            <div className="mt-6 grid gap-3">
              {(['en', 'fr', 'ar'] as Language[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPendingLanguage(option)}
                  className={`rounded-xl border px-4 py-3 text-lg font-medium transition-colors ${
                    pendingLanguage === option
                      ? 'border-brand-400 bg-brand-500/10 text-white'
                      : 'border-surface-700 bg-surface-800 text-gray-300 hover:border-surface-500'
                  }`}
                >
                  {languageNames[option]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => chooseLanguage(pendingLanguage)}
              className="mt-6 w-full rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-400"
            >
              {pendingLanguage === 'en' ? 'Continue' : pendingLanguage === 'fr' ? 'Continuer' : 'متابعة'}
            </button>
          </div>
        </div>
      )}
    </>
  );
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
