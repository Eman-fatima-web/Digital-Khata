# Digital Khata — Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for Digital Khata, including backup strategies, recovery procedures, and business continuity planning.

## Recovery Objectives

### RPO (Recovery Point Objective)
**Target**: 24 hours maximum data loss

- **Supabase**: Daily automated backups (24-hour RPO)
- **AWS RDS**: Point-in-time recovery (5-minute RPO with automated backups)
- **Manual backups**: Depends on backup frequency (recommend daily minimum)

### RTO (Recovery Time Objective)
**Target**: 2 hours maximum downtime

- **Database restore**: 30-60 minutes
- **Application restart**: 10-15 minutes
- **Verification**: 30-60 minutes
- **Total**: 1-2 hours

## Backup Strategy

### Database Backups

#### Automated Backups (Recommended)

**Supabase:**
- Automatic daily backups
- 7-day retention (free tier)
- 30-day retention (pro tier)
- Point-in-time recovery available

**AWS RDS:**
- Enable automated backups in RDS console
- Retention period: 7-35 days (recommend 30 days)
- Backup window: During low-traffic period (e.g., 2-3 AM)
- Automated snapshots every day

**Manual Backup Script:**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/digital-khata"
FILENAME="digital_khata_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_DIR/$FILENAME

# Compress backup
gzip $BACKUP_DIR/$FILENAME

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Log backup
echo "Backup completed: $FILENAME.gz" >> /var/log/digital-khata-backup.log
```

**Cron Job (Daily at 2 AM):**
```bash
0 2 * * * /path/to/backup.sh
```

### Application Backups

**Code Repository:**
- GitHub repository with version control
- All changes tracked in git
- Branch protection rules enabled

**Environment Variables:**
- Document all required environment variables
- Store securely (not in code repository)
- Use secrets manager (AWS Secrets Manager, etc.)

**Configuration Files:**
- Version control all configuration files
- Document any manual configuration steps

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:**
- Application errors related to database
- Health check fails: `/health/ready` returns 503
- Database connection errors in logs

**Recovery Procedure:**
1. **Stop application** to prevent further corruption
   ```bash
   # Railway/Render
   # Use dashboard to stop service
   
   # AWS EC2
   pm2 stop digital-khata
   ```

2. **Assess damage**
   ```bash
   # Check database status
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check for corruption
   psql $DATABASE_URL -c "REINDEX DATABASE digital_khata;"
   ```

3. **Restore from backup**
   ```bash
   # Create new database
   createdb digital_khata_restored
   
   # Restore backup
   gunzip -c /backups/digital-khata/digital_khata_20260101_020000.sql.gz | psql digital_khata_restored
   
   # Verify restore
   psql digital_khata_restored -c "SELECT COUNT(*) FROM customers;"
   ```

4. **Switch to restored database**
   ```bash
   # Update DATABASE_URL to point to restored database
   # Restart application
   ```

5. **Verify functionality**
   ```bash
   # Test health endpoints
   curl https://api.yourdomain.com/health/ready
   
   # Test application functionality
   # Login, create customer, record payment, etc.
   ```

6. **Monitor for 24 hours**

### Scenario 2: Application Server Failure

**Symptoms:**
- Application not responding
- Health check fails: `/health` returns error
- Server unreachable

**Recovery Procedure:**
1. **Check server status**
   ```bash
   # AWS EC2
   aws ec2 describe-instance-status --instance-ids i-1234567890
   
   # Railway/Render
   # Check dashboard for service status
   ```

2. **Restart application**
   ```bash
   # AWS EC2
   pm2 restart digital-khata
   
   # Railway/Render
   # Use dashboard to restart service
   ```

3. **If restart fails, redeploy**
   ```bash
   # Pull latest code
   git pull origin main
   
   # Reinstall dependencies
   npm install
   
   # Rebuild
   npm run build
   
   # Restart
   pm2 restart digital-khata
   ```

4. **Verify functionality**
   ```bash
   curl https://api.yourdomain.com/health
   ```

### Scenario 3: Complete Infrastructure Loss

**Symptoms:**
- All services unavailable
- Cannot access server or database

**Recovery Procedure:**
1. **Provision new infrastructure**
   - New server instance (EC2, Railway, Render)
   - New database instance (RDS, Supabase, Neon)

2. **Restore database from backup**
   ```bash
   # Download latest backup
   # Restore to new database
   gunzip -c backup.sql.gz | psql $NEW_DATABASE_URL
   ```

3. **Deploy application**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/digital-khata.git
   
   # Install dependencies
   npm install
   
   # Set environment variables
   export DATABASE_URL=...
   export JWT_SECRET=...
   
   # Build and start
   npm run build
   pm2 start server/index.js
   ```

