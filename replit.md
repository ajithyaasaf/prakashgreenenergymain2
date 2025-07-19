# Prakash Greens Energy Dashboard

## Overview

This is an enterprise-grade dashboard application for Prakash Greens Energy, built as a comprehensive business management system. The application handles attendance tracking, customer management, product catalog, quotations, invoices, payroll, and user management with sophisticated role-based access control.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context for authentication, TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Authentication**: Firebase Auth with custom token verification
- **Database**: Firebase Firestore (NoSQL document database)
- **File Storage**: Cloudinary for attendance photos and document storage
- **API Design**: RESTful endpoints with comprehensive error handling

### Authentication & Authorization
- **Two-layer permission model**:
  1. Department-based feature access (which modules users can see)
  2. Designation-based action permissions (what actions they can perform)
- **Role hierarchy**: master_admin → admin → employee
- **Permission system**: 50+ granular permissions for fine-grained access control

## Key Components

### User Management System
- Role-based access control with three primary roles
- Department assignments (operations, admin, hr, marketing, sales, technical, housekeeping)
- Designation hierarchy (ceo, gm, officer, executive, cre, team_leader, technician, welder, house_man)
- Payroll grade assignments (A1, A2, B1, B2, C1, C2, D1, D2)

### Attendance Management
- **Enterprise-grade geolocation validation** with indoor GPS compensation
- **Multiple attendance types**: office, remote, field work
- **Photo verification** with Cloudinary integration
- **Real-time location tracking** with configurable geofences
- **Automated late arrival detection** and overtime calculations

### Business Operations
- **Customer Management**: Complete CRM functionality
- **Product Catalog**: Solar energy product management with specifications
- **Quotation System**: Generate and track sales quotations
- **Invoice Management**: Create, track, and manage invoices
- **Payroll System**: Comprehensive salary calculation and management

### Department-Specific Modules
- **Operations**: Full system access, enterprise analytics
- **Admin**: User management, department oversight
- **HR**: Employee management, attendance, leave management
- **Marketing**: Customer relations, quotations (view), analytics
- **Sales**: Customer management, quotations, invoices
- **Technical**: Product management, field work attendance
- **Housekeeping**: Basic attendance functionality

## Data Flow

### Authentication Flow
1. User logs in via Firebase Auth
2. Server verifies Firebase token and loads user profile from Firestore
3. User permissions calculated based on department + designation
4. Client receives authenticated user data with computed permissions

### Attendance Flow
1. User requests location permission
2. Enterprise location service validates coordinates against office geofences
3. Indoor GPS compensation applied for poor accuracy scenarios
4. Photo captured and uploaded to Cloudinary
5. Attendance record stored in Firestore with location validation results

### Site Visit Enhanced Location System
- **Automatic GPS detection** with Google Maps API reverse geocoding
- **Human-readable address display** for better user experience
- **Manual fallback options** when automatic detection fails
- **Real-time location capture** for both check-in and check-out
- **Enhanced UI components** with proper error handling and loading states

### Business Process Flow
1. Customer data managed through dedicated CRM module
2. Products cataloged with technical specifications
3. Quotations generated from customer + product combinations
4. Invoices created from approved quotations
5. All data synchronized across modules with audit trails

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication and token management
- **Firestore**: Primary database for all application data
- **Firebase Storage**: Document and file storage

### Third-Party Services
- **Cloudinary**: Image storage and optimization for attendance photos
- **TanStack Query**: Server state management and caching
- **Radix UI**: Accessible component primitives

### Development Dependencies
- **TypeScript**: Type safety and enhanced developer experience
- **ESBuild**: Fast JavaScript bundling for production
- **Drizzle**: Database schema management (configured but not actively used)

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 (provisioned but using Firestore)
- **Port Configuration**: 5000 (internal) → 80 (external)
- **Live Reload**: Vite HMR for instant development feedback

### Production Deployment
- **Target**: Replit Autoscale deployment
- **Build Process**: Vite build + ESBuild server bundling
- **Environment Variables**: Firebase credentials and Cloudinary keys
- **Static Assets**: Served from dist/public directory

### Configuration Files
- **Replit**: .replit file with deployment and environment settings
- **Build**: package.json scripts for dev/build/start lifecycle
- **Styling**: Tailwind config with custom color scheme
- **TypeScript**: Comprehensive tsconfig with path aliases

## Recent Changes

