"""
Intelligent Field Mapping Algorithm - Core Implementation
========================================================

This module implements an intelligent field mapping system that matches
document data to PDF form fields using multiple techniques including
NLP, fuzzy matching, ML classification, and rule-based systems.
"""

import re
import json
import logging
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from rapidfuzz import fuzz, process
from transformers import AutoTokenizer, AutoModel
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import spacy

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FieldType(Enum):
    """Enumeration of supported field types"""
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    DATE = "date"
    NUMBER = "number"
    CURRENCY = "currency"
    ADDRESS = "address"
    NAME = "name"
    BOOLEAN = "boolean"
    SIGNATURE = "signature"
    UNKNOWN = "unknown"

class MatchingStrategy(Enum):
    """Enumeration of matching strategies"""
    EXACT = "exact"
    FUZZY = "fuzzy"
    SEMANTIC = "semantic"
    RULE_BASED = "rule_based"
    ML_CLASSIFICATION = "ml_classification"
    HYBRID = "hybrid"

@dataclass
class FieldMapping:
    """Represents a mapping between document data and form field"""
    source_field: str
    target_field: str
    confidence_score: float
    field_type: FieldType
    matching_strategy: MatchingStrategy
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DocumentField:
    """Represents a field extracted from a document"""
    name: str
    value: Any
    field_type: FieldType
    context: str = ""
    position: Tuple[int, int] = (0, 0)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class FormField:
    """Represents a field in a PDF form"""
    name: str
    field_type: FieldType
    required: bool = False
    options: List[str] = field(default_factory=list)
    validation_pattern: str = ""
    position: Tuple[int, int] = (0, 0)
    metadata: Dict[str, Any] = field(default_factory=dict)

