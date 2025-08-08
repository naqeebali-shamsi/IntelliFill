# Integration Guide: Intelligent Field Mapping Algorithm

## Quick Start Integration

### Installation and Setup

#### Dependencies
```bash
# Core dependencies
pip install rapidfuzz transformers torch sklearn spacy numpy pandas

# Optional dependencies for enhanced features
pip install redis postgresql-adapter sqlalchemy

# Download spaCy model
python -m spacy download en_core_web_sm
```

#### Basic Setup
```python
from src.algorithms.field_mapping_core import IntelligentFieldMapper
from src.algorithms.field_mapping_core import DocumentField, FormField, FieldType

# Initialize mapper with default configuration
mapper = IntelligentFieldMapper()

# Or with custom configuration
config = {
    "similarity_threshold": 0.7,
    "confidence_threshold": 0.6,
    "enable_semantic_matching": True,
    "enable_fuzzy_matching": True,
    "enable_rule_based": True
}
mapper = IntelligentFieldMapper(config)
```

### Basic Usage Example
```python
# Define document fields (extracted from your document)
doc_fields = [
    DocumentField("applicant_first_name", "John", FieldType.NAME),
    DocumentField("applicant_last_name", "Doe", FieldType.NAME),
    DocumentField("email_address", "john.doe@example.com", FieldType.EMAIL),
    DocumentField("phone_number", "555-123-4567", FieldType.PHONE)
]

# Define form fields (from your PDF form)
form_fields = [
    FormField("firstName", FieldType.NAME, required=True),
    FormField("lastName", FieldType.NAME, required=True), 
    FormField("emailAddr", FieldType.EMAIL, required=True),
    FormField("phoneNum", FieldType.PHONE)
]

# Perform mapping
mappings = mapper.map_fields(doc_fields, form_fields)

# Process results
for mapping in mappings:
    print(f"Map '{mapping.source_field}' to '{mapping.target_field}' "
          f"(confidence: {mapping.confidence_score:.3f})")
```

## API Integration Patterns

### REST API Wrapper
```python
from flask import Flask, request, jsonify
from typing import List, Dict

app = Flask(__name__)
mapper = IntelligentFieldMapper()

@app.route('/api/v1/map-fields', methods=['POST'])
def map_fields_api():
    try:
        data = request.json
        
        # Convert API input to internal format
        doc_fields = [
            DocumentField(
                name=field['name'],
                value=field.get('value', ''),
                field_type=FieldType(field.get('type', 'text'))
            ) for field in data['document_fields']
        ]
        
        form_fields = [
            FormField(
                name=field['name'],
                field_type=FieldType(field.get('type', 'text')),
                required=field.get('required', False)
            ) for field in data['form_fields']
        ]
        
        # Perform mapping
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Convert results to API format
        result = {
            'status': 'success',
            'mappings': [
                {
                    'source_field': m.source_field,
                    'target_field': m.target_field,
                    'confidence': m.confidence_score,
                    'field_type': m.field_type.value,
                    'strategy': m.matching_strategy.value
                } for m in mappings
            ],
            'metadata': {
                'total_document_fields': len(doc_fields),
                'total_form_fields': len(form_fields),
                'successful_mappings': len(mappings)
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/v1/validate-mapping', methods=['POST'])
def validate_mapping():
    """Validate a specific field mapping"""
    try:
        data = request.json
        mapping_data = data['mapping']
        value = data.get('value')
        
        # Create mapping object
        mapping = FieldMapping(
            source_field=mapping_data['source_field'],
            target_field=mapping_data['target_field'],
            confidence_score=mapping_data['confidence'],
            field_type=FieldType(mapping_data['field_type']),
            matching_strategy=MatchingStrategy(mapping_data['strategy'])
        )
        
        # Validate data type if value provided
        is_valid = True
        if value:
            is_valid = mapper.validate_data_types(mapping, value)
        
        return jsonify({
            'status': 'success',
            'is_valid': is_valid,
            'field_type': mapping.field_type.value
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=8080)
```

### Async Processing with Celery
```python
from celery import Celery
import json

celery_app = Celery('field_mapper', broker='redis://localhost:6379/0')

@celery_app.task(bind=True)
def map_fields_async(self, doc_fields_data, form_fields_data, task_id=None):
    """Asynchronous field mapping task"""
    try:
        # Initialize mapper
        mapper = IntelligentFieldMapper()
        
        # Convert data to internal format
        doc_fields = [DocumentField(**field) for field in doc_fields_data]
        form_fields = [FormField(**field) for field in form_fields_data]
        
        # Update task progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 0, 'total': len(doc_fields), 'status': 'Starting...'}
        )
        
        # Perform mapping with progress updates
        mappings = []
        for i, doc_field in enumerate(doc_fields):
            field_mappings = mapper._find_mapping_candidates(
                doc_field, form_fields, 
                mapper._compute_similarity_matrices([doc_field.name], [f.name for f in form_fields]),
                0
            )
            mappings.extend(field_mappings)
            
            # Update progress
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1, 
                    'total': len(doc_fields),
                    'status': f'Processed {doc_field.name}'
                }
            )
        
        # Return results
        result = {
            'status': 'completed',
            'mappings': [
                {
                    'source_field': m.source_field,
                    'target_field': m.target_field,
                    'confidence': m.confidence_score,
                    'field_type': m.field_type.value
                } for m in mappings
            ]
        }
        
        return result
        
    except Exception as e:
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
```

