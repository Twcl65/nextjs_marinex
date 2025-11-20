# Troubleshooting Vercel Database Connection Issues

## Common Issues and Solutions

### Issue: Works on localhost but fails on Vercel

This is usually caused by one of these problems:

### 1. DATABASE_URL Format Issue

**Problem**: Your DATABASE_URL might be missing required parameters for AWS RDS.

**Solution**: Update your DATABASE_URL in Vercel to include SSL and connection parameters:

```
mysql://username:password@your-rds-endpoint.region.rds.amazonaws.com:3306/database_name?sslaccept=strict&connection_limit=10&connect_timeout=10
```

**Key Parameters:**
- `sslaccept=strict` - Required for AWS RDS SSL connections
- `connection_limit=10` - Helps with serverless connection pooling
- `connect_timeout=10` - Sets connection timeout (10 seconds)

### 2. AWS RDS Security Group Not Configured

**Problem**: RDS security group is blocking connections from Vercel.

**Solution**: 
1. Go to AWS Console → RDS → Your Database → Security tab
2. Click on the Security Group
3. Edit Inbound Rules
4. Add rule: MySQL/Aurora, Port 3306, Source: `0.0.0.0/0` (or specific IPs)
5. Save rules

### 3. RDS Not Publicly Accessible

**Problem**: RDS instance is not set to be publicly accessible.

**Solution**:
1. Go to AWS Console → RDS → Your Database
2. Click "Modify"
3. Under "Connectivity", set "Publicly accessible" to **Yes**
4. Apply changes (takes a few minutes)

### 4. Connection Timeout

**Problem**: Vercel functions have a timeout, and slow connections fail.

**Solution**: 
- Add `connect_timeout=10` to your DATABASE_URL
- Consider using AWS RDS Proxy for better connection management
- Check your RDS instance is in the same region as your application (or close by)

### 5. Prisma Client Not Generated

**Problem**: Prisma client might not be generated during Vercel build.

**Solution**: 
- Check Vercel build logs to ensure `prisma generate` runs
- The `postinstall` script should handle this automatically
- If not, check that `prisma` is in `devDependencies` (it should be)

## Debugging Steps

### Step 1: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on the failed function (e.g., `/api/auth/login`)
3. Check the logs for detailed error messages
4. Look for:
   - `PrismaClientInitializationError`
   - `P1001` (Can't reach database server)
   - `ECONNREFUSED` (Connection refused)
   - `ETIMEDOUT` (Connection timeout)

### Step 2: Verify Environment Variables

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify `DATABASE_URL` is set correctly
3. Check the format matches: `mysql://user:pass@host:port/db?params`
4. Make sure it's set for **Production** environment

### Step 3: Test Database Connection

You can test if your RDS is accessible using:

```bash
# From your local machine (if RDS is publicly accessible)
mysql -h your-rds-endpoint.region.rds.amazonaws.com -u username -p

# Or using a connection string tester
# The connection should work from any internet location
```

### Step 4: Check RDS Status

1. Go to AWS Console → RDS
2. Verify your database instance status is **Available**
3. Check the endpoint is correct
4. Verify the port is 3306 (default for MySQL)

## Quick Checklist

- [ ] DATABASE_URL is set in Vercel environment variables
- [ ] DATABASE_URL includes SSL parameters (`?sslaccept=strict`)
- [ ] DATABASE_URL includes connection parameters (`&connection_limit=10&connect_timeout=10`)
- [ ] RDS Security Group allows inbound connections on port 3306
- [ ] RDS is set to be publicly accessible
- [ ] RDS instance status is "Available"
- [ ] Database credentials are correct
- [ ] Vercel deployment has been redeployed after setting environment variables

## Still Not Working?

If you've checked all the above:

1. **Check Vercel Function Logs** - Look for the exact error message
2. **Test from a different location** - Try connecting to your RDS from a different network
3. **Consider AWS RDS Proxy** - For better connection management in serverless environments
4. **Check AWS CloudWatch Logs** - RDS logs might show connection attempts
5. **Verify Network ACLs** - Ensure no network ACLs are blocking connections

## Alternative: Use Connection Pooling Service

If direct RDS connections continue to fail, consider:
- **AWS RDS Proxy** - Managed connection pooling
- **PlanetScale** - Serverless MySQL with built-in connection pooling
- **Railway** - Easy database hosting with automatic connection pooling

