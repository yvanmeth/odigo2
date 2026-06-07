import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos, deductDigoos } from '../services/digoos'

type RewardTab = 'rewards' | 'wallet' | 'progression'

interface ActiveWeek {
  week: string
  digoos: number
}

interface Progress {
  user_id: string
  digoos: number
  digoos_this_week: number
  active_weeks: ActiveWeek[]
  week_streak: number
  claimed_badges: string[]
  last_week_reset: string
  updated_at: string
}

interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
  stock: number
  valid_until?: string | null
}

interface IrlPurchase {
  id: string
  child_id: string
  reward_id: string
  reward_name: string
  cost: number
  status: 'valid' | 'used'
  purchased_at: string
  used_at?: string | null
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
  progressLabel: (p: Progress) => string
}

const WEEK_THRESHOLD = 100
const WEEK_VERY_ACTIVE_THRESHOLD = 1000

const ALL_BADGES: Badge[] = [
  { id: 'first_week', label: 'Premier pas', description: 'Première semaine active', icon: '🌱', condition: p => p.active_weeks.length >= 1, progressLabel: p => `${p.active_weeks.length}/1` },
  { id: 'two_weeks', label: 'En route', description: '2 semaines consécutives', icon: '🔥', condition: p => p.week_streak >= 2, progressLabel: p => `${p.week_streak}/2` },
  { id: 'five_weeks', label: 'Régulier', description: '5 semaines consécutives', icon: '⚡', condition: p => p.week_streak >= 5, progressLabel: p => `${p.week_streak}/5` },
  { id: 'ten_weeks', label: 'Champion', description: '10 semaines consécutives', icon: '🏆', condition: p => p.week_streak >= 10, progressLabel: p => `${p.week_streak}/10` },
  { id: 'twenty_weeks', label: 'Légendaire', description: '20 semaines consécutives', icon: '💎', condition: p => p.week_streak >= 20, progressLabel: p => `${p.week_streak}/20` },
  { id: 'hundred_digoos', label: 'Riche', description: '100 Digoos accumulés', icon: '💰', condition: p => p.digoos >= 100, progressLabel: p => `${p.digoos}/100` },
  { id: 'five_hundred_digoos', label: 'Millionnaire', description: '500 Digoos accumulés', icon: '🤑', condition: p => p.digoos >= 500, progressLabel: p => `${p.digoos}/500` },
]

const playBadgeSound = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'triangle'
  o.frequency.setValueAtTime(880, ctx.currentTime)
  o.frequency.setValueAtTime(1175, ctx.currentTime + 0.06)
  g.gain.setValueAtTime(0.1, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  o.start(); o.stop(ctx.currentTime + 0.25)
}

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

const weekKeyForDate = (d: Date) => {
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const year = monday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return { key: `${year}-S${weekNum.toString().padStart(2, '0')}`, monday }
}

const FIRST_DISPLAYED_WEEK = '2026-S23'
const FUTURE_WEEKS_COUNT = 5

