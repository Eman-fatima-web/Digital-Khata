# Digital Khata — Deployment Guide

## Production Deployment Architecture

```
┌─────────────────┐
│   Frontend      │  Vite PWA (Static)
│   (PWA)         │  Deployed to CDN/Vercel/Netlify
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Backend API   │  Node.js + Express
│   (API Server)  │  Deployed to Railway/Render/AWS
└────────┬────────┘
         │
         │ TCP/5432
         │
┌────────▼────────┐
│  PostgreSQL     │  Database
│  (Database)     │  Supabase/AWS RDS/Neon
└─────────────────┘
```

## Required Environment Variables

### Frontend (.env)
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Backend (.env)
```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/digital_khata
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Optional - AI Provider
AI_PROVIDER_API_KEY=your-openai-or-anthropic-key
AI_PROVIDER_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Optional - WhatsApp Business API
WHATSAPP_API_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

## Database Setup

### 1. Create PostgreSQL Database
```bash
# Using Supabase
# 1. Create new project at supabase.com
# 2. Get connection string from Settings > Database

# Using AWS RDS
# 1. Create RDS PostgreSQL instance
# 2. Get connection endpoint

# Using Neon
# 1. Create new project at neon.tech
# 2. Get connection string
```

### 2. Run Schema Migration
```bash
# Connect to your database
psql $DATABASE_URL

# Run schema
\i server/database/schema.sql

# Verify tables
\dt
```

### 3. Create Initial User (Optional)
```sql
-- Insert demo user (change password hash in production)
INSERT INTO businesses (id, name, owner_id) 
VALUES ('business-1', 'My Business', 'user-1');

INSERT INTO users (id, email, password_hash, business_id)
VALUES ('user-1', 'demo@example.com', '$2b$10$...', 'business-1');
```

## Backend Deployment

### Option 1: Railway
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL plugin
railway add postgresql

# 5. Set environment variables
railway variables set JWT_SECRET=your-secret
railway variables set DATABASE_URL=$DATABASE_URL

# 6. Deploy
railway up
```

### Option 2: Render
```bash
# 1. Connect GitHub repo at render.com
# 2. Create new Web Service
# 3. Set build command: npm install && npm run build
# 4. Set start command: npm start
# 5. Add environment variables
# 6. Deploy
```

### Option 3: AWS EC2/ECS
```bash
# 1. Launch EC2 instance or create ECS cluster
# 2. Install Node.js 20+
# 3. Clone repository
# 4. Install dependencies
npm install

# 5. Build
npm run build

# 6. Set environment variables
export JWT_SECRET=your-secret
export DATABASE_URL=your-db-url

# 7. Start with PM2
npm install -g pm2
pm2 start server/index.js --name digital-khata
pm2 save
pm2 startup
```

## Frontend Deployment

### Option 1: Vercel
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Set environment variable
vercel env add VITE_API_BASE_URL production
# Enter: https://your-api.railway.app
```

### Option 2: Netlify
```bash
# 1. Connect GitHub repo at netlify.com
# 2. Set build command: npm run build
# 3. Set publish directory: dist
# 4. Add environment variable: VITE_API_BASE_URL
# 5. Deploy
```

### Option 3: Manual
```bash
# 1. Build
npm run build

# 2. Upload dist/ folder to your hosting
# 3. Configure environment variable VITE_API_BASE_URL
```

## Health Checks

### Backend Health Endpoints
```bash
# Basic health check
curl https://api.yourdomain.com/health

# Liveness probe
curl https://api.yourdomain.com/health/live

