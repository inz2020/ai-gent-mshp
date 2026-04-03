import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
    {
        telephone: {
            type: String,
            required: true
        },
 
    },
    { timestamps: true }
);

export default mongoose.model('Conversation', messageSchema);
