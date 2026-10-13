/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  AnchorHTMLAttributes,
} from 'react';
import { validTournamentId } from '@/lib/authFlow';

type Route =
  | { name: 'home' }
  | { name: 'tournaments' }
  | { name: 'tournament'; id: string }
  | { name: 'meetups' }
  | { name: 'players' }
  | { name: 'map' }
  | { name: 'clubManagement' }
  | { name: 'messages'; playerId?: string; meetupId?: string }
  | { name: 'clubs' }
  | { name: 'cities' }
  | { name: 'city'; id: string }
  | { name: 'club'; id: string }
  | { name: 'signin'; tournamentId?: string }
  | { name: 'signup'; tournamentId?: string }
  | { name: 'forgotPassword'; tournamentId?: string }
  | { name: 'resetPassword' }
  | { name: 'authCallback'; tournamentId?: string }
  | { name: 'security' }
  | { name: 'dashboard' }
  | { name: 'organizer' }
  | { name: 'admin' }
  | { name: 'profile' };

interface RouterContextValue {
  route: Route;
  navigate: (route: Route) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function parseHash(): Route {
  if (window.location.pathname === '/auth/callback')
    return {
      name: 'authCallback',
      tournamentId: validTournamentId(
        new URLSearchParams(window.location.search).get('tournament')
      ),
    };
  const hash = window.location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'tournaments' && parts.length === 1)
    return { name: 'tournaments' };
  if (parts[0] === 'tournaments' && parts[1])
    return { name: 'tournament', id: parts[1] };
  if (parts[0] === 'meetups') return { name: 'meetups' };
  if (parts[0] === 'players') return { name: 'players' };
  if (parts[0] === 'map') return { name: 'map' };
  if (parts[0] === 'club-management') return { name: 'clubManagement' };
  if (parts[0] === 'messages' && parts[1] === 'player' && parts[2])
    return { name: 'messages', playerId: parts[2] };
  if (parts[0] === 'messages' && parts[1] === 'meetup' && parts[2])
    return { name: 'messages', meetupId: parts[2] };
  if (parts[0] === 'messages') return { name: 'messages' };
  if (parts[0] === 'clubs' && parts.length === 1) return { name: 'clubs' };
  if (parts[0] === 'clubs' && parts[1]) return { name: 'club', id: parts[1] };
  if (parts[0] === 'cities' && parts.length === 1) return { name: 'cities' };
  if (parts[0] === 'cities' && parts[1]) return { name: 'city', id: parts[1] };
  if (parts[0] === 'signin' || parts[0] === 'signup') {
    return {
      name: parts[0],
      tournamentId: validTournamentId(
        new URLSearchParams(query).get('tournament')
      ),
    };
  }
  if (parts[0] === 'dashboard') return { name: 'dashboard' };
  if (parts[0] === 'forgot-password')
    return {
      name: 'forgotPassword',
      tournamentId: validTournamentId(
        new URLSearchParams(query).get('tournament')
      ),
    };
  if (parts[0] === 'reset-password') return { name: 'resetPassword' };
  if (parts[0] === 'security') return { name: 'security' };
  if (parts[0] === 'organizer') return { name: 'organizer' };
  if (parts[0] === 'admin') return { name: 'admin' };
  if (parts[0] === 'profile') return { name: 'profile' };
  return { name: 'home' };
}

function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'tournaments':
      return '/tournaments';
    case 'tournament':
      return `/tournaments/${route.id}`;
    case 'meetups':
      return '/meetups';
    case 'players':
      return '/players';
    case 'map':
      return '/map';
    case 'clubManagement':
      return '/club-management';
    case 'messages':
      if (route.playerId) return `/messages/player/${route.playerId}`;
      if (route.meetupId) return `/messages/meetup/${route.meetupId}`;
      return '/messages';
    case 'clubs':
      return '/clubs';
    case 'club':
      return `/clubs/${route.id}`;
    case 'cities':
      return '/cities';
    case 'city':
      return `/cities/${route.id}`;
    case 'signin':
    case 'signup': {
      const tournamentId = validTournamentId(route.tournamentId);
      return `/${route.name}${tournamentId ? `?tournament=${tournamentId}` : ''}`;
    }
    case 'dashboard':
      return '/dashboard';
    case 'forgotPassword':
      return `/forgot-password${validTournamentId(route.tournamentId) ? `?tournament=${route.tournamentId}` : ''}`;
    case 'resetPassword':
      return '/reset-password';
    case 'authCallback':
      return '/auth/callback';
    case 'security':
      return '/security';
    case 'organizer':
      return '/organizer';
    case 'admin':
      return '/admin';
    case 'profile':
      return '/profile';
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const handler = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  function navigate(newRoute: Route) {
    if (window.location.pathname === '/auth/callback') {
      window.history.replaceState(null, '', `/#${routeToHash(newRoute)}`);
      setRoute(newRoute);
      window.scrollTo(0, 0);
      return;
    }
    window.location.hash = routeToHash(newRoute);
  }

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}

export function Link({
  to,
  children,
  className,
  onClick,
  ...props
}: {
  to: Route;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'onClick' | 'children'
>) {
  const { navigate } = useRouter();
  return (
    <a
      {...props}
      href={`${window.location.pathname === '/auth/callback' ? '/' : ''}#${routeToHash(to)}`}
      className={className}
      onClick={(e) => {
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        navigate(to);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
