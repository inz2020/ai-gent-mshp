import { useState, useEffect } from 'react';

export const PER_PAGE = 10;

export function usePagination(items, perPage = PER_PAGE) {
    const [page, setPage] = useState(1);

    // Retour à la page 1 dès que la liste change (recherche, filtre)
    useEffect(() => { setPage(1); }, [items.length]);

    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const safePage   = Math.min(page, totalPages);
    const paged      = items.slice((safePage - 1) * perPage, safePage * perPage);

    return { paged, page: safePage, setPage, totalPages, total: items.length };
}
