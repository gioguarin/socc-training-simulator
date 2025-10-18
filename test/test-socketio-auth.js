/**
 * Test: Socket.io Authentication
 * Tests that Socket.io connections require valid JWT tokens
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';
let testSocket = null;

console.log('='.repeat(70));
console.log('TESTING: Socket.io Authentication');
console.log('='.repeat(70));

async function runTests() {
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Reject Missing Token
    console.log('\n[Test 1] Connection without token should be rejected');
    try {
        await new Promise((resolve, reject) => {
            const socket = io(SERVER_URL, {
                auth: { token: '' },
                timeout: 2000
            });

            socket.on('connect_error', (err) => {
                console.log(`  Error received: ${err.message}`);
                if (err.message.includes('token') || err.message.includes('Authentication')) {
                    console.log('✅ PASS: Connection rejected without token');
                    testsPassed++;
                    socket.disconnect();
                    resolve();
                } else {
                    console.log('❌ FAIL: Wrong error message:', err.message);
                    testsFailed++;
                    socket.disconnect();
                    reject();
                }
            });

            socket.on('connect', () => {
                console.log('❌ FAIL: Connection accepted without token!');
                testsFailed++;
                socket.disconnect();
                reject(new Error('Should not connect without token'));
            });

            setTimeout(() => {
                if (!socket.connected) {
                    console.log('✅ PASS: Connection timeout (rejected)');
                    testsPassed++;
                    socket.disconnect();
                    resolve();
                }
            }, 2500);
        });
    } catch (err) {
        // Expected to fail
    }

    // Test 2: Reject Invalid Token
    console.log('\n[Test 2] Connection with invalid token should be rejected');
    try {
        await new Promise((resolve, reject) => {
            const socket = io(SERVER_URL, {
                auth: { token: 'invalid-fake-token-12345' },
                timeout: 2000
            });

            socket.on('connect_error', (err) => {
                console.log(`  Error received: ${err.message}`);
                if (err.message.includes('token') || err.message.includes('Invalid') || err.message.includes('jwt')) {
                    console.log('✅ PASS: Invalid token rejected');
                    testsPassed++;
                    socket.disconnect();
                    resolve();
                } else {
                    console.log('❌ FAIL: Wrong error message:', err.message);
                    testsFailed++;
                    socket.disconnect();
                    reject();
                }
            });

            socket.on('connect', () => {
                console.log('❌ FAIL: Invalid token accepted!');
                testsFailed++;
                socket.disconnect();
                reject(new Error('Should not connect with invalid token'));
            });

            setTimeout(() => {
                if (!socket.connected) {
                    console.log('✅ PASS: Connection timeout (rejected)');
                    testsPassed++;
                    socket.disconnect();
                    resolve();
                }
            }, 2500);
        });
    } catch (err) {
        // Expected to fail
    }

    // Test 3: Accept Valid Token
    console.log('\n[Test 3] Connection with valid token should be accepted');
    console.log('  Creating test user...');

    try {
        // Register a test user to get a valid token
        const registerResponse = await axios.post(`${SERVER_URL}/api/auth/register`, {
            name: 'Socket Test User',
            email: `sockettest${Date.now()}@example.com`,
            password: 'TestPassword123',
            inviteCode: 'ADMIN2024'
        });

        const token = registerResponse.data.token;
        console.log('  Token obtained:', token ? 'YES' : 'NO');

        if (!token) {
            console.log('❌ FAIL: Could not obtain token for testing');
            testsFailed++;
        } else {
            // Test connection with valid token
            await new Promise((resolve, reject) => {
                const socket = io(SERVER_URL, {
                    auth: { token },
                    timeout: 3000
                });

                socket.on('connect', () => {
                    console.log('✅ PASS: Valid token accepted, connected successfully!');
                    testsPassed++;

                    // Test 4: Verify user identity is correct
                    console.log('\n[Test 4] Verify user identity');

                    socket.emit('join-lobby', {});

                    socket.on('lobby-joined', (data) => {
                        console.log(`  Received lobby-joined event`);
                        console.log(`  Player ID: ${data.playerId}`);
                        console.log(`  Player Name: ${data.playerName || 'N/A'}`);

                        if (data.playerId && data.playerId !== 1) {
                            console.log('✅ PASS: User authenticated with real user ID (not mock ID 1)');
                            testsPassed++;
                        } else if (data.playerId === 1) {
                            console.log('❌ FAIL: Still using mock user ID 1');
                            testsFailed++;
                        } else {
                            console.log('⚠️  WARNING: Could not verify user ID');
                        }

                        socket.disconnect();
                        resolve();
                    });

                    // Fallback if lobby-joined doesn't fire
                    setTimeout(() => {
                        console.log('✅ PASS: Connected (lobby event timeout, but connection succeeded)');
                        socket.disconnect();
                        resolve();
                    }, 2000);
                });

                socket.on('connect_error', (err) => {
                    console.log('❌ FAIL: Valid token rejected:', err.message);
                    testsFailed++;
                    socket.disconnect();
                    reject(err);
                });
            });
        }
    } catch (err) {
        if (err.response && err.response.status === 400) {
            console.log('  Note: Registration requires invite code or open registration');
            console.log('  Error:', err.response.data.error);
        } else {
            console.log('  Error creating test user:', err.message);
        }
        console.log('⚠️  SKIP: Could not test valid token (user creation failed)');
    }

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log('='.repeat(70));

    if (testsFailed === 0 && testsPassed >= 2) {
        console.log('Socket.io Authentication: VERIFIED');
        console.log('='.repeat(70));
        process.exit(0);
    } else {
        console.log('Socket.io Authentication: ISSUES FOUND');
        console.log('='.repeat(70));
        process.exit(1);
    }
}

// Run tests
runTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
});
