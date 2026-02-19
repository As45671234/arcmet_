# ARCMET Deployment Guide (VPS)

This guide covers deploying the ARCMET e-commerce application to a VPS using Node.js, PM2, and Nginx.

## Table of Contents
- [Prerequisites](#prerequisites)
- [VPS Setup](#vps-setup)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Nginx Configuration](#nginx-configuration)
- [SSL/TLS with Let's Encrypt](#ssltls-with-lets-encrypt)
- [MongoDB Atlas Setup](#mongodb-atlas-setup)
- [Maintenance](#maintenance)

---

## Prerequisites

- **VPS Requirements:** Ubuntu 20.04+ or similar
- **Software:**
  - Node.js 18.x or higher
  - npm/yarn
  - Nginx
  - PM2 (for process management)
  - Git

Install on VPS:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git wget

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

---

## VPS Setup

### 1. Clone the repository
```bash
cd /home/ubuntu
git clone https://github.com/As45671234/acrmet_full.git
cd acrmet_full
```

### 2. Create environment files (IMPORTANT - do NOT commit these)

**`backend/.env`** (create manually on VPS, never from git):
```env
PORT=3001
MONGODB_URI=mongodb+srv://arcmet:arcmet1234@cluster0.tfn5lbp.mongodb.net/?appName=Cluster0

ADMIN_PASSWORD=your_strong_password_here
JWT_SECRET=your_long_random_secret_here_use_at_least_32_chars

MAIL_TO=your_email@domain.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password_here
SMTP_FROM="ARCMET <your_email@gmail.com>"
MAIL_REPLY_TO=your_email@gmail.com
```

**`frontend/.env.local`** (create manually on VPS):
```env
VITE_API_BASE_URL=https://yourdomain.com/api
```

⚠️ **CRITICAL:** Never commit `.env` files. Always create them manually on VPS with strong, unique values.

---

## Backend Deployment

### 1. Install dependencies
```bash
cd /home/ubuntu/acrmet_full/backend
npm ci  # use ci for production (deterministic install)
```

### 2. Create PM2 ecosystem config

Create `backend/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'arcmet-backend',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '512M',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 3. Start backend with PM2
```bash
cd /home/ubuntu/acrmet_full/backend
pm2 start ecosystem.config.js

# Save PM2 configuration to auto-start on reboot
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 4. Monitor backend
```bash
pm2 logs arcmet-backend
pm2 status
```

---

## Frontend Deployment

### 1. Build frontend
```bash
cd /home/ubuntu/acrmet_full/frontend
npm ci
npm run build
```

Output will be in `frontend/dist/`.

### 2. Serve with Nginx (see Nginx configuration below)

---

## Nginx Configuration

### 1. Create Nginx config

Create `/etc/nginx/sites-available/arcmet`:
```nginx
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL is set up)
    # return 301 https://$server_name$request_uri;

    # Frontend static files
    root /home/ubuntu/acrmet_full/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/css text/javascript application/json;
    gzip_min_length 1000;

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Uploads directory
    location /uploads/ {
        alias /home/ubuntu/acrmet_full/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/arcmet /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t  # test config
sudo systemctl restart nginx
```

---

## SSL/TLS with Let's Encrypt

### 1. Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Get certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

The certificate will auto-renew via systemd timer.

### 3. Update Nginx config for HTTPS

After getting the cert, Certbot will update the config automatically. Verify:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## MongoDB Atlas Setup

### 1. Add VPS IP to whitelist

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to **Network Access** → **IP Whitelist**
3. Click **Add IP Address**
4. Enter your VPS public IP or use `0.0.0.0/0` (temporary, restrict later)
5. Click **Confirm**

### 2. Verify connection

On VPS:
```bash
npm install -g mongo-shell  # optional, for testing
mongosh "mongodb+srv://arcmet:arcmet1234@cluster0.tfn5lbp.mongodb.net/"
```

---

## Maintenance & Monitoring

### View logs
```bash
pm2 logs arcmet-backend
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart backend
```bash
pm2 restart arcmet-backend
```

### Rebuild frontend after updates
```bash
cd /home/ubuntu/acrmet_full/frontend
git pull origin master
npm ci
npm run build
sudo systemctl restart nginx
```

### Backup MongoDB
```bash
# Schedule automated backups in MongoDB Atlas console
# Or use MongoDB CLI tools for manual backups
```

### Monitor disk space
```bash
df -h
du -sh /home/ubuntu/acrmet_full/backend/uploads/
```

---

## Security Checklist

- [ ] Changed `ADMIN_PASSWORD` to a strong unique value
- [ ] Changed `JWT_SECRET` to a long random string (32+ chars)
- [ ] Updated SMTP credentials for email notifications
- [ ] Added VPS IP to MongoDB Atlas whitelist
- [ ] Enabled HTTPS/SSL with Let's Encrypt
- [ ] Configured Nginx firewall rules (ufw)
- [ ] Set up automated backups for MongoDB
- [ ] Disabled SSH password auth (use keys only)
- [ ] Enabled UFW firewall
  ```bash
  sudo ufw allow 22/tcp  # SSH
  sudo ufw allow 80/tcp   # HTTP
  sudo ufw allow 443/tcp  # HTTPS
  sudo ufw enable
  ```

---

## Troubleshooting

### Backend won't connect to MongoDB
```bash
# Check if MongoDB Atlas whitelist includes VPS IP
# Run: curl https://checkup.amazonaws.com/ (verify your public IP)
# Or test connection: mongosh "mongodb+srv://..."
```

### Nginx returns 502 Bad Gateway
```bash
# Check if backend is running
pm2 status
pm2 logs arcmet-backend

# Verify Nginx config
sudo nginx -t
```

### Frontend showing old version
```bash
# Clear browser cache or force refresh (Ctrl+Shift+R)
# Rebuild frontend
cd frontend && npm run build
```

---

## Deployment Checklist

- [ ] Clone repo to VPS
- [ ] Create `.env` files with production values
- [ ] Run `npm ci` in backend & frontend
- [ ] Build frontend (`npm run build`)
- [ ] Start backend with PM2
- [ ] Configure Nginx
- [ ] Set up SSL/TLS
- [ ] Add VPS IP to MongoDB Atlas whitelist
- [ ] Test login and core functionality
- [ ] Set up monitoring/uptime alerts

Good luck! 🚀
