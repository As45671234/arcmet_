# Security & Environment Setup

## Critical: Environment Variables

### DO NOT commit `.env` files

The `.env` files contain sensitive information:
- Database URI and credentials
- Admin passwords
- JWT secrets
- Email SMTP credentials

These are **NEVER** stored in the repository. Instead:

1. **Local Development:**
   - Create `backend/.env` locally (ignored by `.gitignore`)
   - Create `frontend/.env.local` locally (ignored by `.gitignore`)

2. **VPS Production:**
   - Create `.env` files manually on the VPS
   - Use strong, unique values (generate with `openssl rand -hex 32`)
   - Restrict file permissions: `chmod 600 .env`

3. **Git History (if accidentally committed):**
   ```bash
   # Remove sensitive files from git history
   git rm --cached backend/.env
   git rm --cached frontend/.env.local
   git commit -m "Remove sensitive .env files from tracking"
   git push
   
   # Rotate all secrets in these files immediately
   ```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Backend server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | See below |
| `ADMIN_PASSWORD` | Admin panel login password | Must be strong (12+ chars, mixed) |
| `JWT_SECRET` | Token signing secret (32+ chars) | `openssl rand -hex 32` |
| `SMTP_HOST` | Email server host | `smtp.gmail.com` |
| `SMTP_PORT` | Email server port | `465` |
| `SMTP_SECURE` | Use TLS/SSL | `true` |
| `SMTP_USER` | Email account | `your-email@gmail.com` |
| `SMTP_PASS` | Email password (app-specific) | Gmail App Password |
| `SMTP_FROM` | From email header | `ARCMET <noreply@domain.com>` |
| `MAIL_TO` | Default recipient for leads | `admin@domain.com` |
| `MAIL_REPLY_TO` | Reply-to address | `support@domain.com` |

### Frontend (`frontend/.env.local`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_BASE_URL` | Backend API endpoint | `https://yourdomain.com/api` |

---

## MongoDB Atlas Security

### Connection String (MONGODB_URI)

Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

**Steps:**
1. Create a MongoDB Atlas account
2. Create a cluster (Free tier is fine for development)
3. Create a database user with strong password
4. Get connection string from Atlas (note: use your actual username/password)
5. Add your VPS IP to the IP Access List

### IP Whitelist

- **Development:** Add your local machine IP
- **VPS:** Add VPS public IP
- **Do NOT use `0.0.0.0/0`** in production (allows anyone)

---

## JWT Secret Generation

```bash
# Generate a strong JWT_SECRET
openssl rand -hex 32

# Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Admin Password Requirements

- **Minimum 12 characters**
- **Mix of uppercase, lowercase, numbers, symbols**
- **Example:** `MyStr0ng!Pass2024`

Generate with:
```bash
# On Mac/Linux:
openssl rand -base64 16

# On Windows PowerShell:
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Minimum 1000000000 -Maximum 9999999999)))
```

---

## SMTP Setup (Gmail Example)

1. Enable 2-Factor Authentication on Google Account
2. Generate App Password (not account password):
   - Go to https://myaccount.google.com/security
   - App passwords → Select Mail & Windows Computer → Generate
3. Use the 16-character password as `SMTP_PASS`

**Alternatives:**
- SendGrid, Mailgun, AWS SES, Resend, etc.

---

## VPS Security Hardening

### SSH Key Setup (do NOT use password auth)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/id_ed25519.pub ubuntu@your-vps-ip

# Disable password authentication on VPS
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PubkeyAuthentication yes

sudo systemctl restart ssh
```

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### File Permissions

```bash
# Backend .env
chmod 600 backend/.env

# Uploads directory
chmod 755 backend/uploads
chmod 644 backend/uploads/products/*

# Home directory
chmod 700 ~
```

---

## Incident Response: Exposed Secrets

If you accidentally commit sensitive data:

1. **Immediately rotate all secrets:**
   - Change `ADMIN_PASSWORD` on VPS
   - Generate new `JWT_SECRET`
   - Reset MongoDB Atlas password
   - Reset SMTP app password

2. **Remove from git history:**
   ```bash
   git rm --cached backend/.env
   git commit -m "Remove .env from tracking"
   git push
   ```

3. **Clean git history (nuclear option - cleans entire history):**
   ```bash
   git filter-branch --tree-filter 'rm -f backend/.env' HEAD
   # This rewrites history - coordinate with team
   ```

4. **Enable branch protection on GitHub:**
   - Settings → Branches → Branch protection rules
   - Require pull request reviews before merging

---

## Monitoring & Auditing

### Enable Nginx Logs
```bash
# Check access logs for suspicious activity
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### PM2 Logs
```bash
# Monitor backend application logs
pm2 logs arcmet-backend
pm2 status  # check uptime and memory usage
```

### MongoDB Atlas
- Enable MFA in Atlas account settings
- Monitor connection logs in Atlas console
- Set up alerts for unusual activity

---

## Best Practices Checklist

- [ ] `.env` files in `.gitignore` ✓ (we've configured this)
- [ ] Use environment variables, never hardcoded secrets
- [ ] Rotate secrets regularly (quarterly minimum)
- [ ] Use strong passwords (12+ mixed characters)
- [ ] Enable HTTPS/TLS (Let's Encrypt)
- [ ] Enable 2FA on GitHub, MongoDB Atlas, all accounts
- [ ] Regular backups (automated in MongoDB Atlas)
- [ ] Security headers in Nginx (HSTS, CSP, etc.)
- [ ] Rate limiting on API endpoints (already in code)
- [ ] Input validation on all endpoints (already in code)
- [ ] SQL injection prevention (using Mongoose/ODM)
- [ ] XSS protection (using React, no eval/innerHTML)

---

## Questions?

For security issues, email security@yourdomain.com (do NOT post in issues or public forums)
