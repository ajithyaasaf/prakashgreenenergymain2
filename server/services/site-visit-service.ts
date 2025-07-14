/**
 * Site Visit Management Service
 * Handles all field operations for Technical, Marketing, and Admin departments
 */

import { db } from "../firebase";
import { Timestamp } from "firebase-admin/firestore";
import {
  SiteVisit,
  InsertSiteVisit,
  insertSiteVisitSchema,
  Location,
  CustomerDetails,
  TechnicalSiteVisit,
  MarketingSiteVisit,
  AdminSiteVisit,
  SitePhoto
} from "@shared/schema";

export class SiteVisitService {
  private collection = db.collection('siteVisits');

  /**
   * Create a new site visit
   */
  async createSiteVisit(data: InsertSiteVisit): Promise<SiteVisit> {
    try {
      // Validate the input data
      const validatedData = insertSiteVisitSchema.parse(data);
      
      // Convert dates to Firestore timestamps
      const firestoreData = {
        ...validatedData,
        siteInTime: Timestamp.fromDate(validatedData.siteInTime),
        siteOutTime: validatedData.siteOutTime ? Timestamp.fromDate(validatedData.siteOutTime) : null,
        createdAt: Timestamp.fromDate(validatedData.createdAt || new Date()),
        updatedAt: Timestamp.fromDate(validatedData.updatedAt || new Date()),
        sitePhotos: validatedData.sitePhotos.map(photo => ({
          ...photo,
          timestamp: Timestamp.fromDate(photo.timestamp)
        }))
      };

      const docRef = await this.collection.add(firestoreData);
      
      return {
        id: docRef.id,
        ...this.convertFirestoreToSiteVisit(firestoreData)
      };
    } catch (error) {
      console.error('Error creating site visit:', error);
      throw new Error('Failed to create site visit');
    }
  }

