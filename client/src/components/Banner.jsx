import React from 'react';

export default function Banner() {
  return (
    <section className="banner">
      <div className="banner-overlay" />
      <div className="banner-content">
        <span className="banner-badge">Programme Élargi de Vaccination — Niger 🇳🇪</span>
        <h1>Protégez vos enfants,<br />vaccinez dès la naissance</h1>
        <p>
          Hawa, votre assistante santé disponible 24h/24 sur WhatsApp,
          répond à toutes vos questions sur la vaccination en français et en Hausa.
        </p>
        <div className="banner-actions">
          <a
            href="https://wa.me/22799553514"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            💬 Discuter avec Hawa
          </a>
          <a href="/solutions" className="btn-outline">En savoir plus</a>
        </div>
      </div>
    </section>
  );
}
