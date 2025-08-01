# Prakash Greens Energy Dashboard

## Overview

This is an enterprise-grade dashboard application for Prakash Greens Energy, designed as a comprehensive business management system. It aims to streamline operations by handling attendance tracking, customer management, product catalog, quotations, invoices, payroll, and user management with sophisticated role-based access control. The project's ambition is to provide a robust, scalable solution for efficient business management in the energy sector.

## User Preferences

Preferred communication style: Simple, everyday language.
Time format preference: 12-hour format (AM/PM) throughout the application.
Business logic preference: Google-level enterprise approach with department-based time management.
Overtime calculation: Simple rule - any work beyond department checkout time is considered overtime.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context for authentication, TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds
- **UI/UX Decisions**: Clean, simple interface focused on core requirements (photo + location + timing). Enhanced error messages with plain language and context-aware guidance. Consistent 12-hour format enforcement across all time displays and inputs.

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Authentication**: Firebase Auth with custom token verification
- **Database**: Firebase Firestore (NoSQL document database)
- **File Storage**: Cloudinary for attendance photos and document storage
- **API Design**: RESTful endpoints with comprehensive error handling.

### Authentication & Authorization
- **Two-layer permission model**: Department-based feature access and Designation-based action permissions.
- **Role Hierarchy**: master_admin → admin → employee.
- **Permission System**: Granular access control with 50+ permissions.

### Key Features & Technical Implementations
- **User Management**: Role-based access control with department and designation assignments.
- **Attendance Management**: Enterprise-grade geolocation validation with indoor GPS compensation, photo verification, real-time location tracking (simplified to remove geofencing restrictions), and automated late arrival/overtime calculations. Unified validation requires location access and a selfie photo for check-in/out.
- **Business Operations**: CRM for customer management, solar energy product catalog, quotation generation, invoice management, and comprehensive payroll calculation.
- **Site Visit System**: Enhanced location capture with Google Maps API reverse geocoding, human-readable address display, manual fallback, and automated customer data handling via autocomplete. Enterprise-grade validation with proper TypeScript compliance across all forms (Marketing, Admin, Technical).
- **Payroll System**: Dynamic earnings and deductions based on salary structure, proper EPF/ESI calculations, and handling of various attendance statuses (overtime, half-day, early checkout).
- **Enterprise Time Service**: Centralized 12-hour format standardization, real-time overtime calculation based on department schedules, and intelligent caching.
- **Code Optimization**: Comprehensive code splitting and bundle optimization using strategic component splitting and lazy loading for performance gains.

## External Dependencies

- **Firebase Services**: Firebase Auth (user authentication), Firestore (primary database).
- **Cloudinary**: Image storage and optimization for attendance photos.
- **TanStack Query**: Server state management and caching.
- **Radix UI**: Accessible component primitives.
- **Google Maps API**: For reverse geocoding in enhanced location capture.