const getWeekRange = (currentKey: string): { key: string; isFuture: boolean }[] => {
  let cursor = new Date(2026, 0, 1)
  cursor.setDate(cursor.getDate() - (cursor.getDay() === 0 ? 6 : cursor.getDay() - 1))
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 60 && weekKeyForDate(cursor).key !== FIRST_DISPLAYED_WEEK; i++) {
    cursor.setDate(cursor.getDate() + 7)
  }

  const weeks: { key: string; isFuture: boolean }[] = []
  let pastCurrent = false
  let futureCount = 0
  for (let i = 0; i < 500 && futureCount <= FUTURE_WEEKS_COUNT; i++) {
    const key = weekKeyForDate(cursor).key
    if (pastCurrent) futureCount++
    if (futureCount > FUTURE_WEEKS_COUNT) break
    weeks.push({ key, isFuture: pastCurrent })
    if (key === currentKey) pastCurrent = true
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

const isAfterSundayReset = () => {
  const now = new Date()
  return now.getDay() === 0 && now.getHours() >= 18
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function Rewards({ userId, onNavigate }: { userId?: string; onNavigate?: (page: string, exercise?: string) => void }) {
  const [activeTab, setActiveTab] = useState<RewardTab>('rewards')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekSummaryVisible, setWeekSummaryVisible] = useState(false)
  const [irlRewards, setIrlRewards] = useState<IrlReward[]>([])
  const [parentIds, setParentIds] = useState<string[]>([])
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const [loadingRewardId, setLoadingRewardId] = useState<string | null>(null)
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [purchases, setPurchases] = useState<UserPurchase[]>([])
  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null)
  const [gender, setGender] = useState<'M' | 'F' | 'X' | null>(null)
  const [irlPurchases, setIrlPurchases] = useState<IrlPurchase[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetchProgress()
    fetchIrlRewards()
    fetchShop()
    fetchGender()
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
    if (!links || links.length === 0) { setParentIds([]); return }
    const pIds = links.map((l: any) => l.parent_id)
    setParentIds(pIds)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('irl_rewards')
      .select('*')
      .in('parent_id', pIds)
      .gt('stock', 0)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order('name')
    if (data) setIrlRewards(data)
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

  const handleObtenir = async (reward: IrlReward) => {
    setLoadingRewardId(reward.id)
    const { data: { user } } = await supabase.auth.getUser()
    await deductDigoos(reward.cost)
    if (user) {
      await supabase.from('irl_purchases').insert({
        child_id: user.id,
        reward_id: reward.id,
        reward_name: reward.name,
        cost: reward.cost,
        status: 'valid',
      })
      await supabase.from('irl_rewards').update({ stock: reward.stock - 1 }).eq('id', reward.id)
    }
    setConfirmMsg('🎉 Récompense obtenue ! Demande-la à tes parents.')
    await fetchProgress()
    await fetchIrlRewards()
    await fetchIrlPurchases()
    setLoadingRewardId(null)
  }

  const handleClaimBadge = async (badge: Badge) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !progress) return
    playBadgeSound()
    await addDigoos(10)
    const updatedClaimed = [...(progress.claimed_badges || []), badge.id]
    await supabase.from('progress').update({ claimed_badges: updatedClaimed }).eq('user_id', user.id)
    await fetchProgress()
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
          ✓ Actif{purchase.expires_at ? ` jusqu'au ${formatDate(purchase.expires_at)}` : ''}
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

  const renderCoupon = (purchase: IrlPurchase, used: boolean = false) => (
    <div
      key={purchase.id}
      style={{
        background: 'white', border: '2px dashed #2a9d8f', borderRadius: '0.75rem',
        padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: used ? 0.5 : 1,
      }}
    >
      <div>
        <div style={{ fontWeight: 'bold', color: '#333' }}>🎁 {purchase.reward_name}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>
          Acheté le {formatDate(purchase.purchased_at)}
          {used && purchase.used_at && ` · Utilisé le ${formatDate(purchase.used_at)}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ borderLeft: '1px dashed #ccc', alignSelf: 'stretch' }} />
        <span style={{ background: '#e9c46a', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {purchase.cost} Digoos
        </span>
        <span style={{ background: '#f0faf8', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {used ? 'Utilisée' : '✓ Valable'}
        </span>
      </div>
    </div>
  )

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        <button style={tabStyle('rewards')} onClick={() => setActiveTab('rewards')}>🎁 Récompenses</button>
        <button style={tabStyle('wallet')} onClick={() => setActiveTab('wallet')}>👛 Portefeuille</button>
        <button style={tabStyle('progression')} onClick={() => setActiveTab('progression')}>📊 Progression</button>
      </div>

      {/* Onglet Récompenses */}
      {activeTab === 'rewards' && (
        <div>
          {/* Récompenses IRL */}
          {parentIds.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '0.25rem', fontSize: '1.1rem' }}>🎁 Récompenses IRL</h3>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>Voici les récompenses actuellement disponibles.</p>

              {confirmMsg && (
                <div style={{ background: '#f0faf8', border: '2px solid #2a9d8f', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#2a9d8f', fontWeight: 'bold' }}>{confirmMsg}</span>
                  <button onClick={() => setConfirmMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem' }}>✕</button>
                </div>
              )}

              {irlRewards.length === 0 ? (
                <p style={{ color: '#aaa' }}>Aucune récompense disponible pour le moment.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {irlRewards.map(r => {
                    const canAfford = (progress?.digoos || 0) >= r.cost
                    const inStock = r.stock > 0
                    const canBuy = canAfford && inStock
                    const isLoading = loadingRewardId === r.id
                    return (
                      <div key={r.id} style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{r.name}</div>
                        {r.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{r.description}</div>}
                        {r.stock > 1 && <div style={{ fontSize: '0.8rem', color: '#888' }}>{r.stock} disponible(s)</div>}
                        {r.valid_until && <div style={{ fontSize: '0.8rem', color: '#888' }}>Valable jusqu'au {formatDate(r.valid_until)}</div>}
                        <div style={{ display: 'inline-block', background: '#e9c46a', color: 'white', fontWeight: 'bold', borderRadius: '1rem', padding: '0.2rem 0.75rem', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                          {r.cost} Digoos
                        </div>
                        <button
                          onClick={() => canBuy && !isLoading && handleObtenir(r)}
                          disabled={!canBuy || isLoading}
                          style={{
                            marginTop: '0.25rem', padding: '0.6rem',
                            background: canBuy ? '#2a9d8f' : '#ddd',
                            color: canBuy ? 'white' : '#aaa',
                            border: 'none', borderRadius: '0.5rem',
                            cursor: canBuy && !isLoading ? 'pointer' : 'default',
                            fontSize: '0.9rem', fontWeight: 'bold',
                          }}
                        >
                          {isLoading ? '...' : canBuy ? `Obtenir — ${r.cost} Digoos` : 'Digoos insuffisants'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Digooland */}
          <div>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>✨ Digooland</h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🎨 Personnalise ton Odigo</h4>
              {themes.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {themes.map(renderShopItem)}
                </div>
              ) : (
                <p style={{ color: '#aaa' }}>Aucun thème disponible pour l'instant.</p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🏷️ Titres</h4>
              {titles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {titles.map(renderShopItem)}
                </div>
              ) : (
                <p style={{ color: '#aaa' }}>Aucun titre disponible pour l'instant.</p>
              )}
            </div>

            <div>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🎮 Divertissement</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>⚔️</span>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Jeu des allumettes</div>
                  <button
                    onClick={() => onNavigate?.('exercises', 'allumettes')}
                    style={{ alignSelf: 'flex-start', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Jouer — 1 Digoo
                  </button>
                </div>
                <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.6, cursor: 'default' }}>
                  <span style={{ fontSize: '1.4rem' }}>📖</span>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Histoire interactive</div>
                  <span style={{ display: 'inline-block', background: '#e0e0e0', color: '#888', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', alignSelf: 'flex-start' }}>
                    Bientôt disponible
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onglet Portefeuille */}
      {activeTab === 'wallet' && (() => {
        const validPurchases = irlPurchases.filter(p => p.status === 'valid')
        const usedPurchases = irlPurchases.filter(p => p.status === 'used')
        return (
          <div>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>👛 Portefeuille</h3>

            {validPurchases.length === 0 ? (
              <p style={{ color: '#aaa' }}>Ton portefeuille est vide. Achète des récompenses dans l'onglet Récompenses !</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {validPurchases.map(p => renderCoupon(p))}
              </div>
            )}

            {usedPurchases.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  style={{ padding: '0.5rem 1rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                >
                  {showHistory ? '▲' : '▼'} Voir l'historique ({usedPurchases.length})
                </button>
                {showHistory && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {usedPurchases.map(p => renderCoupon(p, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Onglet Progression */}
      {activeTab === 'progression' && (() => {
        const weekRange = getWeekRange(currentWeek)
        const getWeekColor = (weekKey: string, isFuture: boolean): string => {
          if (isFuture) return '#f5f5f5'
          if (weekKey === currentWeek) return '#e9c46a'
          const found = progress?.active_weeks?.find(w => w.week === weekKey)
          if (!found) return '#e0e0e0'
          return found.digoos >= WEEK_VERY_ACTIVE_THRESHOLD ? '#2a9d8f' : '#a5d6a7'
        }
        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>

              {/* Digoos accumulés */}
              <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>💰 Digoos</h3>
                <div style={{ color: '#555', fontSize: '0.9rem' }}>
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
                  {weekRange.map(({ key, isFuture }) => (
                    <div
                      key={key}
                      title={getWeekLabel(key)}
                      style={{
                        width: '32px', height: '32px', borderRadius: '0.3rem',
                        background: getWeekColor(key, isFuture),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', color: isFuture ? '#bbb' : 'white', fontWeight: 'bold', cursor: 'default',
                      }}
                    >
                      {key.split('-S')[1]}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem' }}>
                  🟠 en cours · 🟢 active · 🟩 très active · ⬜ inactive · 🔲 à venir
                </div>
              </div>

            </div>

            {/* Badges */}
            <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem', fontSize: '1rem' }}>
                🏅 Badges ({progress?.claimed_badges?.length || 0}/{ALL_BADGES.length})
              </h3>
              <div>
                {ALL_BADGES.map(badge => {
                  const conditionMet = progress ? badge.condition(progress) : false
                  const claimed = !!progress?.claimed_badges?.includes(badge.id)
                  const obtainable = conditionMet && !claimed
                  const statusLabel = claimed ? 'Terminé ✓' : obtainable ? 'Obtenu' : 'En cours'
                  const statusBg = claimed ? '#f0faf8' : obtainable ? '#e9c46a' : '#f5f5f5'
                  const statusColor = claimed ? '#2a9d8f' : obtainable ? 'white' : '#888'
                  return (
                    <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ fontSize: '1.5rem' }}>{badge.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>{badge.label}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{badge.description}</div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>{progress ? badge.progressLabel(progress) : ''}</div>
                      <span
                        onClick={() => obtainable && handleClaimBadge(badge)}
                        onMouseEnter={e => { if (obtainable) e.currentTarget.style.background = '#dfb15a' }}
                        onMouseLeave={e => { if (obtainable) e.currentTarget.style.background = '#e9c46a' }}
                        style={{
                          padding: '0.35rem 0.85rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold',
                          background: statusBg, color: statusColor,
                          cursor: obtainable ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
