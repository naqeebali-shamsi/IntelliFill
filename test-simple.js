const http = require('http');

console.log('Testing QuikAdmin API...\n');

// Test health endpoint
const healthTest = () => new Promise((resolve) => {
  http.get('http://127.0.0.1:3001/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const result = JSON.parse(data);
      console.log('✅ Health Check:', result.status === 'ok' ? 'PASSED' : 'FAILED');
      console.log('   Response:', result);
      resolve();
    });
  }).on('error', (err) => {
    console.log('❌ Health Check: FAILED');
    console.log('   Error:', err.message);
    resolve();
  });
});

// Test login endpoint
const loginTest = () => new Promise((resolve) => {
  const postData = JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123'
  });

  const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const result = JSON.parse(data);
      console.log('\n✅ Login Test:', result.success ? 'PASSED' : 'FAILED');
      console.log('   Has tokens:', !!result.data?.tokens?.accessToken);
      resolve();
    });
  });

  req.on('error', (err) => {
    console.log('\n❌ Login Test: FAILED');
    console.log('   Error:', err.message);
    resolve();
  });

  req.write(postData);
  req.end();
});

// Run tests
(async () => {
  await healthTest();
  await loginTest();
  console.log('\n✅ All tests completed!');
})();