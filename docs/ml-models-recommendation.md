# Machine Learning Models for Field Mapping

## Model Architecture Recommendations

### 1. Primary Recommendation: Transformer-Based Approach

#### Model: Custom Fine-tuned BERT/DistilBERT
```python
class FieldMappingTransformer(nn.Module):
    def __init__(self, bert_model_name='distilbert-base-uncased'):
        super().__init__()
        self.bert = AutoModel.from_pretrained(bert_model_name)
        self.classifier = nn.Sequential(
            nn.Linear(768, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(), 
            nn.Dropout(0.2),
            nn.Linear(256, 1),  # Binary classification score
            nn.Sigmoid()
        )
    
    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        cls_embedding = outputs.last_hidden_state[:, 0, :]
        similarity_score = self.classifier(cls_embedding)
        return similarity_score
```

**Training Strategy:**
- **Dataset**: Pairs of (document_field, form_field, match_label)
- **Loss Function**: Binary Cross-Entropy with class weights
- **Optimization**: AdamW with learning rate scheduling
- **Regularization**: Dropout + L2 regularization

**Advantages:**
- Context-aware semantic understanding
- Transfer learning capabilities
- High accuracy for complex field relationships
- Handles synonyms and variations naturally

**Performance Expectations:**
- Accuracy: 92-96%
- Inference time: ~50ms per field pair
- Memory: ~500MB for DistilBERT

### 2. Hybrid Ensemble Approach

#### Architecture
```python
class HybridFieldMapper:
    def __init__(self):
        self.transformer_model = FieldMappingTransformer()
        self.fuzzy_matcher = FuzzyStringMatcher()
        self.rule_engine = RuleBasedMatcher()
        self.meta_classifier = XGBoostClassifier()
    
    def predict(self, doc_field, form_field):
        # Get predictions from each component
        semantic_score = self.transformer_model.predict(doc_field, form_field)
        fuzzy_score = self.fuzzy_matcher.score(doc_field.name, form_field.name)
        rule_score = self.rule_engine.evaluate(doc_field, form_field)
        
        # Meta-learning: combine scores intelligently
        features = np.array([semantic_score, fuzzy_score, rule_score])
        final_confidence = self.meta_classifier.predict_proba(features.reshape(1, -1))
        
        return final_confidence[0][1]  # Probability of match
```

**Training Data Requirements:**
- 10,000+ labeled field pairs minimum
- Balanced positive/negative examples
- Domain-specific examples (HR, Finance, Legal, etc.)
- Multi-language support data if needed

### 3. Specialized Models by Domain

#### A. Financial Forms Model
```python
class FinancialFormMapper(FieldMappingTransformer):
    def __init__(self):
        super().__init__()
        # Pre-trained on financial terminology
        self.domain_vocab = FinancialVocabulary()
        self.amount_detector = CurrencyFieldDetector()
        self.date_validator = FinancialDateValidator()
    
    def enhanced_features(self, field_name, field_value):
        features = []
        
        # Financial-specific features
        features.append(self.amount_detector.is_currency(field_value))
        features.append(self.date_validator.is_fiscal_date(field_value))
        features.append(self.domain_vocab.similarity_score(field_name))
        
        return np.array(features)
```

#### B. Legal Forms Model
```python
class LegalFormMapper(FieldMappingTransformer):
    def __init__(self):
        super().__init__()
        self.legal_ner = LegalEntityRecognizer()
        self.citation_detector = CitationDetector()
        
    def extract_legal_features(self, text):
        # Extract legal-specific entities and patterns
        entities = self.legal_ner.extract(text)
        citations = self.citation_detector.find_citations(text)
        
        return {
            'has_legal_entities': len(entities) > 0,
            'has_citations': len(citations) > 0,
            'entity_types': [e.label_ for e in entities]
        }
```

### 4. Deep Learning Architecture Options

