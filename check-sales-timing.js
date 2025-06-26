import admin from 'firebase-admin';

// Initialize Firebase if not already done
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    })
  });
}

const db = admin.firestore();

async function checkSalesTiming() {
  try {
    console.log('Checking all sales department timing records...');
    
    // Get all timing records for sales department
    const timingQuery = await db.collection('department_timings')
      .where('department', '==', 'sales')
      .get();
    
    if (timingQuery.empty) {
      console.log('No sales timing records found');
    } else {
      console.log(`Found ${timingQuery.size} sales timing record(s):`);
      timingQuery.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n--- Record ${index + 1} (ID: ${doc.id}) ---`);
        console.log('Department:', data.department);
        console.log('Check In Time:', data.checkInTime);
        console.log('Check Out Time:', data.checkOutTime);
        console.log('Allow Early Check Out:', data.allowEarlyCheckOut);
        console.log('Allow Late Check Out:', data.allowLateCheckOut);
        console.log('Overtime Multiplier:', data.overtimeMultiplier);
        console.log('Created At:', data.createdAt?.toDate());
        console.log('Updated At:', data.updatedAt?.toDate());
      });
    }
    
    // Also check departments collection
    console.log('\n=== Checking departments collection ===');
    const deptQuery = await db.collection('departments')
      .where('name', '==', 'sales')
      .get();
    
    if (!deptQuery.empty) {
      deptQuery.forEach(doc => {
        const data = doc.data();
        console.log('Department record:', data);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error checking timing:', error);
    process.exit(1);
  }
}

checkSalesTiming();