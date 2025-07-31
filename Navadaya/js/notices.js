// Notice Management Module
class NoticeManager {
    constructor() {
        this.db = null;
        this.notices = [];
        this.filteredNotices = [];
        this.editingNotice = null;
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                console.log('Firebase database initialized:', this.db);
                await this.testFirebaseConnection();
                await this.loadNotices();
                this.setupEventListeners();
            } else {
                console.log('Waiting for Firebase initialization...');
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Notice manager initialization error:', error);
            Utils.showNotification('Failed to initialize notice management', 'error');
        }
    }

    async testFirebaseConnection() {
        try {
            console.log('Testing Firebase connection...');
            const { collection, getDocs, limit, query } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const testRef = collection(this.db, 'notices');
            const testQuery = query(testRef, limit(1));
            const snapshot = await getDocs(testQuery);
            
            console.log('Firebase connection successful. Notices collection accessible.');
            console.log('Total notices found:', snapshot.size);
            return true;
        } catch (error) {
            console.error('Firebase connection test failed:', error);
            Utils.showNotification('Database connection failed. Please check Firebase configuration.', 'error');
            return false;
        }
    }

    async loadNotices() {
        try {
            Utils.showLoading(true);

            const { collection, onSnapshot, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Set up real-time listener with ordering
            const noticesQuery = query(collection(this.db, 'notices'), orderBy('createdAt', 'desc'));
            
            onSnapshot(noticesQuery, (snapshot) => {
                this.notices = [];
                snapshot.forEach(doc => {
                    this.notices.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.filteredNotices = [...this.notices];
                this.renderNotices();
            });

        } catch (error) {
            console.error('Error loading notices:', error);
            Utils.showNotification('Failed to load notices', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    setupEventListeners() {
        // Add notice button
        const addNoticeBtn = document.getElementById('addNoticeBtn');
        if (addNoticeBtn) {
            addNoticeBtn.addEventListener('click', () => this.openNoticeModal());
        }

        // Test connection button
        const testConnectionBtn = document.getElementById('testConnectionBtn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => this.testFirebaseConnection());
        }

        // Modal close buttons
        const modal = document.getElementById('noticeModal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeNoticeModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeNoticeModal());
        }

        // Close modal on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeNoticeModal();
                }
            });
        }

        // Form submission
        const noticeForm = document.getElementById('noticeForm');
        if (noticeForm) {
            noticeForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Search
        const searchNotice = document.getElementById('searchNotice');
        if (searchNotice) {
            searchNotice.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
    }

    openNoticeModal(notice = null) {
        const modal = document.getElementById('noticeModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('noticeForm');

        if (!modal || !modalTitle || !form) return;

        this.editingNotice = notice;

        if (notice) {
            modalTitle.textContent = 'Edit Notice';
            this.populateForm(notice);
        } else {
            modalTitle.textContent = 'Add Notice';
            form.reset();
        }

        modal.classList.remove('hidden');
    }

    closeNoticeModal() {
        const modal = document.getElementById('noticeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingNotice = null;
    }

    populateForm(notice) {
        document.getElementById('title').value = notice.title || '';
        document.getElementById('content').value = notice.content || '';
        document.getElementById('priority').value = notice.priority || 'medium';
        document.getElementById('pinned').checked = notice.pinned || false;
        
        if (notice.expiryDate) {
            const expiryDate = new Date(notice.expiryDate.seconds * 1000);
            document.getElementById('expiryDate').value = expiryDate.toISOString().split('T')[0];
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        try {
            Utils.showLoading(true);

            const formData = new FormData(e.target);
            
            // Debug form data
            console.log('Form data captured:', {
                title: formData.get('title'),
                content: formData.get('content'),
                priority: formData.get('priority'),
                expiryDate: formData.get('expiryDate'),
                pinned: document.getElementById('pinned').checked
            });

            const noticeData = {
                title: formData.get('title')?.trim() || '',
                content: formData.get('content')?.trim() || '',
                priority: formData.get('priority') || 'medium',
                pinned: document.getElementById('pinned').checked || false,
                expiryDate: formData.get('expiryDate') ? new Date(formData.get('expiryDate')) : null,
                createdAt: this.editingNotice?.createdAt || new Date(),
                updatedAt: new Date()
            };

            console.log('Notice data to save:', noticeData);

            // Validate form
            if (!this.validateNoticeData(noticeData)) {
                return;
            }

            // Check Firebase connection
            if (!this.db) {
                throw new Error('Firebase database not initialized');
            }

            const { collection, addDoc, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            if (this.editingNotice) {
                // Update existing notice
                console.log('Updating notice with ID:', this.editingNotice.id);
                const noticeRef = doc(this.db, 'notices', this.editingNotice.id);
                await updateDoc(noticeRef, noticeData);
                Utils.showNotification('Notice updated successfully');
            } else {
                // Add new notice
                console.log('Adding new notice to collection');
                const docRef = await addDoc(collection(this.db, 'notices'), noticeData);
                console.log('Notice added with ID:', docRef.id);
                Utils.showNotification('Notice published successfully');
            }

            this.closeNoticeModal();

        } catch (error) {
            console.error('Error saving notice:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            let errorMessage = 'Failed to save notice';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please check Firebase security rules.';
            } else if (error.code === 'unauthenticated') {
                errorMessage = 'Authentication required. Please login to Firebase.';
            } else if (error.message) {
                errorMessage = `Error: ${error.message}`;
            }
            
            Utils.showNotification(errorMessage, 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    validateNoticeData(data) {
        if (!data.title) {
            Utils.showNotification('Title is required', 'error');
            return false;
        }

        if (!data.content) {
            Utils.showNotification('Content is required', 'error');
            return false;
        }

        if (data.title.length > 100) {
            Utils.showNotification('Title must be less than 100 characters', 'error');
            return false;
        }

        if (data.expiryDate && data.expiryDate < new Date()) {
            Utils.showNotification('Expiry date cannot be in the past', 'error');
            return false;
        }

        return true;
    }

    async deleteNotice(noticeId) {
        const confirmed = await Utils.confirm(
            'Are you sure you want to delete this notice? This action cannot be undone.',
            'Delete Notice'
        );

        if (!confirmed) return;

        try {
            Utils.showLoading(true);

            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            await deleteDoc(doc(this.db, 'notices', noticeId));
            Utils.showNotification('Notice deleted successfully');

        } catch (error) {
            console.error('Error deleting notice:', error);
            Utils.showNotification('Failed to delete notice', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    async togglePin(noticeId, currentPinned) {
        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const noticeRef = doc(this.db, 'notices', noticeId);
            await updateDoc(noticeRef, {
                pinned: !currentPinned,
                updatedAt: new Date()
            });

            Utils.showNotification(`Notice ${!currentPinned ? 'pinned' : 'unpinned'} successfully`);

        } catch (error) {
            console.error('Error toggling pin:', error);
            Utils.showNotification('Failed to update notice', 'error');
        }
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchNotice').value.toLowerCase();

        this.filteredNotices = this.notices.filter(notice => {
            const matchesSearch = !searchTerm || 
                notice.title.toLowerCase().includes(searchTerm) ||
                notice.content.toLowerCase().includes(searchTerm);

            // Check if notice has expired
            const isExpired = notice.expiryDate && new Date() > new Date(notice.expiryDate.seconds * 1000);
            
            // Only show non-expired notices (or notices without expiry)
            return matchesSearch && !isExpired;
        });

        // Sort: pinned notices first, then by creation date
        this.filteredNotices.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            
            const aDate = a.createdAt?.seconds || 0;
            const bDate = b.createdAt?.seconds || 0;
            return bDate - aDate;
        });

        this.renderNotices();
    }

    renderNotices() {
        const noticesList = document.getElementById('noticesList');
        const emptyState = document.getElementById('emptyState');

        if (!noticesList || !emptyState) return;

        if (this.filteredNotices.length === 0) {
            noticesList.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        noticesList.style.display = 'block';
        emptyState.classList.add('hidden');

        noticesList.innerHTML = this.filteredNotices.map(notice => this.createNoticeCard(notice)).join('');

        // Add event listeners to action buttons
        this.filteredNotices.forEach(notice => {
            const editBtn = document.getElementById(`edit-${notice.id}`);
            const deleteBtn = document.getElementById(`delete-${notice.id}`);
            const pinBtn = document.getElementById(`pin-${notice.id}`);

            if (editBtn) {
                editBtn.addEventListener('click', () => this.openNoticeModal(notice));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteNotice(notice.id));
            }

            if (pinBtn) {
                pinBtn.addEventListener('click', () => this.togglePin(notice.id, notice.pinned));
            }
        });
    }

    createNoticeCard(notice) {
        const createdDate = notice.createdAt ? 
            Utils.formatDate(new Date(notice.createdAt.seconds * 1000)) : 
            Utils.formatDate(new Date());

        const expiryDate = notice.expiryDate ? 
            Utils.formatDate(new Date(notice.expiryDate.seconds * 1000)) : null;

        const priorityColor = {
            low: '#4ECDC4',
            medium: '#FFD93D',
            high: '#FF6B6B',
            urgent: '#8B0000'
        };

        const pinnedClass = notice.pinned ? 'notice-pinned' : '';

        return `
            <div class="notice-card ${pinnedClass}">
                <div class="notice-header">
                    <div class="notice-title">
                        <h3>
                            ${notice.pinned ? '<i class="fas fa-thumbtack" style="color: #FFD93D; margin-right: 8px;"></i>' : ''}
                            ${Utils.escapeHtml(notice.title)}
                        </h3>
                        <div class="notice-meta">
                            <span style="color: ${priorityColor[notice.priority]};">
                                <i class="fas fa-circle"></i> ${notice.priority.toUpperCase()}
                            </span>
                            <span>
                                <i class="fas fa-calendar"></i> ${createdDate}
                            </span>
                            ${expiryDate ? `
                                <span>
                                    <i class="fas fa-clock"></i> Expires ${expiryDate}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="notice-actions">
                        <button class="btn-secondary btn-small" id="pin-${notice.id}" title="${notice.pinned ? 'Unpin' : 'Pin'} Notice">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="btn-secondary btn-small" id="edit-${notice.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-secondary btn-small" id="delete-${notice.id}" style="color: #FF6B6B;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="notice-content">
                    ${Utils.escapeHtml(notice.content).replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    }
}

// Initialize notice manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.noticeManager = new NoticeManager();
});
