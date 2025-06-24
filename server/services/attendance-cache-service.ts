/**
 * Attendance Cache Service
 * Google-level caching for attendance operations
 */

import { performanceOptimizer } from './performance-optimizer';

interface AttendanceCacheConfig {
  userAttendanceToday: number;      // 30 seconds
  departmentStats: number;          // 2 minutes  
  attendanceList: number;           // 1 minute
  userProfile: number;              // 5 minutes
  departmentTiming: number;         // 10 minutes
}

const CACHE_TTL: AttendanceCacheConfig = {
  userAttendanceToday: 30000,
  departmentStats: 120000,
  attendanceList: 60000,
  userProfile: 300000,
  departmentTiming: 600000,
};

export class AttendanceCacheService {
  // User's today attendance with ultra-fast access
  static async getUserTodayAttendance(userId: string, queryFn: () => Promise<any>): Promise<any> {
    const cacheKey = `attendance:today:${userId}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      CACHE_TTL.userAttendanceToday
    );
  }
  
  // Department statistics with smart caching
  static async getDepartmentStats(department: string, queryFn: () => Promise<any>): Promise<any> {
    const cacheKey = `stats:department:${department}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      CACHE_TTL.departmentStats
    );
  }
  
  // Attendance list with pagination awareness
  static async getAttendanceList(filters: any, queryFn: () => Promise<any>): Promise<any> {
    const filterKey = JSON.stringify(filters);
    const cacheKey = `attendance:list:${filterKey}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      CACHE_TTL.attendanceList
    );
  }
  
  // User profile with long-term caching
  static async getUserProfile(userId: string, queryFn: () => Promise<any>): Promise<any> {
    const cacheKey = `user:profile:${userId}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      CACHE_TTL.userProfile
    );
  }
  
  // Department timing with longest cache
  static async getDepartmentTiming(department: string, queryFn: () => Promise<any>): Promise<any> {
    const cacheKey = `timing:department:${department}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      CACHE_TTL.departmentTiming
    );
  }
  
  // Live attendance with minimal caching
  static async getLiveAttendance(queryFn: () => Promise<any>): Promise<any> {
    const cacheKey = `attendance:live:${new Date().toISOString().split('T')[0]}`;
    return performanceOptimizer.executeOptimizedQuery(
      cacheKey,
      queryFn,
      15000 // 15 seconds only for live data
    );
  }
  
  // Invalidation strategies
  static invalidateUserCache(userId: string): void {
    performanceOptimizer.invalidate(`attendance:today:${userId}`);
    performanceOptimizer.invalidate(`user:profile:${userId}`);
    console.log(`CACHE: Invalidated user cache for ${userId}`);
  }
  
  static invalidateDepartmentCache(department: string): void {
    performanceOptimizer.invalidate(`stats:department:${department}`);
    performanceOptimizer.invalidate(`timing:department:${department}`);
    console.log(`CACHE: Invalidated department cache for ${department}`);
  }
  
  static invalidateAttendanceCache(): void {
    performanceOptimizer.invalidate('attendance:list');
    performanceOptimizer.invalidate('attendance:live');
    performanceOptimizer.invalidate('stats:department');
    console.log('CACHE: Invalidated all attendance cache');
  }
  
  static getCacheStats(): any {
    return performanceOptimizer.getPerformanceStats();
  }
}