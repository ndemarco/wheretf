import { Header } from '@/components/layout';

export default function AgentsPage() {
  return (
    <>
      <Header title="Agents" />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">AI Agents</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize how AI agents behave and respond
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Agent management coming soon</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Agents will be seeded on first use
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
