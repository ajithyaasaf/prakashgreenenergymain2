import { EnhancedAttendanceOvertimeService } from "./enhanced-attendance-overtime-service";

export class AttendanceScheduler {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Start the attendance scheduler
   * Runs every 5 minutes to check for auto-checkouts
   */
  static start(): void {
    if (this.isRunning) {
      console.log("Attendance scheduler already running");
      return;
    }

    console.log("Starting enhanced attendance scheduler...");
    
    // Run immediately on start
    this.processScheduledTasks();

    // Schedule to run every 5 minutes
    this.intervalId = setInterval(() => {
      this.processScheduledTasks();
    }, 5 * 60 * 1000); // 5 minutes

    this.isRunning = true;
    console.log("Enhanced attendance scheduler started successfully");
  }

  /**
   * Stop the attendance scheduler
   */
  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Enhanced attendance scheduler stopped");
  }

  /**
   * Process scheduled attendance tasks
   */
  private static async processScheduledTasks(): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] Running enhanced attendance scheduler...`);

      // Process enhanced auto checkouts
      const result = await EnhancedAttendanceOvertimeService.processEnhancedAutoCheckouts();
      
      if (result.processedCount > 0) {
        console.log(`Processed ${result.processedCount} enhanced auto checkouts:`, result.details);
      } else {
        console.log("No enhanced auto checkouts needed at this time");
      }

    } catch (error) {
      console.error("Error in enhanced attendance scheduler:", error);
    }
  }

  /**
   * Get scheduler status
   */
  static getStatus(): { isRunning: boolean; nextRun?: string } {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined
    };
  }

  /**
   * Manual trigger for testing
   */
  static async runNow(): Promise<any> {
    console.log("Manual trigger: Running enhanced attendance scheduler...");
    await this.processScheduledTasks();
    return { success: true, message: "Enhanced scheduler executed manually" };
  }
}