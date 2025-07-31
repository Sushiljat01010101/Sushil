// Report Generation Module
class ReportManager {
    constructor() {
        this.db = null;
        this.students = [];
        this.fees = [];
        this.rooms = [];
        this.init();
    }

    async init() {
        try {
            if (window.firebase) {
                this.db = window.firebase.db;
                await this.loadData();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Report manager initialization error:', error);
            Utils.showNotification('Failed to initialize report generation', 'error');
        }
    }

    async loadData() {
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Load all data needed for reports
            const [studentsSnapshot, feesSnapshot, roomsSnapshot] = await Promise.all([
                getDocs(collection(this.db, 'students')),
                getDocs(collection(this.db, 'fees')),
                getDocs(collection(this.db, 'rooms'))
            ]);

            this.students = [];
            studentsSnapshot.forEach(doc => {
                this.students.push({ id: doc.id, ...doc.data() });
            });

            this.fees = [];
            feesSnapshot.forEach(doc => {
                this.fees.push({ id: doc.id, ...doc.data() });
            });

            this.rooms = [];
            roomsSnapshot.forEach(doc => {
                this.rooms.push({ id: doc.id, ...doc.data() });
            });

        } catch (error) {
            console.error('Error loading data for reports:', error);
            Utils.showNotification('Failed to load data for reports', 'error');
        }
    }