#### A. Siamese Network for Field Similarity
```python
class SiameseFieldMapper(nn.Module):
    def __init__(self, embedding_dim=300):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, 128, batch_first=True, bidirectional=True)
        self.fc = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )
    
    def forward_once(self, x):
        embedded = self.embedding(x)
        lstm_out, (hidden, _) = self.lstm(embedded)
        # Use final hidden state
        return hidden[-1]  # Take last layer, last direction
    
    def forward(self, input1, input2):
        output1 = self.forward_once(input1)
        output2 = self.forward_once(input2)
        
        # Calculate similarity
        diff = torch.abs(output1 - output2)
        similarity = self.fc(diff)
        return torch.sigmoid(similarity)
```

#### B. Multi-Task Learning Model
```python
class MultiTaskFieldMapper(nn.Module):
    def __init__(self):
        super().__init__()
        self.shared_encoder = BERTEncoder()
        
        # Task-specific heads
        self.similarity_head = SimilarityHead()
        self.type_classification_head = TypeClassificationHead()
        self.confidence_regression_head = ConfidenceRegressionHead()
    
    def forward(self, doc_field, form_field):
        # Shared representation
        doc_encoding = self.shared_encoder(doc_field)
        form_encoding = self.shared_encoder(form_field)
        
        # Multi-task outputs
        similarity = self.similarity_head(doc_encoding, form_encoding)
        field_types = self.type_classification_head(doc_encoding, form_encoding)
        confidence = self.confidence_regression_head(doc_encoding, form_encoding)
        
        return {
            'similarity': similarity,
            'field_types': field_types,
            'confidence': confidence
        }
```

### 5. Gradient Boosting Approach

#### XGBoost Feature Engineering
```python
class FeatureEngineeredMapper:
    def __init__(self):
        self.xgb_model = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8
        )
    
    def engineer_features(self, doc_field, form_field):
        features = []
        
        # String similarity features
        features.extend([
            fuzz.ratio(doc_field.name, form_field.name) / 100,
            fuzz.partial_ratio(doc_field.name, form_field.name) / 100,
            fuzz.token_sort_ratio(doc_field.name, form_field.name) / 100,
            fuzz.token_set_ratio(doc_field.name, form_field.name) / 100
        ])
        
        # Semantic features
        doc_embedding = self.get_word_embedding(doc_field.name)
        form_embedding = self.get_word_embedding(form_field.name)
        cosine_sim = cosine_similarity([doc_embedding], [form_embedding])[0][0]
        features.append(cosine_sim)
        
        # Structural features
        features.extend([
            len(doc_field.name),
            len(form_field.name),
            abs(len(doc_field.name) - len(form_field.name)),
            len(doc_field.name.split('_')),
            len(form_field.name.split('_'))
        ])
        
        # Type compatibility
        features.append(int(doc_field.type == form_field.type))
        
        # Position features
        if hasattr(doc_field, 'position') and hasattr(form_field, 'position'):
            pos_distance = np.linalg.norm(
                np.array(doc_field.position) - np.array(form_field.position)
            )
            features.append(pos_distance)
        
        return np.array(features)
```

### 6. Active Learning Pipeline

```python
class ActiveLearningMapper:
    def __init__(self):
        self.base_model = FieldMappingTransformer()
        self.uncertainty_sampler = UncertaintySampler()
        self.annotation_queue = AnnotationQueue()
    
    def active_learning_loop(self, unlabeled_data, annotation_budget):
        for iteration in range(annotation_budget // batch_size):
            # Select most uncertain examples
            uncertain_samples = self.uncertainty_sampler.select(
                unlabeled_data, batch_size=50
            )
            
            # Get human annotations
            annotations = self.get_human_annotations(uncertain_samples)
            
            # Retrain model
            self.base_model.fine_tune(annotations)
            
            # Update uncertainty estimates
            self.uncertainty_sampler.update_model(self.base_model)
    
    def uncertainty_score(self, doc_field, form_field):
        # Monte Carlo dropout for uncertainty estimation
        predictions = []
        for _ in range(10):  # 10 forward passes with dropout
            pred = self.base_model.predict_with_dropout(doc_field, form_field)
            predictions.append(pred)
        
        # Uncertainty as variance of predictions
        return np.var(predictions)
```

