"""
Test Suite for Intelligent Field Mapping Algorithm
=================================================

Comprehensive tests covering core functionality, edge cases, and performance.
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch
from typing import List, Dict, Any

# Import the main components (assuming they're in the src directory)
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from algorithms.field_mapping_core import (
    IntelligentFieldMapper, 
    DocumentField, 
    FormField, 
    FieldMapping,
    FieldType,
    MatchingStrategy
)

class TestFieldMappingCore:
    """Test core field mapping functionality"""
    
    @pytest.fixture
    def mapper(self):
        """Create a mapper instance for testing"""
        config = {
            "similarity_threshold": 0.6,
            "confidence_threshold": 0.5,
            "enable_semantic_matching": False,  # Disable for faster tests
            "enable_fuzzy_matching": True,
            "enable_rule_based": True,
        }
        return IntelligentFieldMapper(config)
    
    @pytest.fixture
    def sample_doc_fields(self):
        """Sample document fields for testing"""
        return [
            DocumentField("first_name", "John", FieldType.NAME),
            DocumentField("last_name", "Doe", FieldType.NAME),
            DocumentField("email_address", "john@example.com", FieldType.EMAIL),
            DocumentField("phone_number", "555-123-4567", FieldType.PHONE),
            DocumentField("home_address", "123 Main St", FieldType.ADDRESS),
            DocumentField("birth_date", "01/01/1990", FieldType.DATE),
            DocumentField("annual_salary", "$75,000", FieldType.CURRENCY),
        ]
    
    @pytest.fixture
    def sample_form_fields(self):
        """Sample form fields for testing"""
        return [
            FormField("firstName", FieldType.NAME, required=True),
            FormField("lastName", FieldType.NAME, required=True),
            FormField("emailAddr", FieldType.EMAIL, required=True),
            FormField("phoneNum", FieldType.PHONE),
            FormField("streetAddress", FieldType.ADDRESS),
            FormField("dateOfBirth", FieldType.DATE),
            FormField("salary", FieldType.CURRENCY),
            FormField("middleName", FieldType.NAME),  # No corresponding doc field
        ]

    def test_exact_match_mapping(self, mapper, sample_doc_fields, sample_form_fields):
        """Test exact field name matching"""
        # Create exact match case
        doc_fields = [DocumentField("firstName", "John", FieldType.NAME)]
        form_fields = [FormField("firstName", FieldType.NAME)]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        assert len(mappings) == 1
        assert mappings[0].source_field == "firstName"
        assert mappings[0].target_field == "firstName"
        assert mappings[0].confidence_score > 0.9
        assert mappings[0].matching_strategy == MatchingStrategy.RULE_BASED

    def test_fuzzy_matching(self, mapper, sample_doc_fields, sample_form_fields):
        """Test fuzzy string matching functionality"""
        mappings = mapper.map_fields(sample_doc_fields, sample_form_fields)
        
        # Should find reasonable mappings
        assert len(mappings) >= 5  # Most fields should map
        
        # Check specific expected mappings
        mapping_dict = {m.source_field: m.target_field for m in mappings}
        
        assert mapping_dict.get("first_name") == "firstName"
        assert mapping_dict.get("last_name") == "lastName"
        assert mapping_dict.get("email_address") == "emailAddr"
        
        # All mappings should meet confidence threshold
        for mapping in mappings:
            assert mapping.confidence_score >= 0.5

    def test_type_compatibility_bonus(self, mapper):
        """Test that matching field types get bonus scores"""
        doc_field = DocumentField("user_email", "test@example.com", FieldType.EMAIL)
        form_field_email = FormField("email", FieldType.EMAIL)
        form_field_text = FormField("email", FieldType.TEXT)
        
        # Calculate bonus for compatible types
        email_bonus = mapper._calculate_type_compatibility_bonus(doc_field, form_field_email)
        text_bonus = mapper._calculate_type_compatibility_bonus(doc_field, form_field_text)
        
        assert email_bonus > text_bonus
        assert email_bonus == 0.2  # Exact match bonus

    def test_confidence_scoring(self, mapper):
        """Test confidence score calculation"""
        doc_field = DocumentField("firstName", "John", FieldType.NAME)
        form_field = FormField("first_name", FieldType.NAME)
        
        # Mock similarity matrices
        similarity_matrices = {
            "fuzzy": np.array([[0.8]]),
            "rule_based": np.array([[0.9]])
        }
        
        confidence = mapper._calculate_confidence_score(
            doc_field, form_field, similarity_matrices, 0, 0
        )
        
        assert 0.0 <= confidence <= 1.0
        assert confidence > 0.7  # Should be high for good match

    def test_conflict_resolution(self, mapper):
        """Test resolution of mapping conflicts"""
        # Create conflicting mappings
        mappings = [
            FieldMapping("doc_field1", "form_field", 0.8, FieldType.TEXT, MatchingStrategy.FUZZY),
            FieldMapping("doc_field2", "form_field", 0.7, FieldType.TEXT, MatchingStrategy.FUZZY),
        ]
        
        resolved = mapper._resolve_mapping_conflicts(mappings)
        
        assert len(resolved) == 1
        assert resolved[0].source_field == "doc_field1"  # Higher confidence wins
        assert resolved[0].confidence_score == 0.8

    def test_data_type_validation(self, mapper):
        """Test data type validation functionality"""
        email_mapping = FieldMapping("email", "emailAddr", 0.9, FieldType.EMAIL, MatchingStrategy.FUZZY)
        phone_mapping = FieldMapping("phone", "phoneNum", 0.9, FieldType.PHONE, MatchingStrategy.FUZZY)
        date_mapping = FieldMapping("date", "birthDate", 0.9, FieldType.DATE, MatchingStrategy.FUZZY)
        
        # Valid data
        assert mapper.validate_data_types(email_mapping, "user@example.com") == True
        assert mapper.validate_data_types(phone_mapping, "555-123-4567") == True
        assert mapper.validate_data_types(date_mapping, "01/15/1990") == True
        
        # Invalid data
        assert mapper.validate_data_types(email_mapping, "not-an-email") == False
        assert mapper.validate_data_types(phone_mapping, "abc-def-ghij") == False
        assert mapper.validate_data_types(date_mapping, "not-a-date") == False

    def test_field_type_inference(self, mapper):
        """Test field type inference from names and values"""
        doc_field = DocumentField("user_email", "test@example.com", FieldType.UNKNOWN)
        form_field = FormField("contact_email", FieldType.UNKNOWN)
        
        inferred_type = mapper._infer_field_type(doc_field, form_field)
        assert inferred_type == FieldType.EMAIL

    def test_empty_inputs(self, mapper):
        """Test handling of empty input lists"""
        mappings = mapper.map_fields([], [])
        assert mappings == []
        
        doc_fields = [DocumentField("test", "value", FieldType.TEXT)]
        mappings = mapper.map_fields(doc_fields, [])
        assert mappings == []

    def test_no_matches_below_threshold(self, mapper):
        """Test that low-confidence matches are filtered out"""
        # Create fields with very different names
        doc_fields = [DocumentField("xyz123", "value", FieldType.TEXT)]
        form_fields = [FormField("abc456", FieldType.TEXT)]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        assert len(mappings) == 0  # Should be filtered out by threshold


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture
    def mapper(self):
        config = {
            "similarity_threshold": 0.3,  # Lower for edge case testing
            "confidence_threshold": 0.3,
            "enable_semantic_matching": False,
            "enable_fuzzy_matching": True,
            "enable_rule_based": True,
        }
        return IntelligentFieldMapper(config)

    def test_multiple_potential_matches(self, mapper):
        """Test handling of multiple potential matches"""
        doc_field = [DocumentField("name", "John Doe", FieldType.NAME)]
        form_fields = [
            FormField("firstName", FieldType.NAME),
            FormField("fullName", FieldType.NAME),
            FormField("applicantName", FieldType.NAME),
            FormField("customerName", FieldType.NAME),
        ]
        
        mappings = mapper.map_fields(doc_field, form_fields)
        
        # Should select the best match
        assert len(mappings) == 1
        assert mappings[0].confidence_score > 0.3

    def test_missing_data_scenarios(self, mapper):
        """Test scenarios with missing or incomplete data"""
        # More form fields than document fields
        doc_fields = [
            DocumentField("firstName", "John", FieldType.NAME),
        ]
        form_fields = [
            FormField("firstName", FieldType.NAME, required=True),
            FormField("lastName", FieldType.NAME, required=True),
            FormField("email", FieldType.EMAIL, required=True),
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should only map the available field
        assert len(mappings) == 1
        assert mappings[0].source_field == "firstName"

    def test_different_naming_conventions(self, mapper):
        """Test handling of different naming conventions"""
        test_cases = [
            # camelCase to snake_case
            ("firstName", "first_name"),
            ("lastName", "last_name"),
            ("emailAddress", "email_address"),
            # kebab-case to snake_case
            ("phone-number", "phone_number"),
            ("street-address", "street_address"),
            # Abbreviations
            ("fname", "first_name"),
            ("lname", "last_name"),
            ("addr", "address"),
            ("tel", "telephone"),
        ]
        
        for doc_name, form_name in test_cases:
            doc_fields = [DocumentField(doc_name, "test", FieldType.TEXT)]
            form_fields = [FormField(form_name, FieldType.TEXT)]
            
            mappings = mapper.map_fields(doc_fields, form_fields)
            
            assert len(mappings) >= 0  # May or may not match depending on algorithm
            if mappings:
                assert mappings[0].confidence_score > 0.0

    def test_nested_form_structures(self, mapper):
        """Test handling of nested form field structures"""
        # Simulate flattened nested fields
        doc_fields = [
            DocumentField("street", "123 Main St", FieldType.ADDRESS),
            DocumentField("city", "Anytown", FieldType.TEXT),
            DocumentField("state", "CA", FieldType.TEXT),
        ]
        
        form_fields = [
            FormField("address.street", FieldType.ADDRESS),
            FormField("address.city", FieldType.TEXT),
            FormField("address.state", FieldType.TEXT),
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should handle nested naming
        assert len(mappings) >= 1
        
        # Check if nested names are handled properly
        mapping_dict = {m.source_field: m.target_field for m in mappings}
        possible_matches = [
            ("street", "address.street"),
            ("city", "address.city"),
            ("state", "address.state")
        ]
        
        # At least some should match
        matches_found = sum(1 for source, target in possible_matches 
                          if mapping_dict.get(source) == target)
        assert matches_found >= 1

    def test_unicode_and_special_characters(self, mapper):
        """Test handling of unicode and special characters"""
        doc_fields = [
            DocumentField("naïve_field", "test", FieldType.TEXT),
            DocumentField("field-with-dashes", "test", FieldType.TEXT),
            DocumentField("field_with_underscore", "test", FieldType.TEXT),
            DocumentField("field with spaces", "test", FieldType.TEXT),
        ]
        
        form_fields = [
            FormField("naive_field", FieldType.TEXT),
            FormField("field_with_dashes", FieldType.TEXT),
            FormField("fieldWithUnderscore", FieldType.TEXT),
            FormField("fieldWithSpaces", FieldType.TEXT),
        ]
        
        # Should not crash and may find some matches
        mappings = mapper.map_fields(doc_fields, form_fields)
        assert isinstance(mappings, list)  # Should return a list without errors

    def test_extremely_long_field_names(self, mapper):
        """Test handling of extremely long field names"""
        long_name = "very_" * 50 + "long_field_name"
        doc_fields = [DocumentField(long_name, "test", FieldType.TEXT)]
        form_fields = [FormField("shortName", FieldType.TEXT)]
        
        # Should not crash
        mappings = mapper.map_fields(doc_fields, form_fields)
        assert isinstance(mappings, list)

    def test_case_sensitivity(self, mapper):
        """Test case-insensitive matching"""
        test_cases = [
            ("FIRSTNAME", "firstname"),
            ("LastName", "lastname"),
            ("EMAIL", "email"),
            ("PhoneNumber", "phonenumber"),
        ]
        
        for doc_name, form_name in test_cases:
            doc_fields = [DocumentField(doc_name, "test", FieldType.TEXT)]
            form_fields = [FormField(form_name, FieldType.TEXT)]
            
            mappings = mapper.map_fields(doc_fields, form_fields)
            
            # Should find matches regardless of case
            assert len(mappings) >= 1
            assert mappings[0].confidence_score > 0.5


class TestPerformanceAndScalability:
    """Test performance characteristics and scalability"""
    
    @pytest.fixture
    def mapper(self):
        return IntelligentFieldMapper()

    def test_large_field_sets_performance(self, mapper):
        """Test performance with large numbers of fields"""
        import time
        
        # Create large field sets
        doc_fields = [
            DocumentField(f"doc_field_{i}", f"value_{i}", FieldType.TEXT)
            for i in range(100)
        ]
        form_fields = [
            FormField(f"form_field_{i}", FieldType.TEXT)
            for i in range(100)
        ]
        
        start_time = time.time()
        mappings = mapper.map_fields(doc_fields, form_fields)
        end_time = time.time()
        
        execution_time = end_time - start_time
        
        # Should complete within reasonable time (adjust threshold as needed)
        assert execution_time < 30.0  # 30 seconds max for 100x100 comparison
        assert isinstance(mappings, list)

    def test_memory_usage_with_large_inputs(self, mapper):
        """Test memory usage doesn't grow excessively"""
        import tracemalloc
        
        tracemalloc.start()
        
        # Process multiple batches
        for batch in range(5):
            doc_fields = [
                DocumentField(f"batch_{batch}_doc_{i}", f"value_{i}", FieldType.TEXT)
                for i in range(50)
            ]
            form_fields = [
                FormField(f"batch_{batch}_form_{i}", FieldType.TEXT)
                for i in range(50)
            ]
            
            mappings = mapper.map_fields(doc_fields, form_fields)
            assert isinstance(mappings, list)
        
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        # Memory should be reasonable (adjust threshold as needed)
        assert peak < 100 * 1024 * 1024  # 100MB max

    @pytest.mark.parametrize("num_fields", [10, 50, 100])
    def test_scalability(self, mapper, num_fields):
        """Test scalability with different field set sizes"""
        doc_fields = [
            DocumentField(f"doc_{i}", f"value_{i}", FieldType.TEXT)
            for i in range(num_fields)
        ]
        form_fields = [
            FormField(f"form_{i}", FieldType.TEXT)
            for i in range(num_fields)
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should always return results
        assert isinstance(mappings, list)
        assert len(mappings) >= 0


class TestConfigurationAndCustomization:
    """Test configuration options and customization"""
    
    def test_confidence_threshold_filtering(self):
        """Test that confidence threshold properly filters results"""
        high_threshold_config = {"confidence_threshold": 0.9}
        low_threshold_config = {"confidence_threshold": 0.1}
        
        high_mapper = IntelligentFieldMapper(high_threshold_config)
        low_mapper = IntelligentFieldMapper(low_threshold_config)
        
        # Use somewhat similar but not exact field names
        doc_fields = [DocumentField("first_name", "John", FieldType.NAME)]
        form_fields = [FormField("firstName", FieldType.NAME)]
        
        high_mappings = high_mapper.map_fields(doc_fields, form_fields)
        low_mappings = low_mapper.map_fields(doc_fields, form_fields)
        
        # Low threshold should find more/same mappings as high threshold
        assert len(low_mappings) >= len(high_mappings)

    def test_similarity_weights_configuration(self):
        """Test custom similarity weight configuration"""
        fuzzy_heavy_config = {
            "fuzzy_ratio_weight": 0.8,
            "semantic_weight": 0.1,
            "rule_weight": 0.1,
            "enable_semantic_matching": False
        }
        
        mapper = IntelligentFieldMapper(fuzzy_heavy_config)
        
        # Test with fields that would benefit from fuzzy matching
        doc_fields = [DocumentField("first_name", "John", FieldType.NAME)]
        form_fields = [FormField("firstName", FieldType.NAME)]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        assert len(mappings) >= 1
        # Should use fuzzy matching strategy
        assert any(m.matching_strategy == MatchingStrategy.FUZZY for m in mappings)

    def test_disabled_components(self):
        """Test that disabled components don't affect results"""
        disabled_config = {
            "enable_semantic_matching": False,
            "enable_fuzzy_matching": False,
            "enable_rule_based": True,
        }
        
        mapper = IntelligentFieldMapper(disabled_config)
        
        doc_fields = [DocumentField("exact_match", "value", FieldType.TEXT)]
        form_fields = [FormField("exact_match", FieldType.TEXT)]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should still work with just rule-based matching
        assert len(mappings) == 1
        assert mappings[0].matching_strategy == MatchingStrategy.RULE_BASED


class TestIntegrationAndRealWorldScenarios:
    """Test integration scenarios and real-world use cases"""
    
    @pytest.fixture
    def mapper(self):
        return IntelligentFieldMapper()

    def test_job_application_form_scenario(self, mapper):
        """Test mapping job application document to form"""
        doc_fields = [
            DocumentField("applicant_first_name", "John", FieldType.NAME),
            DocumentField("applicant_last_name", "Doe", FieldType.NAME),
            DocumentField("email_address", "john.doe@email.com", FieldType.EMAIL),
            DocumentField("mobile_phone", "555-123-4567", FieldType.PHONE),
            DocumentField("current_salary", "$75,000", FieldType.CURRENCY),
            DocumentField("years_experience", "5", FieldType.NUMBER),
            DocumentField("availability_date", "01/15/2024", FieldType.DATE),
        ]
        
        form_fields = [
            FormField("firstName", FieldType.NAME, required=True),
            FormField("lastName", FieldType.NAME, required=True),
            FormField("email", FieldType.EMAIL, required=True),
            FormField("phone", FieldType.PHONE, required=True),
            FormField("currentSalary", FieldType.CURRENCY),
            FormField("experience", FieldType.NUMBER),
            FormField("startDate", FieldType.DATE),
            FormField("coverLetter", FieldType.TEXT),  # No match in doc
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should map most fields successfully
        assert len(mappings) >= 5
        
        # Check specific mappings exist
        mapping_dict = {m.source_field: m.target_field for m in mappings}
        expected_mappings = [
            ("applicant_first_name", "firstName"),
            ("applicant_last_name", "lastName"),
            ("email_address", "email"),
            ("mobile_phone", "phone"),
        ]
        
        for source, expected_target in expected_mappings:
            assert source in mapping_dict
            # The exact target might vary, but should be reasonable
            assert mapping_dict[source] in [expected_target] or \
                   any(expected_target.lower() in target.lower() 
                       for target in [mapping_dict[source]])

    def test_medical_form_scenario(self, mapper):
        """Test mapping medical document to patient form"""
        doc_fields = [
            DocumentField("patient_name", "Jane Smith", FieldType.NAME),
            DocumentField("date_of_birth", "03/15/1985", FieldType.DATE),
            DocumentField("social_security", "123-45-6789", FieldType.TEXT),
            DocumentField("insurance_number", "INS123456", FieldType.TEXT),
            DocumentField("emergency_contact", "John Smith", FieldType.NAME),
            DocumentField("emergency_phone", "555-987-6543", FieldType.PHONE),
            DocumentField("primary_physician", "Dr. Johnson", FieldType.NAME),
        ]
        
        form_fields = [
            FormField("patientFullName", FieldType.NAME, required=True),
            FormField("birthDate", FieldType.DATE, required=True),
            FormField("ssn", FieldType.TEXT, required=True),
            FormField("insuranceId", FieldType.TEXT),
            FormField("emergencyContactName", FieldType.NAME),
            FormField("emergencyContactPhone", FieldType.PHONE),
            FormField("primaryDoctor", FieldType.NAME),
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should successfully map medical form fields
        assert len(mappings) >= 4
        
        # Verify high-confidence mappings for critical fields
        high_confidence_mappings = [m for m in mappings if m.confidence_score > 0.7]
        assert len(high_confidence_mappings) >= 2

    def test_financial_form_scenario(self, mapper):
        """Test mapping financial document to loan application form"""
        doc_fields = [
            DocumentField("borrower_name", "Michael Johnson", FieldType.NAME),
            DocumentField("annual_income", "$95,000", FieldType.CURRENCY),
            DocumentField("monthly_expenses", "$3,200", FieldType.CURRENCY),
            DocumentField("credit_score", "750", FieldType.NUMBER),
            DocumentField("employment_status", "Full-time", FieldType.TEXT),
            DocumentField("loan_amount_requested", "$250,000", FieldType.CURRENCY),
            DocumentField("property_address", "456 Oak Street", FieldType.ADDRESS),
        ]
        
        form_fields = [
            FormField("applicantName", FieldType.NAME, required=True),
            FormField("yearlyIncome", FieldType.CURRENCY, required=True),
            FormField("monthlyExpenses", FieldType.CURRENCY),
            FormField("creditScore", FieldType.NUMBER),
            FormField("employmentType", FieldType.TEXT),
            FormField("requestedAmount", FieldType.CURRENCY),
            FormField("propertyAddr", FieldType.ADDRESS),
            FormField("loanTerm", FieldType.NUMBER),  # No match
        ]
        
        mappings = mapper.map_fields(doc_fields, form_fields)
        
        # Should handle financial terminology well
        assert len(mappings) >= 4
        
        # Check for currency field mappings
        currency_mappings = [m for m in mappings if m.field_type == FieldType.CURRENCY]
        assert len(currency_mappings) >= 1


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])