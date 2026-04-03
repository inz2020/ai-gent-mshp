import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
    {
        nom: {
            type: String,
            required: true,
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

// Hashage du mot de passe avant sauvegarde
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Méthode de vérification du mot de passe
userSchema.methods.verifierPassword = function (motDePasse) {
    return bcrypt.compare(motDePasse, this.password);
};

export default mongoose.model('User', userSchema);