  /**
   * Update site visit (for check-out and progress updates)
   */
  async updateSiteVisit(id: string, updates: Partial<InsertSiteVisit>): Promise<SiteVisit> {
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

      if (updates.sitePhotos) {
        firestoreUpdates.sitePhotos = updates.sitePhotos.map(photo => ({
          ...photo,
          timestamp: Timestamp.fromDate(photo.timestamp)
        }));
      }

      await docRef.update(firestoreUpdates);
      
      const updatedDoc = await docRef.get();
      if (!updatedDoc.exists) {
        throw new Error('Site visit not found');
      }

      return {
        id: updatedDoc.id,
        ...this.convertFirestoreToSiteVisit(updatedDoc.data()!)
      };
    } catch (error) {
      console.error('Error updating site visit:', error);
      throw new Error('Failed to update site visit');
    }
  }

  /**
   * Get site visit by ID
   */
  async getSiteVisitById(id: string): Promise<SiteVisit | null> {
    try {
      const doc = await this.collection.doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data()!)
      };
    } catch (error) {
      console.error('Error getting site visit:', error);
      throw new Error('Failed to get site visit');
    }
  }

  /**
   * Get site visits by user ID
   */
  async getSiteVisitsByUser(userId: string, limit = 50): Promise<SiteVisit[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data())
      }));
    } catch (error) {
      console.error('Error getting user site visits:', error);
      throw new Error('Failed to get user site visits');
    }
  }

  /**
   * Get site visits by department
   */
  async getSiteVisitsByDepartment(department: 'technical' | 'marketing' | 'admin', limit = 100): Promise<SiteVisit[]> {
    try {
      const snapshot = await this.collection
        .where('department', '==', department)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data())
      }));
    } catch (error) {
      console.error('Error getting department site visits:', error);
      throw new Error('Failed to get department site visits');
    }
  }

  /**
   * Get active (in-progress) site visits
   */
  async getActiveSiteVisits(): Promise<SiteVisit[]> {
    try {
      const snapshot = await this.collection
        .where('status', '==', 'in_progress')
        .orderBy('siteInTime', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data())
      }));
    } catch (error) {
      console.error('Error getting active site visits:', error);
      throw new Error('Failed to get active site visits');
    }
  }

  /**
   * Get site visits by date range
   */
  async getSiteVisitsByDateRange(startDate: Date, endDate: Date): Promise<SiteVisit[]> {
    try {
      const snapshot = await this.collection
        .where('siteInTime', '>=', Timestamp.fromDate(startDate))
        .where('siteInTime', '<=', Timestamp.fromDate(endDate))
        .orderBy('siteInTime', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data())
      }));
    } catch (error) {
      console.error('Error getting site visits by date range:', error);
      throw new Error('Failed to get site visits by date range');
    }
  }

  /**
   * Get site visits with filters
   */
  async getSiteVisitsWithFilters(filters: {
    userId?: string;
    department?: 'technical' | 'marketing' | 'admin';
    status?: 'in_progress' | 'completed' | 'cancelled';
    visitPurpose?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SiteVisit[]> {
    try {
      let query = this.collection.orderBy('createdAt', 'desc');

      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      if (filters.department) {
        query = query.where('department', '==', filters.department);
      }

      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      if (filters.visitPurpose) {
        query = query.where('visitPurpose', '==', filters.visitPurpose);
      }

      if (filters.startDate) {
        query = query.where('siteInTime', '>=', Timestamp.fromDate(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('siteInTime', '<=', Timestamp.fromDate(filters.endDate));
      }

      const snapshot = await query.limit(filters.limit || 100).get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...this.convertFirestoreToSiteVisit(doc.data())
      }));
    } catch (error) {
      console.error('Error getting filtered site visits:', error);
      throw new Error('Failed to get filtered site visits');
    }
  }

  /**
   * Delete site visit
   */
  async deleteSiteVisit(id: string): Promise<void> {
    try {
      await this.collection.doc(id).delete();
    } catch (error) {
      console.error('Error deleting site visit:', error);
      throw new Error('Failed to delete site visit');
    }
  }

  /**
   * Add photos to existing site visit
   */
  async addSitePhotos(siteVisitId: string, photos: SitePhoto[]): Promise<SiteVisit> {
    try {
      const docRef = this.collection.doc(siteVisitId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error('Site visit not found');
      }

      const currentData = doc.data()!;
      const currentPhotos = currentData.sitePhotos || [];
      
      // Convert new photos to Firestore format
      const firestorePhotos = photos.map(photo => ({
        ...photo,
        timestamp: Timestamp.fromDate(photo.timestamp)
      }));

      // Ensure we don't exceed 20 photos limit
      const updatedPhotos = [...currentPhotos, ...firestorePhotos].slice(0, 20);

      await docRef.update({
        sitePhotos: updatedPhotos,
        updatedAt: Timestamp.fromDate(new Date())
      });

      const updatedDoc = await docRef.get();
      return {
        id: updatedDoc.id,
        ...this.convertFirestoreToSiteVisit(updatedDoc.data()!)
      };
    } catch (error) {
      console.error('Error adding site photos:', error);
      throw new Error('Failed to add site photos');
    }
  }

  /**
   * Get site visit analytics/statistics
   */
  async getSiteVisitStats(filters?: {
    department?: 'technical' | 'marketing' | 'admin';
    startDate?: Date;
    endDate?: Date;
  }) {
    try {
      let query = this.collection;

      if (filters?.department) {
        query = query.where('department', '==', filters.department);
      }

      if (filters?.startDate) {
        query = query.where('siteInTime', '>=', Timestamp.fromDate(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('siteInTime', '<=', Timestamp.fromDate(filters.endDate));
      }

      const snapshot = await query.get();
      const siteVisits = snapshot.docs.map(doc => doc.data());

      return {
        total: siteVisits.length,
        inProgress: siteVisits.filter(sv => sv.status === 'in_progress').length,
        completed: siteVisits.filter(sv => sv.status === 'completed').length,
        cancelled: siteVisits.filter(sv => sv.status === 'cancelled').length,
        byDepartment: {
          technical: siteVisits.filter(sv => sv.department === 'technical').length,
          marketing: siteVisits.filter(sv => sv.department === 'marketing').length,
          admin: siteVisits.filter(sv => sv.department === 'admin').length
        },
        byPurpose: siteVisits.reduce((acc, sv) => {
          acc[sv.visitPurpose] = (acc[sv.visitPurpose] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      console.error('Error getting site visit stats:', error);
      throw new Error('Failed to get site visit statistics');
    }
  }

  /**
   * Convert Firestore data to SiteVisit object
   */
  private convertFirestoreToSiteVisit(data: any): Omit<SiteVisit, 'id'> {
    return {
      ...data,
      siteInTime: data.siteInTime.toDate(),
      siteOutTime: data.siteOutTime ? data.siteOutTime.toDate() : undefined,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      sitePhotos: (data.sitePhotos || []).map((photo: any) => ({
        ...photo,
        timestamp: photo.timestamp.toDate()
      }))
    };
  }
}

// Export singleton instance
export const siteVisitService = new SiteVisitService();