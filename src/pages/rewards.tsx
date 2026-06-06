import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'

type RewardTab = 'rewards' | 'progression'

interface Progress {
  user_id: string
  digoos: number
  digoos_this_week: number
  active_weeks: string[]
  week_streak: number
  badges: string[]
  last_week_reset: string
  updated_at: string
}

interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
}

interface ShopItem {
  id: string
  type: 'theme' | 'title'
  name: string
  name_masculine?: string | null
  name_feminine?: string | null
  description?: string | null
  price: number
  color?: string | null
  duration_days?: number | null
}

interface UserPurchase {
  id: string
  user_id: string
  item_id: string
  purchased_at: string
  expires_at?: string | null
  active: boolean
}

interface Badge {
  id: string
  label: string
  description: string
  icon: string
  condition: (p: Progress) => boolean
}

const WEEK_THRESHOLD = 100

const ALL_BADGES: Badge[] = [
  { id: 'first_week', label: 'Premier pas', description: 'Première semaine active', icon: '🌱', condition: p => p.active_weeks.length >= 1 },
  { id: 'two_weeks', label: 'En route', description: '2 semaines consécutives', icon: '🔥', condition: p => p.week_streak >= 2 },
  { id: 'five_weeks', label: 'Régulier', description: '5 semaines consécutives', icon: '⚡', condition: p => p.week_streak >= 5 },
  { id: 'ten_weeks', label: 'Champion', description: '10 semaines consécutives', icon: '🏆', condition: p => p.week_streak >= 10 },
  { id: 'twenty_weeks', label: 'Légendaire', description: '20 semaines consécutives', icon: '💎', condition: p => p.week_streak >= 20 },
  { id: 'hundred_digoos', label: 'Riche', description: '100 Digoos accumulés', icon: '💰', condition: p => p.digoos >= 100 },
  { id: 'five_hundred_digoos', label: 'Millionnaire', description: '500 Digoos accumulés', icon: '🤑', condition: p => p.digoos >= 500 },
]

