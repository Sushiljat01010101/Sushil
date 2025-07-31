# Deployment Guide

This guide covers various deployment options for the Navadaya Girls Hostel Management System.

## 🚀 Quick Deploy Options

### 1. Heroku Deployment

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

**Manual Deployment:**
```bash
# 1. Install Heroku CLI
npm install -g heroku

# 2. Login to Heroku
heroku login

# 3. Create app
heroku create navadaya-hostel-app

# 4. Set environment variables
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)

# 5. Deploy
git push heroku main
```

### 2. Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

**Manual Deployment:**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# 3. Set environment variables in Vercel dashboard
# SESSION_SECRET=your-secret-key
```

### 3. Railway Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

**Manual Deployment:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway create

# 4. Deploy
railway up

# 5. Set environment variables
railway variables:set SESSION_SECRET=$(openssl rand -base64 32)
```

### 4. DigitalOcean App Platform

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your GitHub repository
4. Configure:
   - **Name**: navadaya-hostel
   - **Region**: Choose closest to your users
   - **Plan**: Basic ($5/month)
   - **Environment Variables**: `SESSION_SECRET`

### 5. Google Cloud Run

```bash
# 1. Build and deploy
gcloud run deploy navadaya-hostel \
    --source . \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars SESSION_SECRET=$(openssl rand -base64 32)
```

## 🔧 Environment Variables

Required environment variables for production:

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | Flask session secret key | Yes |
| `FLASK_ENV` | Environment (production/development) | No |

**Generate secure session secret:**
```bash
# Linux/Mac
openssl rand -base64 32

# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 🔥 Firebase Configuration

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project: "navadaya-hostel"
3. Enable Firestore Database
4. Enable Authentication (Email/Password + Google)

### 2. Configure Authentication
```javascript
// In Firebase Console > Authentication > Sign-in method
// Enable:
// - Email/Password
// - Google (optional)

// Set authorized domains:
// - localhost (for development)
// - your-app-domain.com (for production)
```

### 3. Firestore Security Rules
```javascript
// Copy rules from firebase-security-rules.txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin users only
    match /admins/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Students can read/write their own data
    match /students/{studentId} {
      allow read, write: if request.auth != null;
    }
    
    // Public read access for some collections
    match /notices/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Admin only in production
    }
  }
}
```

### 4. Update Firebase Config
Update `js/firebase-config.js` with your project credentials:
```javascript
const config = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "main:app"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - SESSION_SECRET=your-secret-key
      - FLASK_ENV=production
    restart: unless-stopped
```

### Deploy with Docker
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🌐 Domain Configuration

### Custom Domain Setup
1. **Purchase domain** from registrar (Namecheap, GoDaddy, etc.)
2. **Configure DNS records:**
   ```
   Type: CNAME
   Name: @
   Value: your-app.herokuapp.com (or other platform)
   
   Type: CNAME  
   Name: www
   Value: your-app.herokuapp.com
   ```
3. **Update platform settings** to use custom domain
4. **Enable SSL/TLS** (usually automatic)

### Subdomain Setup
For subdomain like `hostel.yourdomain.com`:
```
Type: CNAME
Name: hostel
Value: your-app.herokuapp.com
```

## 🔒 Security Checklist

### Production Security
- [ ] Use HTTPS only
- [ ] Set strong SESSION_SECRET
- [ ] Configure Firebase security rules
- [ ] Enable CSRF protection
- [ ] Set secure headers
- [ ] Regular security updates
- [ ] Monitor error logs

### Firebase Security
- [ ] Restrict API keys to specific domains
- [ ] Configure proper Firestore rules
- [ ] Enable audit logging
- [ ] Set up backup schedule
- [ ] Monitor usage quotas

## 📊 Monitoring & Analytics

### Application Monitoring
```python
# Add to main.py for basic logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)
```

### Error Tracking
Consider integrating:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **Google Analytics** for usage analytics

### Performance Monitoring
- Use platform-specific monitoring (Heroku Metrics, Vercel Analytics)
- Monitor Firebase usage in Firebase Console
- Set up alerts for high error rates

## 🚨 Troubleshooting

### Common Issues

**CORS Errors:**
```python
# Add to main.py
from flask_cors import CORS
CORS(app, origins=['https://your-domain.com'])
```

**Firebase Connection Issues:**
- Check API key restrictions
- Verify domain authorization
- Review Firestore security rules

**PDF Generation Errors:**
```bash
# Install additional fonts for better PDF support
apt-get install fonts-liberation
```

**Memory Issues:**
- Increase dyno/container memory
- Implement file cleanup for temporary QR codes
- Use streaming for large reports

### Health Check Endpoint
```python
@app.route('/health')
def health_check():
    return {'status': 'healthy', 'timestamp': datetime.now().isoformat()}
```

## 📈 Scaling Considerations

### Database Scaling
- Monitor Firestore read/write quotas
- Implement efficient querying
- Consider Firebase pricing tiers

### Application Scaling
- Use multiple workers with Gunicorn
- Implement caching for static data
- Consider CDN for assets

### Cost Optimization
- Monitor platform usage
- Implement automatic scaling
- Use efficient database queries
- Compress images and assets

---

**Need help?** Check the main README.md or create an issue in the repository.