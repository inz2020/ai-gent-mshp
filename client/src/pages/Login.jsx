import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/index.js';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function togglePassword() {
    setShowPassword(prev => !prev);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.login || !form.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token, nom, role } = await loginUser(form.login, form.password);
      localStorage.setItem('token', token);
      console.log('token:', token)
      localStorage.setItem('user_nom', nom ?? '');
      localStorage.setItem('user_role', role ?? '');
      navigate('/dashboard');
    } catch (err) {
      console.log("err:", err)
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <img
            src="https://res.cloudinary.com/dvdayaoa9/image/upload/q_auto/f_auto/v1775218374/logoMSP_bydyvk.png"
            alt="PEV Niger"
            className="login-logo"
          />
          <h2>Programme Élargi de Vaccination</h2>
          <p>Accédez à votre espace de gestion du service de vaccination du Niger.</p>
          <ul className="login-features">
            <li>✅ Suivi des campagnes de vaccination</li>
            <li>✅ Gestion des messages WhatsApp</li>
            <li>✅ Statistiques en temps réel</li>
            <li>✅ Administration du chatbot Hawa</li>
          </ul>
        </div>
      </div>

      <div className="login-right">
        <div className="login-box">
          <div className="login-header">
            <h1>Connexion</h1>
            <p>Entrez vos identifiants pour accéder à votre espace</p>
          </div>

          {error && <div className="login-error"><i className="bi bi-exclamation-triangle-fill"></i> {error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login">Identifiant</label>
              <input
                id="login"
                name="login"
                type="email"
                placeholder="exemple@sante.gouv.ne"
                value={form.login}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Mot de passe
                <a href="#" className="forgot-link">Mot de passe oublié ?</a>
              </label>
              <div className="input-password">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={togglePassword}
                >
                  {showPassword ? 'Cacher' : 'Voir'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Se connecter'}
            </button>
          </form>

          <p className="login-back">
            <Link to="/"><i className="bi bi-arrow-left"></i> Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
