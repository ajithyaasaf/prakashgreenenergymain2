import { storage } from './storage';

/**
 * Migration script to update organizational structure based on the provided chart
 * 
 * Chart Analysis:
 * - CEO, GM, Officer -> Operations Department
 * - Executive -> Admin, HR, Marketing Departments
 * - CRE -> Sales Department (designation, not department)
 * - Team Leader, Technician, Welder -> Technical Department
 * - House Man -> Housekeeping Department
 */

export async function migrateOrganizationalStructure() {
  console.log('Starting organizational structure migration...');

  try {
    // Get all users
    const users = await storage.listUsers();
    console.log(`Found ${users.length} users to migrate`);

    const migrationMap: Record<string, { department: string; designation: string }> = {
      // Current department "cre" users should become designation "cre" in "sales" department
      'cre': { department: 'sales', designation: 'cre' },
      // Current department mappings to new structure
      'accounts': { department: 'admin', designation: 'executive' },
      'hr': { department: 'hr', designation: 'executive' },
      'sales_and_marketing': { department: 'marketing', designation: 'executive' },
      'technical_team': { department: 'technical', designation: 'technician' }
    };

    let migratedCount = 0;
    for (const user of users) {
      let needsUpdate = false;
      const updateData: any = {};

      // Migrate department if it exists in our mapping
      if (user.department && migrationMap[user.department]) {
        updateData.department = migrationMap[user.department].department;
        updateData.designation = migrationMap[user.department].designation;
        needsUpdate = true;
        console.log(`Migrating user ${user.email}: ${user.department} -> ${updateData.department} (${updateData.designation})`);
      }

      // Update designation mapping for existing users
      const designationMapping: Record<string, string> = {
        'director': 'ceo',
        'manager': 'gm',
        'assistant_manager': 'officer',
        'senior_executive': 'team_leader',
        'junior_executive': 'cre',
        'trainee': 'technician',
        'intern': 'house_man'
      };

      if (user.designation && designationMapping[user.designation]) {
        updateData.designation = designationMapping[user.designation];
        needsUpdate = true;
        console.log(`Updating designation for ${user.email}: ${user.designation} -> ${updateData.designation}`);
      }

      if (needsUpdate) {
        await storage.updateUser(user.uid, updateData);
        migratedCount++;
      }
    }

    console.log(`Migration completed successfully! Migrated ${migratedCount} users.`);
    return { success: true, migratedCount };

  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Default department timings for new organizational structure
export const newDepartmentTimings = {
  operations: {
    departmentId: 'operations',
    checkInTime: '09:00',
    checkOutTime: '18:00',
    workingHours: 9,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: true,
    flexibleCheckInStart: '08:30',
    flexibleCheckInEnd: '09:30',
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  admin: {
    departmentId: 'admin',
    checkInTime: '09:30',
    checkOutTime: '18:30',
    workingHours: 8,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: false,
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  hr: {
    departmentId: 'hr',
    checkInTime: '09:30',
    checkOutTime: '18:30',
    workingHours: 8,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: false,
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  marketing: {
    departmentId: 'marketing',
    checkInTime: '09:30',
    checkOutTime: '18:30',
    workingHours: 8,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: false,
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  sales: {
    departmentId: 'sales',
    checkInTime: '09:00',
    checkOutTime: '19:00',
    workingHours: 9,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: true,
    flexibleCheckInStart: '08:30',
    flexibleCheckInEnd: '09:30',
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  technical: {
    departmentId: 'technical',
    checkInTime: '08:00',
    checkOutTime: '17:00',
    workingHours: 8,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: false,
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  },
  housekeeping: {
    departmentId: 'housekeeping',
    checkInTime: '07:00',
    checkOutTime: '16:00',
    workingHours: 8,
    overtimeThresholdMinutes: 30,
    lateThresholdMinutes: 15,
    isFlexibleTiming: false,
    breakDurationMinutes: 60,
    weeklyOffDays: [0], // Sunday
    isActive: true
  }
};