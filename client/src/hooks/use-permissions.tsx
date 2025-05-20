import { useAuthContext } from "@/contexts/auth-context";

// Define permission types
export type Permission =
  | "manage_departments" // Create, update, delete departments
  | "set_office_locations" // Define office locations with geo-fencing
  | "manage_access" // Manage application access for departments/roles
  | "assign_departments" // Assign departments to employees
  | "view_all_reports" // View reports across all departments
  | "view_department_reports" // View reports for specific department
  | "manage_customers" // Add, update, delete customers
  | "manage_products" // Add, update, delete products
  | "manage_quotations" // Create quotations
  | "manage_invoices" // Create invoices
  | "manage_attendance" // Manage attendance
  | "manage_leaves" // Manage leaves
  | "approve_leaves" // Approve leave applications
  | "hr_operations" // HR department operations
  | "accounts_operations" // Accounts department operations
  | "cre_operations" // CRE department operations
  | "sales_operations" // Sales and Marketing operations
  | "technical_operations"; // Technical team operations

// Define permission mappings for each role and department
const rolePermissions: Record<string, Permission[]> = {
  master_admin: [
    "manage_departments",
    "set_office_locations",
    "manage_access",
    "assign_departments",
    "view_all_reports",
    "manage_customers",
    "manage_products",
    "manage_quotations",
    "manage_invoices",
    "manage_attendance",
    "manage_leaves",
    "approve_leaves",
    "hr_operations",
    "accounts_operations",
    "cre_operations",
    "sales_operations",
    "technical_operations",
  ],
  admin: [
    "assign_departments",
    "view_all_reports",
    "manage_customers",
    "manage_products",
    "manage_quotations",
    "manage_invoices",
    "manage_attendance",
    "approve_leaves",
  ],
  employee: [
    "view_department_reports",
  ],
};

// Define department-specific permissions
const departmentPermissions: Record<string, Permission[]> = {
  hr: [
    "hr_operations",
    "manage_attendance",
    "manage_leaves",
    "approve_leaves",
  ],
  accounts: [
    "accounts_operations",
    "manage_invoices",
  ],
  cre: [
    "cre_operations",
  ],
  sales_and_marketing: [
    "sales_operations",
    "manage_customers",
    "manage_quotations",
  ],
  technical_team: [
    "technical_operations",
    "manage_products",
  ],
};

export function usePermissions() {
  const { user } = useAuthContext();

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;

    // Check role-based permissions
    const userRolePermissions = rolePermissions[user.role] || [];
    
    // Check department-based permissions
    const userDepartmentPermissions = user.department 
      ? departmentPermissions[user.department] || []
      : [];

    // Combine both permission sets
    return userRolePermissions.includes(permission) || userDepartmentPermissions.includes(permission);
  };

  const canManageDepartments = (): boolean => {
    return hasPermission("manage_departments");
  };

  const canSetOfficeLocations = (): boolean => {
    return hasPermission("set_office_locations");
  };

  const canManageAccess = (): boolean => {
    return hasPermission("manage_access");
  };

  const canAssignDepartments = (): boolean => {
    return hasPermission("assign_departments");
  };

  const canViewAllReports = (): boolean => {
    return hasPermission("view_all_reports");
  };

  const canManageCustomers = (): boolean => {
    return hasPermission("manage_customers");
  };

  const canManageProducts = (): boolean => {
    return hasPermission("manage_products");
  };

  const canManageQuotations = (): boolean => {
    return hasPermission("manage_quotations");
  };

  const canManageInvoices = (): boolean => {
    return hasPermission("manage_invoices");
  };

  const canManageAttendance = (): boolean => {
    return hasPermission("manage_attendance");
  };

  const canManageLeaves = (): boolean => {
    return hasPermission("manage_leaves");
  };

  const canApproveLeaves = (): boolean => {
    return hasPermission("approve_leaves");
  };

  return {
    hasPermission,
    canManageDepartments,
    canSetOfficeLocations,
    canManageAccess,
    canAssignDepartments,
    canViewAllReports,
    canManageCustomers,
    canManageProducts,
    canManageQuotations,
    canManageInvoices,
    canManageAttendance,
    canManageLeaves,
    canApproveLeaves,
    // Return user role and department for reference
    userRole: user?.role,
    userDepartment: user?.department,
  };
}