const getCurrentWeekKey = () => {
  const now = new Date()
  const day = now.getDay()
  const hours = now.getHours()
  const offset = (day === 0 && hours < 18) ? 7 : 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset)
  monday.setHours(0, 0, 0, 0)
  const year = monday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${year}-S${weekNum.toString().padStart(2, '0')}`
}

const getWeekLabel = (key: string) => {
  const parts = key.split('-S')
  return `Semaine ${parts[1]} — ${parts[0]}`
}

const isAfterSundayReset = () => {
  const now = new Date()
  return now.getDay() === 0 && now.getHours() >= 18
}

const formatExpiry = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function Rewards({ userId }: { userId?: string }) {
  const [activeTab, setActiveTab] = useState<RewardTab>('rewards')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [newBadges, setNewBadges] = useState<string[]>([])
  const [weekSummaryVisible, setWeekSummaryVisible] = useState(false)
  const [irlRewards, setIrlRewards] = useState<IrlReward[]>([])
  const [parentIds, setParentIds] = useState<string[]>([])
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const [loadingRewardId, setLoadingRewardId] = useState<string | null>(null)
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [purchases, setPurchases] = useState<UserPurchase[]>([])
  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null)
  const [gender, setGender] = useState<'M' | 'F' | 'X' | null>(null)

  useEffect(() => {
    fetchProgress()
    fetchIrlRewards()
    fetchShop()
    fetchGender()
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
      if (!isViewingOther) checkNewBadges(updated)
    } else if (!isViewingOther) {
      const newProgress: Partial<Progress> = {
        user_id: user.id,
        digoos: 0,
        digoos_this_week: 0,
        active_weeks: [],
        week_streak: 0,
        badges: [],
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
    if (!links || links.length === 0) { setParentIds([]); return }
    const pIds = links.map((l: any) => l.parent_id)
    setParentIds(pIds)
    const { data } = await supabase.from('irl_rewards').select('*').in('parent_id', pIds).order('name')
    if (data) setIrlRewards(data)
  }

  const fetchShop = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [itemsRes, purchasesRes] = await Promise.all([
      supabase.from('shop_items').select('*').order('type').order('price'),
      supabase.from('user_purchases').select('*').eq('user_id', user.id),
    ])
    if (itemsRes.data) setShopItems(itemsRes.data)
    if (purchasesRes.data) setPurchases(purchasesRes.data)
  }

  const checkWeekReset = async (p: Progress, targetUserId: string) => {
    const currentWeek = getCurrentWeekKey()
    if (p.last_week_reset === currentWeek) return p
    const wasActive = p.digoos_this_week >= WEEK_THRESHOLD
    const updatedActiveWeeks = wasActive
      ? [...(p.active_weeks || []), p.last_week_reset].slice(-52)
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

  const checkNewBadges = async (p: Progress) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const earned = ALL_BADGES.filter(b => b.condition(p) && !(p.badges || []).includes(b.id)).map(b => b.id)
    if (earned.length > 0) {
      const updatedBadges = [...(p.badges || []), ...earned]
      await supabase.from('progress').update({ badges: updatedBadges }).eq('user_id', user.id)
      setProgress(prev => prev ? { ...prev, badges: updatedBadges } : prev)
      setNewBadges(earned)
    }
  }

  const handleObtenir = async (reward: IrlReward) => {
    setLoadingRewardId(reward.id)
    await deductDigoos(reward.cost)
    setConfirmMsg('🎉 Récompense obtenue ! Demande-la à tes parents.')
    await fetchProgress()
    setLoadingRewardId(null)
  }

  const handlePurchase = async (item: ShopItem) => {
    if ((progress?.digoos || 0) < item.price || !!loadingPurchaseId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoadingPurchaseId(item.id)
    await deductDigoos(item.price)
    const now = new Date()
    const expiresAt = item.duration_days
      ? new Date(now.getTime() + item.duration_days * 86400000).toISOString()
      : null
    await supabase.from('user_purchases').insert({
      user_id: user.id,
      item_id: item.id,
      purchased_at: now.toISOString(),
      expires_at: expiresAt,
      active: false,
    })
    await fetchProgress()
    await fetchShop()
    setLoadingPurchaseId(null)
  }

  const handleActivateTheme = async (purchase: UserPurchase, color: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const themeItemIds = shopItems.filter(i => i.type === 'theme').map(i => i.id)
    if (themeItemIds.length > 0) {
      await supabase.from('user_purchases').update({ active: false }).eq('user_id', user.id).in('item_id', themeItemIds)
    }
    await supabase.from('user_purchases').update({ active: true }).eq('id', purchase.id)
    localStorage.setItem('odigo_theme_color', color)
    window.location.reload()
  }

  const fetchGender = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = userId || user.id
    const { data } = await supabase.from('profiles').select('gender').eq('id', targetId).single()
    if (data) setGender(data.gender || 'X')
  }

  const getPurchase = (itemId: string) => purchases.find(p => p.item_id === itemId)
  const isExpiredPurchase = (p: UserPurchase) => !!p.expires_at && new Date(p.expires_at) < new Date()

  const getItemName = (item: ShopItem): string => {
    if (item.type === 'title') {
      if (gender === 'M') return item.name_masculine || item.name
      if (gender === 'F') return item.name_feminine || item.name
      return item.name_masculine && item.name_feminine
        ? item.name_masculine + ' / ' + item.name_feminine
        : item.name
    }
    return item.name
  }

  const currentWeek = getCurrentWeekKey()
  const weekProgress = progress ? Math.min((progress.digoos_this_week / WEEK_THRESHOLD) * 100, 100) : 0
  const isCurrentWeekActive = progress ? progress.digoos_this_week >= WEEK_THRESHOLD : false

  const getLast10Weeks = () => {
    const weeks = []
    const now = new Date()
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const day = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      monday.setHours(0, 0, 0, 0)
      const year = monday.getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
      weeks.push(`${year}-S${weekNum.toString().padStart(2, '0')}`)
    }
    return weeks
  }

  const tabStyle = (tab: RewardTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    background: activeTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    fontSize: '0.9rem',
  })

  const themes = shopItems.filter(i => i.type === 'theme')
  const titles = shopItems.filter(i => i.type === 'title')

  const renderShopItem = (item: ShopItem) => {
    const purchase = getPurchase(item.id)
    const expired = purchase ? isExpiredPurchase(purchase) : false
    const canAfford = (progress?.digoos || 0) >= item.price
    const isLoading = loadingPurchaseId === item.id

    let statusNode: React.ReactNode = null

    if (item.price === 0) {
      statusNode = <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>✓ Actif</span>
    } else if (!purchase) {
      statusNode = (
        <button
          onClick={() => handlePurchase(item)}
          disabled={!canAfford || !!isLoading}
          style={{
            padding: '0.4rem 0.75rem', border: 'none', borderRadius: '0.5rem',
            background: canAfford ? '#2a9d8f' : '#ddd',
            color: canAfford ? 'white' : '#aaa',
            cursor: canAfford ? 'pointer' : 'default',
            fontSize: '0.8rem', fontWeight: 'bold',
          }}
        >
          {isLoading ? '...' : canAfford ? `Obtenir — ${item.price} Digoos` : 'Digoos insuffisants'}
        </button>
      )
    } else if (expired) {
      statusNode = (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#e63946' }}>Expiré</span>
          <button
            onClick={() => handlePurchase(item)}
            disabled={!canAfford || !!isLoading}
            style={{
              padding: '0.3rem 0.6rem', border: 'none', borderRadius: '0.4rem',
              background: canAfford ? '#2a9d8f' : '#ddd',
              color: canAfford ? 'white' : '#aaa',
              cursor: canAfford ? 'pointer' : 'default',
              fontSize: '0.78rem',
            }}
          >
            {isLoading ? '...' : 'Renouveler'}
          </button>
        </div>
      )
    } else if (item.type === 'title') {
      statusNode = <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>✓ Obtenu</span>
    } else if (purchase.active) {
      statusNode = (
        <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>
          ✓ Actif{purchase.expires_at ? ` jusqu'au ${formatExpiry(purchase.expires_at)}` : ''}
        </span>
      )
    } else {
      statusNode = (
        <button
          onClick={() => item.color && handleActivateTheme(purchase, item.color)}
          style={{
            padding: '0.4rem 0.75rem', border: 'none', borderRadius: '0.5rem',
            background: '#e9c46a', color: 'white',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
          }}
        >
          Activer
        </button>
      )
    }

    return (
      <div key={item.id} style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {item.type === 'theme' && item.color && (
          <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: item.color }} />
        )}
        {item.type === 'title' && <span style={{ fontSize: '1.4rem' }}>🏷️</span>}
        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{getItemName(item)}</div>
        {item.description && <div style={{ fontSize: '0.82rem', color: '#888' }}>{item.description}</div>}
        {item.price > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#e9c46a', fontWeight: 'bold' }}>{item.price} Digoos</div>
        )}
        {statusNode}
      </div>
    )
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Nouveaux badges */}
      {newBadges.length > 0 && (
        <div style={{ background: '#f0faf8', border: '2px solid #2a9d8f', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉 Nouveau badge débloqué !</div>
          {newBadges.map(id => {
            const badge = ALL_BADGES.find(b => b.id === id)
            return badge ? (
              <div key={id} style={{ fontSize: '1.1rem', color: '#2a9d8f', fontWeight: 'bold' }}>
                {badge.icon} {badge.label}
              </div>
            ) : null
          })}
        </div>
      )}

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        <button style={tabStyle('rewards')} onClick={() => setActiveTab('rewards')}>🎁 Récompenses</button>
        <button style={tabStyle('progression')} onClick={() => setActiveTab('progression')}>📊 Progression</button>
      </div>

      {/* Onglet Récompenses */}
      {activeTab === 'rewards' && (
        <div>
          {/* Boutique Odigo */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>✨ Boutique</h3>

            {themes.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🎨 Thèmes</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {themes.map(renderShopItem)}
                </div>
              </div>
            )}

            {titles.length > 0 && (
              <div>
                <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🏷️ Titres</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {titles.map(renderShopItem)}
                </div>
              </div>
            )}

            {shopItems.length === 0 && (
              <p style={{ color: '#aaa' }}>Aucun article disponible pour l'instant.</p>
            )}
          </div>

          {/* Récompenses IRL */}
          {parentIds.length > 0 && (
            <div>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>🎁 Récompenses IRL</h3>

              {confirmMsg && (
                <div style={{ background: '#f0faf8', border: '2px solid #2a9d8f', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#2a9d8f', fontWeight: 'bold' }}>{confirmMsg}</span>
                  <button onClick={() => setConfirmMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem' }}>✕</button>
                </div>
              )}

              {irlRewards.length === 0 ? (
                <p style={{ color: '#aaa' }}>Aucune récompense disponible pour l'instant.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {irlRewards.map(r => {
                    const canAfford = (progress?.digoos || 0) >= r.cost
                    const isLoading = loadingRewardId === r.id
                    return (
                      <div key={r.id} style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{r.name}</div>
                        {r.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{r.description}</div>}
                        <div style={{ display: 'inline-block', background: '#e9c46a', color: 'white', fontWeight: 'bold', borderRadius: '1rem', padding: '0.2rem 0.75rem', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                          {r.cost} Digoos
                        </div>
                        <button
                          onClick={() => canAfford && !isLoading && handleObtenir(r)}
                          disabled={!canAfford || isLoading}
                          style={{
                            marginTop: '0.25rem', padding: '0.6rem',
                            background: canAfford ? '#2a9d8f' : '#ddd',
                            color: canAfford ? 'white' : '#aaa',
                            border: 'none', borderRadius: '0.5rem',
                            cursor: canAfford && !isLoading ? 'pointer' : 'default',
                            fontSize: '0.9rem', fontWeight: 'bold',
                          }}
                        >
                          {isLoading ? '...' : canAfford ? 'Obtenir' : 'Digoos insuffisants'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglet Progression */}
      {activeTab === 'progression' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>

            {/* Digoos */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>💰 Digoos</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>
                {progress?.digoos || 0}
              </div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Digoos accumulés</div>
              <div style={{ marginTop: '1rem', color: '#555', fontSize: '0.9rem' }}>
                Cette semaine : <strong style={{ color: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a' }}>{progress?.digoos_this_week || 0}</strong> / {WEEK_THRESHOLD}
              </div>
              <div style={{ marginTop: '0.5rem', background: '#f0f0f0', borderRadius: '1rem', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${weekProgress}%`, background: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a', height: '100%', borderRadius: '1rem', transition: 'width 0.3s ease' }} />
              </div>
              {isCurrentWeekActive && <div style={{ color: '#2a9d8f', fontSize: '0.8rem', marginTop: '0.25rem' }}>✅ Semaine active !</div>}
            </div>

            {/* Streak semaines */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>🔥 Série de semaines</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.25rem' }}>
                {progress?.week_streak || 0}
              </div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>semaines consécutives actives</div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {getLast10Weeks().map(week => {
                  const isActive = progress?.active_weeks?.includes(week)
                  const isCurrent = week === currentWeek
                  return (
                    <div
                      key={week}
                      title={getWeekLabel(week)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '0.3rem',
                        background: isCurrent ? (isCurrentWeekActive ? '#2a9d8f' : '#e9c46a') : isActive ? '#2a9d8f' : '#e0e0e0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', color: 'white', fontWeight: 'bold', cursor: 'default',
                      }}
                    >
                      {week.split('-S')[1]}
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem' }}>
                🟢 active · 🟡 en cours · ⬜ inactive
              </div>
            </div>

          </div>

          {/* Badges compacts */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>
              🏅 Badges ({progress?.badges?.length || 0}/{ALL_BADGES.length})
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ALL_BADGES.map(badge => {
                const unlocked = progress?.badges?.includes(badge.id)
                return (
                  <div
                    key={badge.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.75rem', borderRadius: '2rem',
                      background: unlocked ? '#f0faf8' : '#f5f5f5',
                      border: `1px solid ${unlocked ? '#2a9d8f' : '#eee'}`,
                      opacity: unlocked ? 1 : 0.45,
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', filter: unlocked ? 'none' : 'grayscale(1)' }}>{badge.icon}</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: unlocked ? '#2a9d8f' : '#aaa' }}>{badge.label}</span>
                    {unlocked && <span style={{ fontSize: '0.75rem', color: '#888' }}>{badge.description}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