### Site Visit System Fix - July 19, 2025
- **Issue**: Marketing site visit creation was failing due to schema validation error
- **Root Cause**: `projectType` field was required in `marketingSiteVisitSchema` even when `updateRequirements` was false
- **Solution**: Made `projectType` optional in the marketing schema to match business logic
- **Result**: Site visits now successfully create and store in Firestore database
- **Impact**: Marketing department can now perform both simple visits and detailed requirement assessments
- January 18, 2025: CRITICAL PRODUCTION SYSTEM FIXES COMPLETED
  - ✓ MAJOR FIX: Fixed all async permission system bugs - added proper await to all checkSiteVisitPermission calls
  - ✓ MAJOR FIX: Resolved Date/Timestamp conversion crashes with proper null checking in convertFirestoreToSiteVisit
  - ✓ MAJOR FIX: Fixed Firebase configuration contradiction - removed undefined env var checks, using hardcoded values
  - ✓ MAJOR FIX: Enhanced location service to work without API key - graceful fallback to coordinates
  - ✓ MAJOR FIX: Implemented real Cloudinary photo upload in site visit start modal
  - ✓ MAJOR FIX: Fixed Firestore compound query issues - smart filter prioritization to avoid index requirements
  - ✓ MAJOR FIX: Enhanced form validation for all departments with proper length requirements
  - ✓ Technical Form: Added team member requirement and 10-char minimum for pending remarks
  - ✓ Marketing Form: Added panel count validation for all project types
  - ✓ Admin Form: Added 10-char minimum for all description fields
  - ✓ Added comprehensive error boundary system for component-level error handling
  - ✓ Created detailed environment setup guide with all required API keys
  - ✓ Fixed location service to support both API key and coordinate-only modes
  - ✓ Enhanced photo upload with proper error handling and user feedback
  - ✓ Optimized database queries to prevent Firestore compound index errors
  - ✓ System now production-ready with proper error handling and validation
- January 18, 2025: ENHANCED SITE VISIT LOCATION SYSTEM COMPLETED
  - ✓ Implemented enhanced location capture service with Google Maps API reverse geocoding
  - ✓ Created reusable EnhancedLocationCapture component with automatic GPS detection
  - ✓ Added human-readable address display for better user experience
  - ✓ Integrated manual fallback options when automatic detection fails
  - ✓ Updated site visit start modal with new location capture system
  - ✓ Updated site visit checkout modal with enhanced location functionality
  - ✓ Improved error handling and loading states for location operations
  - ✓ Enhanced UX with clear progress indicators and user-friendly messaging
  - ✓ Implemented multi-attempt GPS detection for maximum accuracy
  - ✓ Added refresh button for manual location re-detection
  - ✓ Removed technical coordinate display for cleaner user interface
  - ✓ Optimized GPS settings with multiple readings and best position selection
- July 03, 2025: FIXED SALARY STRUCTURE CALCULATION DISCREPANCIES
  - ✓ MAJOR FIX: Fixed Total Deduction calculation bug in Salary Structure Form 
  - ✓ Added dedicated useEffect for manual deduction tracking when auto-calculation is disabled
  - ✓ Total Deduction now updates dynamically when EPF, ESI, or other deductions are manually entered
  - ✓ MAJOR FIX: Corrected display calculation discrepancy - table now includes ALL deduction fields
  - ✓ Fixed net salary mismatch between form (₹22,900) and display (₹22,712.50)
  - ✓ Display calculation now includes TDS, Loan, Advance, Fine, and Credit deductions
  - ✓ Both form and table calculations now use identical logic for accurate salary computation
  - ✓ Net Salary calculation updates correctly based on manual deduction changes
  - ✓ Maintains existing auto-calculation functionality when enabled
- July 03, 2025: FIXED EARLY CHECKOUT POLICY ENFORCEMENT & REMOVED DUPLICATE UI WARNINGS
  - ✓ MAJOR FIX: Eliminated strict 8-hour department policy enforcement that was blocking early check-outs
  - ✓ Removed hardcoded policy violation checks from server routes (allowEarlyCheckOut enforcement)
  - ✓ Simplified frontend to show single early checkout warning instead of duplicate warnings
  - ✓ Early check-out now only requires reason (minimum 10 characters) without policy blocking
  - ✓ Removed UI button disabling and "policy violation" error messages
  - ✓ System now allows flexible early check-out with simple reason requirement
  - ✓ Fixed duplicate "Early Checkout Detected" warnings in checkout form
