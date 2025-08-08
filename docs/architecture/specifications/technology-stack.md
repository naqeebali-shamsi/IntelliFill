# Technology Stack Specification

## 1. Overview

This document outlines the comprehensive technology stack for the PDF-filler tool, including justifications for each technology choice, alternatives considered, and integration patterns.

## 2. Technology Selection Criteria

### 2.1 Evaluation Framework
- **Performance**: Processing speed and throughput requirements
- **Scalability**: Ability to handle increased load
- **Maintainability**: Code quality and developer experience
- **Community**: Ecosystem support and long-term viability
- **Cost**: Licensing and operational costs
- **Security**: Built-in security features and track record
- **Integration**: Compatibility with other stack components

### 2.2 Quality Attributes Priority
1. **Performance** (Critical): Sub-second response times
2. **Scalability** (Critical): 1000+ concurrent users
3. **Reliability** (High): 99.9% uptime
4. **Security** (High): Enterprise-grade security
5. **Maintainability** (Medium): Sustainable development
6. **Cost-effectiveness** (Medium): Reasonable TCO

## 3. Backend Services Architecture

### 3.1 Runtime Environment

#### Primary Choice: Node.js 20 LTS
```yaml
Technology: Node.js
Version: 20.x LTS
Justification:
  - Excellent PDF processing libraries (pdf-lib, pdf2pic)
  - Strong async/await support for I/O intensive operations
  - Rich ecosystem for document processing
  - TypeScript integration for type safety
  - High performance for concurrent operations

Alternatives Considered:
  - Python: Better ML libraries but slower for concurrent I/O
  - Java: More verbose, higher memory usage
  - Go: Limited document processing libraries

Key Libraries:
  - pdf-lib: PDF creation and manipulation
  - pdf-parse: PDF text extraction
  - sharp: Image processing
  - mammoth: DOCX processing
  - csv-parser: CSV processing
```

#### Secondary Runtime: Python 3.11
```yaml
Technology: Python
Version: 3.11+
Use Cases: ML/AI processing, OCR, NLP
Justification:
  - Superior ML/AI ecosystem (scikit-learn, transformers)
  - Best OCR libraries (pytesseract, easyocr)
  - Excellent NLP tools (spaCy, NLTK)
  - FastAPI for high-performance APIs

Key Libraries:
  - FastAPI: High-performance web framework
  - PyMuPDF: Advanced PDF processing
  - pytesseract: OCR capabilities
  - spaCy: NLP processing
  - transformers: Pre-trained ML models
```

### 3.2 Web Framework

#### Node.js Services: Express.js + TypeScript
```typescript
// Example service structure
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

const app = express()

// Security middleware
app.use(helmet())
app.use(compression())

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
}))

// Configuration
interface ServiceConfig {
  port: number
  database: DatabaseConfig
  redis: RedisConfig
  storage: StorageConfig
  monitoring: MonitoringConfig
}
```

#### Python Services: FastAPI
```python
# Example FastAPI service
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn

app = FastAPI(
    title="PDF Filler Intelligence Service",
    version="1.0.0",
    docs_url="/api/docs"
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.post("/api/v1/intelligence/map-fields")
async def map_fields(request: FieldMappingRequest):
    # Implementation
    pass
```

### 3.3 Document Processing Libraries

#### PDF Processing Stack
```yaml
Primary: pdf-lib (Node.js)
  Version: ^1.17.1
  Capabilities:
    - Create, modify, and fill PDF forms
    - AcroForm and XFA form support
    - Digital signatures
    - Form field manipulation
  Performance: ~50-100 docs/second

Secondary: PyMuPDF (Python)
  Version: ^1.23.0
  Capabilities:
    - Advanced text extraction
    - Layout analysis
    - Image extraction
    - Annotation handling
  Performance: ~100-200 docs/second

OCR: Tesseract.js + pytesseract
  Versions: tesseract.js@^4.1.0, pytesseract@^0.3.10
  Languages: 100+ supported languages
  Performance: ~5-10 pages/second
```

