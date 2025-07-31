// Firebase Configuration Module
class FirebaseConfig {
    constructor() {
        this.config = {
            apiKey: "AIzaSyDA6duS8SJ5Wr26qNxzBoge01Leestj-9o",
            authDomain: "animal-planet-73497.firebaseapp.com",
            databaseURL: "https://animal-planet-73497-default-rtdb.firebaseio.com",
            projectId: "animal-planet-73497",
            storageBucket: "animal-planet-73497.appspot.com",
            messagingSenderId: "15025745338",
            appId: "1:15025745338:web:f2d2e2644d822afea00183",
            measurementId: "G-KP9582LMC3"
        };
    }

    getConfig() {
        return this.config;
    }

    // Initialize Firebase services
    async initializeServices() {
        try {
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getStorage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');

            const app = initializeApp(this.config);
            const auth = getAuth(app);
            const db = getFirestore(app);
            const storage = getStorage(app);

            return { app, auth, db, storage };
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }
}

// Export singleton instance
window.FirebaseConfig = new FirebaseConfig();
