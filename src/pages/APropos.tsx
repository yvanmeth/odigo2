import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

const POINTS = [
  { icon: '🎯', title: 'Exercices', desc: 'QCM, épellation, flashcards, conjugaison, anagrammes... plusieurs façons de mémoriser et de progresser.' },
  { icon: '📅', title: 'Planificateur', desc: 'Note tes évaluations, planifie tes révisions et ajoute des rappels importants, comme dans un agenda.' },
  { icon: '🏆', title: 'Récompenses', desc: 'Gagne des Digoos (Δ) à chaque exercice, échange-les contre des récompenses IRL ou des objets Digooland.' },
  { icon: '🎴', title: 'Cartes', desc: 'Collectionne des cartes ODIGO et personnalise ton profil avec ton avatar préféré.' },
]

export default function APropos() {
  const { showToast } = useToast()
  const [feedbackType, setFeedbackType] = useState<'bug' | 'idee' | 'autre'>('idee')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const handleFeedback = async () => {
    if (!feedbackText.trim()) return
    setFeedbackLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Non connecté', 'error'); return }
      const { error } = await supabase.from('suggestions').insert({
        user_id: user.id,
        text: `[${feedbackType.toUpperCase()}] ${feedbackText.trim()}`,
        created_at: new Date().toISOString(),
      })
      if (!error) { setFeedbackSent(true); setFeedbackText(''); setTimeout(() => setFeedbackSent(false), 4000) }
      else showToast("Erreur lors de l'envoi", 'error')
    } catch { showToast("Erreur lors de l'envoi", 'error') }
    finally { setFeedbackLoading(false) }
  }

  const sectionStyle = {
    background: 'white', borderRadius: '1rem',
    padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem',
  }

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* Logo + description */}
      <div style={{ ...sectionStyle, textAlign: 'center' }}>
        <img src="/logo-full.svg" alt="ODIGO" style={{ height: '48px', marginBottom: '1.25rem' }} />
        <p style={{ color: '#555', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
          ODIGO est une plateforme d'apprentissage gamifiée conçue pour aider les élèves du primaire
          à organiser leur travail scolaire et réviser de façon ludique.
        </p>
      </div>

      {/* Comment ça marche */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>Comment ça marche ?</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {POINTS.map(p => (
            <div key={p.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 }}>{p.icon}</div>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.2rem' }}>{p.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nous contacter */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>💬 Nous contacter</h3>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
          Tu as une suggestion ou tu as trouvé un bug ? Dis-le nous, on lit tous les messages !
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
          {([{ value: 'bug', label: '🐛 Bug' }, { value: 'idee', label: '💡 Idée' }, { value: 'autre', label: '💬 Autre' }] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFeedbackType(value)}
              style={{ flex: 1, padding: '0.6rem', background: feedbackType === value ? '#2a9d8f' : 'var(--color-border)', color: feedbackType === value ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={feedbackText}
          onChange={e => setFeedbackText(e.target.value)}
          placeholder={feedbackType === 'bug' ? "Décris le problème : que s'est-il passé ?" : feedbackType === 'idee' ? "Décris ton idée d'amélioration..." : "Ton message..."}
          style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical', marginTop: '0.75rem', boxSizing: 'border-box' }}
        />

        {feedbackSent ? (
          <div style={{ color: '#2a9d8f', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem' }}>✓ Message envoyé, merci !</div>
        ) : (
          <button
            onClick={handleFeedback}
            disabled={!feedbackText.trim() || feedbackLoading}
            style={{ background: feedbackText.trim() ? '#2a9d8f' : 'var(--color-border)', color: feedbackText.trim() ? 'white' : '#aaa', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', cursor: feedbackText.trim() ? 'pointer' : 'default', fontWeight: 'bold', marginTop: '0.75rem', width: '100%', fontSize: '0.9rem' }}
          >
            {feedbackLoading ? 'Envoi...' : 'Envoyer'}
          </button>
        )}
      </div>

      {/* Version */}
      <p style={{ textAlign: 'center', color: '#bbb', fontSize: '0.8rem', marginBottom: '1rem' }}>
        ODIGO v1.0 — 2026
      </p>
    </div>
  )
}
