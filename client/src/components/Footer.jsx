import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img
            src="https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png"
            alt="PEV Niger"
          />
          <p>
            Ministère de la Santé Publique du Niger<br />
            Programme Élargi de Vaccination
          </p>
        </div>

        <div className="footer-links">
          <h4>Navigation</h4>
          <ul>
            <li><a href="/">Accueil</a></li>
            <li><a href="/solutions">Solutions</a></li>
            <li><a href="/contact">Nous contacter</a></li>
          </ul>
        </div>

        <div className="footer-links">
          <h4>Services</h4>
          <ul>
            <li><a href="#">Calendrier vaccinal</a></li>
            <li><a href="#">Centres de santé</a></li>
            <li><a href="#">Chatbot WhatsApp</a></li>
          </ul>
        </div>

        <div className="footer-contact">
          <h4>Contact</h4>
          <p>📞 +227 XX XX XX XX</p>
          <p>📧 pev@sante.gouv.ne</p>
          <p>📍 Niamey, Niger</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} PEV Niger — Ministère de la Santé Publique. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