- July 03, 2025: CRITICAL PAYROLL PROCESSING FIX - RESOLVED ATTENDANCE DATA READING ISSUES & DYNAMIC FIELDS
  - ✓ MAJOR FIX: Fixed critical user ID mismatch in payroll processing (tries both userId and uid)
  - ✓ MAJOR FIX: Corrected date filtering logic (month conversion from 0-11 to 1-12 range)
  - ✓ MAJOR FIX: Enhanced status classification to include all valid working statuses
  - ✓ MAJOR FIX: Fixed dynamic earnings and deductions not being calculated from salary structure
  - ✓ MAJOR FIX: Dynamic fields now properly pro-rated based on present days (not showing ₹0.00)
  - ✓ Added comprehensive debugging logging for attendance data retrieval and salary calculations
  - ✓ Implemented dual user identifier strategy to handle Firebase UID vs system userId
  - ✓ Enhanced attendance query with error handling and detailed logging
  - ✓ Fixed payroll calculation to properly count overtime, half_day, and early_checkout statuses
  - ✓ Added detailed step-by-step logging for payroll processing debugging
  - ✓ Fixed Basic, HRA, Conveyance fields showing proper values from salary structure
  - ✓ Dynamic earnings and deductions now calculated and included in payroll generation
  - ✓ System now properly reads Vishnu's attendance records for payroll calculations
  - ✓ All dynamic fields (earnings/deductions) are now properly populated from database values
- June 27, 2025: CRITICAL FIX - ELIMINATED ALL HARDCODED DEPARTMENT TIMING OVERRIDES
  - ✓ MAJOR FIX: Removed hardcoded sales department "19:00" (7:00 PM) defaults in storage.ts
  - ✓ Fixed TWO duplicate hardcoded timing entries that were automatically overriding user settings
  - ✓ Master admin department configuration now strictly uses user-defined values without any automatic defaults
  - ✓ Added emergency cache clearing endpoint (/api/admin/clear-cache) for timing reset functionality
  - ✓ Enhanced Enterprise Time Service with cache clearing capabilities
  - ✓ Eliminated systematic issue where Firebase documents reverted to hardcoded defaults
  - ✓ Department timing master configuration feature now functions as intended
  - ✓ Verified sales department timing no longer automatically changes to 7:00 PM
  - ✓ System now respects all user-configured timing settings permanently
- June 26, 2025: FIXED CRITICAL PAYROLL CALCULATION BUGS & NAVIGATION TIMEOUTS
  - ✓ MAJOR FIX: Resolved critical EPF calculation bug using pro-rated salary instead of full basic
  - ✓ MAJOR FIX: Fixed ESI rate inconsistency (routes.ts used 0.75%, storage.ts used 1.75%)
  - ✓ EPF now correctly calculated on full basic salary (regulatory compliant with EPFO)
  - ✓ Standardized ESI rate at 0.75% across all calculation methods
  - ✓ Fixed runtime timeout errors during page navigation by simplifying lazy loading system
  - ✓ Resolved corrupted "6:NaN AM" timing data causing 4.1h overtime miscalculation
  - ✓ Corrected sales department timing: 9:00 AM - 7:00 PM (was corrupted as "6:NaN AM")
  - ✓ Eliminated complex chunk loading wrapper causing signal timeouts
  - ✓ Implemented proper Suspense boundaries for all lazy-loaded routes
  - ✓ Added error boundaries to prevent crashes during chunk loading failures
  - ✓ Verified overtime calculation: 10:53 AM - 6:36 PM = 7.72h work, 0h overtime (correct)
  - ✓ System now properly calculates OT only when checkout exceeds department schedule
  - ✓ Cleared corrupted cache and validated all timing calculations work correctly
  - ✓ Comprehensive payroll audit shows all statutory deductions now comply with regulations
- June 26, 2025: IMPLEMENTED COMPREHENSIVE CODE SPLITTING & BUNDLE OPTIMIZATION
  - ✓ Enhanced lazy loading with strategic component splitting for major performance gains
  - ✓ Created advanced chunk loading utilities with progressive preloading mechanisms
  - ✓ Implemented route-based code splitting for all heavy components (Payroll, Attendance Management, etc.)
  - ✓ Added intelligent preloading system that loads commonly accessed pages after initial load
  - ✓ Separated complex components into dedicated chunks (PayrollTable, SalaryStructuresTable, FieldConfigTable)
  - ✓ Created progressive loading fallbacks with context-aware messaging for better UX
  - ✓ Implemented cross-tab synchronization and advanced caching strategies
  - ✓ Added memory management utilities to prevent loading state conflicts
  - ✓ Enhanced AttendanceTable and CheckInModal as separate loadable chunks
  - ✓ Maintained all existing functionality while reducing initial bundle size significantly
  - ✓ Added comprehensive error boundaries and loading state management
  - ✓ Optimized critical path loading for Dashboard, Login, and Register components
  - ✓ Fixed critical missing useEffect import causing runtime errors in payroll management
  - ✓ Resolved all memory cleanup issues with proper React hook implementations
  - ✓ Verified complete system functionality with all API endpoints responding correctly
  - ✓ Confirmed authentication, permission validation, and database operations remain intact
