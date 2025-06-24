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
- June 24, 2025: Fixed critical timezone display issue in attendance history
  - ✓ Corrected TimeDisplay component to properly show Indian Standard Time (IST)
  - ✓ Fixed server timezone conversion to use IST (UTC+5:30) for all checkout operations
  - ✓ Updated all time formatting functions to use Asia/Kolkata timezone
  - ✓ Resolved checkout time showing 4:16 AM instead of 10:49 PM in attendance history
  - ✓ Enhanced server response to include both UTC and IST timestamps for debugging
  - ✓ Added forced timezone conversion and tooltip display for verification
  - ✓ Enhanced data refresh logic to clear cached timestamps
  - ✓ Fixed existing attendance database record to show correct Indian time
  - ✓ Updated problematic 4:16 AM record to display proper checkout time
  - ✓ System now correctly displays Indian time in all attendance records and UI components
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