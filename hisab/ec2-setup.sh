#!/bin/bash

# EC2 Setup Script - Run this on your EC2 instance
# This script installs Node.js, PM2, and other dependencies

echo "🚀 Setting up EC2 instance for HISAB Backend..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
echo "📥 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
echo "✅ Node.js version:"
node --version
echo "✅ npm version:"
npm --version

# Install PM2 globally
echo "📥 Installing PM2..."
sudo npm install -g pm2

# Install Nginx (optional but recommended)
echo "📥 Installing Nginx..."
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install additional dependencies
echo "📥 Installing additional dependencies..."
sudo apt install -y git curl wget unzip

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /home/ubuntu/apps
mkdir -p /home/ubuntu/apps/logs

# Set proper permissions
sudo chown -R ubuntu:ubuntu /home/ubuntu/apps

# Configure firewall (if using UFW)
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 5000
sudo ufw --force enable

# Create Nginx configuration for reverse proxy
echo "⚙️ Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/hisab-backend > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/hisab-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Setup PM2 startup script
echo "⚙️ Setting up PM2 startup..."
pm2 startup

echo "✅ EC2 setup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Upload your application code"
echo "2. Set up environment variables"
echo "3. Start your application with PM2"
echo "4. Your app will be accessible at: http://your-ec2-ip"
echo ""
echo "🔧 Useful commands:"
echo "- Check PM2 status: pm2 list"
echo "- View logs: pm2 logs hisab-backend"
echo "- Restart app: pm2 restart hisab-backend"
echo "- Check Nginx status: sudo systemctl status nginx" 