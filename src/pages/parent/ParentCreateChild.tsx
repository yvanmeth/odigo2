import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'

interface ParentCreateChildProps {
  onChildCreated: () => void
}

export default function ParentCreateChild({ onChildCreated }: ParentCreateChildProps) {
  const { showToast } = useToast()
  const [showCreateChild, setShowCreateChild] = useState(false)
  const [newChildFirstName, setNewChildFirstName] = useState('')
  const [newChildPassword, setNewChildPassword] = useState('')
  const [newChildConfirm, setNewChildConfirm] = useState('')
  const [newChildRelationship, setNewChildRelationship] = useState('parent')
  const [createChildLoading, setCreateChildLoading] = useState(false)

  const handleCreateChild = async () => {
    if (newChildPassword !== newChildConfirm) {
      showToast('Les mots de passe ne correspondent pas', 'error')
      return
    }
    if (newChildPassword.length < 6) {
      showToast('Le mot de passe doit faire au moins 6 caractères', 'error')
      return
    }

    setCreateChildLoading(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const token = session?.access_token
      if (!token) {
        showToast('Session expirée, reconnecte-toi', 'error')
        setCreateChildLoading(false)
        return
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-child-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: newChildFirstName,
            password: newChildPassword,
            relationship: newChildRelationship,
          }),
        }
      )
      const result = await response.json()
      if (result.success) {
        showToast(`Compte créé pour ${newChildFirstName} !`)
        setNewChildFirstName('')
        setNewChildPassword('')
        setNewChildConfirm('')
        setShowCreateChild(false)
        onChildCreated()
      } else {
        showToast(result.error || JSON.stringify(result), 'error')
      }
    } catch {
      showToast('Erreur lors de la création', 'error')
    } finally {
      setCreateChildLoading(false)
    }
  }

  return (
    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ color: '#5c6bc0', margin: 0 }}>👶 Créer un compte enfant</h3>
        <button
          onClick={() => setShowCreateChild(v => !v)}
          style={{ background: 'none', border: '1px solid #5c6bc0', color: '#5c6bc0', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          {showCreateChild ? 'Fermer' : '+ Créer'}
        </button>
      </div>
      <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
        Ton enfant n'a pas d'email ? Crée-lui un compte directement ici.
      </p>

      {showCreateChild && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Prénom de l'enfant"
            value={newChildFirstName}
            onChange={e => setNewChildFirstName(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
          />
          <select
            value={newChildRelationship}
            onChange={e => setNewChildRelationship(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
          >
            <option value="père">Père</option>
            <option value="mère">Mère</option>
            <option value="tuteur">Tuteur</option>
            <option value="autre">Autre</option>
          </select>
          <input
            type="password"
            placeholder="Mot de passe"
            value={newChildPassword}
            onChange={e => setNewChildPassword(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
          />
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={newChildConfirm}
            onChange={e => setNewChildConfirm(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
          />
          <button
            onClick={handleCreateChild}
            disabled={createChildLoading || !newChildFirstName.trim() || !newChildPassword}
            style={{ padding: '0.7rem', background: createChildLoading ? '#ccc' : '#5c6bc0', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: createChildLoading ? 'default' : 'pointer', fontSize: '0.9rem' }}
          >
            {createChildLoading ? 'Création...' : 'Créer le compte'}
          </button>
        </div>
      )}
    </div>
  )
}
