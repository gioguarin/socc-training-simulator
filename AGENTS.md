# AGENTS.md

## Build/Lint/Test Commands

### Build
- `npm run build` - Build the project for production
- `npm run dev` - Start development server (both backend and frontend)
- `npm run dev:server` - Start backend server only
- `npm run dev:client` - Start frontend development server only
- `npm run install:client` - Install frontend dependencies
- `npm run db:init` - Initialize the database schema

### Lint
- `npm run lint` - Run ESLint for frontend code quality checks
- `npm run lint:fix` - Auto-fix frontend linting issues

### Test
- `npm test` - Run frontend tests
- `npm run test:watch` - Run frontend tests in watch mode
- `npm run test -- <test-file>` - Run a single frontend test file
- `npm run test -- --testNamePattern="<pattern>"` - Run frontend tests matching pattern

### Database
- Initialize database: `node server/database/init.js`
- View logs: `tail -f logs/combined.log`
- View errors: `tail -f logs/error.log`

## Code Style Guidelines

### Imports
- Use ES6 imports with named exports preferred
- Group imports: React, third-party libraries, local components/utilities
- Sort imports alphabetically within groups

### Formatting
- Use Prettier for consistent formatting
- 2 spaces for indentation
- Single quotes for strings, double for JSX attributes
- Semicolons required

### Types
- Use TypeScript for type safety
- Prefer interfaces over types for object shapes
- Use union types for variants, avoid `any`

### Naming Conventions
- Components: PascalCase (e.g., `UserProfile`)
- Functions/variables: camelCase (e.g., `getUserData`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- Files: kebab-case (e.g., `user-profile.tsx`)

### Error Handling
- Use try/catch for async operations
- Throw descriptive Error objects
- Handle errors at appropriate levels (UI vs API)

## Enterprise Features

### Authentication & Authorization
- **OAuth SSO**: Integrated with corporate identity providers (Auth0, Okta, Azure AD)
- **Role-based Access**: Admin, Trainer, and Trainee roles with different permissions
- **JWT Tokens**: Secure session management with configurable expiration
- **Session Security**: HTTP-only cookies with secure flags in production

### Database & Data Management
- **SQLite Database**: File-based database for user data, scenarios, and audit logs
- **Audit Logging**: Comprehensive logging of all user actions and system events
- **Data Export**: Admin capability to export training data and analytics
- **Backup Strategy**: Automated database backups for enterprise deployments

### Scenario Management
- **Custom Scenarios**: Users can submit new training scenarios
- **Approval Workflow**: Trainers/Admins review and approve user-submitted content
- **Categorization**: Scenarios organized by category and difficulty level
- **Version Control**: Track changes to approved scenarios

### Training Analytics
- **Participation Tracking**: Log all training sessions with participant details
- **Performance Metrics**: Score training sessions and track improvement
- **Compliance Reporting**: Generate reports for regulatory compliance
- **User Progress**: Dashboard showing individual and team training progress

### Security & Compliance
- **HTTPS Enforcement**: SSL/TLS required for all production deployments
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Input Validation**: Comprehensive validation of all user inputs
- **Data Encryption**: Sensitive data encrypted at rest and in transit

## Deployment Considerations

### Environment Setup
1. Configure OAuth provider settings in `.env`
2. Set up SSL certificates for HTTPS
3. Configure database backup schedules
4. Set up log rotation and monitoring

### Production Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database initialized and backed up
- [ ] OAuth provider configured
- [ ] Admin user created
- [ ] Log monitoring set up
- [ ] Backup strategy implemented

### Security Hardening
- Change all default secrets and keys
- Enable HTTPS with valid certificates
- Configure firewall rules
- Set up intrusion detection
- Regular security updates and patches

### Additional Rules
- No Cursor or Copilot rules found in codebase