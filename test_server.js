const express = require('express');
const app = express();
const PORT = 3006;

app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Test server running',
    timestamp: new Date().toISOString()
  });
});

// Mock auth endpoints for testing
app.post('/api/auth/register', (req, res) => {
  const { email, password, fullName } = req.body;
  
  if (!email || !password || !fullName) {
    return res.status(400).json({
      error: 'Email, password, and full name are required'
    });
  }
  
  // Mock successful registration
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: 'test-user-123',
        email: email,
        fullName: fullName,
        role: 'user',
        createdAt: new Date().toISOString()
      },
      tokens: {
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now()
      }
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Mock successful login
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: 'test-user-123',
        email: email,
        fullName: 'Test User',
        role: 'user'
      },
      tokens: {
        accessToken: 'mock-access-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now()
      }
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authorization token required'
    });
  }
  
  const token = authHeader.substring(7);
  
  if (!token.startsWith('mock-access-token-')) {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  // Mock user profile
  res.json({
    success: true,
    data: {
      user: {
        id: 'test-user-123',
        email: 'testuser@example.com',
        fullName: 'Test User',
        role: 'user',
        createdAt: '2025-08-08T16:00:00.000Z',
        lastLogin: new Date().toISOString()
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Mock QuikAdmin API server running on http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
});