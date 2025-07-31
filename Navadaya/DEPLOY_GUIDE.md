# Quick Deployment Guide

This is a quick reference for deploying the Navadaya Girls Hostel Management System on GitHub and various hosting platforms.

## 🚀 One-Click Deployments

### Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/navadaya-hostel-management)

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/navadaya-hostel)

## 📋 Pre-Deployment Checklist

### 1. Firebase Setup (Required)
- [ ] Create Firebase project
- [ ] Enable Firestore Database
- [ ] Enable Authentication (Email/Password + Google)
- [ ] Configure security rules
- [ ] Update `js/firebase-config.js` with your credentials

### 2. Environment Variables
- [ ] Set `SESSION_SECRET` (generate with: `openssl rand -base64 32`)
- [ ] Configure platform-specific environment variables

### 3. Domain Configuration
- [ ] Set up custom domain (optional)
- [ ] Configure DNS records
- [ ] Enable SSL/HTTPS

## 🛠️ Platform-Specific Instructions

### GitHub Pages (Static Only)
```bash
git clone https://github.com/yourusername/navadaya-hostel-management.git
cd navadaya-hostel-management
# Push to GitHub and enable Pages in repository settings
```

### Manual Heroku Deployment
```bash
heroku create your-app-name
heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
git push heroku main
```

### Docker Deployment
```bash
docker-compose up -d
```

### Local Development
```bash
git clone https://github.com/yourusername/navadaya-hostel-management.git
cd navadaya-hostel-management
pip install -r requirements.txt
python main.py
```

## 🔧 Post-Deployment Setup

### 1. Firebase Configuration
1. Go to Firebase Console
2. Navigate to Authentication → Settings → Authorized domains
3. Add your deployment domain
4. Update Firestore security rules
5. Test authentication flow

### 2. Admin Account Setup
1. Visit your deployed application
2. Click "Create Admin Account"
3. Use email: admin@hostel.com, password: admin123
4. Change credentials after first login

### 3. Sample Data (Optional)
1. Use the "Test Database Connection" button
2. Load sample data from `firebase-init.js`
3. Create test students and rooms

## 🔍 Troubleshooting

### Common Issues
- **CORS Errors**: Check Firebase authorized domains
- **Authentication Fails**: Verify Firebase configuration
- **PDF Generation Issues**: Check platform fonts
- **Build Failures**: Verify all dependencies are listed

### Health Check
Visit `/health` endpoint to verify deployment status

### Logs
- Heroku: `heroku logs --tail`
- Vercel: Check dashboard logs
- Railway: View deployment logs

## 📞 Support
- Documentation: See README.md and DEPLOYMENT.md
- Issues: Create GitHub issue
- Security: See SECURITY.md

---
**Quick Start**: Firebase → Deploy → Configure → Test