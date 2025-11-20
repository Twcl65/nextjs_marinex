# Vercel Environment Variables Setup Guide

This guide lists all the environment variables you need to set in your Vercel project for the application to work correctly.

## Required Environment Variables

### 1. Database Configuration (REQUIRED)
```
DATABASE_URL=mysql://username:password@host:port/database
```
- **Format**: `mysql://username:password@host:port/database`
- **Example**: `mysql://admin:mypassword@db.example.com:3306/marinex_db`
- **Note**: Make sure your database is accessible from the internet (not localhost)

### 2. JWT Secret (REQUIRED)
```
JWT_SECRET=your-strong-random-secret-key-here
```
- Use a long, random string (at least 32 characters)
- You can generate one using: `openssl rand -base64 32`

### 3. AWS S3 Configuration (REQUIRED for file uploads)
```
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_S3_BUCKET=your-s3-bucket-name
```

### 4. AWS SES Configuration (Optional - for sending emails)
```
AWS_SES_FROM_EMAIL=noreply@example.com
```
- The email address must be verified in AWS SES

### 5. Next.js Public URL (Optional)
```
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```
- Used for server-side API calls
- Should match your Vercel deployment URL

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project (`nextjs-marinex`)
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: The variable name (e.g., `DATABASE_URL`)
   - **Value**: The variable value
   - **Environment**: Select all environments (Production, Preview, Development)
5. Click **Save**
6. **Redeploy** your application:
   - Go to **Deployments**
   - Click the three dots (⋯) on the latest deployment
   - Select **Redeploy**

## Important Notes

- ⚠️ **DATABASE_URL** must point to a database that's accessible from the internet
- If you're using a local database, you need to:
  - Use a cloud database service (PlanetScale, AWS RDS, Railway, etc.)
  - Or set up a database tunnel (not recommended for production)
- Environment variables are case-sensitive
- After adding variables, you **must redeploy** for changes to take effect
- Never commit your `.env` file to Git (it should be in `.gitignore`)

## Testing Your Setup

After setting all environment variables and redeploying:
1. Try logging in at `/auth/login`
2. Check Vercel function logs for any errors
3. If you see "Database connection error", verify:
   - DATABASE_URL is correct
   - Database is accessible from the internet
   - Database credentials are correct

