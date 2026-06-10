export default function RewardsHowItWorks() {
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem', padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem',
  }
  const titleStyle: React.CSSProperties = { color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem' }
  const subTitleStyle: React.CSSProperties = { color: '#555', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '0.75rem', marginBottom: '0.4rem' }
  const textStyle: React.CSSProperties = { color: '#555', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }
  const listStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#555', lineHeight: '1.6', paddingLeft: '1rem', listStyle: 'disc', margin: 0 }

  return (
    <div>
      <h2 style={{ color: '#2a9d8f', fontSize: '1.3rem', marginBottom: '1rem' }}>❓ Comment ça marche</h2>

      {/* Les Δ (Digoos) */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>💰 Les Δ (Digoos)</h3>
        <p style={textStyle}>
          Les Δ sont la monnaie d'ODIGO. Tu en gagnes en travaillant régulièrement, et tu peux les
          dépenser dans la Boutique pour personnaliser ton espace ou obtenir des récompenses.
        </p>
      </div>

      {/* Comment gagner des Δ */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>🎯 Comment gagner des Δ</h3>

        <h4 style={subTitleStyle}>Exercices</h4>
        <ul style={listStyle}>
          <li>Chaque session d'exercice terminée rapporte des Δ</li>
          <li>Les 10 premiers exercices du jour sont récompensés à 100%</li>
          <li>Du 11e au 20e : 80%</li>
          <li>À partir du 21e : 60%</li>
          <li>La régularité est plus récompensée que l'intensité !</li>
        </ul>

        <h4 style={subTitleStyle}>Planificateur</h4>
        <ul style={listStyle}>
          <li>Ajouter une évaluation : +2 Δ (1 fois par jour)</li>
          <li>Saisir une note obtenue : +2 Δ (1 fois par jour)</li>
          <li>Cocher une révision comme faite : +2 Δ (1 fois par jour)</li>
          <li>Ajouter un événement : +1 Δ (1 fois par jour)</li>
          <li>Ajouter un rappel : +1 Δ (1 fois par jour)</li>
        </ul>

        <h4 style={subTitleStyle}>Jours, semaines et mois actifs</h4>
        <ul style={listStyle}>
          <li>Jour actif (+10 Δ) : au moins 1 exercice ou 1 action dans le planificateur dans la journée</li>
          <li>Semaine active (+50 Δ) : au moins 300 Δ gagnés, 3 jours actifs ET 1 ajout dans le planificateur</li>
          <li>Mois actif (+200 Δ) : au moins 15 jours actifs, 2 semaines actives ET 15 exercices complétés</li>
          <li>Les récompenses de jours/semaines/mois se récupèrent manuellement dans l'onglet « Progrès et récompenses »</li>
        </ul>

        <h4 style={subTitleStyle}>Badges</h4>
        <ul style={listStyle}>
          <li>Chaque badge débloqué rapporte +10 Δ</li>
          <li>Les badges se récupèrent en cliquant dans l'onglet « Progrès et récompenses »</li>
        </ul>
      </div>

      {/* Comment dépenser des Δ */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>🛍️ Comment dépenser des Δ</h3>
        <ul style={listStyle}>
          <li>Thèmes de couleur : 50 Δ (valable 30 jours)</li>
          <li>Titres : 30 Δ (permanent)</li>
          <li>Récompenses IRL : prix défini par tes parents</li>
          <li>Jeu des allumettes : 1 Δ par partie</li>
        </ul>
      </div>

      {/* Les séries */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>🔥 Les séries</h3>
        <ul style={listStyle}>
          <li>Série de jours : nombre de jours consécutifs actifs</li>
          <li>Série de semaines : nombre de semaines consécutives actives</li>
          <li>Série de mois : nombre de mois consécutifs actifs</li>
          <li>La semaine commence le lundi et se termine le dimanche à 18h00</li>
          <li>Le mois se réinitialise le 1er du mois à minuit</li>
        </ul>
      </div>

      <p style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem' }}>
        Tu peux poser des questions à Odigo sur le fonctionnement d'ODIGO — il connaît toutes ces règles !
      </p>
    </div>
  )
}
