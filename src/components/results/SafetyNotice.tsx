import { HeartPulse } from 'lucide-react';
import { getSafetyNotice } from '@/lib/safety';
import type { QuizAnswers } from '@/lib/quiz-data';

interface SafetyNoticeProps {
  answers: Pick<QuizAnswers, 'injuries'>;
}

/**
 * Prominent, non-dismissable notice shown at the top of a result when the
 * runner reported pain or an injury. Renders nothing otherwise.
 */
const SafetyNotice = ({ answers }: SafetyNoticeProps) => {
  const notice = getSafetyNotice(answers);
  if (!notice) return null;

  return (
    <section
      role="note"
      aria-labelledby="safety-notice-title"
      className="rounded-2xl border-2 border-warning/40 bg-warning/5 p-5 md:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
          <HeartPulse className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="safety-notice-title" className="text-base md:text-lg font-bold text-foreground mb-1.5">
            {notice.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-1">
            You told us about: <span className="font-semibold text-foreground">{notice.reported.join(', ')}</span>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{notice.summary}</p>
          <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
            {notice.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default SafetyNotice;
