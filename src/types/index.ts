export type UserRole = 'player' | 'organizer' | 'admin';

export type TournamentStatus =
  | 'draft'
  | 'pending'
  | 'published'
  | 'cancelled'
  | 'completed';

export type TournamentFormat =
  | 'swiss'
  | 'round-robin'
  | 'knockout'
  | 'blitz'
  | 'rapid'
  | 'classical'
  | 'simultaneous';

export type RegistrationStatus =
  | 'pending'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled';

export interface City {
  id: string;
  name: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  city_id: string | null;
  bio: string | null;
  avatar_url: string | null;
  username: string | null;
  lichess_username: string | null;
  chesscom_username: string | null;
  fide_id: string | null;
  created_at: string;
  city?: City | null;
}

export interface PlayerAvailability {
  profile_id: string;
  time_control: 'Casual / no clock' | 'Blitz' | 'Rapid' | 'Classical';
  expires_at: string;
  updated_at: string;
}

export interface Club {
  id: string;
  name: string;
  city_id: string | null;
  description: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  organizer_id: string | null;
  created_at: string;
  city?: City | null;
  organizer?: Profile | null;
}

export interface Tournament {
  id: string;
  title: string;
  description: string;
  city_id: string;
  club_id: string | null;
  organizer_id: string;
  start_date: string;
  end_date: string;
  venue: string;
  address: string | null;
  format: TournamentFormat;
  time_control: string | null;
  max_participants: number;
  registration_deadline: string | null;
  entry_fee: number;
  prize_fund: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: TournamentStatus;
  featured: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  city?: City | null;
  club?: Club | null;
  organizer?: Profile | null;
  registration_count?: number;
}

export interface Registration {
  id: string;
  tournament_id: string;
  player_id: string;
  status: RegistrationStatus;
  rating: number | null;
  registered_at: string;
  check_in_token?: string | null;
  checked_in_at?: string | null;
  tournament?: Tournament | null;
  player?: Profile | null;
}

export interface CasualMeetup {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  city_id: string;
  venue: string;
  address: string | null;
  starts_at: string;
  time_control: string;
  skill_level: string;
  status: 'published' | 'cancelled';
  created_at: string;
  city?: City | null;
  creator?: Pick<
    Profile,
    'id' | 'full_name' | 'avatar_url' | 'username'
  > | null;
}

export interface CommunityMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  meetup_id: string | null;
  body: string;
  created_at: string;
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  recipient?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  meetup?: Pick<CasualMeetup, 'id' | 'title' | 'creator_id'> | null;
}

export type ClubMembershipStatus = 'pending' | 'active' | 'rejected';

export interface ClubMembership {
  id: string;
  club_id: string;
  profile_id: string;
  status: ClubMembershipStatus;
  joined_at: string;
  profile?: Pick<
    Profile,
    'id' | 'full_name' | 'avatar_url' | 'username'
  > | null;
}

export interface TournamentWithRelations extends Tournament {
  city?: City | null;
  club?: Club | null;
  organizer?: Profile | null;
  registration_count?: number;
}
