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

async function findAllSalesConfigs() {
  try {
    console.log('=== SEARCHING ALL COLLECTIONS FOR SALES TIMING ===\n');
    
    // Check department_timings collection
    console.log('1. Checking department_timings collection...');
    const timingQuery = await db.collection('department_timings').get();
    if (!timingQuery.empty) {
      timingQuery.forEach(doc => {
        const data = doc.data();
        if (data.department === 'sales' || data.name === 'sales') {
          console.log(`Found in department_timings (${doc.id}):`, data);
        }
      });
    }
    
    // Check departments collection  
    console.log('\n2. Checking departments collection...');
    const deptQuery = await db.collection('departments').get();
    if (!deptQuery.empty) {
      deptQuery.forEach(doc => {
        const data = doc.data();
        if (data.name === 'sales' || data.department === 'sales') {
          console.log(`Found in departments (${doc.id}):`, data);
        }
      });
    }
    
    // Check any collection that might have timing info
    console.log('\n3. Checking for any document with sales timing...');
    const collections = ['department_timings', 'departments', 'settings', 'company_settings'];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        snapshot.forEach(doc => {
          const data = doc.data();
          const docString = JSON.stringify(data).toLowerCase();
          if (docString.includes('sales') && (docString.includes('checkin') || docString.includes('checkout') || docString.includes('time'))) {
            console.log(`Found timing-related sales data in ${collectionName} (${doc.id}):`, data);
          }
        });
      } catch (error) {
        // Collection might not exist, skip
      }
    }
    
    // Look for the original migration data
    console.log('\n4. Checking migration timing defaults...');
    // This would be in the migration script defaults
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error searching:', error);
    process.exit(1);
  }
}

findAllSalesConfigs();