4. **Update DNS** (if needed)
   - Point domain to new server IP

5. **Verify all functionality**

6. **Monitor for 48 hours**

### Scenario 4: Data Loss (Accidental Deletion)

**Symptoms:**
- Data missing that should exist
- User reports missing records

**Recovery Procedure:**
1. **Stop writes** to prevent further data loss
   - Temporarily disable write operations
   - Or stop application

2. **Identify point in time** before deletion
   ```bash
   # Check backup timestamps
   ls -la /backups/digital-khata/
   ```

3. **Restore to point in time**
   ```bash
   # Supabase: Use point-in-time recovery
   # AWS RDS: Use point-in-time recovery
   # Manual: Restore from backup before deletion
   ```

4. **Verify restored data**
   ```bash
   # Check that deleted data is restored
   psql $DATABASE_URL -c "SELECT * FROM customers WHERE id = '...';"
   ```

5. **Resume normal operations**

## Backup Verification

### Weekly Verification Test

**Procedure:**
1. **Create test database**
   ```bash
   createdb backup-test-$(date +%Y%m%d)
   ```

2. **Restore latest backup**
   ```bash
   gunzip -c /backups/digital-khata/latest.sql.gz | psql backup-test-$(date +%Y%m%d)
   ```

3. **Verify data integrity**
   ```bash
   psql backup-test-$(date +%Y%m%d) << EOF
   SELECT COUNT(*) FROM businesses;
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM customers;
   SELECT COUNT(*) FROM udhaar;
   SELECT COUNT(*) FROM payments;
   SELECT COUNT(*) FROM sales;
   EOF
   ```

4. **Test application functionality**
   - Point application to test database
   - Test login, create customer, record payment
   - Verify all features work

5. **Clean up**
   ```bash
   dropdb backup-test-$(date +%Y%m%d)
   ```

### Monthly Disaster Recovery Drill

**Procedure:**
1. **Simulate disaster** (in test environment)
2. **Execute recovery procedure**
3. **Measure RTO** (time to recover)
4. **Measure RPO** (data loss)
5. **Document lessons learned**
6. **Update procedures** if needed

## Security Considerations

### Backup Security
- **Encrypt backups** at rest
- **Secure backup storage** with proper access controls
- **Rotate backup credentials** regularly
- **Test restore** from encrypted backup

### Access Control
- **Limit database access** to application only
- **Use strong passwords** for all accounts
- **Enable 2FA** on all infrastructure accounts
- **Audit access logs** regularly

### Compliance
- **Data retention policy**: Define how long to keep data
- **Backup retention policy**: Define how long to keep backups
- **Documentation**: Keep recovery procedures documented and up-to-date

## Contact Information

### Emergency Contacts
- **Primary**: [Name, Phone, Email]
- **Secondary**: [Name, Phone, Email]
- **Database Administrator**: [Name, Phone, Email]
- **Infrastructure Provider Support**: [Phone, Email]

### Service Providers
- **Hosting**: [Provider, Account ID, Support Contact]
- **Database**: [Provider, Account ID, Support Contact]
- **Domain**: [Registrar, Account ID, Support Contact]

## Checklist

### Daily
- [ ] Verify backups completed successfully
- [ ] Check application health endpoints
- [ ] Review error logs

### Weekly
- [ ] Verify backup integrity (restore test)
- [ ] Review security logs
- [ ] Check disk space

### Monthly
- [ ] Disaster recovery drill
- [ ] Update contact information
- [ ] Review and update procedures
- [ ] Test restore to separate environment

### Quarterly
- [ ] Full disaster recovery simulation
- [ ] Review RPO/RTO metrics
- [ ] Update disaster recovery plan
- [ ] Train team on recovery procedures

## Metrics

### Backup Metrics
- **Backup success rate**: Target 100%
- **Backup duration**: Track time to complete
- **Backup size**: Track growth over time
- **Restore time**: Track time to restore

### Recovery Metrics
- **RPO achieved**: Actual data loss in drill
- **RTO achieved**: Actual time to recover
- **Recovery success rate**: Target 100%

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-01 | 1.0.0 | Initial document | [Author] |

---

**Review Frequency**: Quarterly
**Next Review Date**: [Date]
**Document Owner**: [Name]
