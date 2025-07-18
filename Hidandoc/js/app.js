// Main application initialization and coordination

class PhotoGalleryApp {
    constructor() {
        this.uploadManager = null;
        this.photoGallery = null;
        this.imageProcessor = null;
        this.currentPreviewFiles = [];
        this.isInitialized = false;
        
        this.initializeFirebase();
        this.initialize();
    }

    // Initialize Firebase
    initializeFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyCNnemXpvrBmqFcg48FXH_5xDVDvJOFMDw",
            authDomain: "xhunter-4fad8.firebaseapp.com",
            databaseURL: "https://xhunter-4fad8-default-rtdb.firebaseio.com",
            projectId: "xhunter-4fad8",
            storageBucket: "xhunter-4fad8.appspot.com",
            messagingSenderId: "855941951170",
            appId: "1:855941951170:web:9107a972f93f0a1e7d555b",
            measurementId: "G-PXVNK16SN7"
        };
        
        firebase.initializeApp(firebaseConfig);
    }

    // Initialize application
    async initialize() {
        try {
            // Initialize scrolling header
            this.initializeScrollingHeader();
            
            // Initialize managers
            this.uploadManager = new UploadManager();
            this.photoGallery = new PhotoGallery();
            this.imageProcessor = new ImageProcessor();
            
            // Setup event listeners
            this.setupEventListeners();
            this.setupUploadManager();
            this.setupImageEditor();
            this.setupKeyboardShortcuts();
            this.setupMobileOptimizations();
            
            // Load initial data
            await this.photoGallery.loadPhotos();
            
            this.isInitialized = true;
            Utils.showToast('Application initialized successfully', 'success');
            
        } catch (error) {
            Utils.handleError(error, 'Application initialization');
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Upload area drag and drop
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('photo-input');
        
        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files);
            }
        });
        
        // Click to browse
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files);
            }
        });
        
        // Preview section buttons
        const cancelUploadBtn = document.getElementById('cancel-upload');
        const confirmUploadBtn = document.getElementById('confirm-upload');
        
        if (cancelUploadBtn) {
            cancelUploadBtn.addEventListener('click', () => {
                this.cancelPreview();
            });
        }
        
        if (confirmUploadBtn) {
            confirmUploadBtn.addEventListener('click', () => {
                this.confirmUpload();
            });
        }
        
        // Modal close buttons
        const closeEditorBtn = document.getElementById('close-editor');
        const closePhotoBtn = document.getElementById('close-photo');
        
        if (closeEditorBtn) {
            closeEditorBtn.addEventListener('click', () => {
                this.closeEditor();
            });
        }
        
        if (closePhotoBtn) {
            closePhotoBtn.addEventListener('click', () => {
                this.closePhotoModal();
            });
        }
        
        // Close modals on background click
        const editorModal = document.getElementById('editor-modal');
        const photoModal = document.getElementById('photo-modal');
        
        if (editorModal) {
            editorModal.addEventListener('click', (e) => {
                if (e.target.id === 'editor-modal') {
                    this.closeEditor();
                }
            });
        }
        
        if (photoModal) {
            photoModal.addEventListener('click', (e) => {
                if (e.target.id === 'photo-modal') {
                    this.closePhotoModal();
                }
            });
        }


    }

    // Setup upload manager
    setupUploadManager() {
        this.uploadManager.on('preview', (item) => {
            this.updatePreview(item);
        });
        
        this.uploadManager.on('start', () => {
            this.showUploadProgress(true);
        });
        
        this.uploadManager.on('progress', (item) => {
            this.updateUploadProgress(item);
        });
        
        this.uploadManager.on('complete', (item) => {
            if (item.status === 'completed') {
                this.photoGallery.addPhoto({
                    id: item.docId,
                    originalName: item.metadata.name,
                    downloadURL: item.downloadURL,
                    storagePath: item.storagePath,
                    size: item.metadata.size,
                    type: item.metadata.type,
                    width: item.metadata.width,
                    height: item.metadata.height,
                    uploadDate: new Date(),
                    tags: [],
                    metadata: item.metadata
                });
            }
        });
        
        this.uploadManager.on('allComplete', (stats) => {
            this.showUploadProgress(false);
            this.hidePreview();
            
            if (stats.completed > 0) {
                Utils.showToast(`${stats.completed} photo${stats.completed > 1 ? 's' : ''} uploaded successfully`, 'success');
            }
            
            if (stats.failed > 0) {
                Utils.showToast(`${stats.failed} photo${stats.failed > 1 ? 's' : ''} failed to upload`, 'error');
            }
        });
    }

    // Setup image editor
    setupImageEditor() {
        const canvas = document.getElementById('editor-canvas');
        
        // Editor controls
        const rotateLeftBtn = document.getElementById('rotate-left');
        const rotateRightBtn = document.getElementById('rotate-right');
        const flipHorizontalBtn = document.getElementById('flip-horizontal');
        const flipVerticalBtn = document.getElementById('flip-vertical');
        
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => {
                this.imageProcessor.rotate(-90);
            });
        }
        
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => {
                this.imageProcessor.rotate(90);
            });
        }
        
        if (flipHorizontalBtn) {
            flipHorizontalBtn.addEventListener('click', () => {
                this.imageProcessor.flipHorizontal();
            });
        }
        
        if (flipVerticalBtn) {
            flipVerticalBtn.addEventListener('click', () => {
                this.imageProcessor.flipVertical();
            });
        }
        
        // Filter controls
        const filterControls = ['brightness', 'contrast', 'saturation', 'blur'];
        filterControls.forEach(filter => {
            const control = document.getElementById(filter);
            if (control) {
                control.addEventListener('input', Utils.debounce(() => {
                    this.applyFilters();
                }, 100));
            }
        });
        
        // Editor actions
        const resetEditorBtn = document.getElementById('reset-editor');
        const saveEditBtn = document.getElementById('save-edit');
        
        if (resetEditorBtn) {
            resetEditorBtn.addEventListener('click', () => {
                this.resetEditor();
            });
        }
        
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => {
                this.saveEdit();
            });
        }
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        Utils.handleKeyboardShortcuts({
            'ctrl+u': () => document.getElementById('photo-input').click(),
            'escape': () => this.closeModals(),
            'delete': () => this.deleteSelectedPhotos(),
            'ctrl+a': () => this.selectAllPhotos(),
            'ctrl+d': () => this.clearSelection(),
            'f': () => this.toggleFullscreen()
        });
    }

    // Handle file selection
    handleFileSelection(files) {
        if (files.length === 0) return;
        
        this.currentPreviewFiles = this.uploadManager.addFiles(files);
        if (this.currentPreviewFiles.length > 0) {
            this.showPreview();
        }
    }

    // Show preview section
    showPreview() {
        const previewSection = document.getElementById('preview-section');
        const previewContainer = document.getElementById('preview-container');
        
        previewSection.style.display = 'block';
        previewContainer.innerHTML = '';
        
        this.currentPreviewFiles.forEach(file => {
            const previewItem = this.createPreviewItem(file);
            previewContainer.appendChild(previewItem);
        });
        
        // Scroll to preview
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Create preview item
    createPreviewItem(file) {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.dataset.fileId = file.id;
        
        item.innerHTML = `
            <img src="${file.preview || ''}" alt="${file.metadata.name}">
            <div class="preview-overlay">
                <div class="preview-info">
                    <div>${file.metadata.name}</div>
                    <div>${Utils.formatFileSize(file.metadata.size)}</div>
                </div>
            </div>
        `;
        
        return item;
    }

    // Update preview item
    updatePreview(item) {
        const previewItem = document.querySelector(`[data-file-id="${item.id}"]`);
        if (previewItem && item.preview) {
            const img = previewItem.querySelector('img');
            img.src = item.preview;
        }
    }

    // Hide preview section
    hidePreview() {
        const previewSection = document.getElementById('preview-section');
        previewSection.style.display = 'none';
        this.currentPreviewFiles = [];
    }

    // Cancel preview
    cancelPreview() {
        this.uploadManager.cancelAllUploads();
        this.hidePreview();
    }

    // Confirm upload
    confirmUpload() {
        if (this.currentPreviewFiles.length > 0) {
            const selectedCategory = document.getElementById('upload-category').value;
            const customCategory = document.getElementById('custom-category').value.trim();
            
            if (!selectedCategory && !customCategory) {
                Utils.showToast('Please select a category or enter a custom category', 'warning');
                return;
            }
            
            this.uploadManager.startUpload();
        }
    }

    // Show upload progress
    showUploadProgress(show) {
        const uploadProgress = document.getElementById('upload-progress');
        uploadProgress.style.display = show ? 'block' : 'none';
        
        if (!show) {
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
        }
    }

    // Update upload progress
    updateUploadProgress(item) {
        const stats = this.uploadManager.getStats();
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        const overallProgress = stats.progress;
        progressFill.style.width = `${overallProgress}%`;
        progressText.textContent = `${Math.round(overallProgress)}%`;
    }

    // Open image editor
    async openEditor(photo) {
        const modal = document.getElementById('editor-modal');
        const canvas = document.getElementById('editor-canvas');
        
        try {
            // Show loading state
            Utils.showToast('Loading image for editing...', 'info');
            
            // Try to load image directly using the URL
            await this.imageProcessor.initializeCanvas(canvas, photo.downloadURL);
            this.resetFilterControls();
            modal.style.display = 'block';
            
            Utils.showToast('Image loaded successfully', 'success');
            
        } catch (error) {
            console.error('Loading image for editing failed:', error);
            
            // Try fallback method with fetch
            try {
                const response = await fetch(photo.downloadURL, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const blob = await response.blob();
                const file = new File([blob], photo.originalName, { type: blob.type });
                
                await this.imageProcessor.initializeCanvas(canvas, file);
                this.resetFilterControls();
                modal.style.display = 'block';
                
                Utils.showToast('Image loaded successfully', 'success');
                
            } catch (fallbackError) {
                console.error('Fallback image loading failed:', fallbackError);
                Utils.showToast('Unable to load image for editing. Please try again.', 'error');
            }
        }
    }

    // Apply filters
    applyFilters() {
        const brightnessControl = document.getElementById('brightness');
        const contrastControl = document.getElementById('contrast');
        const saturationControl = document.getElementById('saturation');
        const blurControl = document.getElementById('blur');
        
        const filters = {
            brightness: brightnessControl ? parseInt(brightnessControl.value) : 100,
            contrast: contrastControl ? parseInt(contrastControl.value) : 100,
            saturation: saturationControl ? parseInt(saturationControl.value) : 100,
            blur: blurControl ? parseInt(blurControl.value) : 0
        };
        
        this.imageProcessor.applyFilters(filters);
    }

    // Reset editor
    resetEditor() {
        this.imageProcessor.reset();
        this.resetFilterControls();
    }

    // Reset filter controls
    resetFilterControls() {
        const brightnessControl = document.getElementById('brightness');
        const contrastControl = document.getElementById('contrast');
        const saturationControl = document.getElementById('saturation');
        const blurControl = document.getElementById('blur');
        
        if (brightnessControl) brightnessControl.value = 100;
        if (contrastControl) contrastControl.value = 100;
        if (saturationControl) saturationControl.value = 100;
        if (blurControl) blurControl.value = 0;
    }

    // Save edit
    async saveEdit() {
        try {
            const blob = await this.imageProcessor.getBlob();
            const fileName = `edited_${Date.now()}.jpg`;
            
            // Upload edited image
            const storageRef = firebase.storage().ref(`photos/${fileName}`);
            const snapshot = await storageRef.put(blob);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Save to Firestore
            await firebase.firestore().collection('photos').add({
                fileName: fileName,
                originalName: fileName,
                downloadURL: downloadURL,
                storagePath: `photos/${fileName}`,
                size: blob.size,
                type: blob.type,
                uploadDate: firebase.firestore.FieldValue.serverTimestamp(),
                tags: ['edited'],
                metadata: {
                    name: fileName,
                    size: blob.size,
                    type: blob.type
                }
            });
            
            Utils.showToast('Edited photo saved successfully', 'success');
            this.closeEditor();
            this.photoGallery.loadPhotos();
            
        } catch (error) {
            Utils.handleError(error, 'Saving edited photo');
        }
    }

    // Close editor
    closeEditor() {
        const modal = document.getElementById('editor-modal');
        modal.style.display = 'none';
        this.imageProcessor.cleanup();
    }

    // Close photo modal
    closePhotoModal() {
        const modal = document.getElementById('photo-modal');
        modal.style.display = 'none';
    }

    // Close all modals
    closeModals() {
        this.closeEditor();
        this.closePhotoModal();
    }

    // Delete selected photos
    deleteSelectedPhotos() {
        this.photoGallery.deleteSelectedPhotos();
    }

    // Select all photos
    selectAllPhotos() {
        this.photoGallery.filteredPhotos.forEach(photo => {
            this.photoGallery.selectedPhotos.add(photo.id);
        });
        this.photoGallery.renderPhotos();
        this.photoGallery.updateBulkActions();
    }

    // Clear selection
    clearSelection() {
        this.photoGallery.clearSelection();
    }

    // Toggle fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }



    // Initialize scrolling header
    initializeScrollingHeader() {
        let lastScrollTop = 0;
        const header = document.querySelector('.header');
        const galleryControls = document.querySelector('.gallery-controls');
        let isScrolling = false;
        
        const handleScroll = () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    if (scrollTop > 100) {
                        if (scrollTop > lastScrollTop) {
                            // Scrolling down - hide header and gallery controls
                            header.classList.add('hidden');
                            galleryControls.classList.add('hidden');
                        } else {
                            // Scrolling up - show header and gallery controls
                            header.classList.remove('hidden');
                            galleryControls.classList.remove('hidden');
                        }
                    } else {
                        // At top of page - always show header and gallery controls
                        header.classList.remove('hidden');
                        galleryControls.classList.remove('hidden');
                    }
                    
                    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
                    isScrolling = false;
                });
                isScrolling = true;
            }
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    // Setup mobile optimizations
    setupMobileOptimizations() {
        // Detect mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTouch = 'ontouchstart' in window;
        
        if (isMobile || isTouch) {
            document.body.classList.add('mobile-device');
            
            // Setup touch gestures for photo cards
            this.setupTouchGestures();
            
            // Optimize for mobile performance
            this.optimizeMobilePerformance();
            
            // Setup mobile-specific interactions
            this.setupMobileInteractions();
        }
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Recalculate layout after orientation change
                if (this.photoGallery) {
                    this.photoGallery.renderPhotos();
                }
            }, 100);
        });
        
        // Handle window resize for responsive behavior
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.photoGallery) {
                    this.photoGallery.renderPhotos();
                }
            }, 250);
        });
    }
    
    // Setup touch gestures
    setupTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Swipe detection (minimum 50px swipe)
            if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
                // Handle swipe gestures if needed
                console.log('Swipe detected:', deltaX > 0 ? 'right' : 'left');
            }
        }, { passive: true });
    }
    
    // Optimize mobile performance
    optimizeMobilePerformance() {
        // Reduce animation complexity on mobile
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                * {
                    transition-duration: 0.2s !important;
                }
                .photo-card:hover {
                    transform: none !important;
                }
                .modal {
                    backdrop-filter: none !important;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Throttle scroll events more aggressively on mobile
        if ('IntersectionObserver' in window) {
            // Use intersection observer for better mobile performance
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('in-view');
                    }
                });
            }, { threshold: 0.1 });
            
            // Observe photo cards as they're created
            document.addEventListener('DOMNodeInserted', (e) => {
                if (e.target.classList && e.target.classList.contains('photo-card')) {
                    observer.observe(e.target);
                }
            });
        }
    }
    
    // Setup mobile-specific interactions
    setupMobileInteractions() {
        // Add tap highlights
        const style = document.createElement('style');
        style.textContent = `
            .btn, .photo-card, .category-card {
                -webkit-tap-highlight-color: rgba(59, 130, 246, 0.3);
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
            
            .photo-card-image img {
                -webkit-user-drag: none;
                -khtml-user-drag: none;
                -moz-user-drag: none;
                -o-user-drag: none;
                user-drag: none;
            }
        `;
        document.head.appendChild(style);
        
        // Prevent default actions on mobile
        document.addEventListener('touchmove', (e) => {
            // Prevent pull-to-refresh on mobile browsers
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Handle double-tap zoom prevention
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }



    // Cleanup resources
    cleanup() {
        if (this.uploadManager) {
            this.uploadManager.cleanup();
        }
        if (this.photoGallery) {
            this.photoGallery.cleanup();
        }
        if (this.imageProcessor) {
            this.imageProcessor.cleanup();
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make instances globally available
    window.photoGalleryApp = new PhotoGalleryApp();
    window.uploadManager = window.photoGalleryApp.uploadManager;
    window.photoGallery = window.photoGalleryApp.photoGallery;
    window.imageProcessor = window.photoGalleryApp.imageProcessor;
    window.photoEditor = {
        openEditor: (photo) => window.photoGalleryApp.openEditor(photo)
    };
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        window.photoGalleryApp.cleanup();
    });
});
