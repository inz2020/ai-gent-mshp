/**
 * Modal — composant réutilisable et paramétrable
 *
 * Props :
 *   title      {string}              Titre affiché dans le header
 *   onClose    {function}            Appelée au clic sur le bouton ✕
 *   size       {'sm'|'md'|'lg'|'xl'} Taille prédéfinie (défaut : 'md')
 *   maxWidth   {number}              Largeur custom en px (remplace size si fourni)
 *   error      {string}              Message d'erreur affiché en haut du contenu
 *   footer     {ReactNode}           Boutons du pied de page
 *   isForm     {boolean}             Wrap le contenu dans un <form> (défaut : false)
 *   onSubmit   {function}            Handler submit (requis si isForm=true)
 *   className  {string}              Classes CSS supplémentaires sur .modal
 *   children   {ReactNode}           Contenu principal
 */

const SIZE_MAP = { sm: 380, md: 460, lg: 680, xl: 900 };

export default function Modal({
    title,
    onClose,
    size = 'md',
    maxWidth,
    error,
    footer,
    isForm   = false,
    onSubmit,
    className = '',
    children,
}) {
    const width = maxWidth ?? SIZE_MAP[size] ?? SIZE_MAP.md;

    const content = (
        <>
            {error && (
                <div className="modal-error">
                    <i className="bi bi-exclamation-triangle-fill"></i> {error}
                </div>
            )}
            {children}
            {footer && <div className="modal-footer">{footer}</div>}
        </>
    );

    return (
        <div className="modal-overlay">
            <div className={`modal ${className}`} style={{ maxWidth: width }}>

                {/* ── Header ── */}
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button type="button" className="modal-close" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {/* ── Contenu — form ou body ── */}
                {isForm ? (
                    <form onSubmit={onSubmit} className="modal-form">
                        {content}
                    </form>
                ) : (
                    <div className="modal-body">
                        {content}
                    </div>
                )}
            </div>
        </div>
    );
}
