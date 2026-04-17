import { useState, useMemo } from 'react';

/**
 * useSort — tri générique pour n'importe quel tableau de données
 *
 * @param {Array}  data        Données à trier (filtered, rows, etc.)
 * @param {string} defaultKey  Clé de tri initiale (ex: 'nom', 'district.nom')
 * @param {string} defaultDir  Direction initiale : 'asc' | 'desc'
 *
 * @returns {{ sorted, sortKey, sortDir, toggleSort }}
 */
export function useSort(data, defaultKey = '', defaultDir = 'asc') {
    const [sortKey, setSortKey] = useState(defaultKey);
    const [sortDir, setSortDir] = useState(defaultDir);

    function toggleSort(key) {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    const sorted = useMemo(() => {
        if (!sortKey) return data;
        return [...data].sort((a, b) => {
            // Supporte les clés imbriquées : 'district.nom', 'regionId.nom'
            const resolve = (obj, path) =>
                path.split('.').reduce((o, k) => o?.[k], obj) ?? '';

            let aVal = resolve(a, sortKey);
            let bVal = resolve(b, sortKey);

            // Comparaison insensible à la casse pour les strings
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
            return 0;
        });
    }, [data, sortKey, sortDir]);

    return { sorted, sortKey, sortDir, toggleSort };
}
