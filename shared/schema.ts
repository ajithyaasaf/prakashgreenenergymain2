import { z } from "zod";

export const insertAttendanceSchema = z.object({
  userId: z.string(),
  date: z.date().optional(),
  checkInTime: z.date().optional(),
  checkOutTime: z.date().optional(),
  location: z.string().default("office"),
  customerId: z.number().optional(),
  reason: z.string().optional(),
  checkInLatitude: z.string().optional(),
  checkInLongitude: z.string().optional(),
  checkInImageUrl: z.string().optional(),
  checkOutLatitude: z.string().optional(),
  checkOutLongitude: z.string().optional(),
  checkOutImageUrl: z.string().optional(),
  status: z.string().default("pending"),
  overtimeHours: z.number().optional(),
  otReason: z.string().optional(),
});

export const insertOfficeLocationSchema = z.object({
  name: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  radius: z.number(),
});

export const insertPermissionSchema = z.object({
  userId: z.string(),
  month: z.date(),
  minutesUsed: z.number().default(0),
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
