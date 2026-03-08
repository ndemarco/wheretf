import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    name?: string;
    email: string;
    password?: string;
    image?: string;
    role?: string;
    emailVerified?: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String },
        email: { type: String, required: true, unique: true },
        password: { type: String, select: false }, // Don't return password by default
        image: { type: String },
        role: { type: String, default: 'user' },
        emailVerified: { type: Date },
    },
    { timestamps: true }
);

// Prevent initializing the authentication model multiple times
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
