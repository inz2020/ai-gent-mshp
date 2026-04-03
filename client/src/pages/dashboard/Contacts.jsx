import React from 'react';

export default function Contacts() {
    return (
        <div className="dash-page">
            <h1 className="dash-page-title">Contacts</h1>
            <p className="dash-page-sub">Liste des numéros ayant contacté le chatbot.</p>
            <div className="dash-section">
                <p className="dash-empty">Aucun contact enregistré pour le moment.</p>
            </div>
        </div>
    );
}
