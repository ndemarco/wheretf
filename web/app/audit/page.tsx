import React from 'react';
import { auth } from '@/lib/auth';
import { auditRepository } from '@/repositories';
import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export default async function AuditPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/auth/signin');
    }

    const logs = await auditRepository.list(session.user.id, { limit: 100 });

    return (
        <div className="container mx-auto py-8 text-zinc-200">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 text-card-foreground shadow-sm">
                <div className="flex flex-col space-y-1.5 p-6">
                    <h3 className="text-2xl font-semibold leading-none tracking-tight">Audit Log</h3>
                </div>
                <div className="p-6 pt-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50 data-[state=selected]:bg-zinc-900">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Time</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Action</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Entity</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Details</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {logs.map((log) => (
                                    <tr key={String(log._id)} className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50 data-[state=selected]:bg-zinc-900">
                                        <td className="p-4 align-middle whitespace-nowrap text-zinc-500">
                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="inline-flex items-center rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-zinc-300">
                                                {log.action}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-200">{log.entityName}</span>
                                                <span className="text-xs text-zinc-500 uppercase">{log.entityType}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-sm text-zinc-300">
                                            {log.location && (
                                                <div className="mb-1">
                                                    <span className="font-semibold text-zinc-400">Location: </span>
                                                    <span className="font-mono text-xs text-zinc-300">{log.location}</span>
                                                </div>
                                            )}
                                            {log.metadata && (
                                                <pre className="text-xs text-zinc-500 bg-zinc-900 p-2 rounded max-w-md overflow-x-auto border border-zinc-800">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50 data-[state=selected]:bg-zinc-900">
                                        <td colSpan={4} className="p-4 align-middle text-center py-8 text-zinc-500">
                                            No audit logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
