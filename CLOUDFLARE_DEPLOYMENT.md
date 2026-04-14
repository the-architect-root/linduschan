# Cloudflare Workers + Pages Deployment Guide

This guide explains how to deploy induschan.site using Cloudflare Workers and Cloudflare Pages without a VPS.

## Prerequisites
- Cloudflare account (free tier)
- GitHub repository
- Domain: induschan.site
- MongoDB Atlas account
- Redis Labs account
- Cloudflare R2 bucket

## Step 1: Configure Cloudflare DNS

### 1.1 Add Domain to Cloudflare
1. Log in to Cloudflare dashboard
2. Add induschan.site to Cloudflare
3. Update nameservers at GoDaddy to Cloudflare's nameservers

### 1.2 Configure DNS Records
- A record: induschan.site → (will be set by Cloudflare Pages)
- CNAME: www.induschan.site → induschan.site

## Step 2: Set Up Cloudflare R2

### 2.1 Create R2 Bucket
1. Go to Cloudflare R2 dashboard
2. Create a new bucket: `induschan-files`
3. Note the bucket name

### 2.2 Generate API Keys
1. Go to R2 Settings → API Tokens
2. Create an API token with R2 permissions
3. Note the Access Key ID and Secret Access Key

### 2.3 Configure Public Access
- Option A: Use Cloudflare Workers to serve files
- Option B: Use R2's public URL (induschan-files.r2.dev)

### 2.4 Update Application Config
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

## Step 3: Deploy Static Files to Cloudflare Pages

### 3.1 Connect GitHub Repository
1. Go to Cloudflare Pages dashboard
2. Click "Create a project"
3. Connect your GitHub repository

### 3.2 Configure Build Settings
- Build command: `bash .cloudflare-pages-build.sh`
- Build output directory: `static/`
- Root directory: `/`
- Node version: 18

### 3.3 Add Environment Variables
Add these environment variables in Cloudflare Pages:
- MONGODB_URL: Your MongoDB Atlas connection string
- REDIS_URL: Your Redis Labs connection string
- R2_ACCESS_KEY_ID: Your R2 access key
- R2_SECRET_ACCESS_KEY: Your R2 secret key
- R2_BUCKET_NAME: induschan-files
- COOKIE_SECRET: Strong random string
- TRIPCODE_SECRET: Strong random string
- IP_HASH_SECRET: Strong random string
- POST_PASSWORD_SECRET: Strong random string

### 3.4 Deploy
- Click "Save and Deploy"
- Cloudflare Pages will build and deploy static files
- Note the deployment URL

### 3.5 Configure Custom Domain
- In Cloudflare Pages project settings, add custom domain: induschan.site
- Update DNS at Cloudflare to point to Pages

## Step 4: Deploy Backend API

**Important**: The current jschan application is a traditional Node.js application that requires a persistent server. Cloudflare Workers has limitations:
- No persistent WebSocket connections
- Limited runtime (CPU time limits)
- No built-in support for Node.js modules

### Option A: Use a PaaS for Backend (Recommended)

Since you don't want a VPS, use a PaaS service for the backend:

#### Render (Free tier available)
1. Create Render account
2. Connect GitHub repository
3. Create Web Service:
   - Build Command: `npm install && npm run build`
   - Start Command: `node server.js`
   - Instance Type: Free (512MB RAM)
4. Add environment variables (same as Cloudflare Pages)
5. Deploy
6. Configure custom domain in Render
7. Update Cloudflare DNS to point to Render

#### Railway ($5/month)
1. Create Railway account
2. Connect GitHub repository
3. Add web service
4. Add environment variables
5. Deploy
6. Configure custom domain

### Option B: Use Cloudflare Workers with Adaptations

This requires significant code changes to make the application serverless-compatible:
- Convert to use Cloudflare Workers runtime
- Use D1 or external databases instead of direct connections
- Implement WebSocket alternative
- Handle stateless execution

This is complex and not recommended for a quick deployment.

## Step 5: Configure Cloudflare Worker (Optional)

If you deploy the backend to a PaaS, you can use Cloudflare Workers as a proxy:

### 5.1 Update cloudflare-worker.js
```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Proxy backend API requests to your PaaS backend
    if (url.pathname.startsWith('/forms/') || url.pathname.startsWith('/api/')) {
      const backendUrl = 'https://your-backend.render.tech';
      const backendRequest = new Request(backendUrl + url.pathname + url.search, request);
      return fetch(backendRequest);
    }
    
    // Serve static files from Cloudflare Pages
    return fetch(request);
  },
};
```

### 5.2 Deploy Worker
```bash
npm install -g wrangler
wrangler publish
```

## Step 6: Update DNS Configuration

### 6.1 Cloudflare DNS
- A record: induschan.site → Cloudflare Pages IP
- CNAME: api.induschan.site → Your backend PaaS URL (if using separate backend)

### 6.2 GoDaddy
- Nameservers should already be pointing to Cloudflare

## Step 7: Security Configuration

### 7.1 Cloudflare Security
- Enable Cloudflare's WAF
- Configure rate limiting rules
- Enable Bot Fight Mode
- Set up Page Rules for security

### 7.2 Backend Security
- Use strong secrets in environment variables
- Enable SSL/TLS (automatic on Cloudflare and most PaaS)
- Configure CORS if needed
- Implement rate limiting in the application

## Cost Summary

### Cloudflare Pages (Static Files)
- Free tier: Unlimited bandwidth, 500 builds/month

### Cloudflare Workers (Optional)
- Free tier: 100,000 requests/day

### Backend PaaS (Required)
- Render: Free (512MB RAM) or $7/month (2GB RAM)
- Railway: $5/month (512MB RAM)

### Cloudflare R2 (File Storage)
- $0.015/GB storage
- $0.01/10,000 Class B operations

### MongoDB Atlas
- Free tier: 512MB storage

### Redis Labs
- Free tier: 30MB storage

### Total Monthly Cost
- Free option: ~$0-5/month (using Render free tier)
- Paid option: ~$7-12/month (using paid tiers)

## Architecture

```
User → Cloudflare (DNS/DDoS) → Cloudflare Pages (Static Files)
                                   ↓
                            Cloudflare Worker (Optional Proxy)
                                   ↓
                            PaaS Backend (Render/Railway)
                                   ↓
                            MongoDB Atlas + Redis Labs
                                   ↓
                            Cloudflare R2 (File Storage)
```

## Troubleshooting

### Static Files Not Loading
- Check Cloudflare Pages deployment logs
- Verify build command completed successfully
- Check DNS configuration

### Backend API Not Working
- Verify backend is running on PaaS
- Check environment variables are set correctly
- Check database connections
- Review backend logs

### File Upload Issues
- Verify R2 credentials are correct
- Check R2 bucket permissions
- Review R2 public access settings

### WebSocket Issues
- WebSockets may not work well with serverless
- Consider using polling or WebRTC alternatives
- Or use a PaaS that supports WebSockets (Render supports WebSockets)

## Maintenance

### Update Static Files
- Push changes to GitHub
- Cloudflare Pages auto-deploys

### Update Backend
- Push changes to GitHub
- PaaS auto-deploys (Render/Railway)

### Update Secrets
- Update environment variables in Cloudflare Pages/PaaS dashboards
- No code changes needed

## Support

- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Render: https://render.com/docs
- Railway: https://docs.railway.app/
