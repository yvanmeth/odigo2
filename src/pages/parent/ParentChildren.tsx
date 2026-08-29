import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import HelpBubble from '../../components/HelpBubble'
import type { Child, InviteCode } from './types'

interface ParentChildrenProps {
  children: Child[]
  onSelectChild: (childId: string | null) => void
  onChildRemoved: () => void
}

export default function ParentChildren({ children, onSelectChild, onChildRemoved }: ParentChildrenProps) {
  const { showToast } = useToast()
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState('parent')
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)

  useEffect(() => { fetchInviteCode() }, [])

  const fetchInviteCode = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('parent_id', user.id)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) setInviteCode(data)
  }

  const generateCode = async () => {
    setGeneratingCode(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)
    const { data } = await supabase
      .from('invite_codes')
      .insert({ parent_id: user.id, code, used: false, expires_at: expiresAt.toISOString(), relationship: selectedRelationship })
      .select()
      .single()

    if (data) setInviteCode(data)
    setGeneratingCode(false)
  }

  const copyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    await supabase.from('invite_codes').insert({
      parent_id: user.id,
      code: newCode,
      used: false,
      expires_at: expiresAt.toISOString(),
      relationship: selectedRelationship,
    })

    const link = `${window.location.origin}/invite/${newCode}`
    await navigator.clipboard.writeText(link)
    setGeneratedLink(link)
    showToast('Lien copié dans le presse-papiers !')
    setGeneratingLink(false)
  }

  const removeChild = async (childId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('parent_child').delete().eq('parent_id', user.id).eq('child_id', childId)
    onChildRemoved()
  }

  return (
    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 style={{ color: '#2a9d8f', margin: 0 }}>👨‍👩‍👧 Mes enfants</h3>
        <HelpBubble
          title="Comment lier un compte enfant ?"
          position="bottom"
          content={
            <div>
              <p><strong>Option 1 — Par code</strong></p>
              <ol style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                <li>Sélectionne la relation (Père, Mère...)</li>
                <li>Clique "Générer un code"</li>
                <li>Communique ce code à ton enfant</li>
                <li>L'enfant le saisit dans Paramètres → Comptes</li>
              </ol>
              <p><strong>Option 2 — Par lien</strong></p>
              <ol style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                <li>Sélectionne la relation (Père, Mère...)</li>
                <li>Clique "Générer un lien"</li>
                <li>Envoie le lien à ton enfant (SMS, email...)</li>
                <li>L'enfant clique sur le lien et confirme</li>
              </ol>
              <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Le code et le lien sont valables 48 heures.
              </p>
            </div>
          }
        />
      </div>

      {children.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucun enfant lié pour l'instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {children.map(child => (
            <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--color-background)', borderRadius: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{child.first_name}</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>{child.relationship}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => onSelectChild(child.id)}
                  style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Voir
                </button>
                <button
                  onClick={() => removeChild(child.id)}
                  style={{ padding: '0.4rem 0.8rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {children.length < 5 && (
        <div>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Génère un code et transmets-le à ton enfant pour lier les comptes.
          </p>
          <select
            value={selectedRelationship}
            onChange={e => setSelectedRelationship(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.85rem', marginBottom: '0.5rem' }}
          >
            <option value="père">Père</option>
            <option value="mère">Mère</option>
            <option value="autre">Autre</option>
          </select>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={generateCode}
              disabled={generatingCode}
              style={{ flex: 1, padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {generatingCode ? 'Génération...' : '+ Générer un code'}
            </button>
            <button
              onClick={handleGenerateLink}
              disabled={generatingLink}
              style={{ flex: 1, padding: '0.6rem', background: 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {generatingLink ? 'Génération...' : '🔗 Générer un lien'}
            </button>
          </div>

          {inviteCode && (
            <div style={{ background: 'var(--color-background)', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2a9d8f', letterSpacing: '0.3rem', marginBottom: '0.5rem' }}>
                {inviteCode.code}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '0.5rem' }}>
                Expire le {new Date(inviteCode.expires_at).toLocaleDateString('fr-CH')}
              </div>
              <button
                onClick={copyCode}
                style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {copied ? '✓ Copié !' : 'Copier le code'}
              </button>
            </div>
          )}

          {generatedLink && (
            <div>
              <div style={{ background: '#f0faf8', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#2a9d8f', wordBreak: 'break-all', border: '1px solid #e0f0ee' }}>
                🔗 {generatedLink}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                Valable 48 heures. Envoie ce lien à ton enfant par SMS, email ou WhatsApp.
              </p>
            </div>
          )}
        </div>
      )}

      {children.length >= 5 && (
        <p style={{ color: '#aaa', fontSize: '0.8rem' }}>Maximum 5 enfants atteint.</p>
      )}
    </div>
  )
}
