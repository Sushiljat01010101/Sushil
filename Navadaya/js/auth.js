// Authentication Module
class AuthManager {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.isRedirecting = false;
        this.initAttempts = 0;
        this.maxInitAttempts = 50; // 5 seconds max wait
        this.init();
    }

    async init() {
        try {
            this.initAttempts++;
            
            // Wait for Firebase to be available
            if (window.firebase && window.firebase.auth) {
                this.auth = window.firebase.auth;
                this.setupAuthListener();
                console.log('Firebase Auth initialized successfully');
            } else if (this.initAttempts < this.maxInitAttempts) {
                // Listen for firebaseReady event or retry after delay
                if (this.initAttempts === 1) {
                    window.addEventListener('firebaseReady', () => {
                        if (window.firebase && window.firebase.auth) {
                            this.auth = window.firebase.auth;
                            this.setupAuthListener();
                            console.log('Firebase Auth initialized via event');
                        }
                    });
                }
                // Also retry with timeout as fallback
                setTimeout(() => this.init(), 100);
            } else {
                console.error('Firebase initialization timeout. Check if Firebase is properly loaded.');
                this.showError('Authentication system failed to initialize. Please refresh the page.');
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            if (this.initAttempts < this.maxInitAttempts) {
                setTimeout(() => this.init(), 100);
            }
        }
    }

    setupAuthListener() {
        // Import auth functions with error handling
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
            .then(({ onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword }) => {
                // Add a small delay before setting up auth listener to ensure DOM is ready
                setTimeout(() => {
                    onAuthStateChanged(this.auth, (user) => {
                        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
                        this.currentUser = user;
                        this.handleAuthStateChange(user);
                    });

                    // Set up login form if on login page
                    this.setupLoginForm(signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword);
                    
                    // Set up logout functionality
                    this.setupLogout(signOut);
                }, 100);
            })
            .catch(error => {
                console.error('Firebase auth import error:', error);
                this.showError('Failed to load authentication system. Please refresh the page.');
            });
    }

    handleAuthStateChange(user) {
        const currentPage = window.location.pathname;
        const fileName = currentPage.split('/').pop() || 'index.html';
        
        // Prevent redirect loops by checking if we're already redirecting
        if (this.isRedirecting) {
            return;
        }
        
        if (user) {
            // User is signed in
            if (fileName === 'index.html' || fileName === '' || currentPage === '/') {
                // Only redirect if we're on the login page
                this.isRedirecting = true;
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000); // Small delay to ensure Firebase is ready
            } else {
                // Update user display for other pages
                this.updateUserDisplay(user);
            }
        } else {
            // User is signed out
            if (fileName !== 'index.html' && fileName !== '' && currentPage !== '/' && 
                !fileName.includes('student-portal') && !fileName.includes('public')) {
                // Only redirect to login if not already on login page or public pages
                this.isRedirecting = true;
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            }
        }
    }

    // Helper method to detect current page type
    isLoginPage() {
        const currentPage = window.location.pathname;
        const fileName = currentPage.split('/').pop() || 'index.html';
        return fileName === 'index.html' || fileName === '' || currentPage === '/' || 
               currentPage.endsWith('index.html');
    }

    // Helper method to check if user should be redirected
    shouldRedirect(user) {
        if (this.isRedirecting) return false;
        
        const isLogin = this.isLoginPage();
        
        if (user && isLogin) {
            return 'dashboard'; // redirect to dashboard
        }
        
        if (!user && !isLogin && !this.isPublicPage()) {
            return 'login'; // redirect to login
        }
        
        return false; // no redirect needed
    }

    // Helper method to check if current page is public
    isPublicPage() {
        const currentPage = window.location.pathname;
        const fileName = currentPage.split('/').pop() || '';
        return fileName.includes('student-portal') || fileName.includes('public') ||
               fileName.includes('about') || fileName.includes('contact');
    }

    setupLoginForm(signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword) {
        const loginForm = document.getElementById('loginForm');
        const googleSignInBtn = document.getElementById('googleSignIn');
        const errorMessage = document.getElementById('error-message');
        const loading = document.getElementById('loading');

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                this.showLoading(true);
                this.hideError();
                
                try {
                    await signInWithEmailAndPassword(this.auth, email, password);
                } catch (error) {
                    console.error('Login error details:', error);
                    this.showError(this.getErrorMessage(error.code));
                    this.showLoading(false);
                }
            });
        }

        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', async () => {
                const provider = new GoogleAuthProvider();
                
                this.showLoading(true);
                this.hideError();
                
                try {
                    await signInWithPopup(this.auth, provider);
                } catch (error) {
                    this.showError(this.getErrorMessage(error.code));
                    this.showLoading(false);
                }
            });
        }

        // Setup admin creation
        const createAdminBtn = document.getElementById('createAdmin');
        if (createAdminBtn) {
            createAdminBtn.addEventListener('click', async () => {
                this.showLoading(true);
                this.hideError();
                
                try {
                    await createUserWithEmailAndPassword(this.auth, 'admin@hostel.com', 'admin123');
                    this.showError('Admin account created successfully! You can now login with admin@hostel.com / admin123');
                    this.showLoading(false);
                } catch (error) {
                    if (error.code === 'auth/email-already-in-use') {
                        this.showError('Admin account already exists. Use: admin@hostel.com / admin123');
                    } else {
                        console.error('Account creation error:', error);
                        this.showError(this.getErrorMessage(error.code));
                    }
                    this.showLoading(false);
                }
            });
        }

        // Setup database connection test
        const testConnectionBtn = document.getElementById('testConnection');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', async () => {
                this.showLoading(true);
                this.hideError();
                
                try {
                    // Check if user is authenticated first
                    const currentUser = window.firebase.auth.currentUser;
                    if (!currentUser) {
                        this.showError('Please login first to test database connection.');
                        this.showLoading(false);
                        return;
                    }

                    const { collection, addDoc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                    
                    // Test write
                    const testData = {
                        test: true,
                        timestamp: new Date(),
                        message: 'Database connection test',
                        userId: currentUser.uid
                    };
                    
                    const docRef = await addDoc(collection(window.firebase.db, 'connection_test'), testData);
                    console.log('Test document written with ID: ', docRef.id);
                    
                    // Test read
                    const querySnapshot = await getDocs(collection(window.firebase.db, 'connection_test'));
                    console.log('Test documents found: ', querySnapshot.size);
                    
                    this.showError('Database connection successful! Data can be saved and read. Login is working properly.');
                } catch (error) {
                    console.error('Database connection error:', error);
                    if (error.code === 'permission-denied') {
                        this.showError('Permission denied. Firebase database requires authentication to work properly.');
                    } else {
                        this.showError(`Database error: ${error.message}. Please ensure you are logged in.`);
                    }
                }
                
                this.showLoading(false);
            });
        }
    }

    setupLogout(signOut) {
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(this.auth);
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });
        }
    }

    updateUserDisplay(user) {
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = user.email;
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/user-not-found': 'No account found with this email address. Try: admin@hostel.com',
            'auth/wrong-password': 'Incorrect password. Try: admin123',
            'auth/invalid-email': 'Invalid email address format.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/invalid-login-credentials': 'Invalid email or password. Try: admin@hostel.com / admin123',
            'auth/invalid-credential': 'Invalid email or password. Please create admin account first, then use: admin@hostel.com / admin123',
        };
        
        return errorMessages[errorCode] || `Login error (${errorCode}). Try: admin@hostel.com / admin123`;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
