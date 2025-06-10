/**
 * Cloudinary Service for Attendance Photo Upload
 * Handles secure photo upload to Cloudinary with folder organization
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'doeodacsg',
  api_key: process.env.CLOUDINARY_API_KEY || 'your_api_key_here',
  api_secret: 'wUw9Seu6drQEIbQ1tAvYeVyqHdU'
});

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export class CloudinaryService {
  private static readonly FOLDER_NAME = 'prakash attendance field images';

  /**
   * Upload attendance photo to Cloudinary
   * @param base64Image - Base64 encoded image data
   * @param userId - User ID for file naming
   * @param timestamp - Timestamp for unique naming
   */
  static async uploadAttendancePhoto(
    base64Image: string,
    userId: string,
    timestamp: Date = new Date()
  ): Promise<CloudinaryUploadResult> {
    try {
      // Generate unique filename
      const dateStr = timestamp.toISOString().split('T')[0];
      const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
      const publicId = `${this.FOLDER_NAME}/${userId}_${dateStr}_${timeStr}`;

      console.log('CLOUDINARY: Uploading photo to folder:', this.FOLDER_NAME);
      console.log('CLOUDINARY: Public ID:', publicId);

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(base64Image, {
        public_id: publicId,
        folder: this.FOLDER_NAME,
        resource_type: 'image',
        format: 'jpg',
        quality: 'auto',
        transformation: [
          { width: 800, height: 600, crop: 'limit' }, // Limit size for storage efficiency
          { quality: 'auto:good' } // Optimize quality
        ],
        tags: ['attendance', 'field_work', userId]
      });

      console.log('CLOUDINARY: Upload successful:', result.secure_url);

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id
      };

    } catch (error) {
      console.error('CLOUDINARY: Upload failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Delete attendance photo from Cloudinary
   * @param publicId - Cloudinary public ID of the image
   */
  static async deleteAttendancePhoto(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('CLOUDINARY: Delete result:', result);
      return result.result === 'ok';
    } catch (error) {
      console.error('CLOUDINARY: Delete failed:', error);
      return false;
    }
  }

  /**
   * Get folder info to verify folder exists
   */
  static async ensureFolderExists(): Promise<boolean> {
    try {
      // List resources in the folder to check if it exists
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: this.FOLDER_NAME,
        max_results: 1
      });
      
      console.log('CLOUDINARY: Folder check result:', result);
      return true;
    } catch (error) {
      console.log('CLOUDINARY: Folder does not exist or error checking:', error);
      // Folder will be created automatically on first upload
      return true;
    }
  }

  /**
   * Get upload configuration for frontend (for direct upload if needed)
   */
  static getUploadConfig() {
    return {
      cloudName: 'doeodacsg',
      uploadPreset: 'attendance_photos', // You may need to create this preset
      folder: this.FOLDER_NAME
    };
  }
}