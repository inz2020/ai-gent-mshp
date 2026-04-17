/**
 * SortableTh — en-tête de colonne cliquable avec flèches de tri
 *
 * Props:
 *   label    {string}   Texte affiché
 *   field    {string}   Clé de tri (supporte la notation pointée : 'district.nom')
 *   sortKey  {string}   Clé active actuellement
 *   sortDir  {string}   'asc' | 'desc'
 *   onSort   {function} Appelé avec `field` au clic
 *   style    {object}   Styles inline optionnels
 */
export default function SortableTh({ label, field, sortKey, sortDir, onSort, style }) {
    const isActive = sortKey === field;
    return (
        <th onClick={() => onSort(field)} className="th-sortable" style={style}>
            <span className="th-sort-inner">
                {label}
                <span className="th-arrows">
                    <i className={`bi bi-caret-up-fill th-arrow${isActive && sortDir === 'asc' ? ' active' : ''}`}></i>
                    <i className={`bi bi-caret-down-fill th-arrow${isActive && sortDir === 'desc' ? ' active' : ''}`}></i>
                </span>
            </span>
        </th>
    );
}
