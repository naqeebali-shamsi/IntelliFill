#!/bin/bash

# IntelliFill Extension - Installation Verification Script

echo "==========================================="
echo "IntelliFill Extension - Verification"
echo "==========================================="
echo ""

errors=0
warnings=0

# Check required files
echo "Checking required files..."
required_files=(
  "manifest.json"
  "background.js"
  "content-script.js"
  "popup.html"
  "popup.js"
  "popup.css"
  "styles.css"
  "lib/field-detector.js"
  "lib/autocomplete-injector.js"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (MISSING)"
    ((errors++))
  fi
done

echo ""

# Check documentation
echo "Checking documentation..."
doc_files=(
  "README.md"
  "TESTING.md"
  "IMPLEMENTATION_SUMMARY.md"
  "../docs/guides/user/chrome-extension.md"
  "../docs/guides/developer/extension-architecture.md"
)

for file in "${doc_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ⚠️  $file (MISSING - non-critical)"
    ((warnings++))
  fi
done

echo ""

# Check manifest.json syntax
echo "Checking manifest.json..."
if command -v python3 &> /dev/null; then
  if python3 -m json.tool manifest.json > /dev/null 2>&1; then
    echo "  ✅ Valid JSON syntax"
  else
    echo "  ❌ Invalid JSON syntax"
    ((errors++))
  fi
else
  echo "  ⚠️  Python3 not available, skipping JSON validation"
  ((warnings++))
fi

# Check for placeholder icons
echo ""
echo "Checking icons..."
icon_size_16=$(wc -c < icons/icon16.png)
if [ "$icon_size_16" -lt 100 ]; then
  echo "  ⚠️  icon16.png is a placeholder (size: $icon_size_16 bytes)"
  echo "     Replace with proper icon before production"
  ((warnings++))
else
  echo "  ✅ icon16.png appears to be a real icon"
fi

echo ""

# Summary
echo "==========================================="
echo "Verification Summary"
echo "==========================================="
echo ""
echo "Errors:   $errors"
echo "Warnings: $warnings"
echo ""

if [ $errors -eq 0 ]; then
  echo "✅ Extension is ready for installation!"
  echo ""
  echo "To install:"
  echo "1. Open Chrome and go to chrome://extensions/"
  echo "2. Enable 'Developer mode' (top-right toggle)"
  echo "3. Click 'Load unpacked'"
  echo "4. Select this folder"
  echo ""
  if [ $warnings -gt 0 ]; then
    echo "⚠️  Note: $warnings warnings found (see above)"
    echo "    These are non-critical but should be addressed for production"
  fi
else
  echo "❌ Extension has $errors errors and cannot be installed"
  echo "   Fix the errors above and run this script again"
fi

exit $errors
