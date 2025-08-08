# Field Mapping Algorithm Pseudocode

## Core Mapping Algorithm

```pseudocode
ALGORITHM IntelligentFieldMapping

INPUT: 
    DocumentFields D = {d1, d2, ..., dn}  // Fields from document
    FormFields F = {f1, f2, ..., fm}      // Fields from PDF form
    Config C                              // Algorithm configuration

OUTPUT:
    Mappings M = {(di, fj, confidence, strategy)}  // Field mappings

MAIN PROCEDURE:
BEGIN
    // Phase 1: Initialize Components
    CALL InitializeNLPComponents(C)
    CALL LoadFieldPatterns()
    CALL LoadMappingRules()
    
    // Phase 2: Compute Similarity Matrices
    SimilarityMatrices = CALL ComputeSimilarityMatrices(D, F)
    
    // Phase 3: Find Mapping Candidates
    Candidates = EMPTY_LIST
    FOR each di in D DO
        CandidatesForDi = CALL FindMappingCandidates(di, F, SimilarityMatrices)
        ADD CandidatesForDi TO Candidates
    END FOR
    
    // Phase 4: Select Best Mappings
    BestMappings = CALL SelectBestMappings(Candidates, C.confidence_threshold)
    
    // Phase 5: Resolve Conflicts
    FinalMappings = CALL ResolveConflicts(BestMappings)
    
    // Phase 6: Validate and Post-process
    ValidatedMappings = CALL ValidateAndPostProcess(FinalMappings)
    
    RETURN ValidatedMappings
END

PROCEDURE ComputeSimilarityMatrices(D, F):
BEGIN
    Matrices = EMPTY_MAP
    
    // Fuzzy String Matching Matrix
    IF C.enable_fuzzy_matching THEN
        Matrices["fuzzy"] = ComputeFuzzyMatrix(D, F)
    END IF
    
    // Semantic Similarity Matrix
    IF C.enable_semantic_matching THEN
        Matrices["semantic"] = ComputeSemanticMatrix(D, F)
    END IF
    
    // Rule-based Matching Matrix  
    IF C.enable_rule_based THEN
        Matrices["rule_based"] = ComputeRuleBasedMatrix(D, F)
    END IF
    
    RETURN Matrices
END

PROCEDURE ComputeFuzzyMatrix(D, F):
BEGIN
    Matrix = ZEROS(|D|, |F|)
    
    FOR i = 1 TO |D| DO
        FOR j = 1 TO |F| DO
            // Multi-metric fuzzy matching
            ratio = LevenshteinRatio(D[i].name, F[j].name)
            partial = PartialRatio(D[i].name, F[j].name)
            token_sort = TokenSortRatio(D[i].name, F[j].name)
            
            // Weighted combination
            Matrix[i][j] = (ratio * 0.4 + partial * 0.3 + token_sort * 0.3)
        END FOR
    END FOR
    
    RETURN Matrix
END

PROCEDURE ComputeSemanticMatrix(D, F):
BEGIN
    Matrix = ZEROS(|D|, |F|)
    
    TRY
        // Get BERT embeddings
        DocEmbeddings = GetBERTEmbeddings([D[i].name for i in 1..|D|])
        FormEmbeddings = GetBERTEmbeddings([F[j].name for j in 1..|F|])
        
        // Compute cosine similarity
        Matrix = CosineSimilarity(DocEmbeddings, FormEmbeddings)
        
    CATCH Exception
        // Fallback to TF-IDF
        Matrix = ComputeTFIDFSimilarity(D, F)
    END TRY
    
    RETURN Matrix
END

PROCEDURE GetBERTEmbeddings(TextList):
BEGIN
    Embeddings = EMPTY_LIST
    
    FOR each text in TextList DO
        tokens = Tokenize(text)
        embedding = BERTModel.encode(tokens)
        // Use CLS token representation
        ADD embedding[0] TO Embeddings
    END FOR
    
    RETURN Embeddings
END

PROCEDURE ComputeRuleBasedMatrix(D, F):
BEGIN
    Matrix = ZEROS(|D|, |F|)
    
    FOR i = 1 TO |D| DO
        FOR j = 1 TO |F| DO
            score = ApplyMappingRules(D[i].name, F[j].name)
            Matrix[i][j] = score
        END FOR
    END FOR
    
    RETURN Matrix
END

PROCEDURE ApplyMappingRules(docField, formField):
BEGIN
    score = 0.0
    
    // Exact match check
    IF LOWERCASE(docField) = LOWERCASE(formField) THEN
        RETURN 1.0
    END IF
    
    // Pattern-based matching
    FOR each rule in MappingRules DO
        IF MATCHES(docField, rule.doc_pattern) AND 
           MATCHES(formField, rule.form_pattern) THEN
            score = MAX(score, rule.confidence)
        END IF
    END FOR
    
    // Substring matching
    IF CONTAINS(LOWERCASE(docField), LOWERCASE(formField)) OR
       CONTAINS(LOWERCASE(formField), LOWERCASE(docField)) THEN
        score = MAX(score, 0.7)
    END IF
    
    // Word overlap (Jaccard similarity)
    docWords = SPLIT(LOWERCASE(docField))
    formWords = SPLIT(LOWERCASE(formField))
    overlap = |INTERSECTION(docWords, formWords)|
    union = |UNION(docWords, formWords)|
    
    IF union > 0 THEN
        jaccardScore = overlap / union
        score = MAX(score, jaccardScore * 0.8)
    END IF
    
    RETURN score
END

PROCEDURE FindMappingCandidates(docField, FormFields, SimilarityMatrices):
BEGIN
    Candidates = EMPTY_LIST
    docIndex = INDEX_OF(docField)
    
    FOR j = 1 TO |FormFields| DO
        formField = FormFields[j]
        
        // Calculate composite confidence score
        confidence = CalculateConfidenceScore(
            docField, formField, SimilarityMatrices, docIndex, j
        )
        
        IF confidence >= C.similarity_threshold THEN
            strategy = DetermineMatchingStrategy(SimilarityMatrices, docIndex, j)
            fieldType = InferFieldType(docField, formField)
            
            mapping = CreateMapping(
                docField.name, formField.name, confidence, fieldType, strategy
            )
            
            ADD mapping TO Candidates
        END IF
    END FOR
    
    // Sort by confidence (descending)
    SORT Candidates BY confidence DESC
    
    // Limit candidates
    RETURN TOP(Candidates, C.max_suggestions)
END

PROCEDURE CalculateConfidenceScore(docField, formField, Matrices, i, j):
BEGIN
    totalScore = 0.0
    totalWeight = 0.0
    
    // Weighted combination of similarity scores
    FOR each (strategy, matrix) in Matrices DO
        score = matrix[i][j]
        weight = C.weights[strategy]
        totalScore = totalScore + (score * weight)
        totalWeight = totalWeight + weight
    END FOR
    
    // Data type compatibility bonus
    typeBonus = CalculateTypeCompatibilityBonus(docField, formField)
    totalScore = totalScore + (typeBonus * 0.1)
    
    // Normalize
    IF totalWeight > 0 THEN
        confidence = totalScore / totalWeight
    ELSE
        confidence = 0.0
    END IF
    
    RETURN MIN(confidence, 1.0)
END

PROCEDURE SelectBestMappings(AllCandidates, threshold):
BEGIN
    BestMappings = EMPTY_LIST
    
    FOR each candidateList in AllCandidates DO
        IF NOT EMPTY(candidateList) THEN
            bestCandidate = candidateList[1]  // Highest confidence
            IF bestCandidate.confidence >= threshold THEN
                ADD bestCandidate TO BestMappings
            END IF
        END IF
    END FOR
    
    RETURN BestMappings
END

PROCEDURE ResolveConflicts(Mappings):
BEGIN
    // Group mappings by target field
    targetGroups = GROUP_BY(Mappings, mapping.targetField)
    resolvedMappings = EMPTY_LIST
    
    FOR each (targetField, group) in targetGroups DO
        IF |group| = 1 THEN
            // No conflict
            ADD group[1] TO resolvedMappings
        ELSE
            // Conflict: choose highest confidence
            bestMapping = MAX(group, BY mapping.confidence)
            ADD bestMapping TO resolvedMappings
            
            LOG_WARNING("Conflict resolved for " + targetField)
        END IF
    END FOR
    
    RETURN resolvedMappings
END

PROCEDURE ValidateAndPostProcess(Mappings):
BEGIN
    validatedMappings = EMPTY_LIST
    
    FOR each mapping in Mappings DO
        // Data type validation
        IF ValidateDataType(mapping) THEN
            // Apply post-processing rules
            processedMapping = ApplyPostProcessingRules(mapping)
            ADD processedMapping TO validatedMappings
        ELSE
            LOG_WARNING("Data type validation failed for " + mapping.sourceField)
        END IF
    END FOR
    
    RETURN validatedMappings
END
```

