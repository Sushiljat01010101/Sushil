// Upload manager for handling file uploads with progress tracking

class UploadManager {
    constructor() {
        this.queue = [];
        this.activeUploads = 0;
        this.maxConcurrentUploads = 3;
        this.totalFiles = 0;
        this.completedFiles = 0;
        this.failedFiles = 0;
        this.callbacks = {};
        this.abortControllers = new Map();
    }

    // Add files to upload queue
    addFiles(files) {
        const validFiles = [];
        
        Array.from(files).forEach(file => {
            const validation = Utils.validateFile(file);
            if (validation.isValid) {
                const uploadItem = {
                    id: Utils.generateId(),
                    file: file,
                    status: 'pending',
                    progress: 0,
                    error: null,
                    preview: null,
                    compressed: null,
                    metadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified
                    }
                };
                
                validFiles.push(uploadItem);
                this.queue.push(uploadItem);
            } else {
                Utils.showToast(validation.errors.join(', '), 'error');
            }
        });

        this.totalFiles += validFiles.length;
        
        // Generate previews for valid files
        this.generatePreviews(validFiles);
        
        return validFiles;
    }

    // Generate preview images for files
    async generatePreviews(files) {
        const promises = files.map(async (item) => {
            try {
                const dimensions = await Utils.getImageDimensions(item.file);
                item.metadata.width = dimensions.width;
                item.metadata.height = dimensions.height;
                
                // Generate preview
                const preview = await Utils.generateThumbnail(item.file, 300);
                item.preview = URL.createObjectURL(preview);
                
                // Compress original image
                const compressed = await Utils.compressImage(item.file);
                item.compressed = compressed;
                
                this.notifyCallback('preview', item);
            } catch (error) {
                console.error('Error generating preview:', error);
                item.error = 'Failed to generate preview';
            }
        });
        
        await Promise.all(promises);
    }

    // Start upload process
    async startUpload() {
        if (this.queue.length === 0) {
            Utils.showToast('No files to upload', 'warning');
            return;
        }

        this.notifyCallback('start');
        this.processQueue();
    }

    // Process upload queue
    async processQueue() {
        while (this.queue.length > 0 && this.activeUploads < this.maxConcurrentUploads) {
            const item = this.queue.shift();
            this.activeUploads++;
            this.uploadFile(item);
        }
    }

    // Upload individual file
    async uploadFile(item) {
        try {
            item.status = 'uploading';
            this.notifyCallback('progress', item);

            const abortController = new AbortController();
            this.abortControllers.set(item.id, abortController);

            // Upload to Firebase Storage
            const fileToUpload = item.compressed || item.file;
            const fileName = `${Date.now()}_${item.metadata.name}`;
            const storageRef = firebase.storage().ref(`photos/${fileName}`);
            
            const uploadTask = storageRef.put(fileToUpload);
            
            // Track upload progress
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    item.progress = progress;
                    this.notifyCallback('progress', item);
                },
                (error) => {
                    item.status = 'failed';
                    item.error = error.message;
                    this.handleUploadComplete(item, false);
                },
                async () => {
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        
                        // Get selected category or custom category
                        const selectedCategory = document.getElementById('upload-category').value || 'other';
                        const customCategory = document.getElementById('custom-category').value.trim();
                        const finalCategory = customCategory || selectedCategory;
                        
                        // Save to Firestore
                        const docRef = await firebase.firestore().collection('photos').add({
                            fileName: fileName,
                            originalName: item.metadata.name,
                            downloadURL: downloadURL,
                            storagePath: `photos/${fileName}`,
                            size: item.metadata.size,
                            type: item.metadata.type,
                            width: item.metadata.width,
                            height: item.metadata.height,
                            uploadDate: firebase.firestore.FieldValue.serverTimestamp(),
                            category: finalCategory,
                            tags: [],
                            metadata: item.metadata
                        });
                        
                        item.status = 'completed';
                        item.docId = docRef.id;
                        item.downloadURL = downloadURL;
                        
                        this.handleUploadComplete(item, true);
                    } catch (error) {
                        item.status = 'failed';
                        item.error = error.message;
                        this.handleUploadComplete(item, false);
                    }
                }
            );

        } catch (error) {
            item.status = 'failed';
            item.error = error.message;
            this.handleUploadComplete(item, false);
        }
    }

    // Handle upload completion
    handleUploadComplete(item, success) {
        this.activeUploads--;
        this.abortControllers.delete(item.id);
        
        if (success) {
            this.completedFiles++;
            Utils.showToast(`${item.metadata.name} uploaded successfully`, 'success');
        } else {
            this.failedFiles++;
            Utils.showToast(`Failed to upload ${item.metadata.name}: ${item.error}`, 'error');
        }
        
        this.notifyCallback('complete', item);
        
        // Continue processing queue
        this.processQueue();
        
        // Check if all uploads are complete
        if (this.completedFiles + this.failedFiles === this.totalFiles) {
            this.notifyCallback('allComplete', {
                total: this.totalFiles,
                completed: this.completedFiles,
                failed: this.failedFiles
            });
            this.reset();
        }
    }

    // Cancel upload
    cancelUpload(itemId) {
        const abortController = this.abortControllers.get(itemId);
        if (abortController) {
            abortController.abort();
            this.abortControllers.delete(itemId);
        }
        
        // Remove from queue if not started
        this.queue = this.queue.filter(item => item.id !== itemId);
    }

    // Cancel all uploads
    cancelAllUploads() {
        this.abortControllers.forEach(controller => controller.abort());
        this.abortControllers.clear();
        this.queue = [];
        this.reset();
        this.notifyCallback('cancelled');
    }

    // Get upload statistics
    getStats() {
        return {
            total: this.totalFiles,
            completed: this.completedFiles,
            failed: this.failedFiles,
            remaining: this.totalFiles - this.completedFiles - this.failedFiles,
            progress: this.totalFiles > 0 ? ((this.completedFiles + this.failedFiles) / this.totalFiles) * 100 : 0
        };
    }

    // Reset upload manager
    reset() {
        this.queue = [];
        this.activeUploads = 0;
        this.totalFiles = 0;
        this.completedFiles = 0;
        this.failedFiles = 0;
        this.abortControllers.clear();
    }

    // Register callback
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    // Remove callback
    off(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    // Notify callbacks
    notifyCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    // Retry failed uploads
    retryFailedUploads() {
        const failedItems = this.queue.filter(item => item.status === 'failed');
        failedItems.forEach(item => {
            item.status = 'pending';
            item.progress = 0;
            item.error = null;
        });
        
        this.processQueue();
    }

    // Cleanup resources
    cleanup() {
        this.cancelAllUploads();
        this.callbacks = {};
    }

    // Get file by ID
    getFileById(id) {
        return this.queue.find(item => item.id === id);
    }

    // Update file metadata
    updateFileMetadata(id, metadata) {
        const item = this.getFileById(id);
        if (item) {
            item.metadata = { ...item.metadata, ...metadata };
            this.notifyCallback('metadataUpdate', item);
        }
    }

    // Cleanup resources
    cleanup() {
        this.cancelAllUploads();
        this.callbacks = {};
        
        // Cleanup preview URLs
        this.queue.forEach(item => {
            if (item.preview) {
                URL.revokeObjectURL(item.preview);
            }
        });
    }
}

// Export for use in other modules
window.UploadManager = UploadManager;
