'use server';

import { User } from '@/lib/models/User';
import { hash } from 'bcryptjs';
import mongoose from 'mongoose';
import { signIn } from '@/lib/auth';

export async function register(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string || email.split('@')[0];

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        console.log('Registering user:', email);
        if (mongoose.connection.readyState === 0) {
            console.log('Connecting to MongoDB...');
            await mongoose.connect(process.env.MONGODB_URI!);
            console.log('Connected to MongoDB');
        }

        const existingUser = await User.findOne({ email });
        console.log('Checked existing user:', existingUser ? 'Found' : 'Not found');
        if (existingUser) {
            return { error: 'User already exists' };
        }

        const hashedPassword = await hash(password, 10);
        console.log('Password hashed');

        await User.create({
            email,
            password: hashedPassword,
            name,
        });
        console.log('User created');

        // Automatically sign in after registration
        console.log('Attempting sign in...');
        await signIn('credentials', { email, password, redirectTo: '/chat' });
        console.log('Sign in complete');

    } catch (error: any) {
        console.error('Registration error:', error);
        if (error.type === 'CredentialsSignin') {
            throw error; // Let NextAuth handle redirect
        }
        return { error: error.message || 'Registration failed' };
    }
}

export async function login(prevState: any, formData: FormData) {
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        await signIn('credentials', { email, password, redirectTo: '/chat' });
    } catch (error: any) {
        if (error.type === 'CredentialsSignin') {
            return { error: 'Invalid credentials' };
        }
        throw error;
    }
}
