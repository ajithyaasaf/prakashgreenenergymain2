# Prakash Greens Energy - Enterprise Dashboard Application

## Overview

This is a comprehensive enterprise dashboard application for Prakash Greens Energy, a solar energy company. The system provides a complete business management solution including customer relationship management, product catalog, quotations, invoicing, attendance tracking, payroll management, and user administration with role-based access control.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom brand colors (#a7ce3b primary, #157fbe secondary)
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Firebase Authentication with custom role-based access control

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database**: Firebase Firestore (migrated from PostgreSQL/Drizzle)
- **Authentication**: Firebase Admin SDK for server-side auth verification
- **File Storage**: Firebase Storage with Cloudinary integration for attendance photos
- **API Design**: RESTful endpoints with comprehensive error handling

### Data Storage Strategy
- **Primary Database**: Firebase Firestore for all business data
- **File Storage**: Firebase Storage + Cloudinary for images and documents
- **Session Management**: Firebase Auth tokens with server-side verification
- **Caching**: In-memory cache service for user data and permissions

## Key Components

### Authentication & Authorization System
- **Three-tier role system**: Master Admin → Admin → Employee
- **Department-based module access**: Operations, Admin, HR, Marketing, Sales, Technical, Housekeeping
- **Designation hierarchy**: CEO → GM → Officer → Executive → CRE → Team Leader → Technician → Welder → House Man
- **Permission system**: 50+ granular permissions for fine-grained access control
- **Protected routes**: Component-level permission checking

### Business Modules
1. **Customer Management**: Full CRUD operations with search, filtering, and pagination
2. **Product Catalog**: Solar product management with specifications and pricing
3. **Quotation System**: Professional quote generation with PDF export
4. **Invoice Management**: Billing system with payment tracking
5. **Attendance System**: GPS-based check-in/out with location validation and photo capture
6. **Payroll Management**: Salary structures, automated calculations, and payslip generation
7. **Leave Management**: Leave applications with approval workflows
8. **User Administration**: Role assignment, department management, and access control

### Enterprise Features
- **Dashboard Analytics**: Real-time business metrics and KPIs
- **Location Services**: GPS validation with indoor compensation and accuracy monitoring
- **Performance Monitoring**: System health tracking and alerting
- **Audit Logging**: Complete activity tracking for compliance
- **Mobile Responsive**: Optimized for mobile devices with touch-friendly interfaces

## Data Flow

### Authentication Flow
1. User logs in through Firebase Authentication
2. Server validates Firebase token and fetches user profile from Firestore
3. Permissions calculated based on role + department + designation
4. Frontend receives authenticated user object with permissions
5. Protected routes and components check permissions before rendering

### Business Data Flow
1. Frontend makes authenticated API requests with Firebase tokens
2. Express middleware validates tokens and loads user context
3. Permission middleware checks required permissions for endpoints
4. Business logic processes requests and interacts with Firestore
5. Responses sent back with appropriate data and error handling
6. Frontend updates UI using TanStack Query cache invalidation

### Real-time Updates
- TanStack Query with 30-second refetch intervals for live data
- Firestore real-time listeners for critical updates
- Optimistic updates for better user experience

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, and file storage
- **Cloudinary**: Image processing and CDN for attendance photos
- **Replit**: Hosting platform with PostgreSQL module (unused but available)

### Key Libraries
- **Frontend**: React, TanStack Query, Wouter, Tailwind CSS, Radix UI
- **Backend**: Express.js, Firebase Admin SDK, Zod for validation
- **Development**: TypeScript, Vite, ESBuild
- **Charts**: Chart.js for dashboard analytics

### API Integrations
- Firebase Admin SDK for user management
- Geolocation APIs for attendance validation
- Cloudinary API for image uploads

## Deployment Strategy

### Development Environment
- **Command**: `npm run dev`
- **Port**: 5000 (configured in .replit)
- **Hot Reload**: Vite HMR for frontend, tsx watch for backend
- **Database**: Firestore with development project

### Production Build
- **Build Command**: `npm run build`
- **Frontend**: Vite builds to `dist/public`
- **Backend**: ESBuild bundles server to `dist/index.js`
- **Start Command**: `npm run start`

### Replit Configuration
- **Modules**: nodejs-20, web, postgresql-16 (for future use)
- **Deployment**: Autoscale target with external port 80
- **Environment**: All Firebase credentials via environment variables

### Environment Variables Required
```
FIREBASE_PROJECT_ID=solar-energy-56bc8
FIREBASE_PRIVATE_KEY=(service account private key)
FIREBASE_CLIENT_EMAIL=(service account email)
FIREBASE_STORAGE_BUCKET=solar-energy-56bc8.firebasestorage.app
CLOUDINARY_API_KEY=(for image uploads)
DATABASE_URL=(PostgreSQL URL - for future use)
```

## Changelog
- June 21, 2025: Implemented comprehensive enhanced attendance overtime system with early login detection, auto-checkout functionality (2-hour buffer), overtime management with approval workflows, and real-time monitoring capabilities
- June 20, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.