## Framework-Specific Integrations

### Django Integration
```python
# models.py
from django.db import models
import json

class FieldMappingJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.AutoField(primary_key=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    document_fields = models.JSONField()
    form_fields = models.JSONField()
    mappings = models.JSONField(null=True, blank=True)
    confidence_threshold = models.FloatField(default=0.6)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

@csrf_exempt
@require_http_methods(["POST"])
def create_mapping_job(request):
    try:
        data = json.loads(request.body)
        
        # Create job record
        job = FieldMappingJob.objects.create(
            document_fields=data['document_fields'],
            form_fields=data['form_fields'],
            confidence_threshold=data.get('confidence_threshold', 0.6)
        )
        
        # Process asynchronously
        map_fields_async.delay(
            job.document_fields,
            job.form_fields,
            job.id
        )
        
        return JsonResponse({
            'job_id': job.id,
            'status': 'submitted'
        })
        
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)

@require_http_methods(["GET"])
def get_mapping_result(request, job_id):
    try:
        job = FieldMappingJob.objects.get(id=job_id)
        
        response_data = {
            'job_id': job.id,
            'status': job.status,
            'created_at': job.created_at.isoformat()
        }
        
        if job.status == 'completed':
            response_data['mappings'] = job.mappings
            response_data['completed_at'] = job.completed_at.isoformat()
        elif job.status == 'failed':
            response_data['error'] = job.error_message
            
        return JsonResponse(response_data)
        
    except FieldMappingJob.DoesNotExist:
        return JsonResponse({'error': 'Job not found'}, status=404)
```

### FastAPI Integration
```python
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import asyncio

app = FastAPI(title="Field Mapping API", version="1.0.0")

class DocumentFieldModel(BaseModel):
    name: str
    value: Optional[str] = ""
    field_type: str = "text"
    context: Optional[str] = ""

class FormFieldModel(BaseModel):
    name: str
    field_type: str = "text"
    required: bool = False
    options: List[str] = []

class MappingRequest(BaseModel):
    document_fields: List[DocumentFieldModel]
    form_fields: List[FormFieldModel]
    config: Optional[dict] = {}

class MappingResponse(BaseModel):
    mappings: List[dict]
    metadata: dict
    processing_time: float

@app.post("/v1/map-fields", response_model=MappingResponse)
async def map_fields_endpoint(request: MappingRequest):
    import time
    start_time = time.time()
    
    try:
        # Initialize mapper with custom config
        config = {
            "similarity_threshold": 0.7,
            "confidence_threshold": 0.6,
            **request.config
        }
        mapper = IntelligentFieldMapper(config)
        
        # Convert Pydantic models to internal format
        doc_fields = [
            DocumentField(
                name=field.name,
                value=field.value,
                field_type=FieldType(field.field_type),
                context=field.context
            ) for field in request.document_fields
        ]
        
        form_fields = [
            FormField(
                name=field.name,
                field_type=FieldType(field.field_type),
                required=field.required,
                options=field.options
            ) for field in request.form_fields
        ]
        
        # Perform mapping
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        processing_time = time.time() - start_time
        
        return MappingResponse(
            mappings=[
                {
                    'source_field': m.source_field,
                    'target_field': m.target_field,
                    'confidence': m.confidence_score,
                    'field_type': m.field_type.value,
                    'strategy': m.matching_strategy.value,
                    'metadata': m.metadata
                } for m in mappings
            ],
            metadata={
                'total_document_fields': len(doc_fields),
                'total_form_fields': len(form_fields),
                'successful_mappings': len(mappings),
                'average_confidence': sum(m.confidence_score for m in mappings) / len(mappings) if mappings else 0
            },
            processing_time=processing_time
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

# Batch processing endpoint
@app.post("/v1/map-fields-batch")
async def map_fields_batch(
    requests: List[MappingRequest],
    background_tasks: BackgroundTasks
):
    job_ids = []
    
    for i, request in enumerate(requests):
        job_id = f"batch_{int(time.time())}_{i}"
        background_tasks.add_task(
            process_mapping_job, job_id, request
        )
        job_ids.append(job_id)
    
    return {"job_ids": job_ids, "status": "submitted"}

async def process_mapping_job(job_id: str, request: MappingRequest):
    # Implementation for background processing
    pass
```

## Database Integration

