// Fee Management Module
class FeeManager {
    constructor() {
        this.db = null;
        this.fees = [];
        this.filteredFees = [];
        this.students = [];
        this.rooms = [];
        this.summary = {
            totalPaid: 0,
            totalPending: 0,
            overdueFees: 0
        };
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                await this.loadData();
                this.setupEventListeners();
                this.populateYearDropdown();
                this.populateMonthFilterDropdown();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Fee manager initialization error:', error);
            Utils.showNotification('Failed to initialize fee management', 'error');
        }
    }

    async loadData() {
        try {
            Utils.showLoading(true);

            const { collection, getDocs, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

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

            this.populateStudentDropdown();
            this.populateRoomFilterDropdown();

            // Set up real-time listener for fees
            onSnapshot(collection(this.db, 'fees'), (snapshot) => {
                this.fees = [];
                snapshot.forEach(doc => {
                    this.fees.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                this.filteredFees = [...this.fees];
                this.calculateSummary();
                this.renderFees();
            });

        } catch (error) {
            console.error('Error loading data:', error);
            Utils.showNotification('Failed to load data', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    populateStudentDropdown() {
        const studentSelect = document.getElementById('studentSelect');
        if (!studentSelect) return;

        // Clear existing options (except first)
        while (studentSelect.children.length > 1) {
            studentSelect.removeChild(studentSelect.lastChild);
        }

        // Add students with room information
        this.students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            const roomInfo = this.getRoomInfoForStudent(student);
            option.textContent = `${student.firstName} ${student.lastName} (${student.rollNumber}) - ${roomInfo}`;
            studentSelect.appendChild(option);
        });
    }

    populateRoomFilterDropdown() {
        const roomFilter = document.getElementById('roomFilter');
        if (!roomFilter) return;

        // Clear existing options (except first)
        while (roomFilter.children.length > 1) {
            roomFilter.removeChild(roomFilter.lastChild);
        }

        // Get unique room numbers from students
        const roomNumbers = new Set();
        this.students.forEach(student => {
            const roomInfo = this.getRoomInfoForStudent(student);
            if (roomInfo !== 'No Room' && roomInfo !== 'Not Assigned') {
                roomNumbers.add(roomInfo);
            }
        });

        // Sort room numbers
        const sortedRooms = Array.from(roomNumbers).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''));
            const numB = parseInt(b.replace(/\D/g, ''));
            return numA - numB;
        });

        // Add room options
        sortedRooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = `Room ${room}`;
            roomFilter.appendChild(option);
        });
    }

    getRoomInfoForStudent(student) {
        if (!student.assignedRoom) return 'No Room';
        
        // Check if assignedRoom is a document ID (long alphanumeric string)
        const isDocumentId = student.assignedRoom.length > 15 && /^[a-zA-Z0-9]+$/.test(student.assignedRoom);
        
        if (isDocumentId) {
            // Find room by document ID
            const room = this.rooms.find(r => r.id === student.assignedRoom);
            return room ? room.roomNumber : 'Not Assigned';
        } else {
            // It's already a room number
            return student.assignedRoom;
        }
    }

    populateYearDropdown() {
        const yearSelect = document.getElementById('year');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        
        // Clear existing options (except first)
        while (yearSelect.children.length > 1) {
            yearSelect.removeChild(yearSelect.lastChild);
        }

        // Add years (current year and next year)
        for (let year = currentYear - 1; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }

        // Set current year as default
        yearSelect.value = currentYear;
    }

    populateMonthFilterDropdown() {
        const monthFilter = document.getElementById('monthFilter');
        if (!monthFilter) return;

        const months = [
            { value: '01', name: 'January' },
            { value: '02', name: 'February' },
            { value: '03', name: 'March' },
            { value: '04', name: 'April' },
            { value: '05', name: 'May' },
            { value: '06', name: 'June' },
            { value: '07', name: 'July' },
            { value: '08', name: 'August' },
            { value: '09', name: 'September' },
            { value: '10', name: 'October' },
            { value: '11', name: 'November' },
            { value: '12', name: 'December' }
        ];

        // Clear existing options (except first)
        while (monthFilter.children.length > 1) {
            monthFilter.removeChild(monthFilter.lastChild);
        }

        // Add month options
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month.value;
            option.textContent = month.name;
            monthFilter.appendChild(option);
        });
    }

    setupEventListeners() {
        // Record payment button
        const recordPaymentBtn = document.getElementById('recordPaymentBtn');
        if (recordPaymentBtn) {
            recordPaymentBtn.addEventListener('click', () => this.openPaymentModal());
        }



        // Modal close buttons
        const modal = document.getElementById('paymentModal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelPaymentBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePaymentModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closePaymentModal());
        }

        // Close modal on outside click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePaymentModal();
                }
            });
        }

        // Form submission
        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Student selection change - auto-fill amount
        const studentSelect = document.getElementById('studentSelect');
        if (studentSelect) {
            studentSelect.addEventListener('change', () => this.updateAmountFromRoom());
        }

        // Filters
        const statusFilter = document.getElementById('statusFilter');
        const monthFilter = document.getElementById('monthFilter');
        const feeTypeFilter = document.getElementById('feeTypeFilter');
        const roomFilter = document.getElementById('roomFilter');
        const searchStudent = document.getElementById('searchStudent');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.applyFilters());
        }

        if (monthFilter) {
            monthFilter.addEventListener('change', () => this.applyFilters());
        }

        if (feeTypeFilter) {
            feeTypeFilter.addEventListener('change', () => this.applyFilters());
        }

        if (roomFilter) {
            roomFilter.addEventListener('change', () => this.applyFilters());
        }

        if (searchStudent) {
            searchStudent.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }

        // Debug button
        const debugBtn = document.getElementById('debugBtn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.showDebugInfo());
        }

        // Advanced buttons (will be set up after methods are defined)
        setTimeout(() => this.setupAdvancedButtons(), 100);

        // Set default payment date to today
        const paymentDate = document.getElementById('paymentDate');
        if (paymentDate) {
            paymentDate.value = new Date().toISOString().split('T')[0];
        }
    }

    updateAmountFromRoom() {
        const studentSelect = document.getElementById('studentSelect');
        const amountInput = document.getElementById('amount');
        
        if (!studentSelect || !amountInput) return;

        const studentId = studentSelect.value;
        if (!studentId) {
            amountInput.value = '';
            return;
        }

        const student = this.students.find(s => s.id === studentId);
        if (!student || !student.assignedRoom) {
            amountInput.value = '';
            return;
        }

        const room = this.rooms.find(r => r.id === student.assignedRoom);
        if (room) {
            amountInput.value = room.monthlyRent;
        }
    }

    openPaymentModal() {
        const modal = document.getElementById('paymentModal');
        const form = document.getElementById('paymentForm');

        if (!modal || !form) return;

        form.reset();
        
        // Set default payment date
        const paymentDate = document.getElementById('paymentDate');
        if (paymentDate) {
            paymentDate.value = new Date().toISOString().split('T')[0];
        }

        // Set current month and year
        const now = new Date();
        const monthSelect = document.getElementById('month');
        const yearSelect = document.getElementById('year');
        
        if (monthSelect) {
            monthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
        }
        
        if (yearSelect) {
            yearSelect.value = now.getFullYear();
        }

        modal.classList.remove('hidden');
    }

    closePaymentModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        try {
            Utils.showLoading(true);

            const formData = new FormData(e.target);
            const paymentData = {
                studentId: formData.get('studentSelect'),
                month: formData.get('month'),
                year: parseInt(formData.get('year')),
                amount: parseFloat(formData.get('amount')),
                paymentDate: new Date(formData.get('paymentDate')),
                paymentMethod: formData.get('paymentMethod'),
                feeType: formData.get('feeType') || 'monthly_rent',
                notes: formData.get('notes') || '',
                status: 'paid',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Validate form
            if (!this.validatePaymentData(paymentData)) {
                return;
            }

            // Check for duplicate payment
            const existingPayment = this.fees.find(fee => 
                fee.studentId === paymentData.studentId &&
                fee.month === paymentData.month &&
                fee.year === paymentData.year &&
                fee.feeType === paymentData.feeType
            );

            if (existingPayment) {
                Utils.showNotification('Payment for this month already exists', 'error');
                return;
            }

            const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            await addDoc(collection(this.db, 'fees'), paymentData);
            Utils.showNotification('Payment recorded successfully');

            this.closePaymentModal();

        } catch (error) {
            console.error('Error recording payment:', error);
            Utils.showNotification('Failed to record payment', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    validatePaymentData(data) {
        const required = ['studentId', 'month', 'year', 'amount', 'paymentDate', 'paymentMethod'];
        
        for (const field of required) {
            if (!data[field] && data[field] !== 0) {
                Utils.showNotification(`${field.replace(/([A-Z])/g, ' $1')} is required`, 'error');
                return false;
            }
        }

        if (data.amount <= 0) {
            Utils.showNotification('Amount must be greater than 0', 'error');
            return false;
        }

        return true;
    }

    async updatePaymentStatus(feeId, newStatus) {
        try {
            Utils.showLoading(true);

            const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const feeRef = doc(this.db, 'fees', feeId);
            await updateDoc(feeRef, {
                status: newStatus,
                updatedAt: new Date()
            });

            Utils.showNotification('Payment status updated');

        } catch (error) {
            console.error('Error updating payment status:', error);
            Utils.showNotification('Failed to update payment status', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    calculateSummary() {
        this.summary = {
            totalPaid: 0,
            totalPending: 0,
            overdueFees: 0
        };

        const currentDate = new Date();
        
        this.fees.forEach(fee => {
            const amount = fee.amount || 0;
            
            if (fee.status === 'paid') {
                this.summary.totalPaid += amount;
            } else if (fee.status === 'pending') {
                this.summary.totalPending += amount;
                
                // Check if overdue (assuming due date is 5th of each month)
                const dueDate = new Date(fee.year, fee.month - 1, 5);
                if (currentDate > dueDate) {
                    this.summary.overdueFees += amount;
                }
            }
        });

        this.updateSummaryDisplay();
    }

    updateSummaryDisplay() {
        const elements = {
            totalPaid: document.getElementById('totalPaid'),
            totalPending: document.getElementById('totalPending'),
            overdueFees: document.getElementById('overdueFees')
        };

        if (elements.totalPaid) {
            elements.totalPaid.textContent = Utils.formatCurrency(this.summary.totalPaid);
        }
        
        if (elements.totalPending) {
            elements.totalPending.textContent = Utils.formatCurrency(this.summary.totalPending);
        }
        
        if (elements.overdueFees) {
            elements.overdueFees.textContent = Utils.formatCurrency(this.summary.overdueFees);
        }
    }

    applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const monthFilter = document.getElementById('monthFilter').value;
        const feeTypeFilter = document.getElementById('feeTypeFilter').value;
        const roomFilter = document.getElementById('roomFilter').value;
        const searchTerm = document.getElementById('searchStudent').value.toLowerCase();

        this.filteredFees = this.fees.filter(fee => {
            const student = this.students.find(s => s.id === fee.studentId);
            
            const matchesStatus = !statusFilter || fee.status === statusFilter;
            const matchesMonth = !monthFilter || fee.month === monthFilter;
            const matchesFeeType = !feeTypeFilter || fee.feeType === feeTypeFilter;
            
            // Room filter matching
            const matchesRoom = !roomFilter || (student && this.getRoomInfoForStudent(student) === roomFilter);
            
            // Enhanced search to include room numbers
            const matchesSearch = !searchTerm || 
                (student && (
                    student.firstName.toLowerCase().includes(searchTerm) ||
                    student.lastName.toLowerCase().includes(searchTerm) ||
                    student.rollNumber.toLowerCase().includes(searchTerm) ||
                    this.getRoomInfoForStudent(student).toLowerCase().includes(searchTerm)
                ));

            return matchesStatus && matchesMonth && matchesFeeType && matchesRoom && matchesSearch;
        });

        this.renderFees();
    }

    renderFees() {
        const tableBody = document.getElementById('feesTableBody');
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.querySelector('.table-container');

        if (!tableBody || !emptyState || !tableContainer) return;

        if (this.filteredFees.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        tableContainer.style.display = 'block';
        emptyState.classList.add('hidden');

        tableBody.innerHTML = this.filteredFees.map(fee => this.createFeeRow(fee)).join('');

        // Add event listeners to action buttons
        this.filteredFees.forEach(fee => {
            const statusBtn = document.getElementById(`status-${fee.id}`);
            
            if (statusBtn) {
                statusBtn.addEventListener('click', () => {
                    const newStatus = fee.status === 'pending' ? 'paid' : 'pending';
                    this.updatePaymentStatus(fee.id, newStatus);
                });
            }
        });
    }

    createFeeRow(fee) {
        const student = this.students.find(s => s.id === fee.studentId);
        const room = student ? this.rooms.find(r => r.id === student.assignedRoom) : null;
        
        const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
        const roomNumber = room ? `Room ${room.roomNumber}` : 'Not Assigned';
        
        // Handle different fee types
        let periodDisplay = '';
        let dueDateDisplay = '';
        
        if (fee.feeType === 'security_deposit') {
            periodDisplay = 'Security Deposit';
            dueDateDisplay = 'One-time';
        } else {
            periodDisplay = fee.month && fee.year ? `${Utils.getMonthName(parseInt(fee.month))} ${fee.year}` : 'N/A';
            
            // Calculate due date (5th of the month)
            if (fee.month && fee.year) {
                const dueDate = new Date(fee.year, parseInt(fee.month) - 1, 5);
                dueDateDisplay = Utils.formatDate(dueDate);
            } else {
                dueDateDisplay = 'N/A';
            }
        }
        
        // Determine status class
        let isOverdue = false;
        if (fee.status === 'pending' && fee.month && fee.year) {
            const dueDate = new Date(fee.year, parseInt(fee.month) - 1, 5);
            isOverdue = new Date() > dueDate;
        }
        
        const statusClass = fee.status === 'paid' ? 'paid' : 
                           isOverdue ? 'overdue' : 'pending';
        
        // Fee type display
        const feeTypeMap = {
            'monthly_rent': 'Monthly Rent',
            'security_deposit': 'Security Deposit',
            'maintenance': 'Maintenance',
            'electricity': 'Electricity',
            'other': 'Other'
        };
        
        const feeTypeDisplay = feeTypeMap[fee.feeType] || 'Monthly Rent';

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${studentName}</div>
                    <div style="font-size: 12px; color: #718096;">${student?.rollNumber || 'N/A'}</div>
                </td>
                <td>${roomNumber}</td>
                <td>
                    <div style="font-weight: 500;">${periodDisplay}</div>
                    <div style="font-size: 12px; color: #718096;">${feeTypeDisplay}</div>
                </td>
                <td>${Utils.formatCurrency(fee.amount)}</td>
                <td>${dueDateDisplay}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${isOverdue ? 'overdue' : fee.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-secondary btn-small" id="status-${fee.id}">
                            <i class="fas fa-${fee.status === 'paid' ? 'undo' : 'check'}"></i>
                            ${fee.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                        </button>
                        ${fee.status === 'paid' ? `
                        <button class="btn-primary btn-small" onclick="feeManager.generateReceiptForFee('${fee.id}')">
                            <i class="fas fa-receipt"></i>
                            Receipt
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    setupAdvancedButtons() {
        const generateFeesBtn = document.getElementById('generateFeesBtn');
        const viewReportsBtn = document.getElementById('viewReportsBtn');

        if (generateFeesBtn) {
            generateFeesBtn.addEventListener('click', () => this.showAdvancedFeeModal());
        }

        if (viewReportsBtn) {
            viewReportsBtn.addEventListener('click', () => {
                if (window.reportManager) {
                    window.reportManager.showReportModal();
                    window.reportManager.setupReportTypeListeners();
                }
            });
        }
    }

    // Advanced Fee Generation
    showAdvancedFeeModal() {
        const modal = document.getElementById('advancedFeeModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Set default values
            const currentDate = new Date();
            document.getElementById('advancedStartMonth').value = String(currentDate.getMonth() + 1).padStart(2, '0');
            document.getElementById('advancedStartYear').value = currentDate.getFullYear();
            document.getElementById('advancedEndMonth').value = String(currentDate.getMonth() + 1).padStart(2, '0');
            document.getElementById('advancedEndYear').value = currentDate.getFullYear();

            // Add close events
            modal.querySelector('.modal-close').addEventListener('click', () => this.closeAdvancedFeeModal());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAdvancedFeeModal();
            });
        }
    }

    closeAdvancedFeeModal() {
        const modal = document.getElementById('advancedFeeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async generateAdvancedFees() {
        const formData = new FormData(document.getElementById('advancedFeeForm'));
        const startMonth = parseInt(formData.get('startMonth'));
        const startYear = parseInt(formData.get('startYear'));
        const endMonth = parseInt(formData.get('endMonth'));
        const endYear = parseInt(formData.get('endYear'));
        const feeType = formData.get('feeType');
        const includeSecurityDeposit = formData.get('includeSecurityDeposit') === 'on';

        if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
            Utils.showNotification('End date must be after start date', 'error');
            return;
        }

        if (!confirm(`Generate ${feeType} fees from ${Utils.getMonthName(startMonth)} ${startYear} to ${Utils.getMonthName(endMonth)} ${endYear}?`)) {
            return;
        }

        try {
            Utils.showLoading(true);

            const { collection, addDoc, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            let generatedCount = 0;
            let skippedCount = 0;

            for (const student of this.students) {
                if (!student.assignedRoom) {
                    continue;
                }

                const room = this.rooms.find(r => r.id === student.assignedRoom);
                if (!room) {
                    continue;
                }

                // Generate security deposit if requested
                if (includeSecurityDeposit) {
                    const securityQuery = query(
                        collection(this.db, 'fees'),
                        where('studentId', '==', student.id),
                        where('feeType', '==', 'security_deposit')
                    );

                    const existingSecurity = await getDocs(securityQuery);
                    
                    if (existingSecurity.empty) {
                        const securityAmount = (room.monthlyRent || 0) * 2;
                        const securityData = {
                            studentId: student.id,
                            feeType: 'security_deposit',
                            amount: securityAmount,
                            status: 'pending',
                            description: 'Security Deposit (2 months)',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        await addDoc(collection(this.db, 'fees'), securityData);
                        generatedCount++;
                    }
                }

                // Generate monthly fees
                let currentYear = startYear;
                let currentMonth = startMonth;

                while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                    const feeQuery = query(
                        collection(this.db, 'fees'),
                        where('studentId', '==', student.id),
                        where('month', '==', String(currentMonth).padStart(2, '0')),
                        where('year', '==', currentYear),
                        where('feeType', '==', feeType)
                    );

                    const existingFees = await getDocs(feeQuery);
                    
                    if (existingFees.empty) {
                        const feeData = {
                            studentId: student.id,
                            month: String(currentMonth).padStart(2, '0'),
                            year: currentYear,
                            amount: room.monthlyRent || 0,
                            feeType: feeType,
                            status: 'pending',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        await addDoc(collection(this.db, 'fees'), feeData);
                        generatedCount++;
                    } else {
                        skippedCount++;
                    }

                    currentMonth++;
                    if (currentMonth > 12) {
                        currentMonth = 1;
                        currentYear++;
                    }
                }
            }

            Utils.showNotification(`Generated ${generatedCount} fees, skipped ${skippedCount} existing records`);
            this.closeAdvancedFeeModal();
            await this.loadFees();

        } catch (error) {
            console.error('Error generating fees:', error);
            Utils.showNotification('Failed to generate fees', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Reports and Analytics
    showReportsModal() {
        const modal = document.getElementById('reportsModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Add close events
            modal.querySelector('.modal-close').addEventListener('click', () => this.closeReportsModal());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeReportsModal();
            });

            // Setup tabs
            this.setupReportTabs();
            this.loadReportsData();
        }
    }

    closeReportsModal() {
        const modal = document.getElementById('reportsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    setupReportTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show/hide content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const targetContent = document.getElementById(tabName + 'Tab');
                if (targetContent) {
                    targetContent.classList.remove('hidden');
                }

                // Load specific tab data
                if (tabName === 'students') {
                    this.loadStudentsReport();
                } else if (tabName === 'receipts') {
                    this.loadReceiptsTab();
                }
            });
        });
    }

    loadReportsData() {
        // Calculate summary statistics
        let totalCollections = 0;
        let pendingDues = 0;
        let overdueAmount = 0;
        let securityDeposits = 0;

        this.fees.forEach(fee => {
            if (fee.status === 'paid') {
                totalCollections += fee.amount || 0;
                if (fee.feeType === 'security_deposit') {
                    securityDeposits += fee.amount || 0;
                }
            } else if (fee.status === 'pending') {
                pendingDues += fee.amount || 0;
                
                // Check if overdue
                if (fee.month && fee.year) {
                    const dueDate = new Date(fee.year, parseInt(fee.month) - 1, 5);
                    if (new Date() > dueDate) {
                        overdueAmount += fee.amount || 0;
                    }
                }
            }
        });

        // Update summary cards
        document.getElementById('totalCollections').textContent = Utils.formatCurrency(totalCollections);
        document.getElementById('pendingDues').textContent = Utils.formatCurrency(pendingDues);
        document.getElementById('overdueAmount').textContent = Utils.formatCurrency(overdueAmount);
        document.getElementById('securityDeposits').textContent = Utils.formatCurrency(securityDeposits);
    }

    loadStudentsReport() {
        const container = document.getElementById('studentsReportContent');
        if (!container) return;

        let html = '<div class="students-status-grid">';

        this.students.forEach(student => {
            const room = this.rooms.find(r => r.id === student.assignedRoom);
            const studentFees = this.fees.filter(f => f.studentId === student.id);
            
            let totalPaid = 0;
            let totalPending = 0;
            let overdue = 0;
            let hasSecurityDeposit = false;

            studentFees.forEach(fee => {
                if (fee.status === 'paid') {
                    totalPaid += fee.amount || 0;
                } else if (fee.status === 'pending') {
                    totalPending += fee.amount || 0;
                    
                    if (fee.month && fee.year) {
                        const dueDate = new Date(fee.year, parseInt(fee.month) - 1, 5);
                        if (new Date() > dueDate) {
                            overdue += fee.amount || 0;
                        }
                    }
                }

                if (fee.feeType === 'security_deposit') {
                    hasSecurityDeposit = true;
                }
            });

            const securityStatus = hasSecurityDeposit ? 
                (studentFees.find(f => f.feeType === 'security_deposit' && f.status === 'paid') ? 'Paid' : 'Pending') : 
                'Not Required';

            html += `
                <div class="student-status-card">
                    <div class="student-header">
                        <h4>${student.firstName} ${student.lastName}</h4>
                        <span class="roll-number">${student.rollNumber}</span>
                    </div>
                    <div class="room-info">
                        <i class="fas fa-home"></i>
                        ${room ? `Room ${room.roomNumber}` : 'Not Assigned'}
                    </div>
                    <div class="fee-summary">
                        <div class="fee-item">
                            <span class="label">Total Paid:</span>
                            <span class="amount paid">${Utils.formatCurrency(totalPaid)}</span>
                        </div>
                        <div class="fee-item">
                            <span class="label">Pending:</span>
                            <span class="amount pending">${Utils.formatCurrency(totalPending)}</span>
                        </div>
                        ${overdue > 0 ? `
                        <div class="fee-item">
                            <span class="label">Overdue:</span>
                            <span class="amount overdue">${Utils.formatCurrency(overdue)}</span>
                        </div>
                        ` : ''}
                        <div class="fee-item">
                            <span class="label">Security Deposit:</span>
                            <span class="security-status ${securityStatus.toLowerCase().replace(' ', '-')}">${securityStatus}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    loadReceiptsTab() {
        // Populate student dropdown
        const studentSelect = document.getElementById('receiptStudent');
        if (studentSelect) {
            studentSelect.innerHTML = '<option value="">Select Student</option>';
            this.students.forEach(student => {
                studentSelect.innerHTML += `<option value="${student.id}">${student.firstName} ${student.lastName}</option>`;
            });

            studentSelect.addEventListener('change', () => {
                const studentId = studentSelect.value;
                const paymentSelect = document.getElementById('receiptPayment');
                
                if (paymentSelect && studentId) {
                    paymentSelect.innerHTML = '<option value="">Select Payment</option>';
                    const paidFees = this.fees.filter(f => f.studentId === studentId && f.status === 'paid');
                    
                    paidFees.forEach(fee => {
                        const period = fee.feeType === 'security_deposit' ? 
                            'Security Deposit' : 
                            `${Utils.getMonthName(parseInt(fee.month))} ${fee.year}`;
                        
                        paymentSelect.innerHTML += `<option value="${fee.id}">${period} - ${Utils.formatCurrency(fee.amount)}</option>`;
                    });
                }
            });
        }
    }

    generateReceipt() {
        const studentId = document.getElementById('receiptStudent').value;
        const feeId = document.getElementById('receiptPayment').value;

        if (!studentId || !feeId) {
            Utils.showNotification('Please select student and payment', 'error');
            return;
        }

        this.generateReceiptForFee(feeId);
    }

    generateReceiptForFee(feeId) {
        const fee = this.fees.find(f => f.id === feeId);
        const student = this.students.find(s => s.id === fee.studentId);
        const room = student ? this.rooms.find(r => r.id === student.assignedRoom) : null;

        if (!fee || !student) {
            Utils.showNotification('Receipt data not found', 'error');
            return;
        }

        const receiptHtml = this.createReceiptHTML(fee, student, room);
        
        // Show in modal or new window
        const receiptWindow = window.open('', '_blank');
        receiptWindow.document.write(receiptHtml);
        receiptWindow.document.close();
        receiptWindow.print();
    }

    // QR Code generation functions
    generateQRCodeData(receiptNumber, verificationCode, securityHash, rollNumber, amount) {
        // Create a compact verification string with all essential data
        const qrPayload = {
            rcp: receiptNumber,            // Receipt number
            vc: verificationCode,          // Verification code
            sh: securityHash.substring(0, 16), // First 16 chars of security hash
            roll: rollNumber,              // Student roll number
            amt: amount,                   // Amount
            ts: Date.now(),               // Timestamp
            host: window.location.hostname // Hostel domain for verification
        };
        
        // Convert to JSON and encode
        return JSON.stringify(qrPayload);
    }

    generateQRCodeURL(data) {
        // Use reliable QR code generation
        const encodedData = encodeURIComponent(data);
        const size = '150x150';
        
        // Primary QR API that works reliably in most environments
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodedData}&format=png&margin=10`;
    }
    
    // Fallback function to create QR code if external APIs fail
    generateLocalQRCode(data) {
        // Create a simple visual representation for fallback
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 150, 150);
        
        // Add border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, 140, 140);
        
        // Add QR pattern simulation
        ctx.fillStyle = '#000000';
        for(let i = 0; i < 10; i++) {
            for(let j = 0; j < 10; j++) {
                if((i + j + data.length) % 3 === 0) {
                    ctx.fillRect(15 + i * 12, 15 + j * 12, 10, 10);
                }
            }
        }
        
        // Add corner squares
        ctx.fillRect(15, 15, 30, 30);
        ctx.fillRect(105, 15, 30, 30);
        ctx.fillRect(15, 105, 30, 30);
        
        // Add text
        ctx.fillStyle = '#666666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR CODE', 75, 130);
        
        return canvas.toDataURL();
    }

    createReceiptHTML(fee, student, room) {
        const currentDate = new Date();
        const receiptNumber = `RCP-${fee.id.slice(-8).toUpperCase()}`;
        const timestamp = currentDate.getTime();
        const verificationCode = this.generateVerificationCode(fee.id, student.rollNumber, fee.amount, timestamp);
        const receiptData = {
            studentName: `${student.firstName} ${student.lastName}`,
            rollNumber: student.rollNumber,
            amount: fee.amount,
            feeType: fee.feeType,
            timestamp: timestamp
        };
        const securityHash = this.generateSecurityHash(receiptData);
        const digitalSignature = this.generateDigitalSignature(receiptNumber, fee.amount, currentDate);
        
        // Generate QR Code data
        const qrData = this.generateQRCodeData(receiptNumber, verificationCode, securityHash, student.rollNumber, fee.amount);
        const qrCodeUrl = this.generateQRCodeURL(qrData);
        
        const feeTypeMap = {
            'monthly_rent': 'Monthly Rent',
            'security_deposit': 'Security Deposit',
            'maintenance': 'Maintenance',
            'electricity': 'Electricity',
            'other': 'Other'
        };

        const period = fee.feeType === 'security_deposit' ? 
            'One-time Security Deposit' : 
            `${Utils.getMonthName(parseInt(fee.month))} ${fee.year}`;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Receipt - ${receiptNumber}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                
                * { 
                    box-sizing: border-box; 
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
                    margin: 0; 
                    padding: 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }
                
                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: 
                        repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 10px,
                            rgba(255,255,255,0.05) 10px,
                            rgba(255,255,255,0.05) 20px
                        );
                    pointer-events: none;
                    z-index: -1;
                }
                
                .receipt-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #fff;
                    border-radius: 20px;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.3);
                    overflow: hidden;
                    position: relative;
                    border: 3px solid #fff;
                }
                
                .security-watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 120px;
                    color: rgba(102, 126, 234, 0.08);
                    font-weight: 900;
                    z-index: 1;
                    pointer-events: none;
                    text-transform: uppercase;
                    letter-spacing: 10px;
                }
                
                .receipt-content {
                    position: relative;
                    z-index: 2;
                    padding: 40px;
                }
                
                .receipt-header {
                    text-align: center;
                    margin-bottom: 40px;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: -40px -40px 40px -40px;
                    padding: 40px 40px 30px 40px;
                    color: white;
                }
                
                .hostel-logo {
                    width: 80px;
                    height: 80px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    margin: 0 auto 20px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    border: 3px solid rgba(255,255,255,0.3);
                }
                
                .receipt-title {
                    font-size: 32px;
                    font-weight: 700;
                    margin-bottom: 8px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                
                .receipt-subtitle {
                    font-size: 18px;
                    font-weight: 500;
                    opacity: 0.9;
                }
                
                .security-info {
                    display: flex;
                    justify-content: space-between;
                    margin: 30px 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%);
                    border-radius: 15px;
                    border: 2px solid #667eea;
                }
                
                .security-item {
                    text-align: center;
                    flex: 1;
                }
                
                .security-label {
                    font-size: 12px;
                    color: #666;
                    font-weight: 600;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                
                .security-value {
                    font-size: 14px;
                    font-weight: 700;
                    color: #333;
                    font-family: 'Courier New', monospace;
                }
                
                .receipt-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 40px;
                }
                
                .info-section {
                    background: #f8f9fa;
                    padding: 25px;
                    border-radius: 15px;
                    border-left: 5px solid #667eea;
                }
                
                .info-label {
                    font-weight: 600;
                    color: #495057;
                    font-size: 12px;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    letter-spacing: 1px;
                }
                
                .info-value {
                    font-size: 16px;
                    font-weight: 500;
                    color: #212529;
                    margin-bottom: 15px;
                }
                
                .payment-details {
                    background: linear-gradient(135deg, #fff 0%, #f8f9ff 100%);
                    padding: 30px;
                    border-radius: 15px;
                    margin-bottom: 30px;
                    border: 2px solid #e9ecef;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                
                .payment-details h3 {
                    margin: 0 0 25px 0;
                    color: #333;
                    font-size: 20px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .payment-details h3::before {
                    content: '💳';
                    font-size: 24px;
                }
                
                .payment-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding: 12px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .payment-row:last-child {
                    border-bottom: none;
                }
                
                .payment-label {
                    font-weight: 500;
                    color: #495057;
                }
                
                .payment-value {
                    font-weight: 600;
                    color: #212529;
                }
                
                .total-amount {
                    font-size: 20px;
                    font-weight: 700;
                    color: #28a745;
                    border-top: 3px solid #667eea;
                    padding-top: 20px;
                    margin-top: 20px;
                    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
                    padding: 20px;
                    border-radius: 10px;
                }
                
                .verification-section {
                    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                    padding: 25px;
                    border-radius: 15px;
                    margin-bottom: 30px;
                    border: 2px solid #ffc107;
                    text-align: center;
                }
                
                .verification-title {
                    font-weight: 700;
                    color: #856404;
                    margin-bottom: 15px;
                    font-size: 16px;
                }
                
                .verification-code {
                    font-family: 'Courier New', monospace;
                    font-size: 18px;
                    font-weight: 700;
                    color: #856404;
                    background: rgba(255,255,255,0.7);
                    padding: 10px 20px;
                    border-radius: 8px;
                    display: inline-block;
                    letter-spacing: 2px;
                }
                
                .footer {
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 30px;
                    border-top: 2px solid #e9ecef;
                    color: #6c757d;
                    font-size: 12px;
                    line-height: 1.6;
                }
                
                .footer-warning {
                    background: #f8d7da;
                    color: #721c24;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-weight: 600;
                    border: 1px solid #f5c6cb;
                }
                
                .qr-code-section {
                    margin-top: 15px;
                    text-align: center;
                }
                
                .qr-code-container {
                    display: inline-block;
                    padding: 10px;
                    background: white;
                    border: 2px solid #667eea;
                    border-radius: 10px;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
                }
                
                .qr-code-image {
                    width: 100px;
                    height: 100px;
                    display: block;
                    margin: 0 auto;
                    border-radius: 5px;
                }
                
                .qr-code-label {
                    font-size: 10px;
                    color: #667eea;
                    font-weight: 600;
                    margin-top: 5px;
                    text-align: center;
                }
                
                .admin-seal {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 700;
                    font-size: 12px;
                    text-align: center;
                    line-height: 1.2;
                    border: 3px solid white;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                
                @media print {
                    body { 
                        margin: 0; 
                        padding: 20px;
                        background: white !important;
                    }
                    .receipt-container {
                        box-shadow: none;
                        border: 2px solid #333;
                    }
                    .security-watermark {
                        display: block !important;
                        opacity: 0.1 !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .receipt-info {
                        grid-template-columns: 1fr;
                        gap: 20px;
                    }
                    
                    .security-info {
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .receipt-content {
                        padding: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="security-watermark">ORIGINAL</div>
                <div class="admin-seal">ADMIN<br>ISSUED</div>
                
                <div class="receipt-content">
                    <div class="receipt-header">
                        <div class="hostel-logo">🏠</div>
                        <div class="receipt-title">Navadaya Girls Hostel</div>
                        <div class="receipt-subtitle">Official Payment Receipt</div>
                    </div>

                    <div class="security-info">
                        <div class="security-item">
                            <div class="security-label">Receipt ID</div>
                            <div class="security-value">${receiptNumber}</div>
                        </div>
                        <div class="security-item">
                            <div class="security-label">Verification</div>
                            <div class="security-value">${verificationCode}</div>
                        </div>
                        <div class="security-item">
                            <div class="security-label">Security Hash</div>
                            <div class="security-value">${securityHash}</div>
                        </div>
                        <div class="security-item">
                            <div class="security-label">Digital Sign</div>
                            <div class="security-value">${digitalSignature}</div>
                        </div>
                    </div>

                    <div class="receipt-info">
                        <div class="info-section">
                            <div class="info-label">Receipt Information</div>
                            <div class="info-value">📄 ${receiptNumber}</div>
                            
                            <div class="info-label">Generated Date</div>
                            <div class="info-value">📅 ${Utils.formatDate(currentDate)}</div>
                            
                            <div class="info-label">Time</div>
                            <div class="info-value">⏰ ${currentDate.toLocaleTimeString()}</div>
                        </div>
                        
                        <div class="info-section">
                            <div class="info-label">Student Details</div>
                            <div class="info-value">👤 ${student.firstName} ${student.lastName}</div>
                            
                            <div class="info-label">Roll Number</div>
                            <div class="info-value">🎓 ${student.rollNumber}</div>
                            
                            <div class="info-label">Room Assignment</div>
                            <div class="info-value">🏠 ${room ? `Room ${room.roomNumber}` : 'Not Assigned'}</div>
                        </div>
                    </div>

                    <div class="payment-details">
                        <h3>Payment Information</h3>
                        
                        <div class="payment-row">
                            <span class="payment-label">Fee Type:</span>
                            <span class="payment-value">${feeTypeMap[fee.feeType] || 'Monthly Rent'}</span>
                        </div>
                        
                        <div class="payment-row">
                            <span class="payment-label">Billing Period:</span>
                            <span class="payment-value">${period}</span>
                        </div>
                        
                        <div class="payment-row">
                            <span class="payment-label">Payment Date:</span>
                            <span class="payment-value">${fee.paymentDate ? Utils.formatDate(new Date(fee.paymentDate)) : Utils.formatDate(currentDate)}</span>
                        </div>
                        
                        <div class="payment-row">
                            <span class="payment-label">Payment Method:</span>
                            <span class="payment-value">${fee.paymentMethod || 'Cash'}</span>
                        </div>
                        
                        ${fee.notes ? `
                        <div class="payment-row">
                            <span class="payment-label">Additional Notes:</span>
                            <span class="payment-value">${fee.notes}</span>
                        </div>
                        ` : ''}
                        
                        <div class="payment-row total-amount">
                            <span class="payment-label">💰 Total Amount Paid:</span>
                            <span class="payment-value">${Utils.formatCurrency(fee.amount)}</span>
                        </div>
                    </div>

                    <div class="verification-section">
                        <div class="verification-title">🔐 Receipt Verification Code</div>
                        <div class="verification-code">${verificationCode}</div>
                        <div style="margin-top: 10px; font-size: 11px; color: #856404;">
                            Use this code to verify authenticity at hostel office
                        </div>
                        <div class="qr-code-section">
                            <div class="qr-code-container">
                                <img src="${qrCodeUrl}" alt="QR Verification Code" class="qr-code-image" 
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                     onload="console.log('QR Code loaded successfully');" />
                                <div class="qr-code-fallback" style="display:none; padding:15px; border:2px dashed #667eea; border-radius:8px; text-align:center; font-size:11px; background:#f8f9ff;">
                                    <div style="font-weight:600; color:#667eea; margin-bottom:5px;">📱 QR Verification Code</div>
                                    <div style="font-family:monospace; font-size:9px; color:#333; word-break:break-all;">
                                        ${qrData.substring(0, 80)}...
                                    </div>
                                    <div style="font-size:9px; color:#666; margin-top:5px;">
                                        Scan manually or use verification codes above
                                    </div>
                                </div>
                                <div class="qr-code-label">📱 QR Verification</div>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p><strong>🏛️ Navadaya Girls Hostel Management System</strong></p>
                        <p>This is an official computer-generated receipt with digital security features.</p>
                        <p>Generated on ${Utils.formatDate(currentDate)} at ${currentDate.toLocaleTimeString()}</p>
                        <p>For queries, contact the hostel administration office.</p>
                        
                        <div class="footer-warning">
                            ⚠️ WARNING: This receipt contains security features to prevent forgery. 
                            Any attempt to modify, copy, or duplicate this receipt is strictly prohibited and may result in disciplinary action.
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }
    
    generateVerificationCode(feeId, rollNumber, amount, timestamp) {
        // Create a unique verification code based on multiple parameters
        const baseString = `${feeId}${rollNumber}${amount}${timestamp}NAVADAYA${new Date().getFullYear()}`;
        let hash = 0;
        for (let i = 0; i < baseString.length; i++) {
            const char = baseString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Create more complex verification code with checksum
        const primaryCode = Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
        const checksum = this.calculateChecksum(baseString);
        return `${primaryCode}-${checksum}`;
    }
    
    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data.charCodeAt(i) * (i + 1);
        }
        return (sum % 999).toString().padStart(3, '0');
    }
    
    generateSecurityHash(receiptData) {
        // Generate a complex security hash based on receipt data
        const securityString = `${receiptData.studentName}${receiptData.rollNumber}${receiptData.amount}${receiptData.feeType}${receiptData.timestamp}NAVADAYA_SECURITY_2025`;
        let hash = 0;
        for (let i = 0; i < securityString.length; i++) {
            const char = securityString.charCodeAt(i);
            hash = ((hash << 7) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase().slice(0, 12);
    }
    
    generateDigitalSignature(receiptNumber, amount, date) {
        // Create a digital signature for security
        const signatureBase = `${receiptNumber}${amount}${date.getTime()}`;
        let signature = 0;
        for (let i = 0; i < signatureBase.length; i++) {
            signature = ((signature << 3) - signature) + signatureBase.charCodeAt(i);
            signature = signature & signature;
        }
        return Math.abs(signature).toString(16).toUpperCase().slice(0, 6);
    }

    // Debug functionality
    showDebugInfo() {
        const debugInfo = {
            totalStudents: this.students.length,
            totalRooms: this.rooms.length,
            totalFees: this.fees.length,
            filteredFees: this.filteredFees.length,
            studentsWithRooms: this.students.filter(s => s.assignedRoom).length,
            studentsWithoutRooms: this.students.filter(s => !s.assignedRoom).length,
            roomAssignmentIssues: this.students.filter(s => s.assignedRoom && s.assignedRoom.length > 15).length,
            databaseStatus: this.db ? 'Connected' : 'Not Connected',
            summary: this.summary
        };

        const roomDetails = this.students.map(student => ({
            name: `${student.firstName} ${student.lastName}`,
            rollNumber: student.rollNumber,
            assignedRoom: student.assignedRoom,
            actualRoom: this.getRoomInfoForStudent(student),
            hasRoomIssue: student.assignedRoom && student.assignedRoom.length > 15
        }));

        console.group('🔍 Fees Management Debug Information');
        console.log('📊 System Overview:', debugInfo);
        console.log('🏠 Room Assignment Details:', roomDetails);
        console.log('💰 Current Fees Data:', this.fees);
        console.log('🔍 Filtered Fees:', this.filteredFees);
        console.log('👥 Students Data:', this.students);
        console.log('🏠 Rooms Data:', this.rooms);
        console.groupEnd();

        // Show debug modal
        this.showDebugModal(debugInfo, roomDetails);
    }

    showDebugModal(debugInfo, roomDetails) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 8px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        const roomIssuesTable = roomDetails
            .filter(student => student.hasRoomIssue)
            .map(student => `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.rollNumber}</td>
                    <td style="color: red; font-family: monospace;">${student.assignedRoom}</td>
                    <td style="color: green;">${student.actualRoom}</td>
                </tr>
            `).join('');

        content.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 1rem;">
                <h2 style="margin: 0; color: #333;">🔍 Debug Information</h2>
                <button onclick="this.closest('.modal').remove()" style="background: #dc3545; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: #e3f2fd; padding: 1rem; border-radius: 6px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #1976d2;">Students</h4>
                    <p style="margin: 0; font-size: 1.5rem; font-weight: bold;">${debugInfo.totalStudents}</p>
                    <small style="color: #666;">With Rooms: ${debugInfo.studentsWithRooms} | Without: ${debugInfo.studentsWithoutRooms}</small>
                </div>
                <div style="background: #f3e5f5; padding: 1rem; border-radius: 6px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #7b1fa2;">Rooms</h4>
                    <p style="margin: 0; font-size: 1.5rem; font-weight: bold;">${debugInfo.totalRooms}</p>
                </div>
                <div style="background: #e8f5e8; padding: 1rem; border-radius: 6px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #388e3c;">Total Fees</h4>
                    <p style="margin: 0; font-size: 1.5rem; font-weight: bold;">${debugInfo.totalFees}</p>
                    <small style="color: #666;">Filtered: ${debugInfo.filteredFees}</small>
                </div>
                <div style="background: #fff3e0; padding: 1rem; border-radius: 6px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #f57c00;">Database</h4>
                    <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: ${debugInfo.databaseStatus === 'Connected' ? '#4caf50' : '#f44336'};">${debugInfo.databaseStatus}</p>
                </div>
            </div>

            <div style="background: #ffebee; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 1rem 0; color: #d32f2f;">Room Assignment Issues (${debugInfo.roomAssignmentIssues})</h4>
                ${debugInfo.roomAssignmentIssues > 0 ? `
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f5f5f5;">
                                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd;">Student</th>
                                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd;">Roll No</th>
                                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd;">Database Value</th>
                                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd;">Display Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${roomIssuesTable}
                            </tbody>
                        </table>
                    </div>
                ` : '<p style="color: #4caf50; margin: 0;">✅ No room assignment issues found!</p>'}
            </div>

            <div style="background: #f8f9fa; padding: 1rem; border-radius: 6px;">
                <h4 style="margin: 0 0 1rem 0; color: #333;">Summary Statistics</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <strong>Total Paid:</strong><br>
                        <span style="color: #4caf50; font-size: 1.2rem;">${Utils.formatCurrency(debugInfo.summary.totalPaid)}</span>
                    </div>
                    <div>
                        <strong>Total Pending:</strong><br>
                        <span style="color: #ff9800; font-size: 1.2rem;">${Utils.formatCurrency(debugInfo.summary.totalPending)}</span>
                    </div>
                    <div>
                        <strong>Overdue:</strong><br>
                        <span style="color: #f44336; font-size: 1.2rem;">${Utils.formatCurrency(debugInfo.summary.overdueFees)}</span>
                    </div>
                </div>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

}

// Initialize fee manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.feeManager = new FeeManager();
});
