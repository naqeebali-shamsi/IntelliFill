const request = require('supertest');

describe('Auth API Tests', () => {
  const API_URL = 'http://127.0.0.1:3001';
  
  test('Health check endpoint should return 200', async () => {
    const response = await request(API_URL)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('environment', 'development');
  });

  test('Login should require email and password', async () => {
    const response = await request(API_URL)
      .post('/api/auth/login')
      .send({})
      .expect(400);
    
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('required');
  });

  test('Login with valid credentials should return tokens', async () => {
    const response = await request(API_URL)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('tokens');
    expect(response.body.data.tokens).toHaveProperty('accessToken');
    expect(response.body.data.tokens).toHaveProperty('refreshToken');
  });

  test('Login with invalid credentials should return 401', async () => {
    const response = await request(API_URL)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'wrongpassword'
      })
      .expect(401);
    
    expect(response.body).toHaveProperty('error');
  });
});