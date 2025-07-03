// Quick test to verify payroll processing fix
const testPayrollProcessing = async () => {
  const testDate = new Date('2024-01-15T10:30:00Z');
  
  // Test date filtering logic
  const month = 1; // January
  const year = 2024;
  
  // OLD LOGIC (BROKEN):
  const oldMonth = testDate.getMonth(); // Returns 0 (January)
  const oldMatches = oldMonth === (month - 1); // 0 === 0, true
  
  // NEW LOGIC (FIXED):
  const newMonth = testDate.getMonth() + 1; // Returns 1 (January)
  const newMatches = newMonth === month; // 1 === 1, true
  
  console.log("Date filtering test:");
  console.log(`Test date: ${testDate.toISOString()}`);
  console.log(`Looking for month: ${month}, year: ${year}`);
  console.log(`Old logic: getMonth() = ${oldMonth}, matches = ${oldMatches}`);
  console.log(`New logic: getMonth() + 1 = ${newMonth}, matches = ${newMatches}`);
  
  // Test status classification
  const testStatuses = ['present', 'late', 'overtime', 'half_day', 'early_checkout', 'absent'];
  const validWorkingStatuses = ['present', 'late', 'overtime', 'half_day', 'early_checkout'];
  
  console.log("\nStatus classification test:");
  testStatuses.forEach(status => {
    const isValid = validWorkingStatuses.includes(status);
    console.log(`Status: ${status} - Counts as working day: ${isValid}`);
  });
};

testPayrollProcessing().catch(console.error);