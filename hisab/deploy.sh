#!/bin/bash

# HISAB Backend EC2 Deployment Script
# Make sure to run this script from your local machine, not on EC2

echo "🚀 Starting HISAB Backend Deployment to EC2..."

# Configuration - UPDATE THESE VALUES
EC2_HOST="ec2-100-25-217-12.compute-1.amazonaws.com"
EC2_USER="ubuntu"
EC2_KEY_PATH="./hisab.pem"
PROJECT_NAME="hisab-backend"
REMOTE_DIR="/home/ubuntu/apps"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "EC2 Host: $EC2_HOST"
echo "EC2 User: $EC2_USER"
echo "Project: $PROJECT_NAME"
echo "Remote Directory: $REMOTE_DIR"
echo ""

# Check if required files exist
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in current directory${NC}"
    exit 1
fi

if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ index.js not found in current directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Local files verified${NC}"

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
tar --exclude='node_modules' --exclude='.git' --exclude='logs' --exclude='*.log' -czf deploy.tar.gz .

# Upload to EC2
echo -e "${YELLOW}📤 Uploading to EC2...${NC}"
scp -i $EC2_KEY_PATH deploy.tar.gz $EC2_USER@$EC2_HOST:~/

# Execute deployment commands on EC2
echo -e "${YELLOW}🔧 Executing deployment on EC2...${NC}"
ssh -i $EC2_KEY_PATH $EC2_USER@$EC2_HOST << ENDSSH
    # Create apps directory if it doesn't exist
    mkdir -p $REMOTE_DIR
    
    # Stop existing application if running
    if pm2 list | grep -q "hisab-backend"; then
        echo "🛑 Stopping existing application..."
        pm2 stop hisab-backend
        pm2 delete hisab-backend
    fi
    
    # Remove old deployment
    rm -rf $REMOTE_DIR/$PROJECT_NAME
    
    # Extract new deployment
    echo "📂 Extracting new deployment..."
    mkdir -p $REMOTE_DIR/$PROJECT_NAME
    tar -xzf ~/deploy.tar.gz -C $REMOTE_DIR/$PROJECT_NAME
    cd $REMOTE_DIR/$PROJECT_NAME
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install --production
    
    # Create logs directory
    mkdir -p logs
    
    # Start application with PM2
    echo "🚀 Starting application..."
    pm2 start ecosystem.config.cjs --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup
    
    # Clean up
    rm ~/deploy.tar.gz
    
    echo "✅ Deployment completed successfully!"
    echo "📊 Application status:"
    pm2 list
ENDSSH

# Clean up local deployment package
rm deploy.tar.gz

echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Check your application at: http://$EC2_HOST:5000"
echo "2. Configure your security group to allow port 5000"
echo "3. Set up environment variables on EC2"
echo "4. Configure Nginx as reverse proxy (optional but recommended)" 