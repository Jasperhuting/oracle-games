/**
 * OpenAPI 3.0 Specification for Oracle Games API
 * Auto-generated from TypeScript types and Zod schemas
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Oracle Games API',
    version: '1.0.0',
    description: 'REST API for Oracle Games - Fantasy Cycling Platform',
    contact: {
      name: 'Oracle Games',
      email: 'support@oraclegames.online',
    },
  },
  servers: [
    {
      url: 'http://localhost:3210',
      description: 'Development server',
    },
    {
      url: 'https://api.oraclegames.online',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'Games', description: 'Game management endpoints' },
    { name: 'Participants', description: 'Game participation endpoints' },
    { name: 'Bids', description: 'Bidding system endpoints' },
    { name: 'Teams', description: 'Team management endpoints' },
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Messages', description: 'Messaging system endpoints' },
    { name: 'Rankings', description: 'Rider rankings endpoints' },
    { name: 'Rules', description: 'Game rules endpoints' },
  ],
  paths: {
    '/api/games/list': {
      get: {
        tags: ['Games'],
        summary: 'List all games',
        description: 'Get a paginated list of games with optional filters',
        parameters: [
          {
            name: 'year',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by year',
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['draft', 'registration', 'bidding', 'active', 'finished'] },
            description: 'Filter by game status',
          },
          {
            name: 'gameType',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by game type',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Maximum number of results',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GamesListResponse' },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/create': {
      post: {
        tags: ['Games'],
        summary: 'Create a new game',
        description: 'Create a new game (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateGameRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Game created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateGameResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Unauthorized - Admin access required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/{gameId}': {
      get: {
        tags: ['Games'],
        summary: 'Get game details',
        description: 'Get detailed information about a specific game',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Game ID',
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GameResponse' },
              },
            },
          },
          '404': {
            description: 'Game not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Games'],
        summary: 'Update game',
        description: 'Update game details (admin only)',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateGameRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Game updated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateGameResponse' },
              },
            },
          },
          '403': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Games'],
        summary: 'Delete game',
        description: 'Delete a game and all related data (admin only)',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'adminUserId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Game deleted successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeleteGameResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/{gameId}/join': {
      post: {
        tags: ['Participants'],
        summary: 'Join a game',
        description: 'Register as a participant in a game',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinGameRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully joined game',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JoinGameResponse' },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Already a participant',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Participants'],
        summary: 'Leave a game',
        description: 'Remove yourself from a game',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'userId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Successfully left game',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LeaveGameResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/{gameId}/bids/place': {
      post: {
        tags: ['Bids'],
        summary: 'Place a bid',
        description: 'Place or update a bid on a rider',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PlaceBidRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bid placed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PlaceBidResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or insufficient budget',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/games/{gameId}/bids/list': {
      get: {
        tags: ['Bids'],
        summary: 'List bids',
        description: 'Get all bids for a game',
        parameters: [
          {
            name: 'gameId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by user',
          },
          {
            name: 'riderNameId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by rider',
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['active', 'outbid', 'won', 'lost'] },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BidsListResponse' },
              },
            },
          },
        },
      },
    },
    '/api/getRankings': {
      get: {
        tags: ['Rankings'],
        summary: 'Get rider rankings',
        description: 'Get paginated rider rankings',
        parameters: [
          {
            name: 'year',
            in: 'query',
            schema: { type: 'string' },
            description: 'Year for rankings',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RankingsResponse' },
              },
            },
          },
        },
      },
    },
    '/api/getUser': {
      get: {
        tags: ['Users'],
        summary: 'Get user details',
        description: 'Get user information by ID',
        parameters: [
          {
            name: 'userId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserResponse' },
              },
            },
          },
          '404': {
            description: 'User not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/messages': {
      get: {
        tags: ['Messages'],
        summary: 'Get messages',
        description: 'Get all messages for a user',
        parameters: [
          {
            name: 'userId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MessagesResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' },
        },
        required: ['error'],
      },
      CreateGameRequest: {
        type: 'object',
        required: ['adminUserId', 'name', 'gameType', 'year', 'raceType', 'config'],
        properties: {
          adminUserId: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          gameType: {
            type: 'string',
            enum: ['auctioneer', 'slipstream', 'last-man-standing', 'poisoned-cup', 'nations-cup', 'rising-stars', 'country-roads', 'worldtour-manager', 'fan-flandrien', 'giorgio-armada'],
          },
          year: { type: 'integer', minimum: 2020, maximum: 2100 },
          raceType: { type: 'string', enum: ['season', 'grand-tour', 'classics', 'single-race'] },
          raceSlug: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'registration', 'bidding', 'active', 'finished'] },
          registrationOpenDate: { type: 'string', format: 'date-time' },
          registrationCloseDate: { type: 'string', format: 'date-time' },
          division: { type: 'string' },
          divisionLevel: { type: 'integer', minimum: 1 },
          divisionCount: { type: 'integer', minimum: 1 },
          maxPlayers: { type: 'integer', minimum: 1 },
          minPlayers: { type: 'integer', minimum: 1 },
          eligibleTeams: { type: 'array', items: { type: 'string' } },
          eligibleRiders: { type: 'array', items: { type: 'string' } },
          config: { type: 'object' },
        },
      },
      JoinGameRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', minLength: 1 },
        },
      },
      PlaceBidRequest: {
        type: 'object',
        required: ['userId', 'riderNameId', 'amount'],
        properties: {
          userId: { type: 'string', minLength: 1 },
          riderNameId: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0.01 },
          riderName: { type: 'string' },
          riderTeam: { type: 'string' },
          jerseyImage: { type: 'string', format: 'uri' },
        },
      },
      UpdateGameRequest: {
        type: 'object',
        required: ['adminUserId'],
        properties: {
          adminUserId: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: ['draft', 'registration', 'bidding', 'active', 'finished'] },
          registrationOpenDate: { type: 'string', format: 'date-time' },
          registrationCloseDate: { type: 'string', format: 'date-time' },
          maxPlayers: { type: 'integer', minimum: 1 },
          minPlayers: { type: 'integer', minimum: 1 },
          eligibleTeams: { type: 'array', items: { type: 'string' } },
          eligibleRiders: { type: 'array', items: { type: 'string' } },
          config: { type: 'object' },
        },
      },
      GamesListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          games: { type: 'array', items: { $ref: '#/components/schemas/Game' } },
          count: { type: 'integer' },
        },
      },
      GameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          game: { $ref: '#/components/schemas/Game' },
        },
      },
      CreateGameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          gameId: { type: 'string' },
          game: { $ref: '#/components/schemas/Game' },
        },
      },
      UpdateGameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          game: { $ref: '#/components/schemas/Game' },
        },
      },
      DeleteGameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string' },
          deletionStats: {
            type: 'object',
            properties: {
              bids: { type: 'integer' },
              participants: { type: 'integer' },
              playerTeams: { type: 'integer' },
              leagues: { type: 'integer' },
              stagePicks: { type: 'integer' },
              draftPicks: { type: 'integer' },
            },
          },
        },
      },
      JoinGameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          participantId: { type: 'string' },
          participant: { $ref: '#/components/schemas/GameParticipant' },
        },
      },
      LeaveGameResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string' },
          deletionStats: {
            type: 'object',
            properties: {
              bids: { type: 'integer' },
              playerTeams: { type: 'integer' },
            },
          },
        },
      },
      PlaceBidResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          bidId: { type: 'string' },
          bid: { $ref: '#/components/schemas/Bid' },
        },
      },
      BidsListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          bids: { type: 'array', items: { $ref: '#/components/schemas/Bid' } },
          count: { type: 'integer' },
        },
      },
      RankingsResponse: {
        type: 'object',
        properties: {
          riders: { type: 'array', items: { $ref: '#/components/schemas/Ranking' } },
          pagination: {
            type: 'object',
            properties: {
              offset: { type: 'integer' },
              limit: { type: 'integer' },
              count: { type: 'integer' },
              totalCount: { type: 'integer', nullable: true },
            },
          },
        },
      },
      UserResponse: {
        type: 'object',
        properties: {
          uid: { type: 'string' },
          email: { type: 'string', format: 'email' },
          playername: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          userType: { type: 'string', enum: ['admin', 'user'] },
        },
      },
      MessagesResponse: {
        type: 'object',
        properties: {
          messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
        },
      },
      Game: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          gameType: { type: 'string' },
          year: { type: 'integer' },
          status: { type: 'string' },
          playerCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      GameParticipant: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          gameId: { type: 'string' },
          userId: { type: 'string' },
          playername: { type: 'string' },
          totalPoints: { type: 'number' },
          ranking: { type: 'integer' },
          joinedAt: { type: 'string', format: 'date-time' },
        },
      },
      Bid: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          gameId: { type: 'string' },
          userId: { type: 'string' },
          riderNameId: { type: 'string' },
          amount: { type: 'number' },
          status: { type: 'string', enum: ['active', 'outbid', 'won', 'lost'] },
          bidAt: { type: 'string', format: 'date-time' },
        },
      },
      Ranking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rank: { type: 'integer' },
          name: { type: 'string' },
          nameID: { type: 'string' },
          points: { type: 'number' },
          country: { type: 'string' },
          jerseyImage: { type: 'string' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['broadcast', 'individual'] },
          subject: { type: 'string' },
          message: { type: 'string' },
          sentAt: { type: 'string', format: 'date-time' },
          read: { type: 'boolean' },
        },
      },
    },
  },
} as const;

export type OpenAPISpec = typeof openApiSpec;
