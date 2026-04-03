import React from 'react';
import Banner from '../components/Banner.jsx';

const CARDS = [
  {
    icon: '💉',
    title: 'Vaccination gratuite',
    desc: 'Tous les vaccins du PEV sont entièrement gratuits dans les centres de santé publics du Niger.'
  },
  {
    icon: '🤖',
    title: 'Assistante IA 24h/24',
    desc: 'Hawa répond à vos questions en français et en Hausa via WhatsApp, à toute heure.'
  },
  {
    icon: '📅',
    title: 'Calendrier vaccinal',
    desc: 'Suivez le calendrier officiel du PEV Niger, de la naissance jusqu\'à 23 mois.'
  },
  {
    icon: '📍',
    title: 'Centres de santé',
    desc: 'Trouvez le centre de santé le plus proche de chez vous pour vacciner votre enfant.'
  }
];

export default function Home() {
  return (
    <>
      <Banner />

      <section className="features">
        <div className="features-container">
          <h2>Nos services</h2>
          <p className="features-subtitle">
            Un programme complet pour protéger chaque enfant du Niger
          </p>
          <div className="features-grid">
            {CARDS.map((card) => (
              <div key={card.title} className="feature-card">
                <span className="feature-icon">{card.icon}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2>Commencez dès maintenant</h2>
          <p>Envoyez un message à Hawa sur WhatsApp et obtenez des réponses instantanées sur la vaccination.</p>
          <a
            href="https://wa.me/22700000000"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            💬 Contacter Hawa sur WhatsApp
          </a>
        </div>
      </section>
    </>
  );
}