- June 24, 2025: FIXED CRITICAL OVERTIME CALCULATION BUG & COMPLETED COMPREHENSIVE FILE ANALYSIS
  - ✓ MAJOR FIX: Resolved 9-hour overtime calculation error for 8-minute work session
  - ✓ Fixed corrupted department timing data causing "6:NaN AM" parsing errors  
  - ✓ Enhanced time parsing with comprehensive validation and proper fallbacks across all components
  - ✓ Updated sales department defaults: 9:00 AM - 7:00 PM with early checkout allowed
  - ✓ Removed duplicate overtime calculation logic causing incorrect results
  - ✓ Added emergency cache clearing endpoint for debugging timing issues
  - ✓ Implemented proper overtime logic: only work beyond expected checkout time = OT
  - ✓ Fixed WorkingHoursPreview component to handle 12-hour format properly
  - ✓ Removed deprecated formatTimeString imports from attendance-management and departments pages
  - ✓ Updated migration script timing defaults to use consistent 12-hour format
  - ✓ Standardized all time operations to use Enterprise Time Service centrally
  - ✓ Verified payroll integration correctly uses overtime multiplier (1.5x) for salary calculations
- June 24, 2025: COMPLETED HIGH PRIORITY CRITICAL FIXES
  - ✓ MEMORY LEAK PREVENTION: Added proper useEffect cleanup in attendance-management and payroll-management
  - ✓ TIMEZONE STANDARDIZATION: Routed all time operations through Enterprise Time Service in checkout routes
  - ✓ CACHE KEY CONSISTENCY: Fixed cache key mismatch in enterprise-time-service with consistent format
  - ✓ REFETCH INTERVAL OPTIMIZATION: Increased payroll queries from 5-10s to 60s to prevent memory issues
  - ✓ RACE CONDITION MITIGATION: Implemented coordinated cache refresh with retry logic in departments
  - ✓ ENHANCED DEBUG LOGGING: Added comprehensive logging for cache operations and time calculations
- June 24, 2025: FIXED CRITICAL DOUBLE TIMEZONE CONVERSION BUG
  - ✓ MAJOR FIX: Removed double timezone conversion causing 4:16 AM display bug
  - ✓ Server now stores proper UTC timestamps (no manual +5.5 hour conversion)
  - ✓ Frontend TimeDisplay handles timezone conversion to IST correctly
  - ✓ Fixed server logic that was adding IST offset then storing as UTC
  - ✓ Verified with comprehensive timezone conversion testing
  - ✓ All new attendance records will show correct Indian time
  - ✓ System architecture now follows proper UTC storage + client-side timezone display pattern
- June 24, 2025: Completed comprehensive overtime checkout system and code optimization
  - ✓ Fixed critical overtime calculation logic - now correctly detects work beyond department checkout time  
  - ✓ Enhanced overtime checkout to require photo verification and detailed reason (like field work check-in)
  - ✓ Resolved "Invalid time value" error by fixing 12-hour format time parsing in server routes
  - ✓ Added proper overtime detection logic to bypass early checkout validation during overtime scenarios
  - ✓ Cleaned up unused debug logs, fallback constants, and redundant calculations for better performance
  - ✓ Removed excessive console logging that was impacting system performance
  - ✓ Optimized permission calculation and caching mechanisms
  - ✓ System now properly handles overtime with mandatory photo + reason requirements
- June 24, 2025: Implemented targeted UX improvements for better user experience
  - ✓ Simplified technical language throughout the application
  - ✓ Replaced "GPS Accuracy" with "Location accuracy", "Network Positioning" with "Office location"
  - ✓ Changed technical terms like "epfEmployeeRate" to "Retirement Fund (Employee)"
  - ✓ Updated location recommendations to be more user-friendly and actionable
  - ✓ Added undo capabilities for bulk operations in attendance and payroll management
  - ✓ Created comprehensive undo manager with 5-minute expiry and visual feedback
  - ✓ Implemented graceful offline handling with retry queue and user notifications
  - ✓ Added offline indicator showing connection status and pending sync actions
  - ✓ Enhanced error messages to use plain language instead of technical jargon
  - ✓ Updated page titles: "Attendance Management" → "Team Attendance", "Payroll Management" → "Employee Payroll"
  - ✓ Added health check endpoint for reliable connectivity detection
