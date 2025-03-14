# Supabase Authentication Testing

## Prerequisites

- Ensure `.env` file is configured with Supabase credentials
- Supabase project is set up
- NestJS application is running

## Authentication Endpoints

### 1. Sign Up

```bash
curl -X POST http://localhost:3001/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com", "password":"securePassword123!"}'
```

### 2. Sign In

```bash
curl -X POST http://localhost:3001/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com", "password":"securePassword123!"}'
```

### 3. Get Current User (Requires Authentication)

```bash
curl -X GET http://localhost:3001/api/auth/me \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Sign Out (Requires Authentication)

```bash
curl -X POST http://localhost:3001/api/auth/signout \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Notes

- Replace `YOUR_ACCESS_TOKEN` with the token received from sign-in
- Ensure your Supabase URL and Anon Key are correctly set in `.env`
- All routes are prefixed with `/api`
