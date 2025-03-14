# Postman Collection for Supabase Authentication

## Setup Instructions

1. **Import Collection**

   - Open Postman
   - Click "Import" button
   - Select the `Supabase_Auth_Postman_Collection.json` file

2. **Configure Environment Variables**
   - In Postman, go to "Environments"
   - Create a new environment or select an existing one
   - Add the following variables:
     - `base_url`: `http://localhost:3001`
     - `access_token`: Leave blank (will be populated after sign-in)

## Authentication Workflow

### 1. Sign Up

- Use the "Sign Up" request
- Provide a unique email and strong password
- Successful response indicates user creation

### 2. Sign In

- Use the "Sign In" request
- Use the same credentials from Sign Up
- Copy the access token from the response
- Manually set the `access_token` variable in Postman

### 3. Get Current User

- Requires the `access_token` to be set
- Retrieves information about the currently logged-in user

### 4. Sign Out

- Requires the `access_token` to be set
- Terminates the current user session

## Troubleshooting

- Ensure NestJS server is running
- Check console for any error messages
- Verify Supabase credentials in `.env` file

## Best Practices

- Always use unique emails for testing
- Use strong, unique passwords
- Rotate access tokens regularly