#### Office Document Processing
```yaml
DOCX: mammoth.js + python-docx
  Capabilities:
    - Text and formatting extraction
    - Table processing
    - Image extraction
    - Metadata handling

CSV: csv-parser + pandas
  Features:
    - Custom delimiter support
    - Type inference
    - Large file streaming
    - Data validation
```

## 4. Machine Learning and AI Stack

### 4.1 ML Framework Selection

#### Primary: Hugging Face Transformers
```python
# ML model configuration
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    pipeline
)

# Field classification model
class FieldClassifier:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(
            "bert-base-uncased"
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            "custom-field-classifier"
        )
    
    def classify_field(self, text: str) -> FieldType:
        # Implementation
        pass
```

#### Secondary: scikit-learn
```python
# Traditional ML for pattern recognition
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline

# Mapping confidence predictor
mapping_pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000)),
    ('classifier', RandomForestClassifier(n_estimators=100))
])
```

### 4.2 NLP Processing Stack

#### spaCy for Entity Recognition
```python
import spacy
from spacy import displacy

# Load pre-trained model
nlp = spacy.load("en_core_web_sm")

class EntityExtractor:
    def __init__(self):
        self.nlp = nlp
    
    def extract_entities(self, text: str) -> List[Entity]:
        doc = self.nlp(text)
        entities = []
        
        for ent in doc.ents:
            entities.append(Entity(
                text=ent.text,
                label=ent.label_,
                confidence=ent._.confidence if hasattr(ent._, 'confidence') else 0.8,
                start=ent.start_char,
                end=ent.end_char
            ))
        
        return entities
```

## 5. Database and Storage

### 5.1 Primary Database: PostgreSQL 15

#### Configuration and Schema
```sql
-- Database configuration for high performance
-- postgresql.conf optimizations
shared_buffers = '1GB'
effective_cache_size = '3GB'
maintenance_work_mem = '256MB'
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = '4MB'
min_wal_size = '1GB'
max_wal_size = '4GB'

-- Indexing strategy
CREATE INDEX CONCURRENTLY idx_jobs_status_created 
ON jobs(status, created_at) WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY idx_documents_format_state 
ON documents(format, state);

CREATE INDEX CONCURRENTLY idx_extracted_data_document_type 
ON extracted_data(document_id, extraction_type);
```

#### Connection Pooling
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

### 5.2 Caching: Redis 7.0

#### Redis Configuration
```yaml
# redis.conf optimizations
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
```

#### Multi-purpose Usage
```typescript
import Redis from 'ioredis'

// Redis cluster configuration
const redis = new Redis.Cluster([
  { host: 'redis-node-1', port: 6379 },
  { host: 'redis-node-2', port: 6379 },
  { host: 'redis-node-3', port: 6379 }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD
  }
})

// Usage patterns
class CacheService {
  // Session storage
  async setSession(sessionId: string, data: any): Promise<void> {
    await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(data))
  }
  
  // Job queues
  async enqueueJob(queue: string, job: any): Promise<void> {
    await redis.lpush(`queue:${queue}`, JSON.stringify(job))
  }
  
  // Document caching
  async cacheDocument(docId: string, data: any): Promise<void> {
    await redis.setex(`doc:${docId}`, 1800, JSON.stringify(data))
  }
}
```

### 5.3 Object Storage: MinIO / AWS S3

#### Storage Architecture
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

class StorageService {
  private s3Client: S3Client
  
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    })
  }
  
  async storeDocument(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: process.env.DOCUMENTS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    })
    
    await this.s3Client.send(command)
    return `s3://${process.env.DOCUMENTS_BUCKET}/${key}`
  }
}
```

## 6. Message Queue and Event Processing

### 6.1 Primary: Redis Queue (Bull)

#### Queue Configuration
```typescript
import Queue from 'bull'
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3
})

// Job queues
export const documentProcessingQueue = new Queue('document processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  defaultJobOptions: {
    delay: 0,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 10,
    removeOnFail: 5
  }
})

