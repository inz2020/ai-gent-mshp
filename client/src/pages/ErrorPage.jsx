import { useRouteError, Link } from 'react-router-dom';

export default function ErrorPage({ message }) {
  const routeError = useRouteError?.();
  const errorMessage =
    message ||
    routeError?.statusText ||
    routeError?.message ||
    'Une erreur inattendue est survenue.';

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <i className="bi bi-exclamation-triangle-fill" style={styles.icon}></i>
        <h1 style={styles.title}>Une erreur est survenue</h1>
        <p style={styles.message}>{errorMessage}</p>
        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={() => window.location.reload()}>
            Réessayer
          </button>
          <Link to="/" style={styles.btn}>Retour à l'accueil</Link>
        </div>
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
  icon: {
    display: 'block',
    fontSize: '4rem',
    lineHeight: 1,
    marginBottom: '1rem',
    color: 'var(--orange)',
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
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
    border: 'none',
    cursor: 'pointer',
  },
  btnSecondary: {
    display: 'inline-block',
    background: 'transparent',
    color: 'var(--green)',
    padding: '0.65rem 1.5rem',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.9rem',
    border: '2px solid var(--green)',
    cursor: 'pointer',
    transition: 'all var(--transition)',
  },
};
