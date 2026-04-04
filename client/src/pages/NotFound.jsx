import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <span style={styles.code}>404</span>
        <h1 style={styles.title}>Page introuvable</h1>
        <p style={styles.message}>
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link to="/" style={styles.btn}>Retour à l'accueil</Link>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gray-50)',
    padding: '2rem',
  },
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: '3rem 2.5rem',
    textAlign: 'center',
    maxWidth: 420,
    width: '100%',
  },
  code: {
    display: 'block',
    fontSize: '5rem',
    fontWeight: 800,
    color: 'var(--green)',
    lineHeight: 1,
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--gray-800)',
    marginBottom: '0.75rem',
  },
  message: {
    color: 'var(--gray-600)',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  btn: {
    display: 'inline-block',
    background: 'var(--green)',
    color: '#fff',
    padding: '0.65rem 1.5rem',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    transition: 'background var(--transition)',
  },
};
