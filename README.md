# SOCC Training Call Simulator

A comprehensive enterprise-grade training simulator for Security Operations Center (SOCC) incident responders. Features secure invite code-based authentication, custom scenario creation, detailed analytics, and comprehensive audit logging for regulatory compliance.

## Features

### Core Training Features
- **Real-time multiplayer**: Connect with other trainees for live call simulations
- **Role-based training**: Alternate between SOCC Incident Responder and simulated caller
- **Scenario variety**: Practice with common phishing calls to advanced social engineering attacks
- **Scripted scenarios**: Realistic scripts with false information to test responder vigilance
- **Live chat interface**: Simulate phone conversations in real-time

### Enterprise Features
- **Invite Code Authentication**: Secure 10-character codes with configurable expiration and role assignment
- **Role-based Access Control**: Admin, Trainer, and Trainee roles with granular permissions
- **Custom Scenario Creation**: Users can submit and trainers can approve new training scenarios
- **Comprehensive Analytics**: Training participation, performance metrics, and compliance reporting
- **Audit Logging**: Complete audit trail of all user actions and system events
- **User Dashboards**: Individual progress tracking and training history
- **Admin Interface**: User management, invite code generation, scenario approval, and system analytics
- **OAuth SSO Ready**: Infrastructure prepared for future enterprise identity provider integration

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm
- SQLite3

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd socc-training-simulator
```

2. Install dependencies:
```bash
npm install
npm run install:client
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with authentication and database configuration
```

4. Run database migration:
```bash
npm run migrate
```

5. Initialize the database:
```bash
node server/database/init.js
```

6. Start the development servers:
```bash
npm run dev
```

7. Open your browser and navigate to `http://localhost:3000`

   **Note**: The frontend automatically proxies API requests to the backend server running on port 3001.

### Authentication Setup

The system uses invite code authentication by default. An initial admin invite code is created during migration:

- **Default Admin Code**: `ADMIN2024` (expires in 365 days)
- **Email**: `admin@socc-training.com`
- **Role**: Admin

#### Creating Additional Invite Codes

Admins can create additional invite codes through the admin dashboard or via API:

```bash
# Create a trainer invite code with email restriction
curl -X POST http://localhost:3001/api/admin/invite-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trainer@company.com",
    "role": "trainer",
    "department": "IT Security",
    "expiresInDays": 30
  }'

# Create an admin invite code without email restriction (allows any email)
curl -X POST http://localhost:3001/api/admin/invite-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin",
    "department": "IT Security",
    "expiresInDays": 365
  }'
```

**Note**: Invite codes can be created with or without email restrictions. Codes without an associated email allow users to register with any email address.

### Environment Configuration

Configure your settings in `.env`:

```env
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./data/socc-training.db

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-change-in-production
BCRYPT_ROUNDS=12
MIN_PASSWORD_LENGTH=8
REQUIRE_INVITE_CODES=true

# Invite Code Settings
DEFAULT_INVITE_EXPIRY_DAYS=30

# Optional: OAuth (for future enterprise integration)
# OAUTH_CLIENT_ID=your-oauth-client-id
# OAUTH_CLIENT_SECRET=your-oauth-client-secret
# OAUTH_AUTH_URL=https://your-oauth-provider.com/oauth/authorize
# OAUTH_TOKEN_URL=https://your-oauth-provider.com/oauth/token
# OAUTH_CALLBACK_URL=http://localhost:3001/auth/oauth/callback
```

## How to Use

### First-Time Setup

1. **Obtain Invite Code**: Contact your administrator to receive a registration invite code
2. **Register Account**: Visit the application and create your account using the invite code
3. **Login**: Use your email and password to access the training platform

### Training Sessions

1. **Access Dashboard**: After logging in, you'll be taken to your personal dashboard
2. **Join Training Lobby**: Click "Join Training Lobby" to enter the matchmaking queue
3. **Wait for Match**: The system will automatically match you with another player
4. **Role Assignment**: You'll be randomly assigned as either:
    - **SOCC Incident Responder**: Handle the security incident call professionally
    - **Caller**: Follow the provided script and include false information to test the responder
5. **Conduct the Call**: Use the chat interface to simulate a phone conversation
6. **End the Call**: Click "End Call" when finished, then return to lobby for another session

### Administrative Functions

- **Admins**: Access `/admin` to manage users, create invite codes, and approve scenarios
- **Trainers**: Review and approve user-submitted training scenarios
- **Trainees**: Participate in training sessions and view personal progress

## Available Scenarios

### Common Scenarios (70% chance)
- **Phishing Call**: IT support requesting credentials
- **Password Reset**: Urgent password reset requests

### Uncommon Scenarios (30% chance)
- **Social Engineering**: Requesting personal information
- **Ransomware Negotiation**: Threats and extortion attempts

