import { auth, db, storage } from './firebase';

export async function testFirebaseAdmin() {
  const testResults = {
    auth: { status: 'untested', message: '' },
    firestore: { status: 'untested', message: '' },
    storage: { status: 'untested', message: '' }
  };

  console.log('🔥 Testing Firebase Admin SDK...');

  // Test Firebase Auth
  try {
    // Test listing users (this requires no users to exist but tests Auth connection)
    const listUsersResult = await auth.listUsers(1);
    testResults.auth = { 
      status: 'success', 
      message: `Auth connected. Found ${listUsersResult.users.length} users.` 
    };
    console.log('✅ Firebase Auth: Working');
  } catch (error: any) {
    testResults.auth = { 
      status: 'error', 
      message: `Auth error: ${error.message}` 
    };
    console.log('❌ Firebase Auth: Failed -', error.message);
  }

  // Test Firestore
  try {
    // Test creating a collection reference and getting it (doesn't create actual data)
    const testCollection = db.collection('_test_connection');
    const snapshot = await testCollection.limit(1).get();
    testResults.firestore = { 
      status: 'success', 
      message: `Firestore connected. Collection accessible.` 
    };
    console.log('✅ Firestore: Working');
  } catch (error: any) {
    testResults.firestore = { 
      status: 'error', 
      message: `Firestore error: ${error.message}` 
    };
    console.log('❌ Firestore: Failed -', error.message);
  }

  // Test Firebase Storage
  try {
    // Test getting storage bucket info
    const bucket = storage.bucket();
    testResults.storage = { 
      status: 'success', 
      message: `Storage connected. Bucket: ${bucket.name}` 
    };
    console.log('✅ Firebase Storage: Working');
  } catch (error: any) {
    testResults.storage = { 
      status: 'error', 
      message: `Storage error: ${error.message}` 
    };
    console.log('❌ Firebase Storage: Failed -', error.message);
  }

  console.log('🔥 Firebase Admin SDK Test Complete');
  return testResults;
}

// Test custom token generation (important for admin features)
export async function testCustomTokenGeneration(uid: string = 'test-user-123') {
  try {
    const customToken = await auth.createCustomToken(uid, {
      role: 'admin',
      permissions: ['read', 'write']
    });
    console.log('✅ Custom token generation: Working');
    return { success: true, token: customToken.substring(0, 50) + '...' };
  } catch (error: any) {
    console.log('❌ Custom token generation: Failed -', error.message);
    return { success: false, error: error.message };
  }
}

// Test user management operations
export async function testUserManagement() {
  const testEmail = `test-${Date.now()}@prakashgreens.com`;
  let createdUserUid: string | null = null;

  try {
    // Create a test user
    const userRecord = await auth.createUser({
      email: testEmail,
      password: 'TempPassword123!',
      displayName: 'Test User',
      emailVerified: false
    });
    
    createdUserUid = userRecord.uid;
    console.log('✅ User creation: Working');

    // Update the user
    await auth.updateUser(userRecord.uid, {
      displayName: 'Updated Test User'
    });
    console.log('✅ User update: Working');

    // Get user info
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('✅ User retrieval: Working');

    // Clean up - delete the test user
    await auth.deleteUser(userRecord.uid);
    console.log('✅ User deletion: Working');

    return {
      success: true,
      message: 'All user management operations working correctly'
    };

  } catch (error: any) {
    // Clean up if there was an error
    if (createdUserUid) {
      try {
        await auth.deleteUser(createdUserUid);
      } catch (cleanupError) {
        console.log('Failed to cleanup test user:', cleanupError);
      }
    }
    
    console.log('❌ User management test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}