// Room Management Module
class RoomManager {
    constructor() {
        this.db = null;
        this.rooms = [];
        this.filteredRooms = [];
        this.editingRoom = null;
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                await this.loadRooms();
                this.setupEventListeners();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Room manager initialization error:', error);
            Utils.showNotification('Failed to initialize room management', 'error');
        }
    }

    async loadRooms() {
        try {
            Utils.showLoading(true);

            const { collection, getDocs, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Set up real-time listener
            onSnapshot(collection(this.db, 'rooms'), (snapshot) => {
                this.rooms = [];
                snapshot.forEach(doc => {
                    this.rooms.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.filteredRooms = [...this.rooms];
                this.renderRooms();
            });

        } catch (error) {
            console.error('Error loading rooms:', error);
            Utils.showNotification('Failed to load rooms', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    setupEventListeners() {
        // Add room button
        const addRoomBtn = document.getElementById('addRoomBtn');
        if (addRoomBtn) {
            addRoomBtn.addEventListener('click', () => this.openRoomModal());
        }

        // Modal close buttons
        const modal = document.getElementById('roomModal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeRoomModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeRoomModal());
        }

        // Close modal on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeRoomModal();
                }
            });
        }

        // Form submission
        const roomForm = document.getElementById('roomForm');
        if (roomForm) {
            roomForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Filters
        const floorFilter = document.getElementById('floorFilter');
        const statusFilter = document.getElementById('statusFilter');
        const searchRoom = document.getElementById('searchRoom');

        if (floorFilter) {
            floorFilter.addEventListener('change', () => this.applyFilters());
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        if (searchRoom) {
            searchRoom.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }
    }

    openRoomModal(room = null) {
        const modal = document.getElementById('roomModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('roomForm');

        if (!modal || !modalTitle || !form) return;

        this.editingRoom = room;

        if (room) {
            modalTitle.textContent = 'Edit Room';
            this.populateForm(room);
        } else {
            modalTitle.textContent = 'Add Room';
            form.reset();
        }

        modal.classList.remove('hidden');
    }

    closeRoomModal() {
        const modal = document.getElementById('roomModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingRoom = null;
    }

    populateForm(room) {
        document.getElementById('roomNumber').value = room.roomNumber || '';
        document.getElementById('floor').value = room.floor || '';
        document.getElementById('capacity').value = room.capacity || '';
        document.getElementById('roomType').value = room.roomType || '';
        document.getElementById('monthlyRent').value = room.monthlyRent || '';

        // Set amenities checkboxes
        const amenityCheckboxes = document.querySelectorAll('#roomModal input[type="checkbox"]');
        amenityCheckboxes.forEach(checkbox => {
            checkbox.checked = room.amenities?.includes(checkbox.value) || false;
        });
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
            console.log('Form data collected:', {
                roomNumber: formData.get('roomNumber'),
                floor: formData.get('floor'),
                capacity: formData.get('capacity'),
                roomType: formData.get('roomType'),
                monthlyRent: formData.get('monthlyRent')
            });
            
            const roomData = {
                roomNumber: formData.get('roomNumber') || '',
                floor: parseInt(formData.get('floor')) || 1,
                capacity: parseInt(formData.get('capacity')) || 1,
                roomType: formData.get('roomType') || 'single',
                monthlyRent: parseFloat(formData.get('monthlyRent')) || 0,
                occupiedBeds: this.editingRoom?.occupiedBeds || 0,
                status: this.editingRoom?.status || 'available',
                amenities: [],
                occupiedBeds: this.editingRoom?.occupiedBeds || 0,
                status: this.editingRoom?.status || 'available',
                createdAt: this.editingRoom?.createdAt || new Date(),
                updatedAt: new Date()
            };

            // Get selected amenities
            const amenityCheckboxes = document.querySelectorAll('#roomModal input[type="checkbox"]:checked');
            roomData.amenities = Array.from(amenityCheckboxes).map(cb => cb.value);

            // Validate form
            if (!this.validateRoomData(roomData)) {
                return;
            }

            const { collection, addDoc, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            if (this.editingRoom) {
                // Update existing room
                const roomRef = doc(this.db, 'rooms', this.editingRoom.id);
                await updateDoc(roomRef, roomData);
                Utils.showNotification('Room updated successfully');
            } else {
                // Add new room
                await addDoc(collection(this.db, 'rooms'), roomData);
                Utils.showNotification('Room added successfully');
            }

            this.closeRoomModal();

        } catch (error) {
            console.error('Error saving room:', error);
            
            // Show specific error messages
            if (error.code === 'permission-denied') {
                Utils.showNotification('Permission denied. Please ensure you are logged in.', 'error');
            } else if (error.code === 'unauthenticated') {
                Utils.showNotification('Authentication required. Please login first.', 'error');
            } else {
                Utils.showNotification(`Failed to save room: ${error.message}`, 'error');
            }
        } finally {
            Utils.showLoading(false);
        }
    }

    validateRoomData(data) {
        if (!data.roomNumber || !data.roomNumber.trim()) {
            Utils.showNotification('Room number is required', 'error');
            return false;
        }

        if (!data.floor || data.floor < 1) {
            Utils.showNotification('Valid floor number is required', 'error');
            return false;
        }

        if (!data.capacity || data.capacity < 1) {
            Utils.showNotification('Valid capacity is required', 'error');
            return false;
        }

        if (!data.monthlyRent || data.monthlyRent <= 0) {
            Utils.showNotification('Valid monthly rent is required', 'error');
            return false;
        }

        // Check for duplicate room number (only for new rooms or different room)
        const duplicate = this.rooms.find(room => 
            room.roomNumber === data.roomNumber && 
            (!this.editingRoom || room.id !== this.editingRoom.id)
        );

        if (duplicate) {
            Utils.showNotification('Room number already exists', 'error');
            return false;
        }

        return true;
    }

    async deleteRoom(roomId) {
        const confirmed = await Utils.confirm(
            'Are you sure you want to delete this room? This action cannot be undone.',
            'Delete Room'
        );

        if (!confirmed) return;

        try {
            Utils.showLoading(true);

            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            await deleteDoc(doc(this.db, 'rooms', roomId));
            Utils.showNotification('Room deleted successfully');

        } catch (error) {
            console.error('Error deleting room:', error);
            Utils.showNotification('Failed to delete room', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    applyFilters() {
        const floorFilter = document.getElementById('floorFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('searchRoom').value.toLowerCase();

        this.filteredRooms = this.rooms.filter(room => {
            const matchesFloor = !floorFilter || room.floor.toString() === floorFilter;
            
            // Calculate current status for filtering
            let currentStatus = 'available';
            const occupiedBeds = room.occupiedBeds || 0;
            const capacity = room.capacity || 1;
            
            if (occupiedBeds >= capacity) {
                currentStatus = 'full';
            } else if (occupiedBeds > 0) {
                currentStatus = 'partial';
            }
            
            const matchesStatus = !statusFilter || currentStatus === statusFilter || room.status === statusFilter;
            const matchesSearch = !searchTerm || 
                room.roomNumber.toLowerCase().includes(searchTerm) ||
                room.roomType.toLowerCase().includes(searchTerm);

            return matchesFloor && matchesStatus && matchesSearch;
        });

        this.renderRooms();
    }

    renderRooms() {
        const roomsGrid = document.getElementById('roomsGrid');
        const emptyState = document.getElementById('emptyState');

        if (!roomsGrid || !emptyState) return;

        if (this.filteredRooms.length === 0) {
            roomsGrid.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        roomsGrid.style.display = 'grid';
        emptyState.classList.add('hidden');

        roomsGrid.innerHTML = this.filteredRooms.map(room => this.createRoomCard(room)).join('');

        // Add event listeners to action buttons
        this.filteredRooms.forEach(room => {
            const editBtn = document.getElementById(`edit-${room.id}`);
            const deleteBtn = document.getElementById(`delete-${room.id}`);

            if (editBtn) {
                editBtn.addEventListener('click', () => this.openRoomModal(room));
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteRoom(room.id));
            }
        });
    }

    createRoomCard(room) {
        // Dynamic status calculation based on occupancy
        let status = room.status || 'available';
        let statusClass = status;
        
        const occupiedBeds = room.occupiedBeds || 0;
        const capacity = room.capacity || 1;
        
        if (occupiedBeds >= capacity) {
            status = 'full';
            statusClass = 'occupied'; // Use existing red styling for full rooms
        } else if (occupiedBeds > 0) {
            status = 'partial';
            statusClass = 'partial';
        } else {
            status = 'available';
            statusClass = 'available';
        }

        const amenityTags = room.amenities?.map(amenity => 
            `<span class="amenity-tag">${amenity.replace('_', ' ')}</span>`
        ).join('') || '';

        return `
            <div class="room-card">
                <div class="room-header">
                    <div class="room-number">Room ${room.roomNumber}</div>
                    <div class="room-status ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
                </div>
                
                <div class="room-details">
                    <div class="room-detail">
                        <i class="fas fa-layer-group"></i>
                        <span>Floor ${room.floor}</span>
                    </div>
                    <div class="room-detail">
                        <i class="fas fa-users"></i>
                        <span>${room.occupiedBeds || 0}/${room.capacity}</span>
                    </div>
                    <div class="room-detail">
                        <i class="fas fa-bed"></i>
                        <span>${room.roomType}</span>
                    </div>
                    <div class="room-detail">
                        <i class="fas fa-rupee-sign"></i>
                        <span>${Utils.formatCurrency(room.monthlyRent)}</span>
                    </div>
                </div>
                
                <div class="room-amenities">
                    ${amenityTags}
                </div>
                
                <div class="room-actions">
                    <button class="btn-secondary btn-small" id="edit-${room.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-secondary btn-small" id="delete-${room.id}" style="color: #FF6B6B;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }
}

// Initialize room manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.roomManager = new RoomManager();
});
