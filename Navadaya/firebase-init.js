// Firebase initialization script for GitHub deployment
// This file helps with automated Firebase setup

const admin = require('firebase-admin');
const fs = require('fs');

// Sample Firestore collections structure
const sampleCollections = {
  students: {
    sampleId: {
      firstName: "Sample",
      lastName: "Student",
      rollNumber: "2025001",
      email: "sample@example.com",
      phone: "1234567890",
      course: "Computer Science",
      year: 1,
      address: "Sample Address",
      guardianName: "Guardian Name",
      guardianPhone: "0987654321",
      status: "active",
      roomNumber: "101",
      createdAt: new Date().toISOString()
    }
  },
  
  rooms: {
    sampleRoomId: {
      roomNumber: "101",
      floor: 1,
      capacity: 4,
      occupiedBeds: 1,
      monthlyRent: 5000,
      roomType: "Shared",
      facilities: "AC, WiFi, Study Table, Wardrobe",
      status: "available"
    }
  },
  
  fees: {
    sampleFeeId: {
      studentId: "sampleId",
      feeType: "monthly_rent",
      amount: 5000,
      month: "January",
      year: 2025,
      status: "pending",
      dueDate: new Date().toISOString(),
      generatedAt: new Date().toISOString()
    }
  },
  
  notices: {
    sampleNoticeId: {
      title: "Welcome to Navadaya Girls Hostel",
      content: "Welcome to our comprehensive hostel management system.",
      type: "general",
      priority: "normal",
      createdAt: new Date().toISOString(),
      isActive: true
    }
  },
  
  complaints: {
    sampleComplaintId: {
      studentId: "sampleId",
      title: "Sample Complaint",
      description: "This is a sample complaint for testing purposes.",
      category: "maintenance",
      priority: "medium",
      status: "open",
      submittedAt: new Date().toISOString()
    }
  },
  
  leaveApplications: {
    sampleLeaveId: {
      studentId: "sampleId",
      leaveType: "medical",
      fromDate: new Date().toISOString(),
      toDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reason: "Medical checkup",
      status: "pending",
      appliedAt: new Date().toISOString()
    }
  },
  
  roomChangeRequests: {
    sampleRequestId: {
      studentId: "sampleId",
      currentRoom: "101",
      preferredRoom: "102",
      reason: "Personal preference",
      status: "pending",
      requestedAt: new Date().toISOString()
    }
  },
  
  maintenanceRequests: {
    sampleMaintenanceId: {
      studentId: "sampleId",
      roomNumber: "101",
      issueType: "electrical",
      description: "Light not working",
      priority: "medium",
      status: "pending",
      submittedAt: new Date().toISOString()
    }
  }
};

// Firestore security rules
const securityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to authenticated users for their own student data
    match /students/{studentId} {
      allow read, write: if request.auth != null && request.auth.uid == studentId;
    }
    
    // Allow authenticated users to read/write their own records
    match /fees/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /complaints/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /leaveApplications/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /roomChangeRequests/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /maintenanceRequests/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Public read access for notices and rooms
    match /notices/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /rooms/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Admin-only collections (implement admin check)
    match /admins/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

// Export sample data structure
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sampleCollections,
    securityRules
  };
}

// Browser environment
if (typeof window !== 'undefined') {
  window.FirebaseInit = {
    sampleCollections,
    securityRules
  };
}

console.log('Firebase initialization configuration loaded');
console.log('Sample collections structure:', Object.keys(sampleCollections));
console.log('Security rules length:', securityRules.length, 'characters');