class IntelligentFieldMapper:
    """
    Core intelligent field mapping algorithm implementation
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the field mapper with configuration"""
        self.config = config or self._get_default_config()
        self.nlp_model = None
        self.tokenizer = None
        self.bert_model = None
        self.tfidf_vectorizer = None
        self.spacy_nlp = None
        
        # Initialize components based on configuration
        self._initialize_components()
        
        # Pattern repositories
        self.field_patterns = self._load_field_patterns()
        self.mapping_rules = self._load_mapping_rules()
        
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration"""
        return {
            "similarity_threshold": 0.7,
            "confidence_threshold": 0.6,
            "enable_semantic_matching": True,
            "enable_fuzzy_matching": True,
            "enable_rule_based": True,
            "fuzzy_ratio_weight": 0.3,
            "semantic_weight": 0.4,
            "rule_weight": 0.3,
            "bert_model_name": "distilbert-base-uncased",
            "spacy_model": "en_core_web_sm",
            "max_suggestions": 5
        }
    
    def _initialize_components(self):
        """Initialize NLP and ML components"""
        try:
            if self.config.get("enable_semantic_matching"):
                # Initialize BERT model for semantic similarity
                model_name = self.config["bert_model_name"]
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.bert_model = AutoModel.from_pretrained(model_name)
                
                # Initialize spaCy for NLP processing
                spacy_model = self.config["spacy_model"]
                self.spacy_nlp = spacy.load(spacy_model)
                
                # Initialize TF-IDF vectorizer
                self.tfidf_vectorizer = TfidfVectorizer(
                    stop_words='english',
                    ngram_range=(1, 2),
                    max_features=1000
                )
                
            logger.info("NLP components initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize NLP components: {e}")
            # Fallback to basic matching only
            self.config["enable_semantic_matching"] = False
    
    def map_fields(self, 
                   document_fields: List[DocumentField], 
                   form_fields: List[FormField]) -> List[FieldMapping]:
        """
        Main method to map document fields to form fields
        
        Args:
            document_fields: List of fields extracted from document
            form_fields: List of fields from PDF form
            
        Returns:
            List of field mappings with confidence scores
        """
        mappings = []
        
        # Create field name matrices for batch processing
        doc_field_names = [field.name for field in document_fields]
        form_field_names = [field.name for field in form_fields]
        
        # Compute similarity matrices
        similarity_matrices = self._compute_similarity_matrices(
            doc_field_names, form_field_names
        )
        
        # Process each document field
        for i, doc_field in enumerate(document_fields):
            candidates = self._find_mapping_candidates(
                doc_field, form_fields, similarity_matrices, i
            )
            
            if candidates:
                # Select best mapping based on confidence score
                best_mapping = max(candidates, key=lambda x: x.confidence_score)
                
                if best_mapping.confidence_score >= self.config["confidence_threshold"]:
                    mappings.append(best_mapping)
                    logger.info(f"Mapped '{doc_field.name}' to '{best_mapping.target_field}' "
                              f"with confidence {best_mapping.confidence_score:.3f}")
        
        # Handle edge cases and conflicts
        mappings = self._resolve_mapping_conflicts(mappings)
        
        return mappings
    
    def _compute_similarity_matrices(self, 
                                   doc_fields: List[str], 
                                   form_fields: List[str]) -> Dict[str, np.ndarray]:
        """Compute various similarity matrices between field names"""
        matrices = {}
        
        # Fuzzy matching matrix
        if self.config.get("enable_fuzzy_matching"):
            matrices["fuzzy"] = self._compute_fuzzy_matrix(doc_fields, form_fields)
        
        # Semantic similarity matrix
        if self.config.get("enable_semantic_matching") and self.bert_model:
            matrices["semantic"] = self._compute_semantic_matrix(doc_fields, form_fields)
        
        # Rule-based matching matrix
        if self.config.get("enable_rule_based"):
            matrices["rule_based"] = self._compute_rule_based_matrix(doc_fields, form_fields)
        
        return matrices
    
    def _compute_fuzzy_matrix(self, doc_fields: List[str], form_fields: List[str]) -> np.ndarray:
        """Compute fuzzy string similarity matrix"""
        matrix = np.zeros((len(doc_fields), len(form_fields)))
        
        for i, doc_field in enumerate(doc_fields):
            for j, form_field in enumerate(form_fields):
                # Combine multiple fuzzy metrics
                ratio = fuzz.ratio(doc_field.lower(), form_field.lower()) / 100
                partial_ratio = fuzz.partial_ratio(doc_field.lower(), form_field.lower()) / 100
                token_sort_ratio = fuzz.token_sort_ratio(doc_field.lower(), form_field.lower()) / 100
                
                # Weighted average of fuzzy metrics
                matrix[i, j] = (ratio * 0.4 + partial_ratio * 0.3 + token_sort_ratio * 0.3)
        
        return matrix
    
    def _compute_semantic_matrix(self, doc_fields: List[str], form_fields: List[str]) -> np.ndarray:
        """Compute semantic similarity matrix using BERT embeddings"""
        matrix = np.zeros((len(doc_fields), len(form_fields)))
        
        try:
            # Get embeddings for all fields
            doc_embeddings = self._get_bert_embeddings(doc_fields)
            form_embeddings = self._get_bert_embeddings(form_fields)
            
            # Compute cosine similarity
            matrix = cosine_similarity(doc_embeddings, form_embeddings)
            
        except Exception as e:
            logger.error(f"Failed to compute semantic similarity: {e}")
            # Fallback to TF-IDF similarity
            matrix = self._compute_tfidf_similarity(doc_fields, form_fields)
        
        return matrix
    
    def _get_bert_embeddings(self, texts: List[str]) -> np.ndarray:
        """Get BERT embeddings for a list of texts"""
        embeddings = []
        
        for text in texts:
            # Tokenize and encode
            inputs = self.tokenizer(text, return_tensors="pt", 
                                  padding=True, truncation=True, max_length=512)
            
            # Get embeddings
            with torch.no_grad():
                outputs = self.bert_model(**inputs)
                # Use CLS token embedding
                embedding = outputs.last_hidden_state[:, 0, :].squeeze().numpy()
                embeddings.append(embedding)
        
        return np.array(embeddings)
    
    def _compute_tfidf_similarity(self, doc_fields: List[str], form_fields: List[str]) -> np.ndarray:
        """Compute TF-IDF based similarity as fallback"""
        all_fields = doc_fields + form_fields
        tfidf_matrix = self.tfidf_vectorizer.fit_transform(all_fields)
        
        doc_matrix = tfidf_matrix[:len(doc_fields)]
        form_matrix = tfidf_matrix[len(doc_fields):]
        
        return cosine_similarity(doc_matrix, form_matrix)
    
    def _compute_rule_based_matrix(self, doc_fields: List[str], form_fields: List[str]) -> np.ndarray:
        """Compute rule-based matching scores"""
        matrix = np.zeros((len(doc_fields), len(form_fields)))
        
        for i, doc_field in enumerate(doc_fields):
            for j, form_field in enumerate(form_fields):
                score = self._apply_mapping_rules(doc_field, form_field)
                matrix[i, j] = score
        
        return matrix
    
    def _apply_mapping_rules(self, doc_field: str, form_field: str) -> float:
        """Apply rule-based mapping logic"""
        score = 0.0
        doc_lower = doc_field.lower()
        form_lower = form_field.lower()
        
        # Exact match
        if doc_lower == form_lower:
            return 1.0
        
        # Common field patterns
        patterns = [
            # Name variations
            (r'(first|given).*name', r'(first|given).*name'),
            (r'(last|family|sur).*name', r'(last|family|sur).*name'),
            (r'full.*name', r'(full|complete).*name'),
            
            # Contact information
            (r'email.*address', r'email'),
            (r'phone.*number', r'phone'),
            (r'mobile.*number', r'(mobile|cell)'),
            
            # Address components
            (r'street.*address', r'(street|address)'),
            (r'city', r'city'),
            (r'state', r'state'),
            (r'zip.*code', r'(zip|postal)'),
            
            # Date fields
            (r'birth.*date', r'(birth|dob)'),
            (r'date.*birth', r'(birth|dob)'),
            
            # Financial fields
            (r'salary', r'(salary|income)'),
            (r'amount', r'amount'),
        ]
        
        for doc_pattern, form_pattern in patterns:
            if re.search(doc_pattern, doc_lower) and re.search(form_pattern, form_lower):
                score = max(score, 0.9)
        
        # Substring matching
        if doc_lower in form_lower or form_lower in doc_lower:
            score = max(score, 0.7)
        
        # Word overlap
        doc_words = set(doc_lower.split())
        form_words = set(form_lower.split())
        overlap = len(doc_words & form_words)
        total_words = len(doc_words | form_words)
        
        if total_words > 0:
            jaccard_score = overlap / total_words
            score = max(score, jaccard_score * 0.8)
        
        return score
    
    def _find_mapping_candidates(self, 
                               doc_field: DocumentField,
                               form_fields: List[FormField],
                               similarity_matrices: Dict[str, np.ndarray],
                               doc_index: int) -> List[FieldMapping]:
        """Find potential mapping candidates for a document field"""
        candidates = []
        
        for j, form_field in enumerate(form_fields):
            # Calculate composite confidence score
            confidence = self._calculate_confidence_score(
                doc_field, form_field, similarity_matrices, doc_index, j
            )
            
            if confidence >= self.config["similarity_threshold"]:
                # Determine matching strategy
                strategy = self._determine_matching_strategy(
                    similarity_matrices, doc_index, j
                )
                
                mapping = FieldMapping(
                    source_field=doc_field.name,
                    target_field=form_field.name,
                    confidence_score=confidence,
                    field_type=self._infer_field_type(doc_field, form_field),
                    matching_strategy=strategy,
                    metadata={
                        "doc_field_type": doc_field.field_type.value,
                        "form_field_type": form_field.field_type.value,
                        "similarity_breakdown": self._get_similarity_breakdown(
                            similarity_matrices, doc_index, j
                        )
                    }
                )
                
                candidates.append(mapping)
        
        # Sort by confidence score
        candidates.sort(key=lambda x: x.confidence_score, reverse=True)
        
        # Limit number of candidates
        max_suggestions = self.config.get("max_suggestions", 5)
        return candidates[:max_suggestions]
    
    def _calculate_confidence_score(self,
                                  doc_field: DocumentField,
                                  form_field: FormField,
                                  similarity_matrices: Dict[str, np.ndarray],
                                  doc_index: int,
                                  form_index: int) -> float:
        """Calculate composite confidence score"""
        total_score = 0.0
        total_weight = 0.0
        
        # Fuzzy matching score
        if "fuzzy" in similarity_matrices:
            fuzzy_score = similarity_matrices["fuzzy"][doc_index, form_index]
            weight = self.config.get("fuzzy_ratio_weight", 0.3)
            total_score += fuzzy_score * weight
            total_weight += weight
        
        # Semantic matching score
        if "semantic" in similarity_matrices:
            semantic_score = similarity_matrices["semantic"][doc_index, form_index]
            weight = self.config.get("semantic_weight", 0.4)
            total_score += semantic_score * weight
            total_weight += weight
        
        # Rule-based matching score
        if "rule_based" in similarity_matrices:
            rule_score = similarity_matrices["rule_based"][doc_index, form_index]
            weight = self.config.get("rule_weight", 0.3)
            total_score += rule_score * weight
            total_weight += weight
        
        # Data type compatibility bonus
        type_bonus = self._calculate_type_compatibility_bonus(doc_field, form_field)
        total_score += type_bonus * 0.1
        
        # Normalize by total weight
        if total_weight > 0:
            confidence = total_score / total_weight
        else:
            confidence = 0.0
        
        return min(confidence, 1.0)  # Cap at 1.0
    
    def _calculate_type_compatibility_bonus(self, 
                                          doc_field: DocumentField, 
                                          form_field: FormField) -> float:
        """Calculate bonus score for compatible field types"""
        if doc_field.field_type == form_field.field_type:
            return 0.2
        
        # Compatible type mappings
        compatible_types = {
            (FieldType.TEXT, FieldType.NAME): 0.1,
            (FieldType.TEXT, FieldType.ADDRESS): 0.1,
            (FieldType.NUMBER, FieldType.CURRENCY): 0.15,
            (FieldType.TEXT, FieldType.EMAIL): 0.1,
            (FieldType.TEXT, FieldType.PHONE): 0.1,
        }
        
        type_pair = (doc_field.field_type, form_field.field_type)
        reverse_pair = (form_field.field_type, doc_field.field_type)
        
        return compatible_types.get(type_pair, compatible_types.get(reverse_pair, 0.0))
    
    def _determine_matching_strategy(self, 
                                   similarity_matrices: Dict[str, np.ndarray],
                                   doc_index: int, 
                                   form_index: int) -> MatchingStrategy:
        """Determine which matching strategy was most effective"""
        scores = {}
        
        for strategy, matrix in similarity_matrices.items():
            scores[strategy] = matrix[doc_index, form_index]
        
        if not scores:
            return MatchingStrategy.EXACT
        
        best_strategy = max(scores, key=scores.get)
        
        strategy_mapping = {
            "fuzzy": MatchingStrategy.FUZZY,
            "semantic": MatchingStrategy.SEMANTIC,
            "rule_based": MatchingStrategy.RULE_BASED
        }
        
        return strategy_mapping.get(best_strategy, MatchingStrategy.HYBRID)
    
    def _get_similarity_breakdown(self, 
                                similarity_matrices: Dict[str, np.ndarray],
                                doc_index: int, 
                                form_index: int) -> Dict[str, float]:
        """Get detailed similarity scores breakdown"""
        breakdown = {}
        for strategy, matrix in similarity_matrices.items():
            breakdown[strategy] = float(matrix[doc_index, form_index])
        return breakdown
    
    def _infer_field_type(self, doc_field: DocumentField, form_field: FormField) -> FieldType:
        """Infer the most appropriate field type for the mapping"""
        # Prefer form field type if it's not unknown
        if form_field.field_type != FieldType.UNKNOWN:
            return form_field.field_type
        
        # Use document field type if available
        if doc_field.field_type != FieldType.UNKNOWN:
            return doc_field.field_type
        
        # Attempt to infer from field names
        field_name = doc_field.name.lower()
        
        if any(term in field_name for term in ["email", "e-mail"]):
            return FieldType.EMAIL
        elif any(term in field_name for term in ["phone", "mobile", "tel"]):
            return FieldType.PHONE
        elif any(term in field_name for term in ["date", "birth", "dob"]):
            return FieldType.DATE
        elif any(term in field_name for term in ["name", "first", "last"]):
            return FieldType.NAME
        elif any(term in field_name for term in ["address", "street", "city"]):
            return FieldType.ADDRESS
        elif any(term in field_name for term in ["amount", "price", "salary"]):
            return FieldType.CURRENCY
        
        return FieldType.TEXT
    
    def _resolve_mapping_conflicts(self, mappings: List[FieldMapping]) -> List[FieldMapping]:
        """Resolve conflicts where multiple document fields map to the same form field"""
        # Group mappings by target field
        target_groups = {}
        for mapping in mappings:
            if mapping.target_field not in target_groups:
                target_groups[mapping.target_field] = []
            target_groups[mapping.target_field].append(mapping)
        
        resolved_mappings = []
        
        for target_field, group in target_groups.items():
            if len(group) == 1:
                # No conflict
                resolved_mappings.append(group[0])
            else:
                # Conflict resolution: choose mapping with highest confidence
                best_mapping = max(group, key=lambda x: x.confidence_score)
                resolved_mappings.append(best_mapping)
                
                # Log the conflict resolution
                logger.warning(f"Conflict resolved for target field '{target_field}'. "
                             f"Selected '{best_mapping.source_field}' with confidence "
                             f"{best_mapping.confidence_score:.3f}")
        
        return resolved_mappings
    
    def _load_field_patterns(self) -> Dict[str, List[str]]:
        """Load field patterns from configuration or database"""
        # This would typically load from a configuration file or database
        return {
            "name_fields": [
                "first_name", "given_name", "last_name", "family_name", 
                "surname", "full_name", "name", "applicant_name"
            ],
            "email_fields": [
                "email", "email_address", "e_mail", "electronic_mail"
            ],
            "phone_fields": [
                "phone", "phone_number", "telephone", "mobile", "cell_phone"
            ],
            "address_fields": [
                "address", "street_address", "mailing_address", "home_address"
            ],
            "date_fields": [
                "date", "birth_date", "date_of_birth", "dob", "created_date"
            ]
        }
    
    def _load_mapping_rules(self) -> List[Dict[str, Any]]:
        """Load mapping rules from configuration"""
        return [
            {
                "name": "email_validation",
                "pattern": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                "field_type": FieldType.EMAIL,
                "confidence_boost": 0.2
            },
            {
                "name": "phone_validation", 
                "pattern": r"^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$",
                "field_type": FieldType.PHONE,
                "confidence_boost": 0.2
            },
            {
                "name": "date_validation",
                "pattern": r"^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$",
                "field_type": FieldType.DATE,
                "confidence_boost": 0.15
            }
        ]
    
    def validate_data_types(self, mapping: FieldMapping, value: Any) -> bool:
        """Validate if a value matches the expected field type"""
        if mapping.field_type == FieldType.EMAIL:
            return self._validate_email(value)
        elif mapping.field_type == FieldType.PHONE:
            return self._validate_phone(value)
        elif mapping.field_type == FieldType.DATE:
            return self._validate_date(value)
        elif mapping.field_type == FieldType.NUMBER:
            return self._validate_number(value)
        elif mapping.field_type == FieldType.CURRENCY:
            return self._validate_currency(value)
        
        return True  # Default to valid for text fields
    
    def _validate_email(self, value: str) -> bool:
        """Validate email format"""
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, str(value)))
    
    def _validate_phone(self, value: str) -> bool:
        """Validate phone number format"""
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', str(value))
        # Check if it's a valid length for US/international numbers
        return len(digits) in [10, 11, 12]
    
    def _validate_date(self, value: str) -> bool:
        """Validate date format"""
        date_patterns = [
            r"^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$",
            r"^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$",
            r"^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$"
        ]
        return any(re.match(pattern, str(value), re.IGNORECASE) for pattern in date_patterns)
    
    def _validate_number(self, value: str) -> bool:
        """Validate numeric format"""
        try:
            float(str(value).replace(',', ''))
            return True
        except ValueError:
            return False
    
    def _validate_currency(self, value: str) -> bool:
        """Validate currency format"""
        # Allow formats like: $1,234.56, 1234.56, $1234, etc.
        pattern = r"^\$?[\d,]+\.?\d{0,2}$"
        return bool(re.match(pattern, str(value).replace(' ', '')))

# Example usage and testing functions
if __name__ == "__main__":
    # Example usage
    mapper = IntelligentFieldMapper()
    
    # Sample document fields
    doc_fields = [
        DocumentField("applicant_first_name", "John", FieldType.NAME),
        DocumentField("applicant_last_name", "Doe", FieldType.NAME),
        DocumentField("email_addr", "john.doe@example.com", FieldType.EMAIL),
        DocumentField("phone_num", "555-123-4567", FieldType.PHONE),
        DocumentField("street_address", "123 Main St", FieldType.ADDRESS),
    ]
    
    # Sample form fields
    form_fields = [
        FormField("firstName", FieldType.NAME, required=True),
        FormField("lastName", FieldType.NAME, required=True),
        FormField("emailAddress", FieldType.EMAIL, required=True),
        FormField("phoneNumber", FieldType.PHONE),
        FormField("homeAddress", FieldType.ADDRESS),
        FormField("dateOfBirth", FieldType.DATE),
    ]
    
    # Perform mapping
    mappings = mapper.map_fields(doc_fields, form_fields)
    
    # Display results
    print("Field Mappings:")
    print("=" * 50)
    for mapping in mappings:
        print(f"'{mapping.source_field}' -> '{mapping.target_field}'")
        print(f"  Confidence: {mapping.confidence_score:.3f}")
        print(f"  Strategy: {mapping.matching_strategy.value}")
        print(f"  Field Type: {mapping.field_type.value}")
        print()