    // Generate individual student report
    async generateStudentReport(studentId) {
        try {
            Utils.showLoading(true);
            
            // Find student data
            const student = this.students.find(s => s.id === studentId);
            if (!student) {
                Utils.showNotification('Student not found', 'error');
                return;
            }

            // Find student's fees
            const studentFees = this.fees.filter(f => f.studentId === studentId);

            // Find student's room
            const room = student.assignedRoom ? 
                this.rooms.find(r => r.id === student.assignedRoom) : null;

            // Prepare data for API
            const reportData = {
                student: student,
                fees: studentFees,
                room: room
            };

            // Call backend API to generate PDF
            const response = await fetch('/api/generate-student-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Student-Report-${student.firstName}-${student.lastName}-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Utils.showNotification('Student report generated successfully');

        } catch (error) {
            console.error('Error generating student report:', error);
            Utils.showNotification('Failed to generate student report', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Generate comprehensive all students report
    async generateAllStudentsReport(filters = {}) {
        try {
            Utils.showLoading(true);

            // Prepare comprehensive data for all students
            const studentsWithDetails = this.students.map(student => {
                // Find student's fees
                const studentFees = this.fees.filter(f => f.studentId === student.id);
                
                // Find student's room
                const room = student.assignedRoom ? 
                    this.rooms.find(r => r.id === student.assignedRoom) : null;

                return {
                    student: student,
                    fees: studentFees,
                    room: room
                };
            });

            // Apply filters if any
            let filteredData = studentsWithDetails;
            
            if (filters.year) {
                filteredData = filteredData.filter(data => 
                    data.fees.some(f => f.year == filters.year)
                );
            }
            if (filters.month) {
                filteredData = filteredData.filter(data => 
                    data.fees.some(f => f.month == filters.month)
                );
            }

            // Prepare data for API
            const reportData = {
                studentsData: filteredData,
                filters: filters,
                reportType: 'all_students'
            };

            // Call backend API to generate PDF
            const response = await fetch('/api/generate-all-students-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `All-Students-Report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Utils.showNotification('All students report generated successfully');

        } catch (error) {
            console.error('Error generating all students report:', error);
            Utils.showNotification('Failed to generate all students report', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Generate comprehensive fees report
    async generateFeesReport(filters = {}) {
        try {
            Utils.showLoading(true);

            // Filter data based on provided filters
            let filteredFees = [...this.fees];
            let filteredStudents = [...this.students];

            // Apply filters
            if (filters.year) {
                filteredFees = filteredFees.filter(f => f.year == filters.year);
            }
            if (filters.month) {
                filteredFees = filteredFees.filter(f => f.month == filters.month);
            }
            if (filters.status) {
                filteredFees = filteredFees.filter(f => f.status === filters.status);
            }
            if (filters.feeType) {
                filteredFees = filteredFees.filter(f => f.feeType === filters.feeType);
            }

            // Only include students who have fees matching the filters
            if (Object.keys(filters).length > 0) {
                const studentIdsWithFees = new Set(filteredFees.map(f => f.studentId));
                filteredStudents = filteredStudents.filter(s => studentIdsWithFees.has(s.id));
            }

            // Prepare data for API
            const reportData = {
                students: filteredStudents,
                fees: filteredFees,
                rooms: this.rooms,
                filters: filters
            };

            // Call backend API to generate PDF
            const response = await fetch('/api/generate-fees-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Fees-Report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Utils.showNotification('Fees report generated successfully');

        } catch (error) {
            console.error('Error generating fees report:', error);
            Utils.showNotification('Failed to generate fees report', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    // Show report generation modal
    showReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.populateStudentDropdown();
            this.populateFilterDropdowns();
        }
    }

    // Close report modal
    closeReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Populate student dropdown for individual reports
    populateStudentDropdown() {
        const select = document.getElementById('reportStudentSelect');
        if (select) {
            select.innerHTML = '<option value="">Select Student</option>';
            
            this.students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.firstName} ${student.lastName} (${student.rollNumber})`;
                select.appendChild(option);
            });
        }
    }

    // Populate filter dropdowns
    populateFilterDropdowns() {
        // Year dropdown
        const yearSelect = document.getElementById('reportYear');
        if (yearSelect) {
            yearSelect.innerHTML = '<option value="">All Years</option>';
            const currentYear = new Date().getFullYear();
            for (let year = currentYear - 2; year <= currentYear + 1; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }
        }

        // Month dropdown
        const monthSelect = document.getElementById('reportMonth');
        if (monthSelect) {
            monthSelect.innerHTML = '<option value="">All Months</option>';
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            months.forEach((month, index) => {
                const option = document.createElement('option');
                option.value = String(index + 1).padStart(2, '0');
                option.textContent = month;
                monthSelect.appendChild(option);
            });
        }

        // Status dropdown
        const statusSelect = document.getElementById('reportStatus');
        if (statusSelect) {
            statusSelect.innerHTML = `
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
            `;
        }

        // Fee type dropdown
        const feeTypeSelect = document.getElementById('reportFeeType');
        if (feeTypeSelect) {
            feeTypeSelect.innerHTML = `
                <option value="">All Fee Types</option>
                <option value="monthly_rent">Monthly Rent</option>
                <option value="security_deposit">Security Deposit</option>
                <option value="maintenance">Maintenance</option>
                <option value="electricity">Electricity</option>
                <option value="other">Other</option>
            `;
        }
    }

    // Generate report based on selected type
    generateSelectedReport() {
        const reportType = document.querySelector('input[name="reportType"]:checked')?.value;
        
        if (reportType === 'student') {
            const studentId = document.getElementById('reportStudentSelect').value;
            if (!studentId) {
                Utils.showNotification('Please select a student', 'error');
                return;
            }
            this.generateStudentReport(studentId);
        } else if (reportType === 'all_students') {
            const filters = {
                year: document.getElementById('reportYear').value,
                month: document.getElementById('reportMonth').value
            };
            
            // Remove empty filters
            Object.keys(filters).forEach(key => {
                if (!filters[key]) delete filters[key];
            });
            
            this.generateAllStudentsReport(filters);
        } else if (reportType === 'fees') {
            const filters = {
                year: document.getElementById('reportYear').value,
                month: document.getElementById('reportMonth').value,
                status: document.getElementById('reportStatus').value,
                feeType: document.getElementById('reportFeeType').value
            };
            
            // Remove empty filters
            Object.keys(filters).forEach(key => {
                if (!filters[key]) delete filters[key];
            });
            
            this.generateFeesReport(filters);
        }
        
        this.closeReportModal();
    }

    // Setup event listeners for report type selection
    setupReportTypeListeners() {
        const reportTypeRadios = document.querySelectorAll('input[name="reportType"]');
        reportTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const studentOptions = document.getElementById('studentReportOptions');
                const feesOptions = document.getElementById('feesReportOptions');
                
                if (e.target.value === 'student') {
                    studentOptions.classList.remove('hidden');
                    feesOptions.classList.add('hidden');
                } else {
                    studentOptions.classList.add('hidden');
                    feesOptions.classList.remove('hidden');
                }
            });
        });
    }
}

// Initialize report manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.reportManager === 'undefined') {
        window.reportManager = new ReportManager();
    }
});