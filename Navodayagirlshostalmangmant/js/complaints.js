// Complaint Management Module
class ComplaintManager {
    constructor() {
        this.db = null;
        this.complaints = [];
        this.filteredComplaints = [];
        this.students = [];
        this.rooms = [];
        this.currentComplaint = null;
        this.stats = {
            open: 0,
            resolved: 0
        };
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                await this.loadData();
                this.setupEventListeners();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Complaint manager initialization error:', error);
            Utils.showNotification('Failed to initialize complaint management', 'error');
        }
    }

    async loadData() {
        try {
            Utils.showLoading(true);

            const { collection, getDocs, onSnapshot, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Load students and rooms
            const [studentsSnapshot, roomsSnapshot] = await Promise.all([
                getDocs(collection(this.db, 'students')),
                getDocs(collection(this.db, 'rooms'))
            ]);

            this.students = [];
            studentsSnapshot.forEach(doc => {
                this.students.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.rooms = [];
            roomsSnapshot.forEach(doc => {
                this.rooms.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Set up real-time listener for complaints
            const complaintsQuery = query(collection(this.db, 'complaints'), orderBy('createdAt', 'desc'));
            
            onSnapshot(complaintsQuery, (snapshot) => {
                this.complaints = [];
                snapshot.forEach(doc => {
                    this.complaints.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.filteredComplaints = [...this.complaints];
                this.calculateStats();
                this.renderComplaints();
            });

        } catch (error) {
            console.error('Error loading data:', error);
            Utils.showNotification('Failed to load data', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    setupEventListeners() {
        // Modal close buttons
        const modal = document.getElementById('complaintModal');
        const closeBtn = modal?.querySelector('.modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeComplaintModal());
        }

        // Close modal on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeComplaintModal();
                }
            });
        }

        // Status update button
        const updateStatusBtn = document.getElementById('updateStatusBtn');
        if (updateStatusBtn) {
            updateStatusBtn.addEventListener('click', () => this.updateComplaintStatus());
        }

        // Save notes button
        const saveNotesBtn = document.getElementById('saveNotesBtn');
        if (saveNotesBtn) {
            saveNotesBtn.addEventListener('click', () => this.saveAdminNotes());
        }

        // Filters
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');
        const searchComplaint = document.getElementById('searchComplaint');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => this.applyFilters());
        }

        if (searchComplaint) {
            searchComplaint.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
    }

    openComplaintModal(complaint) {
        const modal = document.getElementById('complaintModal');
        if (!modal || !complaint) return;

        this.currentComplaint = complaint;
        
        const student = this.students.find(s => s.id === complaint.studentId);
        const room = student ? this.rooms.find(r => r.id === student.assignedRoom) : null;

        // Populate complaint details
        document.getElementById('studentName').textContent = 
            student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
        
        document.getElementById('roomNumber').textContent = 
            room ? `Room ${room.roomNumber}` : 'Not Assigned';
        
        document.getElementById('category').textContent = complaint.category || 'General';
        
        const priorityElement = document.getElementById('priority');
        priorityElement.textContent = complaint.priority || 'medium';
        priorityElement.className = `priority-badge ${complaint.priority || 'medium'}`;
        
        const statusElement = document.getElementById('status');
        statusElement.textContent = complaint.status || 'open';
        statusElement.className = `status-badge ${complaint.status || 'open'}`;
        
        document.getElementById('submittedDate').textContent = 
            complaint.createdAt ? Utils.formatDate(new Date(complaint.createdAt.seconds * 1000)) : 'Unknown';
        
        document.getElementById('description').textContent = complaint.description || '';
        
        // Set current status in dropdown
        const newStatusSelect = document.getElementById('newStatus');
        if (newStatusSelect) {
            newStatusSelect.value = complaint.status || 'open';
        }
        
        // Load admin notes
        const adminNotesTextarea = document.getElementById('adminNotes');
        if (adminNotesTextarea) {
            adminNotesTextarea.value = complaint.adminNotes || '';
        }

        modal.classList.remove('hidden');
    }

    closeComplaintModal() {
        const modal = document.getElementById('complaintModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentComplaint = null;
    }

    async updateComplaintStatus() {
        if (!this.currentComplaint) return;

        const newStatus = document.getElementById('newStatus').value;
        
        if (newStatus === this.currentComplaint.status) {
            Utils.showNotification('Status is already set to ' + newStatus, 'warning');
            return;
        }

        try {
            Utils.showLoading(true);

            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const complaintRef = doc(this.db, 'complaints', this.currentComplaint.id);
            await updateDoc(complaintRef, {
                status: newStatus,
                statusUpdatedAt: new Date(),
                updatedAt: new Date()
            });

            Utils.showNotification('Complaint status updated successfully');
            
            // Update current complaint object
            this.currentComplaint.status = newStatus;
            
            // Update status display in modal
            const statusElement = document.getElementById('status');
            statusElement.textContent = newStatus;
            statusElement.className = `status-badge ${newStatus}`;

        } catch (error) {
            console.error('Error updating complaint status:', error);
            Utils.showNotification('Failed to update complaint status', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    async saveAdminNotes() {
        if (!this.currentComplaint) return;

        const adminNotes = document.getElementById('adminNotes').value.trim();

        try {
            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const complaintRef = doc(this.db, 'complaints', this.currentComplaint.id);
            await updateDoc(complaintRef, {
                adminNotes: adminNotes,
                updatedAt: new Date()
            });

            Utils.showNotification('Admin notes saved successfully');
            
            // Update current complaint object
            this.currentComplaint.adminNotes = adminNotes;

        } catch (error) {
            console.error('Error saving admin notes:', error);
            Utils.showNotification('Failed to save admin notes', 'error');
        }
    }

    calculateStats() {
        this.stats = {
            open: 0,
            resolved: 0
        };

        this.complaints.forEach(complaint => {
            if (complaint.status === 'open' || complaint.status === 'in_progress') {
                this.stats.open++;
            } else if (complaint.status === 'resolved') {
                this.stats.resolved++;
            }
        });

        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const openCount = document.getElementById('openCount');
        const resolvedCount = document.getElementById('resolvedCount');

        if (openCount) {
            openCount.textContent = `${this.stats.open} Open`;
        }

        if (resolvedCount) {
            resolvedCount.textContent = `${this.stats.resolved} Resolved`;
        }
    }

    applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const searchTerm = document.getElementById('searchComplaint').value.toLowerCase();

        this.filteredComplaints = this.complaints.filter(complaint => {
            const student = this.students.find(s => s.id === complaint.studentId);
            
            const matchesStatus = !statusFilter || complaint.status === statusFilter;
            const matchesPriority = !priorityFilter || complaint.priority === priorityFilter;
            const matchesSearch = !searchTerm || 
                complaint.title?.toLowerCase().includes(searchTerm) ||
                complaint.description?.toLowerCase().includes(searchTerm) ||
                complaint.category?.toLowerCase().includes(searchTerm) ||
                (student && (
                    student.firstName.toLowerCase().includes(searchTerm) ||
                    student.lastName.toLowerCase().includes(searchTerm) ||
                    student.rollNumber.toLowerCase().includes(searchTerm)
                ));

            return matchesStatus && matchesPriority && matchesSearch;
        });

        this.renderComplaints();
    }

    renderComplaints() {
        const complaintsList = document.getElementById('complaintsList');
        const emptyState = document.getElementById('emptyState');

        if (!complaintsList || !emptyState) return;

        if (this.filteredComplaints.length === 0) {
            complaintsList.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        complaintsList.style.display = 'block';
        emptyState.classList.add('hidden');

        complaintsList.innerHTML = this.filteredComplaints.map(complaint => this.createComplaintCard(complaint)).join('');

        // Add event listeners to complaint cards
        this.filteredComplaints.forEach(complaint => {
            const card = document.getElementById(`complaint-${complaint.id}`);
            if (card) {
                card.addEventListener('click', () => this.openComplaintModal(complaint));
            }
        });
    }

    createComplaintCard(complaint) {
        const student = this.students.find(s => s.id === complaint.studentId);
        const room = student ? this.rooms.find(r => r.id === student.assignedRoom) : null;
        
        const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
        const roomNumber = room ? `Room ${room.roomNumber}` : 'Not Assigned';
        
        const submittedDate = complaint.createdAt ? 
            Utils.formatDate(new Date(complaint.createdAt.seconds * 1000)) : 
            'Unknown';

        const statusClass = complaint.status || 'open';
        const priorityClass = complaint.priority || 'medium';

        // Truncate description for card view
        const shortDescription = complaint.description?.length > 150 ? 
            complaint.description.substring(0, 150) + '...' : 
            complaint.description || '';

        return `
            <div class="complaint-card" id="complaint-${complaint.id}">
                <div class="complaint-header">
                    <div class="complaint-title">
                        <h4>${Utils.escapeHtml(complaint.title || 'Untitled Complaint')}</h4>
                        <div class="complaint-meta">
                            <span><i class="fas fa-user"></i> ${studentName}</span>
                            <span><i class="fas fa-bed"></i> ${roomNumber}</span>
                            <span><i class="fas fa-calendar"></i> ${submittedDate}</span>
                        </div>
                    </div>
                    <div class="complaint-badges">
                        <span class="priority-badge ${priorityClass}">${(complaint.priority || 'medium').toUpperCase()}</span>
                        <span class="status-badge ${statusClass}">${(complaint.status || 'open').replace('_', ' ').toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="complaint-content">
                    ${Utils.escapeHtml(shortDescription)}
                </div>
                
                <div class="complaint-footer">
                    <span><i class="fas fa-tag"></i> ${complaint.category || 'General'}</span>
                    ${complaint.adminNotes ? '<span><i class="fas fa-sticky-note"></i> Has Admin Notes</span>' : ''}
                </div>
            </div>
        `;
    }
}

// Initialize complaint manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.complaintManager = new ComplaintManager();
});