## Development

### Project Structure

```
socc-training-simulator/
├── server/                 # Backend Node.js server
│   ├── database/          # Database schema and initialization
│   │   ├── schema.sql     # SQLite database schema
│   │   └── init.js        # Database setup script
│   ├── models/            # Data models
│   │   ├── User.js        # User authentication and management
│   │   ├── Scenario.js    # Scenario management
│   │   └── GameSession.js # Game session and participation tracking
│   ├── routes/            # API route handlers
│   │   ├── auth.js        # Authentication routes
│   │   ├── scenarios.js   # Scenario CRUD operations
│   │   └── admin.js       # Administrative functions
│   ├── middleware/        # Express middleware
│   │   └── auth.js        # Authentication and authorization
│   └── index.js           # Main server file with Socket.io
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.tsx        # Main application component
│   │   └── main.tsx       # React entry point
│   └── public/            # Static assets
├── data/                  # SQLite database and session storage
├── logs/                  # Application logs
├── .env.example          # Environment configuration template
├── package.json          # Root package configuration
└── AGENTS.md             # Development guidelines for agents
```

### Available Scripts

- `npm run dev` - Start both backend and frontend servers
- `npm run dev:server` - Start backend server only
- `npm run dev:client` - Start frontend development server only
- `npm run build` - Build the frontend for production
- `npm run lint` - Run ESLint on frontend code
- `npm run test` - Run frontend tests
- `npm run db:init` - Initialize the database schema

### Database Management

- Initialize database: `node server/database/init.js`
- View application logs: `tail -f logs/combined.log`
- View error logs: `tail -f logs/error.log`
- Backup database: `cp data/socc-training.db data/backup-$(date +%Y%m%d-%H%M%S).db`

## Enterprise Deployment

### Production Setup

1. **SSL/TLS Configuration**: Set up HTTPS with valid certificates
2. **Invite Code Management**: Create initial admin codes and establish code distribution process
3. **Database**: Set up automated backups and monitoring
4. **Logging**: Configure log rotation and centralized logging
5. **Security**: Enable all security middleware and configure firewall rules
6. **User Onboarding**: Establish process for distributing invite codes to new users

### User Roles and Permissions

- **Trainees**: Participate in training sessions, view their progress
- **Trainers**: Approve scenarios, view training analytics, manage content
- **Admins**: Full system access, user management, system configuration

### Compliance and Auditing

- Complete audit trail of all user actions
- Training participation logs for compliance reporting
- Data export capabilities for regulatory requirements
- Session recording for quality assurance

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user with invite code
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Scenario Endpoints
- `GET /api/scenarios` - Get approved scenarios
- `POST /api/scenarios` - Submit new scenario (authenticated)
- `GET /api/scenarios/pending` - Get pending scenarios (trainer+)
- `POST /api/scenarios/:id/approve` - Approve scenario (trainer+)

### Admin Endpoints
- `GET /api/admin/users` - Get all users (admin)
- `PUT /api/admin/users/:id/role` - Update user role (admin)
- `GET /api/admin/stats` - Get system statistics (admin)
- `GET /api/admin/audit` - Get audit log (admin)
- `GET /api/admin/invite-codes` - Get all invite codes (admin)
- `POST /api/admin/invite-codes` - Create new invite code (admin)
- `DELETE /api/admin/invite-codes/:id` - Delete unused invite code (admin)

## Contributing

1. Follow the coding guidelines in `AGENTS.md`
2. Add new scenarios through the web interface or API
3. Test your changes with `npm run lint` and `npm test`
4. Ensure the application runs correctly with `npm run dev`
5. Update database schema migrations for any data model changes

## Security Training Focus

This simulator helps SOCC responders practice:
- Identifying social engineering attempts
- Proper incident response procedures
- Maintaining security protocols under pressure
- Effective communication during security incidents
- Recognizing and handling various attack vectors

The platform itself demonstrates enterprise security practices including:
- Secure user authentication and authorization
- Role-based access control
- Audit logging and compliance tracking
- Secure password hashing and session management

## Troubleshooting

### Common Issues

1. **Database Connection Failed**: Ensure SQLite3 is installed and data directory is writable
2. **Invalid Invite Code**: Verify the code is correct, not expired, and not already used
3. **Registration Failed**: Check that email matches invite code (if specified) and password meets requirements
4. **Login Failed**: Ensure correct email/password combination and account is active
5. **Socket Connection Failed**: Check CORS settings and ensure backend is running
6. **Permission Denied**: Verify user roles and authentication tokens

### Logs and Debugging

- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Database queries: Enable SQL logging in development mode

## License

This project is intended for educational and training purposes within security operations. Commercial use requires separate licensing agreement.