### PostgreSQL Schema Setup
```sql
-- Field patterns table
CREATE TABLE field_patterns (
    id SERIAL PRIMARY KEY,
    source_pattern VARCHAR(255) NOT NULL,
    target_pattern VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    confidence_boost DECIMAL(3,2) DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Mapping history table
CREATE TABLE mapping_history (
    id SERIAL PRIMARY KEY,
    source_field_name VARCHAR(255) NOT NULL,
    target_field_name VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    validation_result BOOLEAN,
    user_feedback INTEGER, -- 1=good, 0=bad, null=no feedback
    document_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    processing_time_ms INTEGER NOT NULL,
    num_document_fields INTEGER NOT NULL,
    num_form_fields INTEGER NOT NULL,
    successful_mappings INTEGER NOT NULL,
    average_confidence DECIMAL(5,4),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_field_patterns_source ON field_patterns(source_pattern);
CREATE INDEX idx_field_patterns_target ON field_patterns(target_pattern);
CREATE INDEX idx_mapping_history_names ON mapping_history(source_field_name, target_field_name);
CREATE INDEX idx_performance_timestamp ON performance_metrics(timestamp);
```

### Database Integration Class
```python
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class FieldPattern(Base):
    __tablename__ = 'field_patterns'
    
    id = Column(Integer, primary_key=True)
    source_pattern = Column(String(255), nullable=False)
    target_pattern = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)
    confidence_boost = Column(Float, default=0.0)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class MappingHistory(Base):
    __tablename__ = 'mapping_history'
    
    id = Column(Integer, primary_key=True)
    source_field_name = Column(String(255), nullable=False)
    target_field_name = Column(String(255), nullable=False)
    confidence_score = Column(Float, nullable=False)
    field_type = Column(String(50), nullable=False)
    strategy = Column(String(50), nullable=False)
    validation_result = Column(Boolean)
    user_feedback = Column(Integer)
    document_type = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class DatabaseIntegratedMapper(IntelligentFieldMapper):
    def __init__(self, config=None, db_url=None):
        super().__init__(config)
        
        if db_url:
            self.engine = create_engine(db_url)
            self.SessionLocal = sessionmaker(bind=self.engine)
            Base.metadata.create_all(bind=self.engine)
    
    def map_fields_with_history(self, doc_fields, form_fields, document_type=None):
        """Map fields and store results in database"""
        mappings = self.map_fields(doc_fields, form_fields)
        
        # Store mapping history
        if hasattr(self, 'engine'):
            self._store_mapping_history(mappings, document_type)
        
        return mappings
    
    def _store_mapping_history(self, mappings, document_type):
        """Store mapping results in database"""
        session = self.SessionLocal()
        
        try:
            for mapping in mappings:
                history_record = MappingHistory(
                    source_field_name=mapping.source_field,
                    target_field_name=mapping.target_field,
                    confidence_score=mapping.confidence_score,
                    field_type=mapping.field_type.value,
                    strategy=mapping.matching_strategy.value,
                    document_type=document_type
                )
                session.add(history_record)
            
            session.commit()
            
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_successful_patterns(self, min_usage_count=5):
        """Retrieve successful patterns from database"""
        if not hasattr(self, 'engine'):
            return []
        
        session = self.SessionLocal()
        
        try:
            patterns = session.query(FieldPattern)\
                .filter(FieldPattern.usage_count >= min_usage_count)\
                .order_by(FieldPattern.confidence_boost.desc())\
                .all()
            
            return patterns
            
        finally:
            session.close()
```

## Microservices Architecture

### Docker Configuration
```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Docker Compose for Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  field-mapper:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/fieldmapper
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    volumes:
      - ./models:/app/models  # Mount model directory

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: fieldmapper
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - field-mapper

volumes:
  postgres_data:
```

### Kubernetes Deployment
```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: field-mapper
spec:
  replicas: 3
  selector:
    matchLabels:
      app: field-mapper
  template:
    metadata:
      labels:
        app: field-mapper
    spec:
      containers:
      - name: field-mapper
        image: field-mapper:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: field-mapper-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: field-mapper-service
spec:
  selector:
    app: field-mapper
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

## Testing Integration

### Unit Test Setup
```python
# test_integration.py
import pytest
from unittest.mock import Mock, patch
from your_app import create_app, db

@pytest.fixture
def client():
    app = create_app(testing=True)
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_map_fields_endpoint(client):
    """Test the map fields API endpoint"""
    payload = {
        "document_fields": [
            {"name": "first_name", "value": "John", "field_type": "name"}
        ],
        "form_fields": [
            {"name": "firstName", "field_type": "name", "required": True}
        ]
    }
    
    response = client.post('/api/v1/map-fields', 
                          json=payload,
                          content_type='application/json')
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'success'
    assert len(data['mappings']) >= 1

def test_batch_processing_endpoint(client):
    """Test batch processing functionality"""
    payload = [
        {
            "document_fields": [{"name": "email", "field_type": "email"}],
            "form_fields": [{"name": "emailAddr", "field_type": "email"}]
        }
    ] * 5  # Batch of 5 requests
    
    response = client.post('/api/v1/map-fields-batch', 
                          json=payload,
                          content_type='application/json')
    
    assert response.status_code == 200
    data = response.get_json()
    assert len(data['job_ids']) == 5
```

This comprehensive integration guide provides multiple pathways for incorporating the intelligent field mapping algorithm into various application architectures and frameworks.