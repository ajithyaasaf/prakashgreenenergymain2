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
- June 24, 2025: Fixed critical UX logical issues in attendance system
  - ✓ Resolved confusing check-in/out button states with clear attendance state logic
  - ✓ Enhanced attendance status display with 5 distinct states (not_started, checked_in, completed, no_timing, unknown)
  - ✓ Added real-time location status indicator with accuracy feedback
  - ✓ Created working hours preview component for check-out with overtime detection
  - ✓ Improved button labels from "Check In/Out" to "Start/End Work Day" for clarity
  - ✓ Added comprehensive attendance state feedback with visual indicators
  - ✓ Fixed midnight boundary confusion with clear day indication
  - ✓ Enhanced check-in modal with location validation and time context
  - ✓ Implemented real-time working hours calculation and overtime alerts
  - ✓ Added user-friendly error messages and actionable recommendations
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