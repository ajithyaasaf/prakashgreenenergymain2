# Prakash Greens Energy - Enterprise Dashboard

## Overview

This is a comprehensive enterprise dashboard application for Prakash Greens Energy, a solar energy company. The system provides role-based access control, attendance management, customer relationship management, product catalog, quotation and invoice systems, payroll management, and user administration.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight routing library)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Shadcn/UI with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Build Tool**: Vite with custom configuration

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **Authentication**: Firebase Authentication with Admin SDK
- **Database**: Firestore (migrated from PostgreSQL/Drizzle)
- **File Storage**: Firebase Storage + Cloudinary for images
- **API**: RESTful endpoints with Firebase token authentication

### Database Strategy
- **Primary**: Firestore for all application data
- **Legacy**: PostgreSQL connection maintained for compatibility (deprecated)
- **Migration**: Active migration from Drizzle ORM to Firestore collections

## Key Components

### Authentication & Authorization
- **Provider**: Firebase Authentication
- **Strategy**: JWT tokens with server-side verification
- **RBAC System**: Three-tier role system (master_admin, admin, employee)
- **Permissions**: Department-based feature access + designation-based action permissions
- **Context**: React context for auth state management

### User Management
- **Hierarchy**: CEO → GM → Officer → Executive → CRE → Team Leader → Technician → Welder → House Man
- **Departments**: Operations, Admin, HR, Marketing, Sales, Technical, Housekeeping
- **Profile Management**: Employee ID, reporting structure, payroll grades

### Attendance System
- **Check-in/out**: GPS-based location validation with geofencing
- **Types**: Office, remote, field work attendance
- **Location Service**: Multi-strategy GPS with indoor compensation
- **Photo Upload**: Cloudinary integration for attendance photos
- **Real-time**: Live attendance tracking with 30-second intervals

### Business Operations
- **Customers**: CRM with contact management and history
- **Products**: Solar product catalog with specifications and pricing
- **Quotations**: Quote generation with product selection and pricing
- **Invoices**: Invoice management with payment tracking
- **Payroll**: Salary structure management with grade-based calculations

## Data Flow

### Authentication Flow
1. User logs in via Firebase Auth
2. Server verifies JWT token
3. User profile loaded from Firestore
4. Permissions calculated based on department + designation
5. Auth context populated with user data and permissions

### Attendance Flow
1. User requests location permission
2. GPS coordinates captured with accuracy
3. Location validated against office geofences
4. Photo captured and uploaded to Cloudinary
5. Attendance record stored in Firestore
6. Real-time updates to dashboard

### Business Data Flow
1. API requests authenticated with Firebase tokens
2. RBAC middleware checks permissions
3. Firestore operations with real-time listeners
4. Query caching via TanStack Query
5. Optimistic updates for better UX

## External Dependencies

### Firebase Services
- **Authentication**: User authentication and token management
- **Firestore**: Primary database for all application data
- **Storage**: File storage for user uploads
- **Admin SDK**: Server-side Firebase operations

### Third-party Services
- **Cloudinary**: Image upload and processing for attendance photos
- **Geolocation API**: Browser-based GPS for attendance tracking

### UI/UX Libraries
- **Shadcn/UI**: Component library based on Radix UI
- **Tailwind CSS**: Utility-first styling framework
- **Radix UI**: Headless UI primitives for accessibility
- **Lucide Icons**: Icon library for consistent iconography

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 (legacy, being phased out)
- **Hot Reload**: Vite dev server with HMR
- **Environment**: Development mode with detailed logging

### Production Deployment
- **Target**: Autoscale deployment on Replit
- **Build Process**: Vite build + esbuild for server bundling
- **Port Configuration**: Internal port 5000, external port 80
- **Static Assets**: Served from dist/public directory

### Environment Variables
- **Firebase**: Project ID, private key, client email, storage bucket
- **Cloudinary**: API key and secret for image uploads
- **Database**: PostgreSQL URL (deprecated but maintained)

## Changelog

```
Changelog:
- June 20, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```