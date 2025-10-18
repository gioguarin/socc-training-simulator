const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test the invite code system
async function testInviteCodeSystem() {
    console.log('🧪 Testing Invite Code Authentication System...\n');

    try {
        // Test 1: Try to register without invite code
        console.log('Test 1: Registration without invite code');
        try {
            await axios.post(`${API_BASE}/auth/register`, {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
            console.log('❌ Should have failed');
        } catch (error) {
            console.log('✅ Correctly rejected:', error.response.data.error);
        }

        // Test 2: Try to register with invalid invite code
        console.log('\nTest 2: Registration with invalid invite code');
        try {
            await axios.post(`${API_BASE}/auth/register`, {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                inviteCode: 'INVALID123'
            });
            console.log('❌ Should have failed');
        } catch (error) {
            console.log('✅ Correctly rejected:', error.response.data.error);
        }

        // Test 3: Try to login with non-existent user
        console.log('\nTest 3: Login with non-existent user');
        try {
            await axios.post(`${API_BASE}/auth/login`, {
                email: 'nonexistent@example.com',
                password: 'password123'
            });
            console.log('❌ Should have failed');
        } catch (error) {
            console.log('✅ Correctly rejected:', error.response.data.error);
        }

        // Test 4: Check if admin invite code exists
        console.log('\nTest 4: Check admin invite code');
        try {
            const response = await axios.get(`${API_BASE}/admin/invite-codes`, {
                headers: {
                    // This would need a valid admin token in real testing
                    // For now, just test the endpoint exists
                }
            });
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Admin endpoint requires authentication');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        console.log('\n🎉 Invite Code System Tests Completed!');
        console.log('\n📝 Manual Testing Required:');
        console.log('1. Start the server: npm run dev');
        console.log('2. Open browser to http://localhost:3000');
        console.log('3. Try registering with invite code: ADMIN2024');
        console.log('4. Login with the created account');
        console.log('5. Access admin dashboard if admin role');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    testInviteCodeSystem();
}

module.exports = { testInviteCodeSystem };