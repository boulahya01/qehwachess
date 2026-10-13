import { useWorkspaceLanguage as useLanguage } from '@/hooks/useWorkspaceLanguage';
import { tournamentWorkflow } from '@/lib/tournamentWorkflow';
import type { TournamentStatus } from '@/types';

export function TournamentProgress({ status }: { status?: TournamentStatus }) {
  const { t } = useLanguage();
  const flow = status ? tournamentWorkflow(status) : undefined;
  return (
    <section
      className="tournament-progress"
      aria-label={t('Tournament progress')}
    >
      <ol>
        {[
          'Create tournament',
          'Submit for review',
          'Approved',
          'Published',
        ].map((label, index) => (
          <li
            key={label}
            data-complete={flow ? flow.step >= index : false}
            aria-current={flow?.step === index ? 'step' : undefined}
          >
            <span aria-hidden="true">{index + 1}</span>
            {t(label)}
          </li>
        ))}
      </ol>
      <p className="field-hint">
        {t(
          flow?.hint ??
            'Approval publishes the event automatically. There is no extra publishing step.'
        )}
      </p>
    </section>
  );
}