// Job processors
documentProcessingQueue.process('extract-data', 5, async (job) => {
  const { documentId, options } = job.data
  return await extractDocumentData(documentId, options)
})
```

### 6.2 Alternative: RabbitMQ (for complex routing)

#### RabbitMQ Setup
```typescript
import amqp from 'amqplib'

class MessageBroker {
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  
  async connect(): Promise<void> {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!)
    this.channel = await this.connection.createChannel()
    
    // Declare exchanges
    await this.channel.assertExchange('document.events', 'topic', { durable: true })
    await this.channel.assertExchange('processing.commands', 'direct', { durable: true })
  }
  
  async publishEvent(routingKey: string, event: any): Promise<void> {
    if (!this.channel) throw new Error('Not connected')
    
    await this.channel.publish(
      'document.events',
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    )
  }
}
```

## 7. API Gateway and Load Balancing

### 7.1 API Gateway: Kong

#### Kong Configuration
```yaml
# kong.yml
_format_version: "3.0"
_transform: true

services:
  - name: document-input-service
    url: http://document-input:3001
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          hour: 1000
      - name: prometheus
        config:
          per_consumer: true

  - name: intelligence-service
    url: http://intelligence:8000
    plugins:
      - name: rate-limiting
        config:
          minute: 50
          hour: 500

routes:
  - name: documents-route
    service: document-input-service
    paths: ["/api/v1/documents"]
  
  - name: intelligence-route
    service: intelligence-service
    paths: ["/api/v1/intelligence"]

plugins:
  - name: cors
    config:
      origins: ["*"]
      methods: ["GET", "POST", "PUT", "DELETE"]
      headers: ["Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Auth-Token"]
      exposed_headers: ["X-Auth-Token"]
      credentials: true
      max_age: 3600
```

### 7.2 Load Balancer: NGINX

#### NGINX Configuration
```nginx
# nginx.conf
upstream document_input_backend {
    server document-input-1:3001 weight=3;
    server document-input-2:3001 weight=3;
    server document-input-3:3001 weight=2;
    keepalive 32;
}

upstream intelligence_backend {
    server intelligence-1:8000 weight=3;
    server intelligence-2:8000 weight=3;
    keepalive 32;
}

server {
    listen 80;
    server_name api.pdffiller.com;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    location /api/v1/documents {
        proxy_pass http://document_input_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    location /api/v1/intelligence {
        proxy_pass http://intelligence_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Longer timeout for ML processing
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

## 8. Containerization and Orchestration

### 8.1 Docker Configuration

#### Multi-stage Dockerfile (Node.js)
```dockerfile
# Base image for Node.js services
FROM node:20-alpine AS base
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS dev
RUN npm ci
COPY . .
CMD ["dumb-init", "npm", "run", "dev"]

FROM base AS production
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN npm run build
USER node
CMD ["dumb-init", "node", "dist/index.js"]
```

#### Dockerfile (Python)
```dockerfile
# Base image for Python services
FROM python:3.11-slim AS base
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production
COPY . .
RUN useradd --create-home --shell /bin/bash app
USER app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 Kubernetes Deployment

#### Deployment Configuration
```yaml
# document-input-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: document-input-service
  labels:
    app: document-input-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: document-input-service
  template:
    metadata:
      labels:
        app: document-input-service
    spec:
      containers:
      - name: document-input
        image: pdffiller/document-input:v1.0.0
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: host
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: document-input-service
spec:
  selector:
    app: document-input-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: ClusterIP
```

## 9. Monitoring and Observability

### 9.1 Application Monitoring: Prometheus + Grafana

#### Metrics Collection
```typescript
import prometheus from 'prom-client'

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})

const documentProcessingDuration = new prometheus.Histogram({
  name: 'document_processing_duration_seconds',
  help: 'Duration of document processing in seconds',
  labelNames: ['document_type', 'processing_stage'],
  buckets: [1, 5, 10, 30, 60, 300, 600]
})

