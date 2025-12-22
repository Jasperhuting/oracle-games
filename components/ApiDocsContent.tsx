function Section({ title, endpoints }: { title: string; endpoints: Array<{ method: string; path: string; description: string }> }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-gray-900">{title}</h3>
      <div className="space-y-2">
        {endpoints.map((endpoint, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded border border-gray-200">
            <span className={`px-2 py-1 text-xs font-semibold rounded ${getMethodColor(endpoint.method)}`}>
              {endpoint.method}
            </span>
            <div className="flex-1">
              <code className="text-sm font-mono text-gray-800">{endpoint.path}</code>
              <p className="text-sm text-gray-600 mt-1">{endpoint.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-blue-100 text-blue-800';
    case 'POST':
      return 'bg-green-100 text-green-800';
    case 'PATCH':
      return 'bg-yellow-100 text-yellow-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function ApiDocsContent() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Oracle Games API Documentation</h1>
          <p className="text-gray-600">
            Complete REST API documentation for the Oracle Games platform
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              OpenAPI Specification (JSON)
            </a>
            <a
              href="https://editor.swagger.io/?url=http://localhost:3210/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Swagger Editor
            </a>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">API Endpoints</h2>

          <div className="space-y-6">
            <Section title="Games" endpoints={[
              { method: 'GET', path: '/api/games/list', description: 'List all games with filters' },
              { method: 'POST', path: '/api/games/create', description: 'Create a new game (admin)' },
              { method: 'GET', path: '/api/games/{gameId}', description: 'Get game details' },
              { method: 'PATCH', path: '/api/games/{gameId}', description: 'Update game (admin)' },
              { method: 'DELETE', path: '/api/games/{gameId}', description: 'Delete game (admin)' },
            ]} />

            <Section title="Participants" endpoints={[
              { method: 'POST', path: '/api/games/{gameId}/join', description: 'Join a game' },
              { method: 'DELETE', path: '/api/games/{gameId}/join', description: 'Leave a game' },
              { method: 'GET', path: '/api/games/{gameId}/participants', description: 'List game participants' },
            ]} />

            <Section title="Bidding" endpoints={[
              { method: 'POST', path: '/api/games/{gameId}/bids/place', description: 'Place or update a bid' },
              { method: 'GET', path: '/api/games/{gameId}/bids/list', description: 'List all bids' },
              { method: 'DELETE', path: '/api/games/{gameId}/bids/cancel', description: 'Cancel a bid' },
            ]} />

            <Section title="Teams" endpoints={[
              { method: 'GET', path: '/api/games/{gameId}/team/list', description: 'Get user team' },
              { method: 'POST', path: '/api/games/{gameId}/team/add-rider', description: 'Add rider to team' },
            ]} />

            <Section title="Users" endpoints={[
              { method: 'GET', path: '/api/getUser', description: 'Get user details' },
              { method: 'GET', path: '/api/getUsers', description: 'List all users (admin)' },
              { method: 'POST', path: '/api/createUser', description: 'Create new user' },
            ]} />

            <Section title="Rankings" endpoints={[
              { method: 'GET', path: '/api/getRankings', description: 'Get rider rankings' },
            ]} />

            <Section title="Messages" endpoints={[
              { method: 'GET', path: '/api/messages', description: 'Get user messages' },
              { method: 'POST', path: '/api/messages/send', description: 'Send a message' },
              { method: 'GET', path: '/api/messages/unread-count', description: 'Get unread count' },
            ]} />
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-blue-900">📚 Additional Resources</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• <strong>Type Definitions:</strong> See <code className="bg-blue-100 px-2 py-1 rounded">/lib/types/api-responses.ts</code></li>
            <li>• <strong>Validation Schemas:</strong> See <code className="bg-blue-100 px-2 py-1 rounded">/lib/validation/schemas.ts</code></li>
            <li>• <strong>Documentation:</strong> Check <code className="bg-blue-100 px-2 py-1 rounded">API_TYPES_OVERVIEW.md</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