## Edge Case Handling Algorithms

### 1. Multiple Potential Matches
```pseudocode
PROCEDURE HandleMultipleMatches(candidates, threshold):
BEGIN
    IF |candidates| <= 1 THEN
        RETURN candidates
    END IF
    
    // Check confidence gap
    topCandidate = candidates[1]
    secondCandidate = candidates[2]
    confidenceGap = topCandidate.confidence - secondCandidate.confidence
    
    IF confidenceGap < threshold THEN
        // Ambiguous case - apply tie-breaking rules
        winner = ApplyTieBreakingRules(topCandidate, secondCandidate)
        RETURN [winner]
    ELSE
        // Clear winner
        RETURN [topCandidate]
    END IF
END

PROCEDURE ApplyTieBreakingRules(candidate1, candidate2):
BEGIN
    // Rule 1: Prefer exact field type match
    IF candidate1.hasExactTypeMatch AND NOT candidate2.hasExactTypeMatch THEN
        RETURN candidate1
    END IF
    IF candidate2.hasExactTypeMatch AND NOT candidate1.hasExactTypeMatch THEN
        RETURN candidate2
    END IF
    
    // Rule 2: Prefer semantic over fuzzy matching
    IF candidate1.strategy = "semantic" AND candidate2.strategy = "fuzzy" THEN
        RETURN candidate1
    END IF
    IF candidate2.strategy = "semantic" AND candidate1.strategy = "fuzzy" THEN
        RETURN candidate2
    END IF
    
    // Rule 3: Prefer shorter field names (more specific)
    IF LENGTH(candidate1.targetField) < LENGTH(candidate2.targetField) THEN
        RETURN candidate1
    END IF
    
    // Default: return first candidate
    RETURN candidate1
END
```

