#!/bin/bash

# Deployment script for jschan imageboard
# This script helps automate the deployment process

set -e

echo "Starting deployment of jschan imageboard..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Update system packages
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Node.js (v18)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install other dependencies
echo "Installing dependencies..."
apt install -y git nginx ufw certbot python3-certbot-nginx

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2

# Configure firewall
echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create application directory
echo "Setting up application directory..."
mkdir -p /home/jschan
cd /home/jschan

# Clone repository (if not already cloned)
if [ ! -d "jschan" ]; then
    echo "Cloning repository..."
    git clone <YOUR_REPO_URL> jschan
    cd jschan
else
    echo "Repository already exists, pulling latest changes..."
    cd jschan
    git pull
fi

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Build static files
echo "Building static files..."
npm run build

# Configure nginx
echo "Configuring nginx..."
cp nginx.conf /etc/nginx/sites-available/induschan.site
ln -sf /etc/nginx/sites-available/induschan.site /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Setup SSL (if domain is configured)
echo "Setting up SSL with Let's Encrypt..."
read -p "Enter your domain (e.g., induschan.site): " domain
if [ ! -z "$domain" ]; then
    certbot --nginx -d "$domain" -d "www.$domain"
fi

# Start application with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Deployment complete!"
echo "Please update configs/secrets.js with your production values before starting."
echo "Application logs: pm2 logs"
echo "Nginx logs: tail -f /var/log/nginx/error.log"
