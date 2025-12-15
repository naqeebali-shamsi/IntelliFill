#!/bin/bash

# IntelliFill Development Environment Setup Script (Unix/Mac)
# This script automates the setup process for new developers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Flags
SKIP_DB=0
SKIP_FRONTEND=0
SKIP_BACKEND=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-db)
            SKIP_DB=1
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=1
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=1
            shift
            ;;
        --help)
            echo ""
            echo "Usage: ./setup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --skip-db        Skip database setup (Prisma migrations)"
            echo "  --skip-frontend  Skip frontend dependency installation"
            echo "  --skip-backend   Skip backend dependency installation"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./setup.sh                    Full setup"
            echo "  ./setup.sh --skip-db          Setup without database"
            echo "  ./setup.sh --skip-frontend    Backend only setup"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "========================================================"
echo "  IntelliFill Development Environment Setup"
echo "========================================================"
echo ""

# ==================== Prerequisites Check ====================
echo "[Step 1/6] Checking prerequisites..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed"
    echo "        Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "  ${GREEN}[OK]${NC} Node.js $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} npm is not installed"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "  ${GREEN}[OK]${NC} npm v$NPM_VERSION"

# Check Bun (required for frontend)
if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Bun is not installed. Installing now..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    if ! command -v bun &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} Failed to install Bun"
        echo "        Please install manually from https://bun.sh"
        exit 1
    fi
    echo -e "  ${GREEN}[OK]${NC} Bun installed successfully"
else
    BUN_VERSION=$(bun -v)
    echo -e "  ${GREEN}[OK]${NC} Bun v$BUN_VERSION"
fi

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}[WARN]${NC} Git is not installed. Some features may not work."
else
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "  ${GREEN}[OK]${NC} Git v$GIT_VERSION"
fi

echo ""

# ==================== Install Root Dependencies ====================
echo "[Step 2/6] Installing root dependencies..."
npm install
echo -e "  ${GREEN}[OK]${NC} Root dependencies installed"
echo ""

# ==================== Install Backend Dependencies ====================
if [ $SKIP_BACKEND -eq 0 ]; then
    echo "[Step 3/6] Installing backend dependencies..."
    cd quikadmin
    npm ci
    cd ..
    echo -e "  ${GREEN}[OK]${NC} Backend dependencies installed"
else
    echo "[Step 3/6] Skipping backend dependencies (--skip-backend)"
fi
echo ""

# ==================== Install Frontend Dependencies ====================
if [ $SKIP_FRONTEND -eq 0 ]; then
    echo "[Step 4/6] Installing frontend dependencies..."
    cd quikadmin-web
    bun install
    cd ..
    echo -e "  ${GREEN}[OK]${NC} Frontend dependencies installed"
else
    echo "[Step 4/6] Skipping frontend dependencies (--skip-frontend)"
fi
echo ""

# ==================== Create Environment Files ====================
echo "[Step 5/6] Setting up environment files..."

# Backend .env
if [ ! -f "quikadmin/.env" ]; then
    if [ -f "quikadmin/.env.example" ]; then
        cp "quikadmin/.env.example" "quikadmin/.env"
        echo -e "  ${GREEN}[OK]${NC} Created quikadmin/.env from example"
        echo -e "  ${YELLOW}[!]${NC}  Please edit quikadmin/.env with your credentials"
    else
        echo -e "  ${YELLOW}[WARN]${NC} No .env.example found for backend"
    fi
else
    echo -e "  ${GREEN}[OK]${NC} quikadmin/.env already exists"
fi

# Frontend .env
if [ ! -f "quikadmin-web/.env" ]; then
    if [ -f "quikadmin-web/.env.example" ]; then
        cp "quikadmin-web/.env.example" "quikadmin-web/.env"
        echo -e "  ${GREEN}[OK]${NC} Created quikadmin-web/.env from example"
    else
        # Create default frontend .env
        cat > "quikadmin-web/.env" << EOF
VITE_API_URL=http://localhost:3002/api
VITE_USE_BACKEND_AUTH=true
EOF
        echo -e "  ${GREEN}[OK]${NC} Created quikadmin-web/.env with defaults"
    fi
else
    echo -e "  ${GREEN}[OK]${NC} quikadmin-web/.env already exists"
fi

# Docker .env
if [ ! -f ".env.docker" ]; then
    if [ -f ".env.docker.example" ]; then
        cp ".env.docker.example" ".env.docker"
        echo -e "  ${GREEN}[OK]${NC} Created .env.docker from example"
        echo -e "  ${YELLOW}[!]${NC}  Please edit .env.docker with your credentials before using Docker"
    fi
else
    echo -e "  ${GREEN}[OK]${NC} .env.docker already exists"
fi

echo ""

# ==================== Database Setup ====================
if [ $SKIP_DB -eq 0 ]; then
    echo "[Step 6/6] Setting up database..."

    # Check if DATABASE_URL is set in backend .env
    if ! grep -q "DATABASE_URL" "quikadmin/.env" 2>/dev/null; then
        echo -e "  ${YELLOW}[WARN]${NC} DATABASE_URL not found in quikadmin/.env"
        echo "         Skipping database setup. Please configure DATABASE_URL first."
    else
        cd quikadmin
        echo "  Running Prisma generate..."
        npx prisma generate || true
        echo -e "  ${GREEN}[OK]${NC} Prisma client generated"

        echo "  Running database migrations..."
        if npx prisma migrate deploy 2>/dev/null; then
            echo -e "  ${GREEN}[OK]${NC} Database migrations applied"
        else
            echo -e "  ${YELLOW}[WARN]${NC} Database migration failed (this is OK for first-time setup)"
            echo "         Run 'npx prisma migrate dev' manually when database is ready"
        fi
        cd ..
    fi
else
    echo "[Step 6/6] Skipping database setup (--skip-db)"
fi

echo ""
echo "========================================================"
echo "  Setup Complete!"
echo "========================================================"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Edit environment files with your credentials:"
echo "     - quikadmin/.env (backend - DATABASE_URL, JWT secrets)"
echo "     - quikadmin-web/.env (frontend - usually no changes needed)"
echo ""
echo "  2. Start development servers:"
echo "     - Backend:  cd quikadmin && npm run dev"
echo "     - Frontend: cd quikadmin-web && bun run dev"
echo ""
echo "  3. Access the application:"
echo "     - Frontend: http://localhost:8080"
echo "     - Backend:  http://localhost:3002"
echo "     - Prisma:   http://localhost:5555"
echo ""
echo "========================================================"
echo ""
