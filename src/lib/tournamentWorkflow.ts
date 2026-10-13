import type { TournamentStatus } from '@/types';

// Approval and publication are one transaction in the existing backend.
export function tournamentWorkflow(status: TournamentStatus) {
  switch (status) {
    case 'draft':
      return {
        step: 0,
        label: 'Draft',
        hint: 'Finish the details, then submit for review.',
        action: 'Continue draft',
      };
    case 'pending':
      return {
        step: 1,
        label: 'In review',
        hint: 'An administrator will review and publish your tournament. You can still edit the details.',
        action: 'Review details',
      };
    case 'published':
      return {
        step: 3,
        label: 'Approved and published',
        hint: 'Your tournament is live. Manage registrations and event information.',
        action: 'Manage event',
      };
    case 'cancelled':
      return {
        step: -1,
        label: 'Cancelled',
        hint: 'This event is cancelled and is no longer accepting registrations.',
        action: 'View event',
      };
    case 'completed':
      return {
        step: 4,
        label: 'Completed',
        hint: 'This event has finished. View its registrations and results.',
        action: 'View event',
      };
  }
}
