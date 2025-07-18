// Photo gallery management with advanced features

class PhotoGallery {
    constructor() {
        this.photos = [];
        this.filteredPhotos = [];
        this.selectedPhotos = new Set();
        this.currentView = 'grid';
        this.currentSort = 'date-desc';
        this.currentFilter = 'all';
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.currentPhotoIndex = 0;
        this.lazyLoader = null;
        this.isLoading = false;
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        
        // Initialize Instagram-like features
        this.initializeLazyLoading();
        this.setupImageCaching();
        this.setupEventListeners();
    }

    // Initialize advanced lazy loading with Instagram-like features
    initializeLazyLoading() {
        // Preload images that are about to come into view
        this.lazyLoader = Utils.createLazyLoader((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    const lowSrc = img.dataset.lowSrc;
                    
                    if (src) {
                        // Show low quality placeholder first (Instagram technique)
                        if (lowSrc && !img.src) {
                            img.src = lowSrc;
                            img.style.filter = 'blur(5px)';
                        }
                        
                        // Load high quality image
                        const highQualityImg = new Image();
                        highQualityImg.onload = () => {
                            img.src = src;
                            img.style.filter = 'none';
                            img.style.transition = 'filter 0.3s ease';
                            img.removeAttribute('data-src');
                            img.removeAttribute('data-low-src');
                        };
                        highQualityImg.src = src;
                        
                        this.lazyLoader.unobserve(img);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '100px', // Start loading 100px before entering viewport
            threshold: 0.1
        });
        
        // Implement progressive image enhancement
        this.setupProgressiveLoading();
    }
    
    // Setup progressive loading like Instagram
    setupProgressiveLoading() {
        // Preload next batch of images
        this.imageCache = new Map();
        this.preloadQueue = [];
        this.isPreloading = false;
        
        // Virtual scrolling for better performance
        this.setupVirtualScrolling();
    }
    
    // Virtual scrolling implementation
    setupVirtualScrolling() {
        let isScrolling = false;
        
        window.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });
    }
    
    // Handle scroll events for preloading
    handleScroll() {
        const scrollTop = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Preload images when user is 80% down the page
        if ((scrollTop + windowHeight) / documentHeight > 0.8) {
            this.preloadNextBatch();
        }
    }
    
    // Preload next batch of images
    async preloadNextBatch() {
        if (this.isPreloading || this.preloadQueue.length === 0) return;
        
        this.isPreloading = true;
        const batchSize = 5; // Load 5 images at a time
        const batch = this.preloadQueue.splice(0, batchSize);
        
        const preloadPromises = batch.map(url => this.preloadImage(url));
        await Promise.allSettled(preloadPromises);
        
        this.isPreloading = false;
    }
    
    // Preload individual image
    preloadImage(url) {
        return new Promise((resolve) => {
            if (this.imageCache.has(url)) {
                resolve(true);
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(url, true);
                resolve(true);
            };
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    // Setup event listeners
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const debouncedSearch = Utils.debounce((query) => {
            this.searchQuery = query;
            this.filterAndSortPhotos();
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });

        // Sort and filter controls
        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.filterAndSortPhotos();
        });

        document.getElementById('filter-select').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.filterAndSortPhotos();
        });

        // Category filter
        document.getElementById('category-select').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.filterAndSortPhotos();
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.setView(view);
            });
        });

        // Selection controls
        document.getElementById('select-all').addEventListener('click', () => {
            this.selectAllPhotos();
        });

        // Bulk actions
        document.getElementById('delete-selected').addEventListener('click', () => {
            this.deleteSelectedPhotos();
        });

        document.getElementById('export-selected').addEventListener('click', () => {
            this.exportSelectedPhotos();
        });

        document.getElementById('clear-selection').addEventListener('click', () => {
            this.clearSelection();
        });
    }

    // Load photos from Firestore
    async loadPhotos() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            const snapshot = await this.db.collection('photos')
                .orderBy('uploadDate', 'desc')
                .get();
            
            this.photos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                uploadDate: doc.data().uploadDate?.toDate() || new Date()
            }));
            
            this.filterAndSortPhotos();
            this.updateStats();
            
        } catch (error) {
            Utils.handleError(error, 'Loading photos');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    // Filter and sort photos
    filterAndSortPhotos() {
        let filtered = [...this.photos];

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(photo => 
                photo.originalName.toLowerCase().includes(query) ||
                (photo.tags && photo.tags.some(tag => tag.toLowerCase().includes(query))) ||
                (photo.category && photo.category.toLowerCase().includes(query))
            );
        }

        // Apply category filter
        if (this.currentCategory && this.currentCategory !== 'all') {
            filtered = filtered.filter(photo => photo.category === this.currentCategory);
        }

        // Apply date filter
        if (this.currentFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            
            switch (this.currentFilter) {
                case 'today':
                    filterDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    filterDate.setFullYear(now.getFullYear() - 1);
                    break;
            }
            
            if (this.currentFilter !== 'all') {
                filtered = filtered.filter(photo => photo.uploadDate >= filterDate);
            }
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'date-desc':
                    return b.uploadDate - a.uploadDate;
                case 'date-asc':
                    return a.uploadDate - b.uploadDate;
                case 'name-asc':
                    return a.originalName.localeCompare(b.originalName);
                case 'name-desc':
                    return b.originalName.localeCompare(a.originalName);
                case 'size-desc':
                    return b.size - a.size;
                case 'size-asc':
                    return a.size - b.size;
                default:
                    return 0;
            }
        });

        this.filteredPhotos = filtered;
        this.renderPhotos();
    }

    // Render photos with Instagram-like performance optimizations
    renderPhotos() {
        const galleryGrid = document.getElementById('gallery-grid');
        const emptyState = document.getElementById('empty-state');
        
        galleryGrid.className = `gallery-grid ${this.currentView === 'list' ? 'list-view' : ''}`;
        
        if (this.filteredPhotos.length === 0) {
            galleryGrid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Implement virtual loading for better performance
        const initialLoad = Math.min(this.filteredPhotos.length, 20); // Load first 20 photos
        
        // Render photos in batches for smooth experience
        this.filteredPhotos.slice(0, initialLoad).forEach((photo, index) => {
            const photoCard = this.createPhotoCard(photo, index);
            fragment.appendChild(photoCard);
        });
        
        galleryGrid.innerHTML = '';
        galleryGrid.appendChild(fragment);
        
        // Setup infinite scroll for remaining photos
        if (this.filteredPhotos.length > initialLoad) {
            this.setupInfiniteScroll(initialLoad);
        }
        
        // Initialize Instagram-like image loading
        requestAnimationFrame(() => {
            this.initializeAdvancedImageLoading();
        });
        
        // Update select all button state
        this.updateSelectAllButton();
    }
    
    // Setup infinite scroll for seamless loading
    setupInfiniteScroll(loadedCount) {
        this.loadedCount = loadedCount;
        this.isLoadingMore = false;
        
        const loadMore = () => {
            if (this.isLoadingMore || this.loadedCount >= this.filteredPhotos.length) return;
            
            this.isLoadingMore = true;
            const batchSize = 10;
            const nextBatch = this.filteredPhotos.slice(this.loadedCount, this.loadedCount + batchSize);
            
            const galleryGrid = document.getElementById('gallery-grid');
            const fragment = document.createDocumentFragment();
            
            nextBatch.forEach((photo, index) => {
                const photoCard = this.createPhotoCard(photo, this.loadedCount + index);
                fragment.appendChild(photoCard);
            });
            
            galleryGrid.appendChild(fragment);
            this.loadedCount += batchSize;
            this.isLoadingMore = false;
            
            // Initialize loading for new images
            requestAnimationFrame(() => {
                this.initializeAdvancedImageLoading();
            });
        };
        
        // Optimized scroll listener
        let ticking = false;
        const scrollHandler = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollPosition = window.innerHeight + window.scrollY;
                    const documentHeight = document.documentElement.offsetHeight;
                    
                    // Load more when 80% scrolled
                    if (scrollPosition >= documentHeight * 0.8) {
                        loadMore();
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
    }
    
    // Initialize advanced image loading (Instagram technique)
    initializeAdvancedImageLoading() {
        const images = document.querySelectorAll('img[data-src]:not(.processed)');
        
        images.forEach((img, index) => {
            img.classList.add('processed');
            
            // Priority loading for first 8 images
            if (index < 8) {
                this.loadImageWithPlaceholder(img);
            } else {
                // Lazy load others with intersection observer
                this.lazyLoader.observe(img);
            }
        });
    }

    // Create photo card element
    createPhotoCard(photo, index) {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.dataset.photoId = photo.id;
        
        const isSelected = this.selectedPhotos.has(photo.id);
        if (isSelected) {
            card.classList.add('selected');
        }
        
        // Generate thumbnail URL for fast loading
        const thumbnailUrl = this.generateThumbnailUrl(photo.downloadURL);
        
        card.innerHTML = `
            <div class="photo-card-image">
                <img data-src="${photo.downloadURL}" 
                     data-low-src="${thumbnailUrl}" 
                     alt="${photo.originalName}" 
                     loading="lazy"
                     style="background: linear-gradient(45deg, #f0f0f0, #e0e0e0); background-size: 20px 20px;">
                <div class="photo-card-overlay">
                    <div class="photo-card-actions">
                        <button onclick="photoGallery.editPhoto('${photo.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="photoGallery.sharePhoto('${photo.id}')" title="Share">
                            <i class="fas fa-share"></i>
                        </button>
                        <button onclick="photoGallery.downloadPhoto('${photo.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="photoGallery.deletePhoto('${photo.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <input type="checkbox" class="photo-card-checkbox" ${isSelected ? 'checked' : ''}>
                ${photo.category ? `<div class="photo-category-badge">${photo.category}</div>` : ''}
            </div>
            <div class="photo-card-content">
                <div class="photo-card-title">${photo.originalName}</div>
                <div class="photo-card-meta">
                    <span>${Utils.formatFileSize(photo.size)}</span>
                    <span>${Utils.formatDate(photo.uploadDate)}</span>
                </div>
            </div>
        `;
        
        // Add event listeners
        const img = card.querySelector('img');
        this.lazyLoader.observe(img);
        
        // Add to preload queue for faster subsequent loading
        this.preloadQueue.push(photo.downloadURL);
        
        const checkbox = card.querySelector('.photo-card-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.togglePhotoSelection(photo.id);
        });
        
        card.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON') {
                return;
            }
            this.openPhotoModal(photo, index);
        });
        
        return card;
    }

    // Toggle photo selection
    togglePhotoSelection(photoId) {
        const card = document.querySelector(`[data-photo-id="${photoId}"]`);
        if (!card) return;
        
        const checkbox = card.querySelector('.photo-card-checkbox');
        
        if (this.selectedPhotos.has(photoId)) {
            this.selectedPhotos.delete(photoId);
            card.classList.remove('selected');
            if (checkbox) checkbox.checked = false;
        } else {
            this.selectedPhotos.add(photoId);
            card.classList.add('selected');
            if (checkbox) checkbox.checked = true;
        }
        
        this.updateBulkActions();
        this.updateSelectAllButton();
    }

    // Select all photos
    selectAllPhotos() {
        const allSelected = this.filteredPhotos.length > 0 && 
                           this.filteredPhotos.every(photo => this.selectedPhotos.has(photo.id));
        
        if (allSelected) {
            // Deselect all
            this.clearSelection();
        } else {
            // Select all currently displayed photos
            this.filteredPhotos.forEach(photo => {
                this.selectedPhotos.add(photo.id);
            });
            
            // Update UI - only select visible cards that correspond to filtered photos
            this.filteredPhotos.forEach(photo => {
                const card = document.querySelector(`[data-photo-id="${photo.id}"]`);
                if (card) {
                    card.classList.add('selected');
                    const checkbox = card.querySelector('.photo-card-checkbox');
                    if (checkbox) checkbox.checked = true;
                }
            });
            
            this.updateBulkActions();
            this.updateSelectAllButton();
            Utils.showToast(`Selected ${this.selectedPhotos.size} photos`, 'success');
        }
    }

    // Clear selection
    clearSelection() {
        this.selectedPhotos.clear();
        document.querySelectorAll('.photo-card').forEach(card => {
            card.classList.remove('selected');
            const checkbox = card.querySelector('.photo-card-checkbox');
            if (checkbox) checkbox.checked = false;
        });
        this.updateBulkActions();
        this.updateSelectAllButton();
        Utils.showToast('Selection cleared', 'info');
    }

    // Update bulk actions visibility
    updateBulkActions() {
        const bulkActions = document.getElementById('bulk-actions');
        bulkActions.style.display = this.selectedPhotos.size > 0 ? 'flex' : 'none';
        this.updateSelectAllButton();
    }

    // Update select all button text
    updateSelectAllButton() {
        const selectAllBtn = document.getElementById('select-all');
        const allSelected = this.filteredPhotos.length > 0 && 
                           this.filteredPhotos.every(photo => this.selectedPhotos.has(photo.id));
        
        if (allSelected) {
            selectAllBtn.innerHTML = '<i class="fas fa-minus-square"></i> Deselect All';
        } else {
            selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Select All';
        }
    }

    // Set view mode
    setView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        this.renderPhotos();
    }

    // Open photo modal
    openPhotoModal(photo, index) {
        this.currentPhotoIndex = index;
        const modal = document.getElementById('photo-modal');
        const modalImage = document.getElementById('modal-image');
        const photoTitle = document.getElementById('photo-title');
        const photoDate = document.getElementById('photo-date');
        const photoSize = document.getElementById('photo-size');
        const photoDimensions = document.getElementById('photo-dimensions');
        const photoUploadDate = document.getElementById('photo-upload-date');
        
        modalImage.src = photo.downloadURL;
        photoTitle.textContent = photo.originalName;
        photoDate.textContent = Utils.formatDate(photo.uploadDate);
        photoSize.textContent = Utils.formatFileSize(photo.size);
        photoDimensions.textContent = `${photo.width || 'Unknown'} × ${photo.height || 'Unknown'}`;
        photoUploadDate.textContent = photo.uploadDate.toLocaleDateString();
        
        // Update category display
        const photoCategory = document.getElementById('photo-category');
        if (photoCategory) {
            photoCategory.textContent = photo.category || 'Other';
        }
        
        modal.style.display = 'block';
        
        // Setup navigation
        this.setupPhotoNavigation();
        
        // Setup action buttons
        this.setupPhotoActions(photo);
    }

    // Setup photo navigation
    setupPhotoNavigation() {
        const prevBtn = document.getElementById('prev-photo');
        const nextBtn = document.getElementById('next-photo');
        
        prevBtn.onclick = () => this.navigatePhoto(-1);
        nextBtn.onclick = () => this.navigatePhoto(1);
        
        prevBtn.style.display = this.currentPhotoIndex > 0 ? 'block' : 'none';
        nextBtn.style.display = this.currentPhotoIndex < this.filteredPhotos.length - 1 ? 'block' : 'none';
    }

    // Navigate to previous/next photo
    navigatePhoto(direction) {
        const newIndex = this.currentPhotoIndex + direction;
        if (newIndex >= 0 && newIndex < this.filteredPhotos.length) {
            const photo = this.filteredPhotos[newIndex];
            this.openPhotoModal(photo, newIndex);
        }
    }

    // Setup photo action buttons
    setupPhotoActions(photo) {
        document.getElementById('edit-photo').onclick = () => this.editPhoto(photo.id);
        document.getElementById('share-photo').onclick = () => this.sharePhoto(photo.id);
        document.getElementById('download-photo').onclick = () => this.downloadPhoto(photo.id);
        document.getElementById('delete-photo').onclick = () => this.deletePhoto(photo.id);
        
        // Setup name editing
        const nameInput = document.getElementById('photo-name-input');
        nameInput.value = photo.originalName;
        
        document.getElementById('save-name').onclick = () => this.updatePhotoName(photo.id, nameInput.value);
    }

    // Edit photo
    editPhoto(photoId) {
        const photo = this.photos.find(p => p.id === photoId);
        if (photo) {
            // Close current modal
            document.getElementById('photo-modal').style.display = 'none';
            
            // Open editor modal
            window.photoEditor.openEditor(photo);
        }
    }

    // Share photo
    async sharePhoto(photoId) {
        const photo = this.photos.find(p => p.id === photoId);
        if (photo) {
            try {
                if (navigator.share) {
                    await navigator.share({
                        title: photo.originalName,
                        text: `Check out this photo: ${photo.originalName}`,
                        url: photo.downloadURL
                    });
                } else {
                    await Utils.copyToClipboard(photo.downloadURL);
                    Utils.showToast('Photo link copied to clipboard', 'success');
                }
            } catch (error) {
                Utils.handleError(error, 'Sharing photo');
            }
        }
    }

    // Download photo
    async downloadPhoto(photoId) {
        const photo = this.photos.find(p => p.id === photoId);
        if (!photo) {
            Utils.showToast('Photo not found', 'error');
            return;
        }

        try {
            // Try direct download first
            const a = document.createElement('a');
            a.href = photo.downloadURL;
            a.download = photo.originalName || 'photo.jpg';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            Utils.showToast('Photo download started', 'success');
            
        } catch (error) {
            console.error('Downloading photo failed:', error);
            
            // Fallback: open in new tab
            try {
                window.open(photo.downloadURL, '_blank', 'noopener,noreferrer');
                Utils.showToast('Photo opened in new tab. Right-click to save.', 'info');
            } catch (fallbackError) {
                console.error('Fallback download failed:', fallbackError);
                Utils.showToast('Unable to download photo. Please try again.', 'error');
            }
        }
    }

    // Delete photo
    async deletePhoto(photoId) {
        const photo = this.photos.find(p => p.id === photoId);
        if (photo && confirm(`Are you sure you want to delete "${photo.originalName}"?`)) {
            try {
                // Delete from Storage
                await this.storage.ref(photo.storagePath).delete();
                
                // Delete from Firestore
                await this.db.collection('photos').doc(photoId).delete();
                
                // Remove from local arrays
                this.photos = this.photos.filter(p => p.id !== photoId);
                this.selectedPhotos.delete(photoId);
                
                this.filterAndSortPhotos();
                this.updateStats();
                
                Utils.showToast('Photo deleted successfully', 'success');
                
                // Close modal if open
                document.getElementById('photo-modal').style.display = 'none';
                
            } catch (error) {
                Utils.handleError(error, 'Deleting photo');
            }
        }
    }

    // Delete selected photos
    async deleteSelectedPhotos() {
        if (this.selectedPhotos.size === 0) return;
        
        const count = this.selectedPhotos.size;
        if (confirm(`Are you sure you want to delete ${count} selected photo${count > 1 ? 's' : ''}?`)) {
            const promises = Array.from(this.selectedPhotos).map(photoId => 
                this.deletePhoto(photoId)
            );
            
            await Promise.all(promises);
            this.clearSelection();
        }
    }

    // Export selected photos - simplified approach
    async exportSelectedPhotos() {
        if (this.selectedPhotos.size === 0) {
            Utils.showToast('No photos selected', 'warning');
            return;
        }
        
        const selectedPhotos = this.photos.filter(p => this.selectedPhotos.has(p.id));
        
        if (selectedPhotos.length === 0) {
            Utils.showToast('No valid photos to export', 'error');
            return;
        }

        // Download all selected photos at once
        Utils.showToast(`Starting download of ${selectedPhotos.length} photos...`, 'info');
        
        // Download photos with minimal delay to trigger all at once
        for (let i = 0; i < selectedPhotos.length; i++) {
            const photo = selectedPhotos[i];
            
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = photo.downloadURL;
                a.download = photo.originalName || `photo_${i + 1}.jpg`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }, i * 100); // 100ms delay between downloads
        }
        
        Utils.showToast(`All ${selectedPhotos.length} photos download started!`, 'success');
        this.clearSelection();
    }

    // Fallback method for individual downloads
    async downloadPhotosIndividually(selectedPhotos) {
        Utils.showToast(`Downloading ${selectedPhotos.length} photos individually...`, 'info');
        
        for (let i = 0; i < selectedPhotos.length; i++) {
            const photo = selectedPhotos[i];
            
            try {
                const a = document.createElement('a');
                a.href = photo.downloadURL;
                a.download = photo.originalName || `photo_${i + 1}.jpg`;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`Failed to download ${photo.originalName}:`, error);
            }
        }
        
        Utils.showToast(`${selectedPhotos.length} photos download completed`, 'success');
        this.clearSelection();
    }

    // Update statistics
    updateStats() {
        const photoCount = document.getElementById('photo-count');
        const storageUsed = document.getElementById('storage-used');
        
        const totalSize = this.photos.reduce((sum, photo) => sum + photo.size, 0);
        
        photoCount.textContent = `${this.photos.length} photo${this.photos.length !== 1 ? 's' : ''}`;
        storageUsed.textContent = `${Utils.formatFileSize(totalSize)} used`;
        
        // Update category summary
        this.updateCategorySummary();
    }

    // Update photo name
    async updatePhotoName(photoId, newName) {
        if (!newName.trim()) {
            Utils.showToast('Photo name cannot be empty', 'warning');
            return;
        }

        try {
            await this.db.collection('photos').doc(photoId).update({
                originalName: newName.trim()
            });

            // Update local data
            const photo = this.photos.find(p => p.id === photoId);
            if (photo) {
                photo.originalName = newName.trim();
                this.renderPhotos();
                Utils.showToast('Photo name updated successfully', 'success');
            }

        } catch (error) {
            Utils.handleError(error, 'Updating photo name');
        }
    }

    // Update category summary
    updateCategorySummary() {
        const categorySummary = document.getElementById('category-summary');
        const categoryCards = document.getElementById('category-cards');
        
        if (!categorySummary || !categoryCards) return;

        // Count photos by category
        const categoryCounts = {};
        this.photos.forEach(photo => {
            const category = photo.category || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });

        // Create category cards
        const fragment = document.createDocumentFragment();
        Object.entries(categoryCounts).forEach(([category, count]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.innerHTML = `
                <div class="category-icon">
                    <i class="fas ${this.getCategoryIcon(category)}"></i>
                </div>
                <div class="category-info">
                    <div class="category-name">${category}</div>
                    <div class="category-count">${count} photo${count > 1 ? 's' : ''}</div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                document.getElementById('category-select').value = category;
                this.currentCategory = category;
                this.filterAndSortPhotos();
            });
            
            fragment.appendChild(card);
        });

        categoryCards.innerHTML = '';
        categoryCards.appendChild(fragment);
        
        categorySummary.style.display = this.photos.length > 0 ? 'block' : 'none';
    }

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            memories: 'fa-heart',
            friends: 'fa-users',
            family: 'fa-home',
            travel: 'fa-plane',
            food: 'fa-utensils',
            selfies: 'fa-user',
            nature: 'fa-leaf',
            pets: 'fa-paw',
            celebration: 'fa-birthday-cake',
            work: 'fa-briefcase',
            hobby: 'fa-gamepad',
            screenshots: 'fa-desktop',
            documents: 'fa-file-alt',
            favorites: 'fa-star',
            shopping: 'fa-shopping-bag',
            sports: 'fa-football-ball',
            education: 'fa-graduation-cap',
            fitness: 'fa-dumbbell',
            art: 'fa-palette',
            music: 'fa-music',
            other: 'fa-folder'
        };
        return icons[category] || 'fa-folder';
    }

    // Add photo to gallery
    addPhoto(photo) {
        this.photos.unshift(photo);
        this.filterAndSortPhotos();
        this.updateStats();
    }

    // Show loading spinner
    showLoading(show) {
        const loadingSpinner = document.getElementById('loading-spinner');
        loadingSpinner.style.display = show ? 'block' : 'none';
    }

    // Generate thumbnail URL for fast loading (Instagram technique)
    generateThumbnailUrl(originalUrl) {
        // Create a smaller version URL by modifying Firebase storage URL
        // This reduces the image size for initial fast loading
        if (originalUrl.includes('firebasestorage.googleapis.com')) {
            // Add size parameter to Firebase URL for automatic resizing
            const url = new URL(originalUrl);
            url.searchParams.set('w', '300'); // Width 300px for thumbnail
            url.searchParams.set('h', '300'); // Height 300px for thumbnail
            url.searchParams.set('q', '70');  // Quality 70% for faster loading
            return url.toString();
        }
        return originalUrl; // Fallback to original if not Firebase
    }

    // Advanced image caching system (Instagram technique)
    setupImageCaching() {
        // Initialize image cache
        this.imageCache = new Map();
        this.preloadQueue = [];
        this.isPreloading = false;
        
        // Setup browser cache optimization
        this.setupCacheHeaders();
        
        // Preload link prefetching for better performance
        this.setupLinkPrefetching();
    }
    
    // Setup link prefetching for critical resources
    setupLinkPrefetching() {
        // Prefetch critical CSS and JS if not already loaded
        const criticalResources = [
            '/styles/main.css',
            '/js/utils.js'
        ];
        
        criticalResources.forEach(href => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            document.head.appendChild(link);
        });
    }

    // Setup cache headers for better performance
    setupCacheHeaders() {
        // Preload critical images
        this.preloadCriticalImages();
        
        // Setup image intersection observer with better performance
        this.setupAdvancedIntersectionObserver();
    }

    // Preload critical images (first 6 images) immediately
    async preloadCriticalImages() {
        const criticalImages = this.filteredPhotos.slice(0, 6);
        const preloadPromises = criticalImages.map(photo => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = this.generateThumbnailUrl(photo.downloadURL);
            document.head.appendChild(link);
            
            return this.preloadImage(photo.downloadURL);
        });

        await Promise.allSettled(preloadPromises);
    }

    // Advanced intersection observer with better performance
    setupAdvancedIntersectionObserver() {
        // Use requestIdleCallback for better performance
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.processImageQueue();
            });
        } else {
            setTimeout(() => this.processImageQueue(), 100);
        }
    }

    // Process image loading queue with priority
    processImageQueue() {
        const visibleImages = document.querySelectorAll('img[data-src]');
        const imageLoadPromises = [];

        visibleImages.forEach((img, index) => {
            // Load first 8 images immediately, rest on scroll
            if (index < 8) {
                imageLoadPromises.push(this.loadImageWithPlaceholder(img));
            }
        });

        Promise.allSettled(imageLoadPromises);
    }

    // Load image with placeholder technique (like Instagram)
    async loadImageWithPlaceholder(img) {
        const originalSrc = img.dataset.src;
        const thumbnailSrc = img.dataset.lowSrc;

        if (!originalSrc) return;

        try {
            // Step 1: Show skeleton/gradient background immediately
            img.style.background = 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)';
            img.style.backgroundSize = '200% 100%';
            img.style.animation = 'loading 1.5s infinite';

            // Step 2: Load thumbnail first if available
            if (thumbnailSrc) {
                const thumbnailImg = new Image();
                thumbnailImg.onload = () => {
                    img.src = thumbnailSrc;
                    img.style.filter = 'blur(8px)';
                    img.style.animation = 'none';
                };
                thumbnailImg.src = thumbnailSrc;
            }

            // Step 3: Load high-quality image
            const highQualityImg = new Image();
            await new Promise((resolve, reject) => {
                highQualityImg.onload = resolve;
                highQualityImg.onerror = reject;
                highQualityImg.src = originalSrc;
            });

            // Step 4: Replace with high-quality image with smooth transition
            img.style.transition = 'filter 0.5s ease';
            img.src = originalSrc;
            img.style.filter = 'none';
            img.style.background = 'none';
            
            // Cache the loaded image
            this.imageCache.set(originalSrc, true);

        } catch (error) {
            console.warn('Failed to load image:', originalSrc, error);
            // Show error placeholder
            img.style.background = '#f5f5f5';
            img.style.animation = 'none';
        }
    }

    // Cleanup function
    cleanup() {
        if (this.lazyLoader) {
            this.lazyLoader.disconnect();
        }
        if (this.imageCache) {
            this.imageCache.clear();
        }
    }

    // Update category summary
    updateCategorySummary() {
        const categorySummary = document.getElementById('category-summary');
        const categoryCards = document.getElementById('category-cards');
        
        if (this.photos.length === 0) {
            categorySummary.style.display = 'none';
            return;
        }
        
        // Count photos by category
        const categoryCount = {};
        this.photos.forEach(photo => {
            const category = photo.category || 'other';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        // Category icons
        const categoryIcons = {
            memories: 'fas fa-heart',
            friends: 'fas fa-user-friends',
            family: 'fas fa-home',
            travel: 'fas fa-plane',
            food: 'fas fa-utensils',
            selfies: 'fas fa-camera',
            nature: 'fas fa-leaf',
            pets: 'fas fa-paw',
            celebration: 'fas fa-birthday-cake',
            work: 'fas fa-briefcase',
            hobby: 'fas fa-gamepad',
            screenshots: 'fas fa-desktop',
            documents: 'fas fa-file-alt',
            favorites: 'fas fa-star',
            shopping: 'fas fa-shopping-cart',
            sports: 'fas fa-running',
            education: 'fas fa-graduation-cap',
            fitness: 'fas fa-dumbbell',
            art: 'fas fa-palette',
            music: 'fas fa-music',
            other: 'fas fa-folder'
        };
        
        categoryCards.innerHTML = '';
        
        Object.entries(categoryCount).forEach(([category, count]) => {
            const card = document.createElement('div');
            card.className = 'category-card';
            card.dataset.category = category;
            
            if (this.currentCategory === category) {
                card.classList.add('active');
            }
            
            card.innerHTML = `
                <div class="category-card-icon">
                    <i class="${categoryIcons[category] || 'fas fa-folder'}"></i>
                </div>
                <div class="category-card-name">${category}</div>
                <div class="category-card-count">${count} photo${count !== 1 ? 's' : ''}</div>
            `;
            
            card.addEventListener('click', () => {
                this.currentCategory = category;
                document.getElementById('category-select').value = category;
                this.filterAndSortPhotos();
                this.updateCategorySummary();
            });
            
            categoryCards.appendChild(card);
        });
        
        // Add "All Categories" card
        const allCard = document.createElement('div');
        allCard.className = 'category-card';
        allCard.dataset.category = 'all';
        
        if (this.currentCategory === 'all') {
            allCard.classList.add('active');
        }
        
        allCard.innerHTML = `
            <div class="category-card-icon">
                <i class="fas fa-images"></i>
            </div>
            <div class="category-card-name">All Photos</div>
            <div class="category-card-count">${this.photos.length} photo${this.photos.length !== 1 ? 's' : ''}</div>
        `;
        
        allCard.addEventListener('click', () => {
            this.currentCategory = 'all';
            document.getElementById('category-select').value = 'all';
            this.filterAndSortPhotos();
            this.updateCategorySummary();
        });
        
        categoryCards.insertBefore(allCard, categoryCards.firstChild);
        
        categorySummary.style.display = 'block';
    }

    // Show/hide loading spinner
    showLoading(show) {
        const loadingSpinner = document.getElementById('loading-spinner');
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }

    // Add photo to gallery
    addPhoto(photo) {
        this.photos.unshift(photo);
        this.filterAndSortPhotos();
        this.updateStats();
    }

    // Update photo
    updatePhoto(photoId, updates) {
        const photo = this.photos.find(p => p.id === photoId);
        if (photo) {
            Object.assign(photo, updates);
            this.filterAndSortPhotos();
        }
    }

    // Get photo by ID
    getPhotoById(photoId) {
        return this.photos.find(p => p.id === photoId);
    }

    // Update photo name
    async updatePhotoName(photoId, newName) {
        if (!newName || newName.trim() === '') {
            Utils.showToast('Please enter a valid name', 'warning');
            return;
        }

        const photo = this.photos.find(p => p.id === photoId);
        if (!photo) {
            Utils.showToast('Photo not found', 'error');
            return;
        }

        try {
            // Update in Firestore
            await firebase.firestore().collection('photos').doc(photoId).update({
                originalName: newName.trim()
            });

            // Update local photo object
            photo.originalName = newName.trim();
            
            // Update UI
            this.filterAndSortPhotos();
            
            // Update modal if open
            const photoTitle = document.getElementById('photo-title');
            if (photoTitle) {
                photoTitle.textContent = newName.trim();
            }
            
            Utils.showToast('Photo name updated successfully', 'success');
            
        } catch (error) {
            console.error('Updating photo name failed:', error);
            Utils.showToast('Failed to update photo name. Please try again.', 'error');
        }
    }

    // Cleanup resources
    cleanup() {
        if (this.lazyLoader) {
            this.lazyLoader.disconnect();
        }
        this.selectedPhotos.clear();
    }
}

// Export for use in other modules
window.PhotoGallery = PhotoGallery;
