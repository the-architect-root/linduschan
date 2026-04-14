# Deployment Guide for induschan.site

This guide explains how to deploy the jschan imageboard to a public server.

## Prerequisites
- Ubuntu 22.04 LTS server (or similar)
- Domain: induschan.site
- Cloudflare account (for DNS and R2 storage)
- MongoDB Atlas account
- Redis Labs account

## Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 Install Other Dependencies
```bash
sudo apt install -y git nginx ufw certbot python3-certbot-nginx
```

### 1.4 Install PM2 Globally
```bash
sudo npm install -g pm2
```

### 1.5 Configure Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 2: Configure Cloudflare

### 2.1 Add Domain to Cloudflare
1. Log in to Cloudflare dashboard
2. Add induschan.site
3. Update nameservers at GoDaddy to Cloudflare's nameservers

### 2.2 Configure DNS Records
- A record: induschan.site → your server IP
- CNAME record: www.induschan.site → induschan.site

### 2.3 Enable DDoS Protection
- Cloudflare's free tier provides basic DDoS protection
- Enable "Under Attack Mode" if needed during attacks

## Step 3: Set Up Cloudflare R2

### 3.1 Create R2 Bucket
1. Go to Cloudflare R2 dashboard
2. Create a new bucket (e.g., induschan-files)
3. Note the bucket name

### 3.2 Generate API Keys
1. Go to R2 Settings → API Tokens
2. Create an API token with R2 permissions
3. Note the Access Key ID and Secret Access Key

### 3.3 Configure Public Access
- Option A: Use Cloudflare Workers to serve files
- Option B: Use R2's public URL (your-bucket.r2.dev)

### 3.4 Update Application Config
Edit `configs/secrets.js`:
```javascript
r2: {
    accountId: 'your-account-id',
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    bucketName: 'induschan-files',
    region: 'auto',
    publicUrl: 'https://induschan-files.r2.dev'
}
```

## Step 4: Deploy Application

### 4.1 Clone Repository
```bash
cd /home
git clone <your-repo-url> jschan
cd jschan
```

### 4.2 Install Dependencies
```bash
npm install
```

### 4.3 Update Configuration
Edit `configs/secrets.js` with production values:
- MongoDB connection string (already configured)
- Redis connection info (already configured)
- Cloudflare R2 credentials
- Strong, unique secrets for cookieSecret, tripcodeSecret, etc.
- Update CAPTCHA keys if using them

### 4.4 Build Static Files
```bash
npm run build
```

## Step 5: Configure Nginx

### 5.1 Copy Nginx Config
```bash
sudo cp nginx.conf /etc/nginx/sites-available/induschan.site
```

### 5.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/induschan.site /etc/nginx/sites-enabled/
```

### 5.3 Test Nginx Config
```bash
sudo nginx -t
```

### 5.4 Reload Nginx
```bash
sudo systemctl reload nginx
```

## Step 6: Setup SSL with Let's Encrypt

### 6.1 Obtain SSL Certificate
```bash
sudo certbot --nginx -d induschan.site -d www.induschan.site
```

### 6.2 Test Auto-Renewal
```bash
sudo certbot renew --dry-run
```

## Step 7: Start Application with PM2

### 7.1 Start Application
```bash
pm2 start ecosystem.config.js
```

### 7.2 Save PM2 Configuration
```bash
pm2 save
```

### 7.3 Configure PM2 to Start on Boot
```bash
pm2 startup
```

### 7.4 Monitor Application
```bash
pm2 status
pm2 logs chan
```

## Step 8: Security Hardening

### 8.1 Disable Root SSH Login
Edit `/etc/ssh/sshd_config`:
```
PermitRootLogin no
PasswordAuthentication no
```

### 8.2 Restart SSH
```bash
sudo systemctl restart sshd
```

### 8.3 Install Fail2Ban
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 8.4 Update Secrets
- Change all secrets in `configs/secrets.js` to strong, unique values
- Never commit `configs/secrets.js` to git
- Add `configs/secrets.js` to `.gitignore`

## Step 9: Monitoring

### 9.1 Server Monitoring
```bash
htop
```

### 9.2 Application Logs
```bash
pm2 logs
```

### 9.3 Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.4 Set Up Uptime Monitoring
- Use UptimeRobot or similar service
- Monitor https://induschan.site

## Troubleshooting

### Application Not Starting
```bash
pm2 logs chan
```

### Nginx Issues
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Database Connection Issues
- Check MongoDB Atlas whitelist
- Verify connection string in secrets.js
- Check Redis Labs connection

### File Upload Issues
- Verify Cloudflare R2 credentials
- Check R2 bucket permissions
- Review nginx client_max_body_size setting

## Maintenance

### Update Application
```bash
cd /home/jschan
git pull
npm install
npm run build
pm2 restart all
```

### Backup Database
- MongoDB Atlas has automated backups
- Check backup retention policy

### Update SSL
- Let's Encrypt auto-renews automatically
- Verify with: `sudo certbot renew --dry-run`

## Cost Summary

- Server: $5-10/month
- Cloudflare R2: $0.015/GB storage + $0.01/10,000 operations
- MongoDB Atlas: Free tier available
- Redis Labs: Free tier available
- Cloudflare DNS: Free
- **Total: ~$5-15/month**

## Support

For issues or questions, check:
- Application logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/`
- Server logs: `/var/log/syslog`
