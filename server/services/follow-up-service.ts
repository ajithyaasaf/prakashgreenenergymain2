/**
 * Follow-Up Site Visit Service
 * Handles follow-up visit data separately from main site visits
 */

import { db } from "../firebase";
import { Timestamp } from "firebase-admin/firestore";
import {
  FollowUpSiteVisit,
  InsertFollowUpSiteVisit,
  insertFollowUpSiteVisitSchema,
  Location,
  CustomerDetails
} from "@shared/schema";

export class FollowUpService {
  private collection = db.collection('followUpVisits');
  private siteVisitsCollection = db.collection('siteVisits');

  /**
   * Create a new follow-up visit
   */
  async createFollowUp(data: InsertFollowUpSiteVisit): Promise<FollowUpSiteVisit> {
    try {
      console.log("FOLLOW_UP_SERVICE: Creating follow-up with data:", JSON.stringify(data, null, 2));
      
      // Validate data
      const validatedData = insertFollowUpSiteVisitSchema.parse(data);
      
      // Convert dates to Firestore timestamps and filter out undefined values
      const firestoreData: any = {
        ...validatedData,
        siteInTime: Timestamp.fromDate(validatedData.siteInTime),
        siteOutTime: validatedData.siteOutTime ? Timestamp.fromDate(validatedData.siteOutTime) : null,
        createdAt: Timestamp.fromDate(validatedData.createdAt || new Date()),
        updatedAt: Timestamp.fromDate(validatedData.updatedAt || new Date())
      };

      // Remove undefined values to prevent Firestore errors
      Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key] === undefined) {
          delete firestoreData[key];
        }
      });

      console.log("FOLLOW_UP_SERVICE: Cleaned data for Firestore:", JSON.stringify(firestoreData, null, 2));

      console.log("FOLLOW_UP_SERVICE: Prepared data for Firestore:", JSON.stringify(firestoreData, null, 2));

      // Create the follow-up document
      const docRef = await this.collection.add(firestoreData);
      console.log("FOLLOW_UP_SERVICE: Document created with ID:", docRef.id);
      
      // Update the original visit to increment follow-up count
      try {
        const originalVisitRef = this.siteVisitsCollection.doc(validatedData.originalVisitId);
        const originalVisitDoc = await originalVisitRef.get();
        
        if (originalVisitDoc.exists) {
          const currentCount = originalVisitDoc.data()?.followUpCount || 0;
          await originalVisitRef.update({
            followUpCount: currentCount + 1,
            hasFollowUps: true,
            updatedAt: Timestamp.fromDate(new Date())
          });
          console.log("FOLLOW_UP_SERVICE: Updated original visit follow-up count:", currentCount + 1);
        }
      } catch (error) {
        console.error("FOLLOW_UP_SERVICE: Error updating original visit:", error);
        // Don't fail the follow-up creation if original visit update fails
      }
      
      const result = {
        id: docRef.id,
        ...this.convertFirestoreToFollowUp(firestoreData)
      };
      
      console.log("FOLLOW_UP_SERVICE: Returning follow-up:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('FOLLOW_UP_SERVICE: Error creating follow-up:', error);
      throw new Error('Failed to create follow-up visit');
    }
  }

  /**
   * Update follow-up visit (for check-out)
   */
  async updateFollowUp(id: string, updates: Partial<InsertFollowUpSiteVisit>): Promise<FollowUpSiteVisit> {
    try {
      const docRef = this.collection.doc(id);
      
      // Convert dates to Firestore timestamps in updates
      const firestoreUpdates: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (updates.siteOutTime) {
        firestoreUpdates.siteOutTime = Timestamp.fromDate(updates.siteOutTime);
      }

      // Remove undefined values to prevent Firestore errors
      Object.keys(firestoreUpdates).forEach(key => {
        if (firestoreUpdates[key] === undefined) {
          delete firestoreUpdates[key];
        }
      });

      await docRef.update(firestoreUpdates);
      
      const updatedDoc = await docRef.get();
      if (!updatedDoc.exists) {
        throw new Error('Follow-up visit not found after update');
      }

      return {
        id: updatedDoc.id,
        ...this.convertFirestoreToFollowUp(updatedDoc.data()!)
      };
    } catch (error) {
      console.error('FOLLOW_UP_SERVICE: Error updating follow-up:', error);
      throw new Error('Failed to update follow-up visit');
    }
  }

  /**
   * Get follow-up by ID
   */
  async getFollowUpById(id: string): Promise<FollowUpSiteVisit | null> {
    try {
      const doc = await this.collection.doc(id).get();
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...this.convertFirestoreToFollowUp(doc.data()!)
      };
    } catch (error) {
      console.error('FOLLOW_UP_SERVICE: Error getting follow-up:', error);
      return null;
    }
  }

  /**
   * Get all follow-ups for an original visit
   */
  async getFollowUpsByOriginalVisit(originalVisitId: string): Promise<FollowUpSiteVisit[]> {
    try {
      const snapshot = await this.collection
        .where('originalVisitId', '==', originalVisitId)
        .get();

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToFollowUp(doc.data())
      }));

      return docs.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime; // Most recent first
      });
    } catch (error) {
      console.error('FOLLOW_UP_SERVICE: Error getting follow-ups for original visit:', error);
      return [];
    }
  }

  /**
   * Get follow-ups by user with filtering
   */
  async getFollowUpsByUser(
    userId: string, 
    department?: string,
    status?: string
  ): Promise<FollowUpSiteVisit[]> {
    try {
      console.log("FOLLOW_UP_SERVICE: Getting follow-ups for user:", userId);
      
      // Simple query to avoid index issues
      const snapshot = await this.collection.where('userId', '==', userId).get();
      
      console.log("FOLLOW_UP_SERVICE: Found", snapshot.size, "documents");
      
      // Filter and map in memory
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToFollowUp(doc.data())
      })).filter(doc => {
        // Apply additional filters in memory
        if (department && doc.department !== department) return false;
        if (status && doc.status !== status) return false;
        return true;
      });

      console.log("FOLLOW_UP_SERVICE: After filtering:", docs.length, "documents");
      console.log("FOLLOW_UP_SERVICE: Documents:", docs);

      return docs.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime; // Most recent first
      });
    } catch (error) {
      console.error('FOLLOW_UP_SERVICE: Error getting follow-ups by user:', error);
      return [];
    }
  }

  /**
   * Convert Firestore document to FollowUpSiteVisit object
   */
  private convertFirestoreToFollowUp(data: any): Omit<FollowUpSiteVisit, 'id'> {
    return {
      originalVisitId: data.originalVisitId,
      userId: data.userId,
      department: data.department,
      siteInTime: data.siteInTime?.toDate() || new Date(),
      siteInLocation: data.siteInLocation,
      siteInPhotoUrl: data.siteInPhotoUrl,
      siteOutTime: data.siteOutTime?.toDate() || undefined,
      siteOutLocation: data.siteOutLocation,
      siteOutPhotoUrl: data.siteOutPhotoUrl,
      followUpReason: data.followUpReason,
      description: data.description,
      sitePhotos: data.sitePhotos || [],
      status: data.status || 'in_progress',
      notes: data.notes,
      customer: data.customer,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date()
    };
  }
}

// Export singleton instance
export const followUpService = new FollowUpService();