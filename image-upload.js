// image-upload.js - Store images in Supabase Storage

const SUPABASE_URL = 'https://ejqrlglwogjpabmojfly.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJsZ2x3b2dqcGFibW9qZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU1NTcsImV4cCI6MjA4NTI5MTU1N30.OQeRNExX5PHG9BVmthuUFebVyyahg7tZWmmqCOLGBnE';
const hotelId = 'default_hotel';

class ImageUploader {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_KEY;
    }
    
    // Upload image to Supabase Storage
    async uploadImage(file, floorNum) {
        try {
            const fileName = `floor-${floorNum}-${Date.now()}.jpg`;
            const formData = new FormData();
            formData.append('file', file);
            
            // First, compress the image
            const compressedFile = await this.compressImageFile(file, 0.7);
            
            // Upload to Supabase Storage
            const response = await fetch(`${this.supabaseUrl}/storage/v1/object/hotel-images/${hotelId}/${fileName}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'apikey': this.supabaseKey
                },
                body: compressedFile
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            const imageUrl = `${this.supabaseUrl}/storage/v1/object/public/hotel-images/${hotelId}/${fileName}`;
            
            return {
                success: true,
                url: imageUrl,
                publicUrl: imageUrl
            };
            
        } catch (error) {
            console.error('Image upload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Compress image file before upload
    async compressImageFile(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;
                    const maxDimension = 1200;
                    
                    if (width > height && width > maxDimension) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    } else if (height > maxDimension) {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
                
                img.onerror = reject;
            };
            
            reader.onerror = reject;
        });
    }
    
    // Get image URL from storage
    getImageUrl(floorNum) {
        return `${this.supabaseUrl}/storage/v1/object/public/hotel-images/${hotelId}/floor-${floorNum}-latest.jpg`;
    }
}

// Create global instance
window.imageUploader = new ImageUploader();
