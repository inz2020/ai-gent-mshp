import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <img
            src="https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png"
            alt="PEV Niger"
          />
          <span>PEV Niger</span>
        </div>

        <button className="navbar-burger" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/" onClick={() => setMenuOpen(false)}>Accueil</NavLink></li>
          <li><NavLink to="/solutions" onClick={() => setMenuOpen(false)}>Solutions</NavLink></li>
          <li><NavLink to="/contact" onClick={() => setMenuOpen(false)}>Nous contacter</NavLink></li>
        </ul>

        <Link to="/connexion" className="btn-connexion">Connexion</Link>
      </div>
    </nav>
  );
}