# Readiness probe (checks database)
curl https://api.yourdomain.com/health/ready
```

### Expected Responses
```json
// /health
{"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}

// /health/live
{"status":"alive","timestamp":"2026-01-01T00:00:00.000Z"}

// /health/ready (database connected)
{"status":"ready","database":"connected","timestamp":"2026-01-01T00:00:00.000Z"}

// /health/ready (database not configured)
{"status":"ready","database":"not configured","timestamp":"2026-01-01T00:00:00.000Z"}
```

## SSL/TLS Configuration

### Railway/Render/Vercel
SSL is automatically configured and managed.

### Manual (AWS/Nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Validation

### Startup Check
The backend validates required environment variables on startup:
- `JWT_SECRET` — Must be set in production
- `DATABASE_URL` — Required for database operations

### Missing Configuration Behavior
- **JWT_SECRET missing**: Server throws error and exits
- **DATABASE_URL missing**: Server starts but database operations fail gracefully
- **AI_PROVIDER_API_KEY missing**: AI falls back to local engine
- **WHATSAPP_API_TOKEN missing**: Messaging shows "not configured"

## Monitoring

### Recommended Services
- **Error Tracking**: Sentry, Rollbar, or Bugsnag
- **Uptime Monitoring**: UptimeRobot, Pingdom, or StatusCake
- **Performance**: New Relic, DataDog, or AppDynamics
- **Logs**: Papertrail, Loggly, or CloudWatch

### Basic Monitoring Script
```bash
#!/bin/bash
# health-check.sh

ENDPOINT="https://api.yourdomain.com/health/ready"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

if [ $RESPONSE -ne 200 ]; then
    echo "Health check failed: $RESPONSE"
    # Send alert (email, Slack, etc.)
fi
```

## Backup Strategy

### PostgreSQL Backups

#### Supabase
- Automatic daily backups
- Point-in-time recovery available
- Backups retained for 7 days (free) or 30 days (pro)

#### AWS RDS
```bash
# Enable automated backups
# 1. Go to RDS Console
# 2. Select your instance
# 3. Modify > Backup > Enable automatic backups
# 4. Set retention period (7-35 days)
```

#### Manual Backup
```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20260101.sql
```

### Backup Verification
```bash
# Test restore to separate database
createdb test-restore
psql test-restore < backup-20260101.sql
psql test-restore -c "SELECT COUNT(*) FROM customers;"
dropdb test-restore
```

## Disaster Recovery

### RPO (Recovery Point Objective)
- **Supabase**: 24 hours (daily backups)
- **AWS RDS**: 5 minutes (with automated backups)
- **Manual**: Depends on backup frequency

### RTO (Recovery Time Objective)
- **Supabase**: 1-2 hours
- **AWS RDS**: 1-2 hours
- **Manual**: 2-4 hours

### Recovery Procedure
1. **Identify failure**: Check health endpoints
2. **Assess data loss**: Check last backup timestamp
3. **Restore database**: Use backup or point-in-time recovery
4. **Restart services**: Restart backend API
5. **Verify**: Run health checks and test functionality
6. **Monitor**: Watch for errors for 24 hours

## Security Checklist

- [ ] JWT_SECRET is strong (32+ characters, random)
- [ ] DATABASE_URL uses SSL (postgresql://...?sslmode=require)
- [ ] All environment variables are set
- [ ] HTTPS is enabled
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled
- [ ] Database backups are configured
- [ ] Monitoring is set up
- [ ] Error tracking is configured
- [ ] Security headers are set (Helmet)

## Scaling

### Vertical Scaling
- Increase server CPU/RAM
- Increase database instance size

### Horizontal Scaling
- Load balancer (AWS ALB, Nginx)
- Multiple backend instances
- Database read replicas
- CDN for frontend

### Database Scaling
- **Read replicas**: For read-heavy workloads
- **Connection pooling**: PgBouncer or built-in pool
- **Indexing**: Ensure proper indexes (already done in schema)
- **Partitioning**: For very large tables (100M+ rows)

## Support

### Documentation
- API Documentation: Auto-generated from routes
- Database Schema: server/database/schema.sql
- Deployment: This document

### Troubleshooting
1. Check logs: Backend logs, database logs
2. Check health endpoints
3. Verify environment variables
4. Check database connectivity
5. Review recent changes

### Contact
- **Issues**: GitHub Issues
- **Questions**: GitHub Discussions
- **Emergency**: Contact your DevOps team

---

**Last Updated**: 2026-01-01
**Version**: 1.0.0
