#!/bin/bash
#
# Ollama Infrastructure Setup Script
# Purpose: Automate provisioning of Ollama server and download required models
# for the IntelliFill Multi-Agent Document Processing Pipeline
#
# Required Models:
#   - llama3.2:8b     (Extraction Agent, QA Agent)
#   - mistral:7b      (Mapping Agent)
#   - phi3:mini       (Classification Agent - fast)
#
# Usage: ./scripts/setup-ollama.sh [--check-only] [--force]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
REQUIRED_MODELS=("llama3.2:8b" "mistral:7b" "phi3:mini")
HEALTH_CHECK_TIMEOUT=30
PULL_TIMEOUT=3600  # 1 hour for large models

# Parse arguments
CHECK_ONLY=false
FORCE_PULL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --force)
            FORCE_PULL=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--check-only] [--force]"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  IntelliFill Multi-Agent Ollama Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function: Check if Ollama is installed
check_ollama_installed() {
    echo -e "${YELLOW}[1/5] Checking Ollama installation...${NC}"

    if command -v ollama &> /dev/null; then
        local version=$(ollama --version 2>/dev/null || echo "unknown")
        echo -e "${GREEN}  Ollama is installed: $version${NC}"
        return 0
    else
        echo -e "${RED}  Ollama is NOT installed${NC}"
        echo ""
        echo "  Please install Ollama first:"
        echo "    - macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh"
        echo "    - Windows: Download from https://ollama.com/download"
        echo ""
        return 1
    fi
}

# Function: Check if Ollama server is running
check_ollama_server() {
    echo -e "${YELLOW}[2/5] Checking Ollama server status...${NC}"

    local attempts=0
    local max_attempts=3

    while [ $attempts -lt $max_attempts ]; do
        if curl -s --connect-timeout 5 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
            echo -e "${GREEN}  Ollama server is running at ${OLLAMA_HOST}${NC}"
            return 0
        fi

        attempts=$((attempts + 1))
        if [ $attempts -lt $max_attempts ]; then
            echo -e "${YELLOW}  Server not responding, attempting to start... (attempt $attempts/$max_attempts)${NC}"

            # Try to start Ollama in background
            if command -v ollama &> /dev/null; then
                ollama serve > /dev/null 2>&1 &
                sleep 5
            fi
        fi
    done

    echo -e "${RED}  Ollama server is NOT running at ${OLLAMA_HOST}${NC}"
    echo ""
    echo "  Please start Ollama server:"
    echo "    ollama serve"
    echo ""
    return 1
}

# Function: Check available VRAM
check_system_resources() {
    echo -e "${YELLOW}[3/5] Checking system resources...${NC}"

    # Estimate total VRAM needed (~15GB for all models with Q4_K_M quantization)
    local required_vram_gb=15

    # Check for NVIDIA GPU
    if command -v nvidia-smi &> /dev/null; then
        local total_vram=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
        local free_vram=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)

        if [ -n "$total_vram" ]; then
            local total_gb=$((total_vram / 1024))
            local free_gb=$((free_vram / 1024))
            echo -e "${GREEN}  NVIDIA GPU detected: ${total_gb}GB total, ${free_gb}GB free${NC}"

            if [ $total_gb -lt 8 ]; then
                echo -e "${YELLOW}  WARNING: Less than 8GB VRAM. May need to use smaller models or CPU fallback.${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}  No NVIDIA GPU detected. Using CPU mode (slower but functional).${NC}"
    fi

    # Check disk space (models require ~20GB)
    local ollama_dir="${OLLAMA_MODELS:-$HOME/.ollama}"
    if [ -d "$ollama_dir" ]; then
        local available_space=$(df -BG "$ollama_dir" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G')
        if [ -n "$available_space" ] && [ "$available_space" -lt 25 ]; then
            echo -e "${YELLOW}  WARNING: Less than 25GB disk space available for models.${NC}"
        else
            echo -e "${GREEN}  Disk space: ${available_space}GB available${NC}"
        fi
    fi

    return 0
}

# Function: Check if a model is already installed
is_model_installed() {
    local model=$1
    ollama list 2>/dev/null | grep -q "^${model}" && return 0 || return 1
}

# Function: Pull a model
pull_model() {
    local model=$1
    echo -e "${BLUE}  Pulling ${model}...${NC}"

    if ollama pull "$model" 2>&1; then
        echo -e "${GREEN}  Successfully pulled ${model}${NC}"
        return 0
    else
        echo -e "${RED}  Failed to pull ${model}${NC}"
        return 1
    fi
}

