import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import StorageType from '@/models/StorageType';
import { auth } from '@/lib/auth';

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // We map StorageTypes to "DimensionTemplate" format expected by frontend
        const types = await StorageType.find({});

        return NextResponse.json(types);
    } catch (error) {
        console.error('Error fetching templates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