- June 24, 2025: Implemented comprehensive UX flow improvements addressing all critical user experience issues
  - ✓ Added upfront policy display showing allowed attendance types for user's department
  - ✓ Implemented progressive requirements disclosure - photo/reason requirements shown before user starts
  - ✓ Added real-time form validation with immediate feedback as user types
  - ✓ Created context-aware messaging replacing generic errors with helpful guidance
  - ✓ Enhanced attendance type selection with policy indicators and badges
  - ✓ Added smart defaults - pre-select attendance type based on location accuracy and policies
  - ✓ Implemented overtime threshold warnings - notify users when approaching limits
  - ✓ Added detailed requirements preview for each attendance type
  - ✓ Enhanced form validation with character count indicators and success feedback
  - ✓ Improved submit button messaging based on form completion state
  - ✓ Added department policy explanations with contextual help
  - ✓ Implemented progressive disclosure for overtime requirements in check-out
  - ✓ Enhanced working time summary with attendance type display
  - ✓ Added real-time overtime threshold detection and warnings
- June 24, 2025: Fixed critical overtime calculation logic with time-based approach
  - ✓ Fixed major overtime bug - now properly calculates based on department schedule vs work time
  - ✓ Implemented correct logic: Overtime = work outside department schedule (before start OR after end)
  - ✓ Enhanced working hours preview with separate regular/overtime breakdown
  - ✓ Added comprehensive overtime explanation card with examples
  - ✓ Fixed frontend overtime display to show accurate calculations
  - ✓ Updated check-out component with proper time-based overtime detection
  - ✓ Added detailed logging for overtime calculation debugging
  - ✓ Example: Dept 12:46-12:50, Employee 12:00-13:00 = 4min regular + 56min overtime
  - ✓ Created visual breakdown of regular hours vs overtime hours
  - ✓ Enhanced time calculation service with proper schedule overlap logic
- June 24, 2025: Implemented Google-level Enterprise Time Service with complete standardization
  - ✓ Created centralized EnterpriseTimeService for department-based time management
  - ✓ Standardized all time operations to 12-hour format throughout application
  - ✓ Implemented real-time overtime calculation based on department schedules
  - ✓ Added intelligent caching for department timings with 5-minute expiry
  - ✓ Created reusable TimeDisplay and TimeInput components
  - ✓ Enhanced attendance service with precise OT calculation (work after dept. checkout = OT)
  - ✓ Integrated bulk timing updates with cache invalidation
  - ✓ Updated all affected components to use consistent 12-hour format
  - ✓ Implemented comprehensive API routes for timing management
  - ✓ Added enterprise-grade timing configuration dialog
  - ✓ Fixed all legacy time formatting issues and deprecated functions
  - ✓ Ensured complete 12-hour format compliance across all components
  - ✓ Updated time input components to work with Enterprise Time Service
  - ✓ Fixed critical parsing issues in attendance management form
  - ✓ Updated server routes to handle 12-hour format parsing correctly
  - ✓ Fixed time parsing in department configuration and attendance checkout
  - ✓ Updated schema validation to enforce 12-hour format patterns
  - ✓ Completed deep file analysis and fixed all remaining inconsistencies
  - ✓ Updated department timing defaults to use 12-hour format across all systems
  - ✓ Fixed schema validation logic to properly handle 12-hour format parsing
  - ✓ Updated Enterprise Time Service default fallbacks to 12-hour format
  - ✓ Ensured all main pages use consistent 12-hour timing logic
  - ✓ Removed all deprecated formatTime/formatTimeString imports from components
  - ✓ Verified complete logical consistency across attendance and timing systems
- June 23, 2025: Fixed critical logical issues across attendance and payroll systems
  - ✓ Corrected permission system corruption (duplicate designation levels)
  - ✓ Fixed timezone mismatches in attendance tracking
  - ✓ Added payroll calculation overflow prevention
  - ✓ Implemented proper resource cleanup for camera streams
  - ✓ Enhanced input validation and rate limiting
  - ✓ Improved bulk operation error handling with transaction-like behavior

## Changelog
- June 23, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
Time format preference: 12-hour format (AM/PM) throughout the application.
Business logic preference: Google-level enterprise approach with department-based time management.
Overtime calculation: Simple rule - any work beyond department checkout time is considered overtime.