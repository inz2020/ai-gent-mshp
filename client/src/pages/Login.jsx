import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/index.js';
import { validerMotDePasse, PASSWORD_RULES } from '../utils/passwordPolicy.js';

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
    console.log('user:', form)
    if (!form.login || !form.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    const { valide, erreurs } = validerMotDePasse(form.password);
    if (!valide) {
      setError(erreurs[0]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token } = await loginUser(form.login, form.password);
      localStorage.setItem('token', token);
      navigate('/dashboard');
    } catch (err) {
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

          {error && <div className="login-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="login"
                name="login"
                type="email"
                placeholder="exemple@sante.gouv.ne"
                value={form.login}
                onChange={handleChange}
                autoComplete="login"
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
              {form.password.length > 0 && (
                <ul className="password-rules">
                  {PASSWORD_RULES.map(rule => (
                    <li key={rule.message} className={rule.regex.test(form.password) ? 'rule-ok' : 'rule-ko'}>
                      {rule.regex.test(form.password) ? '✓' : '✗'} {rule.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Se connecter'}
            </button>
          </form>

          <p className="login-back">
            <Link to="/">← Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