### 7. Model Deployment Considerations

#### A. Model Optimization
```python
class OptimizedFieldMapper:
    def __init__(self):
        # Use quantized model for faster inference
        self.model = torch.quantization.quantize_dynamic(
            FieldMappingTransformer(), 
            {torch.nn.Linear}, 
            dtype=torch.qint8
        )
        
        # Caching layer
        self.cache = LRUCache(maxsize=1000)
    
    def predict_with_cache(self, doc_field, form_field):
        cache_key = hash((doc_field.name, form_field.name))
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        prediction = self.model.predict(doc_field, form_field)
        self.cache[cache_key] = prediction
        
        return prediction
```

#### B. Batch Processing
```python
class BatchFieldMapper:
    def __init__(self, batch_size=32):
        self.model = FieldMappingTransformer()
        self.batch_size = batch_size
    
    def batch_predict(self, field_pairs):
        predictions = []
        
        for i in range(0, len(field_pairs), self.batch_size):
            batch = field_pairs[i:i + self.batch_size]
            
            # Batch tokenization
            doc_inputs = self.tokenizer([pair[0].name for pair in batch])
            form_inputs = self.tokenizer([pair[1].name for pair in batch])
            
            # Batch inference
            with torch.no_grad():
                batch_predictions = self.model(doc_inputs, form_inputs)
            
            predictions.extend(batch_predictions.cpu().numpy())
        
        return predictions
```

### 8. Performance Optimization Strategies

#### Model Distillation
```python
class DistilledFieldMapper:
    def __init__(self, teacher_model, student_model):
        self.teacher = teacher_model  # Large BERT model
        self.student = student_model  # Small LSTM model
        
    def distill(self, training_data):
        for batch in training_data:
            # Get teacher predictions (soft targets)
            with torch.no_grad():
                teacher_outputs = self.teacher(batch)
            
            # Train student to match teacher
            student_outputs = self.student(batch)
            
            # Distillation loss
            loss = F.kl_div(
                F.log_softmax(student_outputs / temperature, dim=1),
                F.softmax(teacher_outputs / temperature, dim=1),
                reduction='batchmean'
            )
            
            loss.backward()
            optimizer.step()
```

### 9. Evaluation Metrics and Benchmarks

```python
class FieldMappingEvaluator:
    def evaluate(self, model, test_data):
        metrics = {}
        
        # Accuracy metrics
        metrics['accuracy'] = accuracy_score(y_true, y_pred)
        metrics['precision'] = precision_score(y_true, y_pred)
        metrics['recall'] = recall_score(y_true, y_pred)
        metrics['f1'] = f1_score(y_true, y_pred)
        
        # Ranking metrics (for multiple candidates)
        metrics['mrr'] = mean_reciprocal_rank(rankings)
        metrics['ndcg'] = ndcg_score(y_true, y_scores)
        
        # Confidence calibration
        metrics['ece'] = expected_calibration_error(confidences, accuracies)
        
        # Domain-specific metrics
        metrics['exact_match_rate'] = exact_match_accuracy(y_true, y_pred)
        metrics['semantic_similarity'] = average_semantic_similarity(mappings)
        
        return metrics
```

## Recommended Implementation Approach

1. **Start with Hybrid Model**: Combine transformer + fuzzy matching + rules
2. **Incremental Training**: Use active learning to improve over time
3. **Domain Adaptation**: Fine-tune on specific form types
4. **Performance Monitoring**: Track accuracy and response times
5. **A/B Testing**: Compare model versions in production

The transformer-based hybrid approach provides the best balance of accuracy, interpretability, and performance for most use cases.