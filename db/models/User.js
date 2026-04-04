import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export function genererLogin(nom) {
    return nom
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[-\s]+/g, '.')
        .replace(/[^a-z0-9.]/g, '')
        + '@sante.gouv.ne';
}

const userSchema = new mongoose.Schema(
    {
        nom: {
            type: String,
            required: true,
            trim: true
        },
        login: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            minlength: 6
        },
        role: {
            type: String,
            enum: ['admin', 'agent','user', 'staff', 'autre'],
            default: 'agent'
        },
        actif: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

// Génération automatique du login si absent
userSchema.pre('save', async function (next) {
    if (!this.login) {
        this.login = genererLogin(this.nom);
    }
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Méthode de vérification du mot de passe
userSchema.methods.verifierPassword = function (motDePasse) {
    return bcrypt.compare(motDePasse, this.password);
};

export default mongoose.model('User', userSchema);
