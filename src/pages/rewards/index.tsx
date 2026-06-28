import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getCurrentWeekKey, isAfterSundayReset, WEEK_THRESHOLD } from './helpers'
import RewardsBoutique from './RewardsBoutique'
import RewardsPortfolio from './RewardsPortfolio'
import RewardsProgress from './RewardsProgress'
import RewardsHowItWorks from './RewardsHowItWorks'
import type { RewardTab, Progress, IrlReward, IrlPurchase } from './types'

export default function Rewards({ userId, onNavigate }: { userId?: string; onNavigate?: (page: string, exercise?: string) => void }) {
  const [activeTab, setActiveTab] = useState<RewardTab>('rewards')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekSummaryVisible, setWeekSummaryVisible] = useState(false)
  const [irlRewards, setIrlRewards] = useState<IrlReward[]>([])
  const [irlPurchases, setIrlPurchases] = useState<IrlPurchase[]>([])

  useEffect(() => {
    fetchProgress()
    fetchIrlRewards()
    fetchIrlPurchases()
  }, [userId])

  const fetchProgress = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const targetId = userId || user.id
    const isViewingOther = !!userId && userId !== user.id

    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', targetId)
      .single()

    if (data) {
      const updated = isViewingOther ? data : await checkWeekReset(data, targetId)
      setProgress(updated)
    } else if (!isViewingOther) {
      const newProgress: Partial<Progress> = {
        user_id: user.id,
        digoos: 0,
        digoos_this_week: 0,
        active_weeks: [],
        week_streak: 0,
        claimed_badges: [],
        last_week_reset: getCurrentWeekKey(),
      }
      await supabase.from('progress').insert(newProgress)
      setProgress(newProgress as Progress)
    }
    setLoading(false)
  }

  const fetchIrlRewards = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = userId || user.id
    const { data: links } = await supabase.from('parent_child').select('parent_id').eq('child_id', targetId)
    if (!links || links.length === 0) { setIrlRewards([]); return }
    const pIds = links.map((l: any) => l.parent_id)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('irl_rewards')
      .select('*, irl_reward_children(child_id)')
      .in('parent_id', pIds)
      .gt('stock', 0)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order('name')
    if (data) {
      const visible = (data as any[]).filter(r =>
        !r.irl_reward_children ||
        r.irl_reward_children.length === 0 ||
        r.irl_reward_children.some((t: any) => t.child_id === targetId)
      ) as IrlReward[]
      setIrlRewards(visible)
    }
  }

  const fetchIrlPurchases = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = userId || user.id
    const { data } = await supabase
      .from('irl_purchases')
      .select('*')
      .eq('child_id', targetId)
      .order('purchased_at', { ascending: false })
    if (data) setIrlPurchases(data)
  }

  const checkWeekReset = async (p: Progress, targetUserId: string) => {
    const currentWeek = getCurrentWeekKey()
    if (p.last_week_reset === currentWeek) return p
    const wasActive = p.digoos_this_week >= WEEK_THRESHOLD
    const updatedActiveWeeks = wasActive
      ? [...(p.active_weeks || []), { week: p.last_week_reset, digoos: p.digoos_this_week }].slice(-52)
      : [...(p.active_weeks || [])].slice(-52)
    const newStreak = wasActive ? (p.week_streak || 0) + 1 : 0
    const updated = { ...p, digoos_this_week: 0, active_weeks: updatedActiveWeeks, week_streak: newStreak, last_week_reset: currentWeek }
    await supabase.from('progress').update({
      digoos_this_week: 0,
      active_weeks: updatedActiveWeeks,
      week_streak: newStreak,
      last_week_reset: currentWeek,
    }).eq('user_id', targetUserId)
    if (isAfterSundayReset()) setWeekSummaryVisible(true)
    return updated
  }

  const onDigoosUpdate = () => {
    fetchProgress()
    fetchIrlRewards()
    fetchIrlPurchases()
  }

  const isCurrentWeekActive = progress ? progress.digoos_this_week >= WEEK_THRESHOLD : false

  const tabStyle = (tab: RewardTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    background: activeTab === tab ? '#2a9d8f' : 'var(--color-border)',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    fontSize: '0.9rem',
  })

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Solde Digoos */}
      <div style={{
        background: 'white', borderRadius: '1rem',
        padding: '0.75rem 1.5rem', marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: '1rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>💰</span>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Mes Digoos</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2a9d8f' }}>{progress?.digoos || 0}</div>
        </div>
      </div>

      {/* Résumé semaine (dimanche 18h) */}
      {weekSummaryVisible && (
        <div style={{ background: '#fffbf0', border: '2px solid #e9c46a', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.5rem' }}>📊 Résumé de la semaine</div>
          <p style={{ color: '#555', margin: 0 }}>
            {isCurrentWeekActive
              ? `✅ Semaine active ! Tu as accumulé ${progress?.digoos_this_week} Digoos.`
              : `⚠️ Semaine insuffisante. Il te manquait ${WEEK_THRESHOLD - (progress?.digoos_this_week || 0)} Digoos pour valider la semaine.`
            }
          </p>
          <button onClick={() => setWeekSummaryVisible(false)} style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', background: '#e9c46a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            OK
          </button>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={tabStyle('rewards')} onClick={() => setActiveTab('rewards')}>🎁 Récompenses</button>
        <button style={tabStyle('wallet')} onClick={() => setActiveTab('wallet')}>👛 Portefeuille</button>
        <button style={tabStyle('progression')} onClick={() => setActiveTab('progression')}>📊 Progression</button>
        <button style={tabStyle('howto')} onClick={() => setActiveTab('howto')}>❓ Comment ça marche</button>
      </div>

      {activeTab === 'rewards' && (
        <RewardsBoutique
          progress={progress}
          onDigoosUpdate={onDigoosUpdate}
          irlRewards={irlRewards}
          onNavigate={onNavigate}
          activeTab={activeTab}
        />
      )}

      {activeTab === 'wallet' && (
        <RewardsPortfolio irlPurchases={irlPurchases} userId={userId} />
      )}

      {activeTab === 'progression' && (
        <RewardsProgress progress={progress} onDigoosUpdate={onDigoosUpdate} />
      )}

      {activeTab === 'howto' && (
        <RewardsHowItWorks />
      )}
    </div>
  )
}
