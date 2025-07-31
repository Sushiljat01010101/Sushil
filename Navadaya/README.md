# Navadaya Girls Hostel Management System

A comprehensive web-based management system for girls' hostels, featuring advanced security, real-time data management, and professional administrative tools.

## 🌟 Features

### Core Functionality
- **Student Management**: Complete student profiles, admission records, and academic information
- **Room Management**: Room assignments, capacity tracking, and maintenance requests
- **Fee Management**: Automated fee calculation, receipt generation with QR security codes
- **Leave Management**: Leave applications with approval workflow
- **Complaint System**: Student grievance management with priority tracking
- **Notice Board**: Real-time announcements and notifications

### Security Features
- **Advanced Receipt Security**: Multi-parameter verification with security hashes
- **QR Code Verification**: Tamper-proof receipt authentication system
- **Firebase Authentication**: Secure login with email/password and Google OAuth
- **Role-based Access Control**: Separate admin and student portals

### Technical Highlights
- **Real-time Updates**: Firebase Firestore for live data synchronization
- **Professional PDF Reports**: Comprehensive student and financial reports
- **Responsive Design**: Mobile-optimized interface with modern UI
- **Session Management**: Persistent login sessions with automatic cleanup

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Firebase account with Firestore database
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/navadaya-hostel-management.git
   cd navadaya-hostel-management
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Firestore Database and Authentication
   - Update `js/firebase-config.js` with your Firebase credentials
   - Set up Firebase security rules (see `firebase-security-rules.txt`)

4. **Run the application**
   ```bash
   python main.py
   ```

5. **Access the application**
   - Admin Portal: `http://localhost:5000`
   - Student Portal: `http://localhost:5000/student-portal.html`

## 📁 Project Structure

```
navadaya-hostel-management/
├── main.py                          # Flask backend server
├── index.html                       # Admin login page
├── student-portal.html              # Student portal interface
├── dashboard.html                   # Admin dashboard
├── css/styles.css                   # Unified styling
├── js/                              # JavaScript modules
│   ├── firebase-config.js           # Firebase configuration
│   ├── auth.js                      # Authentication handlers
│   ├── dashboard.js                 # Dashboard functionality
│   ├── students.js                  # Student management
│   ├── rooms.js                     # Room management
│   ├── fees.js                      # Fee management
│   └── ...                          # Other modules
├── requirements.txt                 # Python dependencies
└── firebase-security-rules.txt     # Firebase security rules
```

## 🔧 Configuration

### Firebase Setup
1. **Authentication**: Enable Email/Password and Google providers
2. **Firestore**: Create database with the following collections:
   - `students` - Student records
   - `rooms` - Room information
   - `fees` - Fee transactions
   - `notices` - Announcements
   - `complaints` - Student complaints
   - `leaveApplications` - Leave requests
   - `roomChangeRequests` - Room change applications
   - `maintenanceRequests` - Room maintenance requests

### Environment Variables
For production deployment, set up environment variables:
- `SESSION_SECRET` - Flask session secret key
- `DATABASE_URL` - PostgreSQL database URL (if using SQL features)

## 🏗️ Architecture

### Frontend
- **Technology**: Vanilla JavaScript ES6 modules
- **Styling**: Custom CSS with utility classes
- **State Management**: Class-based JavaScript architecture
- **UI Framework**: Custom components with FontAwesome icons

### Backend
- **Framework**: Flask (Python)
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **File Storage**: Firebase Storage
- **PDF Generation**: ReportLab
- **QR Codes**: qrcode library with PIL

## 🔐 Security Features

### Receipt Security System
- **Multi-parameter verification codes** using fee ID, roll number, amount, and timestamp
- **Cryptographic security hashes** for tamper detection
- **QR code verification** with embedded security data
- **Admin verification portal** for receipt authentication

### Access Control
- **Role-based authentication** with admin and student levels
- **Session management** with automatic timeout
- **Firebase security rules** protecting data access
- **Input validation** and XSS protection

## 📊 Admin Features

### Dashboard
- Real-time statistics and analytics
- Revenue tracking and occupancy rates
- Recent activities overview
- Quick action buttons

### Student Management
- Complete student profiles and records
- Bulk operations and data export
- Academic progress tracking
- Guardian information management

### Financial Management
- Automated fee calculation and tracking
- Professional receipt generation
- Payment status monitoring
- Financial reports and analytics

### Operations Management
- Room assignments and maintenance
- Leave application processing
- Complaint resolution system
- Notice and announcement management

## 👥 Student Portal Features

- **Personal dashboard** with overview of account status
- **Fee payment tracking** with receipt download
- **Leave application submission** with status tracking
- **Room change requests** with approval workflow
- **Maintenance request submission** for room issues
- **Complaint filing system** with priority levels
- **Notice board** access for announcements

## 🚀 Deployment

### GitHub Pages (Frontend Only)
For static deployment of the frontend:
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Configure Firebase for web hosting domain

### Cloud Platforms
For full-stack deployment:
- **Heroku**: Use provided `Procfile` and requirements
- **Vercel**: Configure for Flask deployment
- **Railway**: Direct deployment with automatic builds
- **DigitalOcean**: App Platform deployment

### Docker Deployment
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Firebase for real-time database and authentication
- FontAwesome for icons
- ReportLab for PDF generation
- The open-source community for various libraries and tools

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` folder
- Review the Firebase security rules for proper setup

---

**Built with ❤️ for efficient hostel management**