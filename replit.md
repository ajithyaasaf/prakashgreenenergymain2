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