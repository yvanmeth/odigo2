import HelpBubble from '../../components/HelpBubble'
import { Delta } from '../../components/Delta'
import ProgressCircle from '../rewards/ProgressCircle'

interface HomeStreaksProps {
  progressData: { record_days?: number; record_weeks?: number; record_months?: number } | null
  dayStreak: number
  weekStreak: number
  monthStreak: number
  monthSteps: number
  digoosThisWeek: number
  todayCount: number
}

export default function HomeStreaks({
  progressData, dayStreak, weekStreak, monthStreak, monthSteps, digoosThisWeek, todayCount,
}: HomeStreaksProps) {
  const weekColor = digoosThisWeek < 100 ? '#e63946' : digoosThisWeek < 1000 ? '#a5d6a7' : '#2a9d8f'

  return (
    <div style={{
      background: 'var(--color-card)', borderRadius: '1rem', padding: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold' }}>🔥 Séries en cours</span>
          <HelpBubble
            title="Séries en cours"
            position="bottom"
            content={
              <div style={{ textAlign: 'left' }}>
                <p style={{ marginBottom: '0.75rem' }}>
                  <strong>📅 Jour actif — </strong>
                  <span style={{ color: '#b8860b' }}>+10 </span>
                  <Delta size={13} style={{ verticalAlign: 'middle' }} />
                </p>
                <p>Fais au moins 1 action dans la journée : un exercice, une révision, ou une entrée dans le planificateur.</p>

                <p style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                  <strong>📆 Semaine active — </strong>
                  <span style={{ color: '#b8860b' }}>+50 </span>
                  <Delta size={13} style={{ verticalAlign: 'middle' }} />
                </p>
                <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0' }}>
                  <li>Gagner au moins <strong>300 Δ</strong> dans la semaine</li>
                  <li>Avoir au moins <strong>3 jours actifs</strong></li>
                  <li>Faire au moins <strong>1 action dans le planificateur</strong></li>
                </ul>
                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                  Le compteur repart à zéro chaque dimanche à 18h.
                </p>

                <p style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                  <strong>🗓️ Mois actif — </strong>
                  <span style={{ color: '#b8860b' }}>+200 </span>
                  <Delta size={13} style={{ verticalAlign: 'middle' }} />
                </p>
                <p>Obtiens <strong>3 semaines actives</strong> sur un mois entier pour obtenir cette récompense.</p>

                <p style={{ marginTop: '0.75rem', color: '#888', fontSize: '0.8rem' }}>
                  Les récompenses se réclament dans Récompenses → Progression.
                </p>
              </div>
            }
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-around' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <ProgressCircle
            value={todayCount >= 1 ? 1 : 0} max={1} streak={dayStreak}
            label="Jours" color="#2a9d8f"
          />
          <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
            Ton record : {Math.max(dayStreak, progressData?.record_days || 0)} jour{Math.max(dayStreak, progressData?.record_days || 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <ProgressCircle
            value={digoosThisWeek} max={1000} streak={weekStreak}
            label="Semaines" color={weekColor}
          />
          <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
            Ton record : {Math.max(weekStreak, progressData?.record_weeks || 0)} semaine{Math.max(weekStreak, progressData?.record_weeks || 0) !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <ProgressCircle
            value={monthSteps} max={32} streak={monthStreak}
            label="Mois" color="#e9c46a"
          />
          <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
            Ton record : {Math.max(monthStreak, progressData?.record_months || 0)} mois
          </div>
        </div>
      </div>
    </div>
  )
}