# Function: Pull required models
pull_required_models() {
    echo -e "${YELLOW}[4/5] Checking and pulling required models...${NC}"

    local missing_models=()
    local installed_models=()

    for model in "${REQUIRED_MODELS[@]}"; do
        if is_model_installed "$model"; then
            echo -e "${GREEN}  Model already installed: ${model}${NC}"
            installed_models+=("$model")
        else
            missing_models+=("$model")
        fi
    done

    if [ ${#missing_models[@]} -eq 0 ] && [ "$FORCE_PULL" = false ]; then
        echo -e "${GREEN}  All required models are already installed!${NC}"
        return 0
    fi

    if [ "$CHECK_ONLY" = true ]; then
        if [ ${#missing_models[@]} -gt 0 ]; then
            echo -e "${YELLOW}  Missing models: ${missing_models[*]}${NC}"
            return 1
        fi
        return 0
    fi

    # Pull missing or all models if force
    local models_to_pull=()
    if [ "$FORCE_PULL" = true ]; then
        models_to_pull=("${REQUIRED_MODELS[@]}")
    else
        models_to_pull=("${missing_models[@]}")
    fi

    echo ""
    echo -e "${BLUE}  Pulling ${#models_to_pull[@]} model(s)...${NC}"
    echo -e "${YELLOW}  This may take 15-60 minutes depending on your connection.${NC}"
    echo ""

    local failed_models=()
    for model in "${models_to_pull[@]}"; do
        if ! pull_model "$model"; then
            failed_models+=("$model")
        fi
        echo ""
    done

    if [ ${#failed_models[@]} -gt 0 ]; then
        echo -e "${RED}  Failed to pull: ${failed_models[*]}${NC}"
        return 1
    fi

    return 0
}

# Function: Verify models are working
verify_models() {
    echo -e "${YELLOW}[5/5] Verifying model functionality...${NC}"

    local test_prompt="Respond with only the word 'OK'"
    local all_working=true

    for model in "${REQUIRED_MODELS[@]}"; do
        echo -n "  Testing ${model}... "

        local response=$(curl -s --max-time 60 "${OLLAMA_HOST}/api/generate" \
            -d "{\"model\": \"${model}\", \"prompt\": \"${test_prompt}\", \"stream\": false}" \
            2>/dev/null | grep -o '"response":"[^"]*"' | head -1 | cut -d'"' -f4)

        if [ -n "$response" ]; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC}"
            all_working=false
        fi
    done

    if [ "$all_working" = true ]; then
        return 0
    else
        echo -e "${RED}  Some models failed verification. Check Ollama logs.${NC}"
        return 1
    fi
}

# Function: Generate environment configuration
generate_env_config() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Environment Configuration${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo "Add these to your .env file:"
    echo ""
    echo "# Ollama Configuration"
    echo "OLLAMA_HOST=${OLLAMA_HOST}"
    echo "OLLAMA_MODEL_CLASSIFIER=phi3:mini"
    echo "OLLAMA_MODEL_EXTRACTOR=llama3.2:8b"
    echo "OLLAMA_MODEL_MAPPER=mistral:7b"
    echo "OLLAMA_MODEL_QA=llama3.2:8b"
    echo ""
    echo "# Cloud Fallback (optional)"
    echo "# GOOGLE_GENAI_API_KEY=your_gemini_api_key"
    echo "# GROQ_API_KEY=your_groq_api_key"
    echo ""
}

# Function: Health check utility
health_check() {
    local status="unhealthy"
    local models_available=0

    # Check server
    if curl -s --connect-timeout 5 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
        status="healthy"

        # Count available models
        for model in "${REQUIRED_MODELS[@]}"; do
            if is_model_installed "$model"; then
                models_available=$((models_available + 1))
            fi
        done
    fi

    # Output JSON for programmatic use
    echo "{\"status\": \"${status}\", \"host\": \"${OLLAMA_HOST}\", \"models_required\": ${#REQUIRED_MODELS[@]}, \"models_available\": ${models_available}}"
}

# Main execution
main() {
    # If called with --health-check, just output status
    if [ "$1" = "--health-check" ]; then
        health_check
        exit 0
    fi

    local exit_code=0

    # Step 1: Check Ollama installation
    if ! check_ollama_installed; then
        exit 1
    fi

    # Step 2: Check server status
    if ! check_ollama_server; then
        exit 1
    fi

    # Step 3: Check system resources
    check_system_resources

    # Step 4: Pull models
    if ! pull_required_models; then
        exit_code=1
    fi

    # Step 5: Verify models (only if not check-only)
    if [ "$CHECK_ONLY" = false ] && [ $exit_code -eq 0 ]; then
        if ! verify_models; then
            exit_code=1
        fi
    fi

    # Generate config
    if [ $exit_code -eq 0 ]; then
        generate_env_config

        echo -e "${GREEN}============================================${NC}"
        echo -e "${GREEN}  Setup Complete!${NC}"
        echo -e "${GREEN}============================================${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Add the environment variables above to quikadmin/.env"
        echo "  2. Start the multi-agent worker: npm run dev:worker"
        echo "  3. Upload a document to test the pipeline"
        echo ""
    else
        echo -e "${RED}============================================${NC}"
        echo -e "${RED}  Setup Failed${NC}"
        echo -e "${RED}============================================${NC}"
        echo ""
        echo "Please resolve the issues above and run this script again."
        echo ""
    fi

    exit $exit_code
}

main "$@"