### 2. Missing or Incomplete Data
```pseudocode
PROCEDURE HandleMissingData(documentFields, formFields):
BEGIN
    // Identify missing required form fields
    requiredFields = FILTER(formFields, field.required = TRUE)
    mappedTargets = [mapping.targetField for mapping in existingMappings]
    unmappedRequired = FILTER(requiredFields, field.name NOT IN mappedTargets)
    
    IF NOT EMPTY(unmappedRequired) THEN
        // Attempt partial matching with lower thresholds
        relaxedMappings = AttemptRelaxedMatching(documentFields, unmappedRequired)
        
        // Generate suggestions for missing fields
        suggestions = GenerateMissingSuggestions(unmappedRequired)
        
        RETURN (relaxedMappings, suggestions)
    END IF
    
    RETURN (EMPTY_LIST, EMPTY_LIST)
END

PROCEDURE AttemptRelaxedMatching(docFields, formFields):
BEGIN
    // Lower confidence threshold for missing required fields
    relaxedThreshold = C.confidence_threshold * 0.7
    
    relaxedMappings = EMPTY_LIST
    FOR each docField in docFields DO
        FOR each formField in formFields DO
            confidence = CalculateConfidenceScore(docField, formField)
            IF confidence >= relaxedThreshold THEN
                mapping = CreateMapping(docField, formField, confidence)
                mapping.metadata["relaxed_matching"] = TRUE
                ADD mapping TO relaxedMappings
            END IF
        END FOR
    END FOR
    
    RETURN relaxedMappings
END
```

