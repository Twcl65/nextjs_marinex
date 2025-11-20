# Vercel Environment Variables Setup Guide

This guide lists all the environment variables you need to set in your Vercel project for the application to work correctly.

## Required Environment Variables

### 1. Database Configuration (REQUIRED)
```
DATABASE_URL=mysql://username:password@host:port/database?sslaccept=strict&connection_limit=10
```
- **Format**: `mysql://username:password@host:port/database?sslaccept=strict&connection_limit=10`
- **Example**: `mysql://admin:mypassword@your-rds-instance.region.rds.amazonaws.com:3306/marinex_db?sslaccept=strict&connection_limit=10`
- **Note**: 
  - For AWS RDS, use the RDS endpoint (not localhost)
  - Include SSL parameters for secure connections
  - `connection_limit` helps with serverless connection pooling

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

## AWS RDS Configuration (IMPORTANT!)

If you're using AWS RDS, you need to configure security groups to allow connections from Vercel:

### Step 1: Get Vercel's IP Ranges
Vercel uses dynamic IP addresses. You have two options:

**Option A: Allow All IPs (Easier, less secure)**
1. Go to AWS Console → RDS → Your Database Instance
2. Click on the **Security** tab
3. Click on the Security Group (e.g., `sg-xxxxx`)
4. Click **Edit inbound rules**
5. Add a new rule:
   - **Type**: MySQL/Aurora (port 3306)
   - **Source**: `0.0.0.0/0` (all IPs - for testing)
   - **Description**: "Allow Vercel connections"
6. Click **Save rules**

**Option B: Use AWS RDS Proxy (Recommended for Production)**
- Set up RDS Proxy which handles connection pooling better
- Configure security groups to allow connections from RDS Proxy

### Step 2: Check RDS Public Accessibility
1. Go to AWS Console → RDS → Your Database Instance
2. Click **Modify**
3. Under **Connectivity**, ensure **Publicly accessible** is set to **Yes**
4. Click **Continue** and **Modify instance**

### Step 3: Update DATABASE_URL Format
Your DATABASE_URL should look like:
```
mysql://username:password@your-rds-endpoint.region.rds.amazonaws.com:3306/database_name?sslaccept=strict&connection_limit=10
```

**Important Parameters:**
- `sslaccept=strict` - Required for AWS RDS SSL connections
- `connection_limit=10` - Helps with serverless connection pooling
- Use the RDS endpoint (found in RDS Console → Connectivity & security)

### Step 4: Test Connection
You can test if your RDS is accessible using:
```bash
mysql -h your-rds-endpoint.region.rds.amazonaws.com -u username -p
```

## Important Notes

- ⚠️ **DATABASE_URL** must point to a database that's accessible from the internet
- ⚠️ **AWS RDS Security Groups** must allow inbound connections on port 3306
- ⚠️ **RDS Public Accessibility** must be enabled (or use RDS Proxy)
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

