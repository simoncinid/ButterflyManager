# 🦋 ButterflyManager

A beautiful, full-stack platform for freelance project management with time tracking, billing logic, and financial analytics.

## Features

- **Authentication**: Secure JWT-based auth with httpOnly cookies
- **Project Management**: Create, edit, and archive projects with different billing modes
- **Time Tracking**: Real-time timer with start/stop functionality
- **Billing Modes**: Fixed total, recurring period, or hourly billing
- **Invoices & Payments**: Track invoices and record payments
- **Analytics Dashboard**: Visualize income and hours by period
- **Dark/Light Theme**: Toggle between themes

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite for bundling
- Tailwind CSS for styling
- React Query for server state
- React Router for navigation
- Framer Motion for animations
- Recharts for charts

### Backend
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL database
- JWT authentication
- Zod for validation

## Project Structure

```
butterfly-manager/
├── apps/
│   ├── web/          # React frontend
│   └── server/       # Node.js backend
├── packages/
│   ├── types/        # Shared TypeScript types
│   └── ui/           # Shared UI components
├── package.json
├── turbo.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn
- PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd butterfly-manager
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:

Create `apps/server/.env`:
```env
PORT=3001
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/butterfly?schema=public"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
FRONTEND_URL="http://localhost:5173"
```

Create `apps/web/.env`:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

4. Set up the database:
```bash
yarn db:generate
yarn db:migrate
```

5. Start development servers:
```bash
yarn dev
```

This will start:
- Frontend at http://localhost:5173
- Backend at http://localhost:3001

## Deployment

### Backend (Render)

1. Create a new Web Service
2. Connect your Git repository
3. Set build command: `cd apps/server && yarn install && yarn build`
4. Set start command: `cd apps/server && node dist/index.js`
5. Set environment variables:
   - `DATABASE_URL`
   - `DATABASE_CA_CERTIFICATE` (for DigitalOcean PostgreSQL)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

### Frontend (Render)

1. Create a new Static Site
2. Connect your Git repository
3. Set build command: `cd apps/web && yarn install && yarn build`
4. Set publish directory: `apps/web/dist`
5. Set environment variables:
   - `VITE_API_BASE_URL`

### Database (DigitalOcean)

1. Create a Managed PostgreSQL database
2. Get the connection string and CA certificate
3. Run migrations: `yarn db:migrate`

## Billing Logic

### Fixed Total
- User sets a total project amount
- Effective hourly rate = fixedTotalAmount / totalHoursTracked

### Recurring Period
- User sets recurring amount and period (monthly/weekly)
- Effective hourly rate per period = recurringAmount / hoursTrackedInPeriod

### Hourly
- User sets hourly rate
- Amount per session = hourlyRate × (durationMinutes / 60)

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Archive project

### Time Tracking
- `POST /api/projects/:id/time-entries/start` - Start timer
- `POST /api/projects/:id/time-entries/:entryId/stop` - Stop timer
- `GET /api/projects/:id/time-entries` - List time entries

### Invoices & Payments
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment

### Analytics
- `GET /api/analytics/dashboard` - Dashboard stats
- `GET /api/analytics/earnings` - Earnings by period
- `GET /api/analytics/time` - Time tracked by period/project

## License

MIT

