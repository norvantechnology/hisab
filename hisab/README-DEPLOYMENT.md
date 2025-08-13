# 🚀 HISAB Backend EC2 Deployment Guide

This guide will walk you through deploying your Express.js backend to AWS EC2.

## 📋 Prerequisites

- AWS Account with EC2 access
- SSH key pair for EC2
- Domain name (optional but recommended)
- Basic knowledge of AWS services

## 🎯 Step-by-Step Deployment

### Step 1: Launch EC2 Instance

1. **Go to AWS Console → EC2 → Launch Instance**
2. **Choose Amazon Machine Image (AMI):**
   - Select "Ubuntu Server 22.04 LTS" (free tier eligible)
3. **Choose Instance Type:**
   - For development: `t2.micro` (free tier)
   - For production: `t3.small` or larger
4. **Configure Instance Details:**
   - Network: Default VPC
   - Subnet: Default subnet
5. **Add Storage:**
   - Keep default (8GB for free tier)
6. **Configure Security Group:**
   - SSH (Port 22): Your IP
   - HTTP (Port 80): 0.0.0.0/0
   - HTTPS (Port 443): 0.0.0.0/0
   - Custom TCP (Port 5000): 0.0.0.0/0
7. **Review and Launch:**
   - Select your key pair
   - Launch instance

### Step 2: Connect to EC2 Instance

```bash
# Replace with your actual values
ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-public-ip
```

### Step 3: Setup EC2 Instance

Run the setup script on your EC2 instance:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/hisab/main/ec2-setup.sh | bash
```

**Or manually run these commands:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Start services
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 4: Configure Environment Variables

Create a `.env` file on your EC2 instance:

```bash
# On EC2 instance
cd /home/ubuntu/apps/hisab-backend
nano .env
```

Add your environment variables:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=your_production_database_url
JWT_SECRET=your_jwt_secret
# Add other required environment variables
```

### Step 5: Deploy Your Application

#### Option A: Using the Deployment Script (Recommended)

1. **Update the deployment script:**
   ```bash
   # Edit deploy.sh and update these values:
   EC2_HOST="your-ec2-public-ip"
   EC2_USER="ubuntu"
   EC2_KEY_PATH="~/.ssh/your-key.pem"
   ```

2. **Make the script executable:**
   ```bash
   chmod +x deploy.sh
   ```

3. **Run the deployment:**
   ```bash
   ./deploy.sh
   ```

#### Option B: Manual Deployment

1. **Upload your code:**
   ```bash
   # From your local machine
   scp -i ~/.ssh/your-key.pem -r . ubuntu@your-ec2-ip:/home/ubuntu/apps/hisab-backend/
   ```

2. **On EC2, install dependencies and start:**
   ```bash
   cd /home/ubuntu/apps/hisab-backend
   npm install --production
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

### Step 6: Verify Deployment

1. **Check PM2 status:**
   ```bash
   pm2 list
   pm2 logs hisab-backend
   ```

2. **Test your API:**
   ```bash
   curl http://localhost:5000/api/auth
   ```

3. **Check Nginx:**
   ```bash
   sudo systemctl status nginx
   curl http://your-ec2-ip
   ```

## 🔧 Configuration Files

### PM2 Ecosystem Config (`ecosystem.config.js`)
- Manages your application process
- Handles clustering and restart policies
- Configures logging

### Nginx Configuration
- Acts as reverse proxy
- Handles SSL termination (when configured)
- Provides load balancing capabilities

## 📊 Monitoring and Management

### PM2 Commands
```bash
# View all processes
pm2 list

# View logs
pm2 logs hisab-backend

# Restart application
pm2 restart hisab-backend

# Stop application
pm2 stop hisab-backend

# Delete application
pm2 delete hisab-backend

# Monitor resources
pm2 monit
```

### Nginx Commands
```bash
# Check status
sudo systemctl status nginx

# Reload configuration
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔒 Security Considerations

1. **Firewall Configuration:**
   - Only open necessary ports
   - Restrict SSH access to your IP

2. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use strong, unique secrets

3. **Regular Updates:**
   - Keep system packages updated
   - Monitor security advisories

## 🚨 Troubleshooting

### Common Issues

1. **Application won't start:**
   ```bash
   pm2 logs hisab-backend
   # Check for missing environment variables or dependencies
   ```

2. **Port already in use:**
   ```bash
   sudo netstat -tlnp | grep :5000
   # Kill the process using the port
   ```

3. **Nginx not working:**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   # Check configuration syntax
   ```

4. **Permission denied:**
   ```bash
   sudo chown -R ubuntu:ubuntu /home/ubuntu/apps
   # Fix ownership issues
   ```

### Log Locations
- **PM2 logs:** `/home/ubuntu/apps/hisab-backend/logs/`
- **Nginx logs:** `/var/log/nginx/`
- **System logs:** `/var/log/syslog`

## 📈 Scaling and Performance

1. **PM2 Clustering:**
   - Automatically uses all CPU cores
   - Handles load balancing

2. **Nginx Optimization:**
   - Configure gzip compression
   - Set up caching headers
   - Enable HTTP/2

3. **Database Optimization:**
   - Use connection pooling
   - Implement query optimization
   - Consider read replicas for heavy loads

## 🔄 Continuous Deployment

For automated deployments, consider:
- GitHub Actions
- AWS CodeDeploy
- Jenkins
- GitLab CI/CD

## 📞 Support

If you encounter issues:
1. Check the logs first
2. Verify configuration files
3. Test individual components
4. Check AWS service status

---

**Happy Deploying! 🎉** 