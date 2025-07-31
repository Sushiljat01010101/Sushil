// Student Management Module
class StudentManager {
    constructor() {
        this.db = null;
        this.storage = null;
        this.students = [];
        this.filteredStudents = [];
        this.rooms = [];
        this.editingStudent = null;
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                this.storage = window.firebase.storage;
                await this.loadData();
                this.setupEventListeners();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Student manager initialization error:', error);
            Utils.showNotification('Failed to initialize student management', 'error');
        }
    }

    async loadData() {
        try {
            Utils.showLoading(true);

            const { collection, getDocs, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Load rooms for dropdown
            const roomsSnapshot = await getDocs(collection(this.db, 'rooms'));
            this.rooms = [];
            roomsSnapshot.forEach(doc => {
                this.rooms.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.populateRoomDropdowns();

            // Set up real-time listener for students
            onSnapshot(collection(this.db, 'students'), (snapshot) => {
                this.students = [];
                snapshot.forEach(doc => {
                    this.students.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.filteredStudents = [...this.students];
                this.renderStudents();
            });

        } catch (error) {
            console.error('Error loading data:', error);
            Utils.showNotification('Failed to load data', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    populateRoomDropdowns() {
        const roomFilters = document.querySelectorAll('#roomFilter, #assignedRoom');
        
        roomFilters.forEach(select => {
            const currentValue = select.value;
            
            // Clear existing options (except first)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }

            // Add only rooms that have available space (not full)
            this.rooms
                .filter(room => {
                    const occupiedBeds = room.occupiedBeds || 0;
                    const capacity = room.capacity || 1;
                    return occupiedBeds < capacity; // Only show rooms with available space
                })
                .forEach(room => {
                    const option = document.createElement('option');
                    option.value = room.id;
                    const occupiedBeds = room.occupiedBeds || 0;
                    const availableSpace = room.capacity - occupiedBeds;
                    option.textContent = `Room ${room.roomNumber} (${occupiedBeds}/${room.capacity} - ${availableSpace} spaces left)`;
                    select.appendChild(option);
                });

            // Restore previous value if it still exists
            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    setupEventListeners() {
        // Add student button
        const addStudentBtn = document.getElementById('addStudentBtn');
        if (addStudentBtn) {
            addStudentBtn.addEventListener('click', () => this.openStudentModal());
        }

        // Generate report button
        const generateReportBtn = document.getElementById('generateReportBtn');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                if (window.reportManager) {
                    window.reportManager.showReportModal();
                    window.reportManager.setupReportTypeListeners();
                }
            });
        }

        // Modal close buttons
        const modal = document.getElementById('studentModal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeStudentModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeStudentModal());
        }

        // Close modal on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeStudentModal();
                }
            });
        }

        // Form submission
        const studentForm = document.getElementById('studentForm');
        if (studentForm) {
            studentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Filters
        const roomFilter = document.getElementById('roomFilter');
        const statusFilter = document.getElementById('statusFilter');
        const searchStudent = document.getElementById('searchStudent');

        if (roomFilter) {
            roomFilter.addEventListener('change', () => this.applyFilters());
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        if (searchStudent) {
            searchStudent.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
    }

    openStudentModal(student = null) {
        const modal = document.getElementById('studentModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('studentForm');

        if (!modal || !modalTitle || !form) return;

        this.editingStudent = student;

        if (student) {
            modalTitle.textContent = 'Edit Student';
            this.populateForm(student);
        } else {
            modalTitle.textContent = 'Add Student';
            form.reset();
        }

        modal.classList.remove('hidden');
    }

    closeStudentModal() {
        const modal = document.getElementById('studentModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingStudent = null;
    }

    populateForm(student) {
        const fields = [
            'firstName', 'lastName', 'rollNumber', 'course', 'year',
            'email', 'phone', 'address', 'guardianName', 'guardianPhone'
        ];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                element.value = student[field] || '';
            }
        });

        // Set assigned room
        const assignedRoom = document.getElementById('assignedRoom');
        if (assignedRoom && student.assignedRoom) {
            assignedRoom.value = student.assignedRoom;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        try {
            // Check authentication first
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                Utils.showNotification('Please login first to save data', 'error');
                return;
            }

            Utils.showLoading(true);

            const formData = new FormData(e.target);
            console.log('Student form data collected:', {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                rollNumber: formData.get('rollNumber'),
                course: formData.get('course'),
                year: formData.get('year'),
                email: formData.get('email'),
                phone: formData.get('phone')
            });
            
            const studentData = {
                firstName: formData.get('firstName') || '',
                lastName: formData.get('lastName') || '',
                rollNumber: formData.get('rollNumber') || '',
                course: formData.get('course') || '',
                year: parseInt(formData.get('year')) || 1,
                email: formData.get('email') || '',
                phone: formData.get('phone') || '',
                address: formData.get('address') || '',
                guardianName: formData.get('guardianName') || '',
                guardianPhone: formData.get('guardianPhone') || '',
                assignedRoom: formData.get('assignedRoom') || null,
                status: this.editingStudent?.status || 'active',
                documents: this.editingStudent?.documents || [],
                createdAt: this.editingStudent?.createdAt || new Date(),
                updatedAt: new Date()
            };

            // Validate form
            if (!this.validateStudentData(studentData)) {
                return;
            }

            // Check room capacity before assigning
            if (studentData.assignedRoom && !this.editingStudent) {
                const room = this.rooms.find(r => r.id === studentData.assignedRoom);
                if (room) {
                    const occupiedBeds = room.occupiedBeds || 0;
                    if (occupiedBeds >= room.capacity) {
                        Utils.showNotification('Selected room is already at full capacity. Please choose another room.', 'error');
                        return;
                    }
                }
            }

            // Check room capacity when changing room assignment
            if (studentData.assignedRoom && this.editingStudent && 
                studentData.assignedRoom !== this.editingStudent.assignedRoom) {
                const room = this.rooms.find(r => r.id === studentData.assignedRoom);
                if (room) {
                    const occupiedBeds = room.occupiedBeds || 0;
                    if (occupiedBeds >= room.capacity) {
                        Utils.showNotification('Selected room is already at full capacity. Please choose another room.', 'error');
                        return;
                    }
                }
            }

            // Handle file uploads
            const documentsFile = document.getElementById('documents').files;
            if (documentsFile.length > 0) {
                studentData.documents = await this.uploadDocuments(documentsFile, studentData.rollNumber);
            }

            const { collection, addDoc, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            if (this.editingStudent) {
                // Update existing student
                const studentRef = doc(this.db, 'students', this.editingStudent.id);
                await updateDoc(studentRef, studentData);
                Utils.showNotification('Student updated successfully');
            } else {
                // Add new student
                await addDoc(collection(this.db, 'students'), studentData);
                Utils.showNotification('Student added successfully');
            }

            // Update room occupancy and status
            await this.updateRoomOccupancy(studentData.assignedRoom, this.editingStudent?.assignedRoom);

            // Refresh room dropdown to reflect capacity changes
            this.populateRoomDropdown();

            this.closeStudentModal();

        } catch (error) {
            console.error('Error saving student:', error);
            
            // Show specific error messages
            if (error.code === 'permission-denied') {
                Utils.showNotification('Permission denied. Please ensure you are logged in.', 'error');
            } else if (error.code === 'unauthenticated') {
                Utils.showNotification('Authentication required. Please login first.', 'error');
            } else {
                Utils.showNotification(`Failed to save student: ${error.message}`, 'error');
            }
        } finally {
            Utils.showLoading(false);
        }
    }

    validateStudentData(data) {
        const required = ['firstName', 'lastName', 'rollNumber', 'course', 'year', 'email', 'phone'];
        
        for (const field of required) {
            const value = data[field];
            if (!value || (typeof value === 'string' && !value.trim())) {
                const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
                Utils.showNotification(`${fieldName} is required`, 'error');
                return false;
            }
        }

        // Validate email
        if (!Utils.validateEmail(data.email)) {
            Utils.showNotification('Valid email address is required', 'error');
            return false;
        }

        // Validate phone
        if (!Utils.validatePhone(data.phone)) {
            Utils.showNotification('Valid phone number is required', 'error');
            return false;
        }

        // Check for duplicate roll number
        const duplicate = this.students.find(student => 
            student.rollNumber === data.rollNumber && 
            (!this.editingStudent || student.id !== this.editingStudent.id)
        );

        if (duplicate) {
            Utils.showNotification('Roll number already exists', 'error');
            return false;
        }

        return true;
    }

    async uploadDocuments(files, rollNumber) {
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            
            const documents = [];
            
            for (const file of files) {
                const fileName = `${rollNumber}_${Date.now()}_${file.name}`;
                const storageRef = ref(this.storage, `student-documents/${fileName}`);
                
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                
                documents.push({
                    name: file.name,
                    url: downloadURL,
                    uploadedAt: new Date()
                });
            }
            
            return documents;
        } catch (error) {
            console.error('Error uploading documents:', error);
            throw error;
        }
    }

    async updateRoomOccupancy(newRoomId, oldRoomId) {
        try {
            const { doc, updateDoc, increment, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Decrease occupancy of old room and update status
            if (oldRoomId && oldRoomId !== newRoomId) {
                const oldRoomRef = doc(this.db, 'rooms', oldRoomId);
                await updateDoc(oldRoomRef, {
                    occupiedBeds: increment(-1)
                });
                
                // Update old room status to available
                await this.updateRoomStatus(oldRoomId);
            }

            // Increase occupancy of new room and update status
            if (newRoomId && newRoomId !== oldRoomId) {
                const newRoomRef = doc(this.db, 'rooms', newRoomId);
                await updateDoc(newRoomRef, {
                    occupiedBeds: increment(1)
                });
                
                // Update new room status based on capacity
                await this.updateRoomStatus(newRoomId);
            }
        } catch (error) {
            console.error('Error updating room occupancy:', error);
        }
    }

    async updateRoomStatus(roomId) {
        try {
            const { doc, updateDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const roomRef = doc(this.db, 'rooms', roomId);
            const roomDoc = await getDoc(roomRef);
            
            if (roomDoc.exists()) {
                const roomData = roomDoc.data();
                const capacity = roomData.capacity || 0;
                const occupiedBeds = roomData.occupiedBeds || 0;
                
                let status = 'available';
                if (occupiedBeds >= capacity) {
                    status = 'full';
                } else if (occupiedBeds > 0) {
                    status = 'partial';
                }
                
                // Only update if status has changed
                if (roomData.status !== status) {
                    await updateDoc(roomRef, {
                        status: status,
                        updatedAt: new Date()
                    });
                    console.log(`Room ${roomData.roomNumber} status updated to: ${status}`);
                }
            }
        } catch (error) {
            console.error('Error updating room status:', error);
        }
    }

    async deleteStudent(studentId) {
        const confirmed = await Utils.confirm(
            'Are you sure you want to delete this student? This action cannot be undone.',
            'Delete Student'
        );

        if (!confirmed) return;

        try {
            Utils.showLoading(true);

            const student = this.students.find(s => s.id === studentId);
            
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            await deleteDoc(doc(this.db, 'students', studentId));
            
            // Update room occupancy
            if (student?.assignedRoom) {
                await this.updateRoomOccupancy(null, student.assignedRoom);
            }

            // Refresh room dropdown to reflect capacity changes
            this.populateRoomDropdown();

            Utils.showNotification('Student deleted successfully');

        } catch (error) {
            console.error('Error deleting student:', error);
            Utils.showNotification('Failed to delete student', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    applyFilters() {
        const roomFilter = document.getElementById('roomFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('searchStudent').value.toLowerCase();

        this.filteredStudents = this.students.filter(student => {
            const matchesRoom = !roomFilter || student.assignedRoom === roomFilter;
            const matchesStatus = !statusFilter || student.status === statusFilter;
            const matchesSearch = !searchTerm || 
                student.firstName.toLowerCase().includes(searchTerm) ||
                student.lastName.toLowerCase().includes(searchTerm) ||
                student.rollNumber.toLowerCase().includes(searchTerm) ||
                student.email.toLowerCase().includes(searchTerm);

            return matchesRoom && matchesStatus && matchesSearch;
        });

        this.renderStudents();
    }

    renderStudents() {
        const tableBody = document.getElementById('studentsTableBody');
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.querySelector('.table-container');

        if (!tableBody || !emptyState || !tableContainer) return;

        if (this.filteredStudents.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.classList.add('hidden');

        tableBody.innerHTML = this.filteredStudents.map(student => this.createStudentRow(student)).join('');

        // Add event listeners to action buttons
        this.filteredStudents.forEach(student => {
            const reportBtn = document.getElementById(`report-${student.id}`);
            const viewDocsBtn = document.getElementById(`view-docs-${student.id}`);
            const editBtn = document.getElementById(`edit-${student.id}`);
            const deleteBtn = document.getElementById(`delete-${student.id}`);

            if (reportBtn) {
                reportBtn.addEventListener('click', () => {
                    if (window.reportManager) {
                        window.reportManager.generateStudentReport(student.id);
                    }
                });
            }

            if (viewDocsBtn) {
                viewDocsBtn.addEventListener('click', () => this.viewStudentDocuments(student));
            }

            if (editBtn) {
                editBtn.addEventListener('click', () => this.openStudentModal(student));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteStudent(student.id));
            }
        });
    }

    createStudentRow(student) {
        const room = this.rooms.find(r => r.id === student.assignedRoom);
        const roomNumber = room ? `Room ${room.roomNumber}` : 'Not Assigned';
        
        const statusClass = student.status === 'active' ? 'active' : 'inactive';

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${student.firstName} ${student.lastName}</div>
                    <div style="font-size: 12px; color: #718096;">${student.course} - Year ${student.year}</div>
                </td>
                <td>${student.rollNumber}</td>
                <td>${roomNumber}</td>
                <td>
                    <div>${student.phone}</div>
                    <div style="font-size: 12px; color: #718096;">${student.email}</div>
                </td>
                <td><span class="status-badge ${statusClass}">${student.status}</span></td>
                <td>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn-secondary btn-small" id="report-${student.id}" title="Generate Student Report">
                            <i class="fas fa-file-pdf"></i> Report
                        </button>
                        <button class="btn-secondary btn-small" id="view-docs-${student.id}" ${!student.documents || student.documents.length === 0 ? 'disabled' : ''}>
                            <i class="fas fa-file-alt"></i> Documents
                        </button>
                        <button class="btn-secondary btn-small" id="edit-${student.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-secondary btn-small" id="delete-${student.id}" style="color: #FF6B6B;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    viewStudentDocuments(student) {
        if (!student.documents || student.documents.length === 0) {
            Utils.showNotification('No documents uploaded for this student', 'info');
            return;
        }

        // Create modal dynamically if it doesn't exist
        let modal = document.getElementById('documentsModal');
        if (!modal) {
            modal = this.createDocumentsModal();
            document.body.appendChild(modal);
        }

        // Populate modal with student documents
        const modalTitle = modal.querySelector('.modal-title');
        const documentsContainer = modal.querySelector('.documents-container');
        
        modalTitle.textContent = `Documents - ${student.firstName} ${student.lastName}`;
        
        documentsContainer.innerHTML = student.documents.map(doc => `
            <div class="document-item">
                <div class="document-info">
                    <i class="fas fa-file-alt"></i>
                    <div>
                        <div class="document-name">${doc.name}</div>
                        <div class="document-date">Uploaded: ${new Date(doc.uploadedAt?.toDate?.() || doc.uploadedAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="document-actions">
                    <a href="${doc.url}" target="_blank" class="btn-secondary btn-small">
                        <i class="fas fa-eye"></i> View
                    </a>
                    <a href="${doc.url}" download="${doc.name}" class="btn-secondary btn-small">
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    createDocumentsModal() {
        const modal = document.createElement('div');
        modal.id = 'documentsModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">Student Documents</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="documents-container">
                        <!-- Documents will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        return modal;
    }
}

// Initialize student manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.studentManager = new StudentManager();
});
