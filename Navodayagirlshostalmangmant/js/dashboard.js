// Dashboard Module
class Dashboard {
    constructor() {
        this.db = null;
        this.stats = {
            totalRooms: 0,
            totalStudents: 0,
            vacantBeds: 0,
            pendingDues: 0,
            openComplaints: 0
        };
        this.charts = {};
        this.init();
    }

    async init() {
        try {
            // Wait for Firebase to be available
            if (window.firebase) {
                this.db = window.firebase.db;
                await this.loadDashboardData();
                this.setupCharts();
                this.loadRecentActivities();
            } else {
                setTimeout(() => this.init(), 100);
            }
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            Utils.showNotification('Failed to load dashboard', 'error');
        }
    }

    async loadDashboardData() {
        try {
            Utils.showLoading(true);

            // Import Firestore functions
            const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Load all collections in parallel
            const [roomsSnapshot, studentsSnapshot, feesSnapshot, complaintsSnapshot] = await Promise.all([
                getDocs(collection(this.db, 'rooms')),
                getDocs(collection(this.db, 'students')),
                getDocs(query(collection(this.db, 'fees'), where('status', '==', 'pending'))),
                getDocs(query(collection(this.db, 'complaints'), where('status', '==', 'open')))
            ]);

            // Calculate stats
            this.stats.totalRooms = roomsSnapshot.size;
            this.stats.totalStudents = studentsSnapshot.size;
            this.stats.openComplaints = complaintsSnapshot.size;

            // Calculate vacant beds
            let totalBeds = 0;
            let occupiedBeds = 0;
            roomsSnapshot.forEach(doc => {
                const room = doc.data();
                totalBeds += room.capacity || 0;
                occupiedBeds += room.occupiedBeds || 0;
            });
            this.stats.vacantBeds = totalBeds - occupiedBeds;

            // Calculate pending dues
            let pendingAmount = 0;
            feesSnapshot.forEach(doc => {
                const fee = doc.data();
                pendingAmount += fee.amount || 0;
            });
            this.stats.pendingDues = pendingAmount;

            // Update UI
            this.updateStatsDisplay();
            this.updateCharts(roomsSnapshot, feesSnapshot);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            Utils.showNotification('Failed to load dashboard data', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    updateStatsDisplay() {
        // Update stat cards
        const elements = {
            totalRooms: document.getElementById('totalRooms'),
            totalStudents: document.getElementById('totalStudents'),
            vacantBeds: document.getElementById('vacantBeds'),
            pendingDues: document.getElementById('pendingDues'),
            openComplaints: document.getElementById('openComplaints')
        };

        elements.totalRooms.textContent = this.stats.totalRooms;
        elements.totalStudents.textContent = this.stats.totalStudents;
        elements.vacantBeds.textContent = this.stats.vacantBeds;
        elements.pendingDues.textContent = Utils.formatCurrency(this.stats.pendingDues);
        elements.openComplaints.textContent = this.stats.openComplaints;
    }

    setupCharts() {
        // Initialize Chart.js charts
        this.setupOccupancyChart();
        this.setupFeeChart();
    }

    setupOccupancyChart() {
        const ctx = document.getElementById('occupancyChart');
        if (!ctx) return;

        this.charts.occupancy = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Vacant'],
                datasets: [{
                    data: [0, 0], // Will be updated with real data
                    backgroundColor: ['#FF6B6B', '#4ECDC4'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    setupFeeChart() {
        const ctx = document.getElementById('feeChart');
        if (!ctx) return;

        this.charts.fee = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Pending', 'Overdue'],
                datasets: [{
                    data: [0, 0, 0], // Will be updated with real data
                    backgroundColor: ['#4ECDC4', '#FFD93D', '#FF6B6B'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateCharts(roomsSnapshot, feesSnapshot) {
        // Update occupancy chart
        if (this.charts.occupancy) {
            let totalBeds = 0;
            let occupiedBeds = 0;
            
            roomsSnapshot.forEach(doc => {
                const room = doc.data();
                totalBeds += room.capacity || 0;
                occupiedBeds += room.occupiedBeds || 0;
            });

            const vacantBeds = totalBeds - occupiedBeds;
            this.charts.occupancy.data.datasets[0].data = [occupiedBeds, vacantBeds];
            this.charts.occupancy.update();
        }

        // Update fee chart (this would need actual fee data with different statuses)
        if (this.charts.fee) {
            // For now, using placeholder data
            const paidAmount = this.stats.totalStudents * 5000 * 0.7; // 70% paid
            const pendingAmount = this.stats.pendingDues;
            const overdueAmount = this.stats.totalStudents * 5000 * 0.1; // 10% overdue

            this.charts.fee.data.datasets[0].data = [paidAmount, pendingAmount, overdueAmount];
            this.charts.fee.update();
        }
    }

    async loadRecentActivities() {
        const activitiesList = document.getElementById('activitiesList');
        if (!activitiesList) return;

        try {
            // In a real app, you'd load actual activities from a logs collection
            // For now, we'll show some sample activities
            const activities = [
                {
                    type: 'student',
                    message: 'New student admission processed',
                    time: new Date(),
                    icon: 'user-plus',
                    color: '#4ECDC4'
                },
                {
                    type: 'payment',
                    message: 'Fee payment received',
                    time: new Date(Date.now() - 3600000), // 1 hour ago
                    icon: 'money-bill-wave',
                    color: '#FFD93D'
                },
                {
                    type: 'complaint',
                    message: 'New complaint submitted',
                    time: new Date(Date.now() - 7200000), // 2 hours ago
                    icon: 'exclamation-circle',
                    color: '#FF6B6B'
                },
                {
                    type: 'room',
                    message: 'Room maintenance completed',
                    time: new Date(Date.now() - 14400000), // 4 hours ago
                    icon: 'wrench',
                    color: '#6C63FF'
                }
            ];

            // Clear existing activities
            activitiesList.innerHTML = '';

            // Add activities
            activities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <div class="activity-icon" style="background: ${activity.color}">
                        <i class="fas fa-${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <div class="activity-time">${this.getTimeAgo(activity.time)}</div>
                    </div>
                `;
                activitiesList.appendChild(activityItem);
            });

        } catch (error) {
            console.error('Error loading activities:', error);
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} days ago`;
    }

    // Refresh dashboard data
    async refresh() {
        await this.loadDashboardData();
        this.loadRecentActivities();
        Utils.showNotification('Dashboard refreshed');
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    
    // Add refresh functionality (could be triggered by a button or timer)
    setInterval(() => {
        if (window.dashboard) {
            window.dashboard.refresh();
        }
    }, 300000); // Refresh every 5 minutes
});
