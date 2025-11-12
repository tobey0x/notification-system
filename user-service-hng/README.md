# User & Authentication Microservice

This service is the single source of truth for all user data. It handles:

- User registration and login
- JWT-based authentication (access and refresh tokens)
- User profile management
- User notification preferences
- Push notification token management

## Tech Stack

- **Framework**: [Fastify](https://www.fastify.io/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (or any other Prisma-supported database)
- **Authentication**: [JWT](https://jwt.io/) (JSON Web Tokens)
- **Validation**: [Zod](https://zod.dev/)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [pnpm](https://pnpm.io/installation) (or npm/yarn)
- A running PostgreSQL instance

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd user-service-hng
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root of the project and add the following variables:

   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>"
   ACCESS_SECRET="your-access-secret"
   PORT=3000
   REFRESH_SECRET="your-refresh-secret"
   ```

4. **Run database migrations:**

   ```bash
   npx prisma migrate dev
   ```

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   The server will be running at `http://localhost:3000`.

## API Endpoints

**Note: All endpoints are prefixed with `/api/v1`.**

### Health Check

#### `GET /health`

Checks the health of the service, including database connectivity.

**Success Response (200):**

```json
{
  "status": "ok",
  "uptime": 3.764,
  "timestamp": "2025-11-10T15:00:00.000Z",
  "db": "ok"
}
```

### Authentication Routes (`/auth`)

#### `POST /auth/register`

Registers a new user.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Success Response (201):**

```json
{
  "data": {
    "id": "clx...",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "access_token": "...",
    "refresh_token": "..."
  },
  "message": "User registered successfully",
  "success": true
}
```

#### `POST /auth/login`

Logs in a user and returns access and refresh tokens.

**Request Body:**

```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Success Response (200):**

```json
{
  "data": {
    "id": "clx...",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "access_token": "...",
    "refresh_token": "..."
  },
  "message": "User logged in successfully",
  "success": true
}
```

#### `POST /auth/refresh`

Generates a new access token using a refresh token.

**Request Body:**

```json
{
  "token": "your-refresh-token"
}
```

**Success Response (200):**

```json
{
  "data": {
    "access_token": "...",
    "refresh_token": "..."
  },
  "message": "Token refreshed successfully",
  "success": true
}
```

#### `POST /auth/logout`

Logs out a user by invalidating their refresh token. Requires authentication.

**Success Response (200):**

```json
{
  "message": "Logged out successfully",
  "success": true
}
```

### User Routes (`/users`)

Authentication is required for all user routes.

#### `GET /users/profile`

Retrieves the profile of the authenticated user.

**Success Response (200):**

```json
{
  "data": {
    "id": "clx...",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "created_at": "2025-11-10T14:28:57.000Z",
    "preference": {
      "id": "clx...",
      "userId": "clx...",
      "email_enabled": true,
      "push_enabled": true,
      "language": "en",
      "timezone": null
    },
    "pushTokens": [
      {
        "id": "clx...",
        "userId": "clx...",
        "token": "...",
        "platform": "android",
        "device_name": null,
        "created_at": "2025-11-10T14:30:00.000Z"
      }
    ]
  },
  "message": "User profile fetched successfully",
  "success": true
}
```

#### `GET /users/profile/:id`

Retrieves the public profile of a user by their ID.

**Success Response (200):**

(Same response body as `GET /users/profile`)

#### `GET /users/preference/:id`

Retrieves the notification preferences for a user by their ID.

**Success Response (200):**

```json
{
  "data": {
    "id": "clx...",
    "userId": "clx...",
    "email_enabled": true,
    "push_enabled": true,
    "language": "en",
    "timezone": null
  },
  "message": "Preference fetched successfully",
  "success": true
}
```

#### `POST /users/preference/:id`

Creates notification preferences for a user by their ID.

**Request Body (Optional):**

```json
{
  "email_enabled": false,
  "push_enabled": false,
  "language": "fr",
  "timezone": "Europe/Paris"
}
```

**Success Response (201):**

(Same response body as `GET /users/preference/:id`)

#### `PATCH /users/preference/:id`

Updates the notification preferences for a user by their ID.

**Request Body:**

```json
{
  "push_enabled": true,
  "language": "es"
}
```

**Success Response (200):**

(Same response body as `GET /users/preference/:id`)

#### `POST /users/push-token`

Adds a new push notification token for the authenticated user.

**Request Body:**

```json
{
  "token": "your-push-token",
  "platform": "ios",
  "device_name": "iPhone 15"
}
```

**Success Response (201):**

```json
{
  "data": {
    "id": "clx...",
    "userId": "clx...",
    "token": "your-push-token",
    "platform": "ios",
    "device_name": "iPhone 15",
    "created_at": "2025-11-10T14:35:00.000Z"
  },
  "message": "Push token added successfully",
  "success": true
}
```

#### `PATCH /users/push-token/:id`

Updates a push notification token by its ID.

**Request Body:**

```json
{
  "device_name": "My New iPhone"
}
```

**Success Response (200):**

(Same response body as `POST /users/push-token`)

#### `DELETE /users/push-token/:id`

Deletes a push notification token by its ID.

**Success Response (204):**

(No content)

## Environment Variables

- `DATABASE_URL`: The connection string for your PostgreSQL database.
- `ACCESS_SECRET`: A secret key for signing access tokens.
- `REFRESH_SECRET`: A secret key for signing refresh tokens.

## Scripts

- `npm run build`: Compiles the TypeScript code.
- `npm run start`: Starts the compiled application.
- `npm run dev`: Starts the application in development mode with hot-reloading.
- `npm test`: (Not yet implemented)

### made with ❤ by group 3
