export default function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;

    // Génère la liste des numéros à afficher avec des "…" pour les grands ensembles
    function buildPages() {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            const near = i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1);
            if (near) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '…') {
                pages.push('…');
            }
        }
        return pages;
    }

    return (
        <div className="pagination">
            <button
                className="pg-btn"
                disabled={page === 1}
                onClick={() => onChange(page - 1)}
            >
                ‹ Précédent
            </button>

            {buildPages().map((p, i) =>
                p === '…'
                    ? <span key={`e${i}`} className="pg-ellipsis">…</span>
                    : <button
                        key={p}
                        className={`pg-btn ${p === page ? 'pg-active' : ''}`}
                        onClick={() => onChange(p)}
                      >
                        {p}
                      </button>
            )}

            <button
                className="pg-btn"
                disabled={page === totalPages}
                onClick={() => onChange(page + 1)}
            >
                Suivant ›
            </button>
        </div>
    );
}
