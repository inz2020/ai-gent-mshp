/**
 * Politique de mot de passe :
 * - Minimum 8 caractères
 * - Au moins 1 lettre majuscule
 * - Au moins 1 lettre minuscule
 * - Au moins 1 chiffre
 * - Au moins 1 caractère spécial parmi !@#$%^&*?_-
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*?_\-]).{8,}$/;

export const PASSWORD_RULES = [
    { regex: /.{8,}/,              message: 'Au moins 8 caractères' },
    { regex: /[A-Z]/,              message: 'Au moins 1 majuscule' },
    { regex: /[a-z]/,              message: 'Au moins 1 minuscule' },
    { regex: /\d/,                 message: 'Au moins 1 chiffre' },
    { regex: /[!@#$%^&*?_\-]/,    message: 'Au moins 1 caractère spécial (!@#$%^&*?_-)' }
];

export function validerMotDePasse(password) {
    const erreurs = PASSWORD_RULES
        .filter(rule => !rule.regex.test(password))
        .map(rule => rule.message);

    return {
        valide: erreurs.length === 0,
        erreurs
    };
}
