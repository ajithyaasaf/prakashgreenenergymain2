# Prakash Greens Energy - Enterprise Dashboard

## Overview

This is a comprehensive enterprise-grade dashboard application for Prakash Greens Energy, a solar energy company. The system provides complete business management capabilities including customer relationship management, attendance tracking, payroll management, quotation and invoice generation, and user management with role-based access control.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: Firebase Firestore (migrated from PostgreSQL)
- **Authentication**: Firebase Authentication with custom user management
- **File Storage**: Cloudinary for attendance photos and document storage
- **API**: RESTful APIs with Firebase Admin SDK integration

### Database Strategy
- **Primary Database**: Firestore for real-time data and scalability
- **Schema**: TypeScript schemas defined in `shared/schema.ts` using Zod validation
- **Migration**: Currently migrating from PostgreSQL/Drizzle to Firestore
- **Legacy Support**: Backward compatibility maintained during transition

## Key Components

### Authentication & Authorization
- **Multi-tier Role System**: Master Admin, Admin, Employee roles
- **Department-based Access**: 7 departments (operations, admin, hr, marketing, sales, technical, housekeeping)
- **Designation Hierarchy**: 9 levels from CEO to House Man
- **Permission System**: Granular permissions for each module and action
- **Firebase Integration**: Server-side token validation with custom user profiles

### Attendance Management
- **GPS-based Check-in/out**: Enterprise-grade location validation
- **Multiple Attendance Types**: Office, remote, field work
- **Photo Verification**: Cloudinary integration for attendance photos
- **Real-time Tracking**: Live attendance monitoring and reporting
- **Geofence Validation**: Configurable office location boundaries

### Business Operations
- **Customer Management**: Complete CRM with contact and project tracking
- **Product Catalog**: Solar equipment and services management
- **Quotation System**: Professional quote generation and tracking
- **Invoice Management**: Billing and payment tracking
- **Leave Management**: Employee leave requests and approvals

### User Management
- **Multi-level Administration**: Department-based user management
- **Profile Management**: Complete employee profiles with reporting structure
- **Payroll Integration**: Grade-based salary structures
- **Activity Tracking**: Comprehensive audit logs

## Data Flow

### Authentication Flow
1. User authenticates with Firebase Auth
2. Server validates Firebase token
3. User profile fetched from Firestore
4. Permissions calculated based on role, department, and designation
5. Session cached for performance

### Attendance Flow
1. User requests check-in with GPS coordinates
2. Location validated against office geofences
3. Photo captured and uploaded to Cloudinary
4. Attendance record created in Firestore
5. Real-time updates pushed to management dashboard

### Business Process Flow
1. Sales team creates quotations for customers
2. Quotations converted to invoices upon approval
3. Technical team tracks product inventory
4. HR manages employee attendance and leave
5. Management accesses analytics and reports

## External Dependencies

### Firebase Services
- **Authentication**: User login and token management
- **Firestore**: Primary database for all application data
- **Admin SDK**: Server-side operations and user management

### Third-party Services
- **Cloudinary**: Image storage and processing for attendance photos
- **Geolocation APIs**: GPS-based location validation

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **Zod**: Schema validation and type inference
- **TanStack Query**: Server state management and caching
- **Tailwind CSS**: Utility-first styling framework

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 (legacy) + Firebase (current)
- **Hot Reload**: Vite development server with instant updates

### Production Deployment
- **Target**: Replit Autoscale deployment
- **Build Process**: Vite production build + esbuild server bundling
- **Port Configuration**: Internal port 5000, external port 80
- **Environment**: Production Firebase project with secure credentials

### Database Migration
- **Current State**: Dual database support (PostgreSQL + Firestore)
- **Target State**: Full Firestore migration
- **Strategy**: Gradual migration with backward compatibility
- **Schema**: Unified TypeScript schemas for both systems

## Changelog

- June 21, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.