const documentProcessingTotal = new prometheus.Counter({
  name: 'documents_processed_total',
  help: 'Total number of documents processed',
  labelNames: ['document_type', 'status']
})
```

### 9.2 Logging: ELK Stack

#### Structured Logging Configuration
```typescript
import winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      },
      index: 'pdf-filler-logs'
    })
  ]
})
```

### 9.3 Distributed Tracing: Jaeger

#### OpenTelemetry Configuration
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT
})

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()
```

## 10. Development and CI/CD

### 10.1 Development Environment

#### Docker Compose for Local Development
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pdffiller_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  document-input:
    build:
      context: ./services/document-input
      target: dev
    ports:
      - "3001:3001"
    volumes:
      - ./services/document-input:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
      DB_HOST: postgres
      REDIS_HOST: redis

volumes:
  postgres_data:
  minio_data:
```

### 10.2 CI/CD Pipeline

#### GitHub Actions Configuration
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Build application
      run: npm run build

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build and push Docker images
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          pdffiller/app:latest
          pdffiller/app:${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/deployment.yaml
          k8s/service.yaml
```

## 11. Security Stack

### 11.1 Authentication and Authorization

#### JWT Implementation
```typescript
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

class AuthService {
  private jwtSecret = process.env.JWT_SECRET!
  private jwtExpiry = '24h'
  
  async generateToken(user: User): Promise<string> {
    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles
    }
    
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiry,
      issuer: 'pdf-filler-api',
      audience: 'pdf-filler-client'
    })
  }
  
  async verifyToken(token: string): Promise<JWTPayload> {
    return jwt.verify(token, this.jwtSecret) as JWTPayload
  }
}
```

### 11.2 Input Validation and Sanitization

#### Validation Schema
```typescript
import Joi from 'joi'
import DOMPurify from 'isomorphic-dompurify'

const documentUploadSchema = Joi.object({
  filename: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+\.(pdf|docx|txt|csv)$/)
    .max(255)
    .required(),
  
  size: Joi.number()
    .max(50 * 1024 * 1024) // 50MB limit
    .required(),
  
  metadata: Joi.object({
    title: Joi.string().max(500).optional(),
    description: Joi.string().max(1000).optional()
  }).optional()
})

class ValidationService {
  sanitizeInput(input: string): string {
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    })
  }
}
```

## 12. Performance Optimization

### 12.1 Caching Strategy Summary

```typescript
// Multi-level caching implementation
class CacheManager {
  private l1Cache = new Map<string, CacheEntry>() // In-memory
  private l2Cache: Redis // Distributed
  private l3Cache: StorageCache // Persistent
  
  async get<T>(key: string): Promise<T | null> {
    // L1: Check in-memory cache
    const l1Result = this.l1Cache.get(key)
    if (l1Result && !this.isExpired(l1Result)) {
      return l1Result.value
    }
    
    // L2: Check Redis cache
    const l2Result = await this.l2Cache.get(key)
    if (l2Result) {
      this.l1Cache.set(key, {
        value: JSON.parse(l2Result),
        expiry: Date.now() + 300000
      })
      return JSON.parse(l2Result)
    }
    
    // L3: Check persistent cache
    return await this.l3Cache.get(key)
  }
}
```

### 12.2 Database Optimization

```sql
-- Performance optimization indexes
CREATE INDEX CONCURRENTLY idx_jobs_status_priority 
ON jobs(status, priority, created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY idx_documents_created_format 
ON documents(created_at, format) 
WHERE state = 'ready';

-- Partitioning for large tables
CREATE TABLE jobs_partitioned (LIKE jobs INCLUDING ALL);
CREATE TABLE jobs_2024_q1 PARTITION OF jobs_partitioned 
FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

This comprehensive technology stack provides a robust foundation for the PDF-filler tool, with careful consideration of performance, scalability, security, and maintainability requirements. Each technology choice is justified based on specific use cases and requirements, with clear alternatives documented for future considerations.