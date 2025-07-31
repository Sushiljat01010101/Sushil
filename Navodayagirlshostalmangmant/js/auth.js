// Authentication Module
class AuthManager {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            // Wait for Firebase to be available
            if (window.firebase) {
                this.auth = window.firebase.auth;
                this.setupAuthListener();
            } else {
                // Retry after a short delay
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    setupAuthListener() {
        // Import auth functions
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
            .then(({ onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword }) => {
                onAuthStateChanged(this.auth, (user) => {
                    this.currentUser = user;
                    this.handleAuthStateChange(user);
                });

                // Set up login form if on login page
                this.setupLoginForm(signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword);
                
                // Set up logout functionality
                this.setupLogout(signOut);
            });
    }

    handleAuthStateChange(user) {
        const currentPage = window.location.pathname;
        
        if (user) {
            // User is signed in
            if (currentPage === '/' || currentPage === '/index.html') {
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                // Update user display
                this.updateUserDisplay(user);
            }
        } else {
            // User is signed out
            if (currentPage !== '/' && currentPage !== '/index.html') {
                // Redirect to login
                window.location.href = 'index.html';
            }
        }
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
