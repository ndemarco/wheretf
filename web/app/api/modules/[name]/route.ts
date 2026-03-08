import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import StorageModule from '@/models/StorageModule';
import { auth } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ name: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const { name } = await params;

        const module = await StorageModule.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (!module) {
            return NextResponse.json({ error: 'Module not found' }, { status: 404 });
        }

        return NextResponse.json(module);
    } catch (error) {
        console.error('Error fetching module:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
