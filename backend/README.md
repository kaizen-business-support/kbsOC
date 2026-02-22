# OptimusCredit Backend API

A comprehensive Node.js/TypeScript backend for the OptimusCredit banking application, providing credit process management, SYSCOHADA-compliant financial analysis, and workflow automation.

## Features

- 🔐 **JWT Authentication** with role-based access control (RBAC)
- 👥 **Multi-role User Management** (Account Manager, Credit Analyst, Branch Manager, Credit Committee, Management, Admin)
- 🏢 **Client Management** with SYSCOHADA identifiers (RCCM, NINEA, COFI)
- 📋 **Credit Application Processing** with configurable workflows
- 📊 **Financial Data Analysis** with industry benchmarking
- 📁 **Document Management** with OCR processing capability
- 🔄 **Workflow Engine** for credit approval processes
- 📈 **Analytics & Reporting** with risk assessment
- 🌐 **CORS-enabled** for frontend integration
- 📝 **Comprehensive Logging** with Winston
- 🐳 **Docker Support** with PostgreSQL and Redis

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with security middleware
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Local filesystem with multer
- **Logging**: Winston with structured logging
- **Validation**: Joi for input validation
- **Testing**: Jest (configured)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+ (optional, for sessions)
- Docker & Docker Compose (optional)

### Option 1: Docker Development Setup

1. **Clone and setup**:
   ```bash
   cd optimus-backend
   cp .env.example .env
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Run migrations**:
   ```bash
   docker-compose exec api npm run migrate
   ```

4. **Seed development data**:
   ```bash
   docker-compose exec api npm run seed
   ```

The API will be available at `http://localhost:3000`

### Option 2: Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup database**:
   ```bash
   # Create PostgreSQL database
   createdb optimus_credit
   
   # Run migrations
   npx prisma migrate dev
   
   # Generate Prisma client
   npx prisma generate
   ```

4. **Seed development data** (optional):
   ```bash
   npm run seed
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (admin)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Client Management
- `GET /api/clients` - List clients with pagination
- `POST /api/clients` - Create new client
- `GET /api/clients/:id` - Get client by ID
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Deactivate client
- `GET /api/clients/:id/financial-data` - Get client's financial data
- `POST /api/clients/:id/financial-data` - Add/update financial data
- `GET /api/clients/:id/statistics` - Get client statistics

### Credit Applications
- `GET /api/applications` - List applications with filtering
- `POST /api/applications` - Create new application
- `GET /api/applications/:id` - Get application details
- `PUT /api/applications/:id` - Update application
- `POST /api/applications/:id/submit` - Submit application for review

### Document Management
- `GET /api/documents/:applicationId` - List application documents
- `POST /api/documents/:applicationId/upload` - Upload documents
- `GET /api/documents/file/:id` - Get document metadata
- `GET /api/documents/download/:id` - Download document
- `PUT /api/documents/:id` - Update document metadata
- `DELETE /api/documents/:id` - Delete document

### Workflow Management
- `GET /api/workflows/:applicationId` - Get application workflow
- `POST /api/workflows/:applicationId/steps` - Create workflow step
- `PUT /api/workflows/steps/:stepId` - Update workflow step
- `GET /api/workflows/my-tasks` - Get user's pending tasks
- `POST /api/workflows/steps/:stepId/complete` - Complete workflow step

### Analytics & Reporting
- `GET /api/analytics/:applicationId/score` - Get credit scoring
- `GET /api/analytics/portfolio` - Portfolio analytics
- `GET /api/analytics/:applicationId/benchmarks` - Industry benchmarking
- `GET /api/analytics/risk-report` - Risk assessment report

### User Management (Admin)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user

## Role-Based Permissions

### Account Manager
- Client creation and management
- Credit application creation
- Document uploads
- Financial data input

### Credit Analyst
- Financial analysis and scoring
- Application review
- Industry benchmarking
- Small amount approvals (< 1M XOF)

### Branch Manager
- Application approvals (< 5M XOF)
- Workflow overrides
- Team management
- Portfolio view

### Credit Committee
- All amount approvals
- Risk overrides
- Policy exceptions
- Committee reviews

### Management
- Portfolio analytics
- Risk reporting
- Policy configuration
- User oversight

### Admin
- System administration
- User management
- System configuration
- Audit logs

## Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/optimus_credit"

# Authentication
JWT_SECRET="your-secret-key"
JWT_EXPIRY="1h"

# Server
NODE_ENV="development"
PORT="3000"
FRONTEND_URL="http://localhost:3001"

# File Upload
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE="10485760"

# Security
BCRYPT_ROUNDS="12"
RATE_LIMIT_MAX_REQUESTS="100"
```

## Development

### Database Operations

```bash
# Create and run migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

### Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run commands in container
docker-compose exec api npm run migrate
docker-compose exec api npx prisma studio

# Stop services
docker-compose down
```

## Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting by IP
- CORS protection
- Helmet security headers
- Input validation and sanitization
- SQL injection prevention
- File upload restrictions
- Audit logging

## Production Deployment

1. **Environment Setup**:
   ```bash
   NODE_ENV=production
   # Set strong JWT secrets
   # Configure production database
   # Set up SSL certificates
   ```

2. **Database Setup**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Build and Start**:
   ```bash
   npm run build
   npm start
   ```

4. **Process Management** (PM2 recommended):
   ```bash
   pm2 start dist/server.js --name optimus-api
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For technical support, please refer to:
- API Documentation: `/api/docs` (development mode)
- Health Check: `/api/health`
- GitHub Issues: [Create an issue](https://github.com/your-org/optimus-credit/issues)

---

**OptimusCredit Backend** - Powering West African banking with SYSCOHADA-compliant credit management.