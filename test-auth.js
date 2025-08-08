#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testAuth() {
  console.log('🧪 Testing QuikAdmin Authentication System\n');
  
  // Test 1: Health Check
  console.log('1. Testing Health Endpoint...');
  try {
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check passed:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: Register User
  console.log('\n2. Testing User Registration...');
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123',
    username: `testuser${Date.now()}`,
    fullName: 'Test User'
  };
  
  let authToken = null;
  let refreshToken = null;
  
  try {
    const register = await axios.post(`${API_URL}/api/auth/register`, testUser);
    console.log('✅ Registration successful:', register.data);
    authToken = register.data.accessToken;
    refreshToken = register.data.refreshToken;
  } catch (error) {
    console.log('❌ Registration failed:', error.response?.data || error.message);
  }
  
  // Test 3: Login
  console.log('\n3. Testing User Login...');
  try {
    const login = await axios.post(`${API_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login successful:', login.data);
    authToken = login.data.accessToken;
    refreshToken = login.data.refreshToken;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data || error.message);
  }
  
  // Test 4: Get User Profile
  console.log('\n4. Testing Get User Profile...');
  if (authToken) {
    try {
      const profile = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Profile retrieved:', profile.data);
    } catch (error) {
      console.log('❌ Profile retrieval failed:', error.response?.data || error.message);
    }
  } else {
    console.log('⚠️  Skipping profile test - no auth token');
  }
  
  // Test 5: Refresh Token
  console.log('\n5. Testing Token Refresh...');
  if (refreshToken) {
    try {
      const refresh = await axios.post(`${API_URL}/api/auth/refresh`, {
        refreshToken
      });
      console.log('✅ Token refresh successful:', refresh.data);
    } catch (error) {
      console.log('❌ Token refresh failed:', error.response?.data || error.message);
    }
  } else {
    console.log('⚠️  Skipping refresh test - no refresh token');
  }
  
  console.log('\n✨ Authentication testing complete!');
}

testAuth().catch(console.error);