### 3. Different Naming Conventions
```pseudocode
PROCEDURE NormalizeFieldNames(fieldName):
BEGIN
    normalized = LOWERCASE(fieldName)
    
    // Remove common prefixes/suffixes
    prefixesToRemove = ["applicant_", "client_", "customer_", "user_"]
    suffixesToRemove = ["_field", "_input", "_data", "_info"]
    
    FOR each prefix in prefixesToRemove DO
        IF STARTS_WITH(normalized, prefix) THEN
            normalized = REMOVE_PREFIX(normalized, prefix)
        END IF
    END FOR
    
    FOR each suffix in suffixesToRemove DO
        IF ENDS_WITH(normalized, suffix) THEN
            normalized = REMOVE_SUFFIX(normalized, suffix)
        END IF
    END FOR
    
    // Convert naming conventions
    normalized = ConvertCamelCaseToSnakeCase(normalized)
    normalized = ConvertKebabCaseToSnakeCase(normalized)
    
    // Replace common abbreviations
    abbreviations = {
        "addr": "address",
        "tel": "telephone", 
        "dob": "date_of_birth",
        "ssn": "social_security_number",
        "fname": "first_name",
        "lname": "last_name"
    }
    
    FOR each (abbrev, full) in abbreviations DO
        normalized = REPLACE(normalized, abbrev, full)
    END FOR
    
    RETURN normalized
END
```

### 4. Nested Form Structures
```pseudocode
PROCEDURE HandleNestedFields(formFields):
BEGIN
    flattenedFields = EMPTY_LIST
    
    FOR each field in formFields DO
        IF field.hasChildren THEN
            // Recursively flatten nested structure
            childFields = FlattenFieldHierarchy(field, field.name)
            ADD_ALL childFields TO flattenedFields
        ELSE
            ADD field TO flattenedFields
        END IF
    END FOR
    
    RETURN flattenedFields
END

PROCEDURE FlattenFieldHierarchy(parentField, pathPrefix):
BEGIN
    flatFields = EMPTY_LIST
    
    FOR each child in parentField.children DO
        childPath = pathPrefix + "." + child.name
        
        IF child.hasChildren THEN
            // Recursive case
            grandChildren = FlattenFieldHierarchy(child, childPath)
            ADD_ALL grandChildren TO flatFields
        ELSE
            // Base case
            flatField = CREATE_FIELD(childPath, child.type, child.properties)
            flatField.metadata["originalParent"] = parentField.name
            flatField.metadata["nestingLevel"] = COUNT_DOTS(childPath)
            ADD flatField TO flatFields
        END IF
    END FOR
    
    RETURN flatFields
END
```

## Confidence Scoring Algorithm

```pseudocode
PROCEDURE AdvancedConfidenceScoring(docField, formField, context):
BEGIN
    baseConfidence = CalculateBaseConfidence(docField, formField)
    
    // Context-aware adjustments
    contextBonus = CalculateContextBonus(docField, formField, context)
    
    // Position-based bonus (fields in similar positions)
    positionBonus = CalculatePositionBonus(docField.position, formField.position)
    
    // Value format validation bonus
    formatBonus = CalculateFormatValidationBonus(docField.value, formField.type)
    
    // Historical success rate bonus
    historyBonus = CalculateHistoricalBonus(docField.name, formField.name)
    
    // Combine all factors
    finalConfidence = baseConfidence + 
                     (contextBonus * 0.15) + 
                     (positionBonus * 0.10) + 
                     (formatBonus * 0.20) + 
                     (historyBonus * 0.05)
    
    // Apply confidence calibration
    calibratedConfidence = CalibrateConfidence(finalConfidence)
    
    RETURN MIN(calibratedConfidence, 1.0)
END

PROCEDURE CalibrateConfidence(rawConfidence):
BEGIN
    // Apply sigmoid function to improve confidence distribution
    calibrated = 1.0 / (1.0 + EXP(-5.0 * (rawConfidence - 0.5)))
    
    // Apply learned calibration curve if available
    IF CalibrationModel.isAvailable THEN
        calibrated = CalibrationModel.predict(calibrated)
    END IF
    
    RETURN calibrated
END
```

This pseudocode provides a comprehensive framework for intelligent field mapping with robust edge case handling and confidence scoring mechanisms.