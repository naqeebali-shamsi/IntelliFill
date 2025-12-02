# Profile Management Guide

## Overview

IntelliFill automatically extracts and aggregates your personal information from uploaded documents, creating a unified profile that you can view, edit, and manage. This guide explains how to use the Profile Settings page to manage your stored profile data.

## Table of Contents

1. [Accessing Profile Settings](#accessing-profile-settings)
2. [Understanding Your Profile](#understanding-your-profile)
3. [Profile Statistics](#profile-statistics)
4. [Field Categories](#field-categories)
5. [Managing Profile Fields](#managing-profile-fields)
6. [Confidence Scores](#confidence-scores)
7. [Adding Custom Fields](#adding-custom-fields)
8. [Searching Fields](#searching-fields)
9. [Refreshing Your Profile](#refreshing-your-profile)
10. [Deleting Profile Data](#deleting-profile-data)
11. [Troubleshooting](#troubleshooting)

---

## Accessing Profile Settings

1. Log in to your IntelliFill account
2. Navigate to **Settings** from the main menu
3. Select **Profile Settings** tab

Alternatively, you can access Profile Settings directly via the URL: `/profile-settings`

---

## Understanding Your Profile

Your profile is automatically created by aggregating data extracted from all documents you've uploaded and processed. IntelliFill uses intelligent algorithms to:

- **Deduplicate** similar values (e.g., phone numbers in different formats)
- **Merge** data from multiple sources
- **Track confidence** scores based on OCR accuracy and consistency
- **Maintain source attribution** to show which documents contributed each field

### How Profile Aggregation Works

1. **Document Upload**: When you upload documents (IDs, tax forms, etc.)
2. **OCR Processing**: IntelliFill extracts text and structured data
3. **Field Detection**: The system identifies personal information fields
4. **Aggregation**: Data is merged into your unified profile
5. **Deduplication**: Similar values are intelligently deduplicated
6. **Confidence Scoring**: Each field receives a confidence score

---

## Profile Statistics

At the top of the Profile Settings page, you'll see three key statistics:

### Total Fields
- Shows the total number of fields in your profile
- Includes extracted and manually added fields
- Displays the number of source documents

### Last Updated
- Date and time of last profile aggregation
- Automatically updates when documents are processed
- Can be manually refreshed

### Average Confidence
- Overall accuracy score of your profile data
- Calculated from all field confidence scores
- Higher scores indicate more reliable data

---

## Field Categories

Your profile fields are organized into four categories:

### 1. Personal Information
Personal details about you:
- First Name, Last Name, Middle Name
- Date of Birth
- Social Security Number (SSN)
- Other identifying information

### 2. Contact Information
Ways to reach you:
- Email addresses
- Phone numbers (home, mobile, work)
- Fax numbers

### 3. Address Information
Where you live or receive mail:
- Street address
- City, State, ZIP code
- Country
- Secondary addresses

### 4. Custom Fields
Additional fields that don't fit standard categories:
- Driver's license number
- Passport number
- Employee ID
- Any manually added fields

---

## Managing Profile Fields

Each field in your profile can be viewed, edited, or deleted.

### Viewing Field Details

Each field displays:
- **Field Name**: The type of information (e.g., "Email", "Phone")
- **Current Value**: The stored data
- **Confidence Badge**: Color-coded accuracy score
  - 🟢 Green (80-100%): High confidence
  - 🟡 Yellow (50-79%): Medium confidence
  - 🔴 Red (0-49%): Low confidence
- **Source Count**: Number of documents that contributed this field
- **Last Updated**: When the field was last modified

### Editing a Field

1. **Hover** over the field you want to edit
2. Click the **Edit** button (pencil icon)
3. Modify the value in the input field
4. Click the **Save** button (checkmark icon) or press `Enter`
5. To cancel, click the **Cancel** button (X icon) or press `Escape`

**Validation**:
- Email fields must be valid email addresses
- Phone numbers must contain 10-15 digits
- SSN must be in format XXX-XX-XXXX
- Date fields must be valid dates
- Invalid entries will show an error message

### Deleting a Field

1. **Hover** over the field you want to delete
2. Click the **Delete** button (trash icon)
3. Confirm deletion in the dialog
4. The field will be removed from your profile

**Note**: Deleting a field doesn't delete the original documents. You can regenerate the profile by refreshing.

---

## Confidence Scores

Confidence scores indicate how reliable the extracted data is:

### Score Ranges

| Score | Color | Meaning |
|-------|-------|---------|
| 80-100% | Green | High confidence - Data is very reliable |
| 50-79% | Yellow | Medium confidence - Data may need verification |
| 0-49% | Red | Low confidence - Data should be reviewed |

### Factors Affecting Confidence

- **Document quality**: Clear, high-resolution documents score higher
- **Consistency**: Values found in multiple documents score higher
- **OCR accuracy**: Text clarity affects extraction quality
- **Manual edits**: Manually entered fields have 100% confidence

### Improving Confidence Scores

To improve low confidence scores:
1. Upload higher quality document scans
2. Process multiple documents with the same information
3. Manually edit and verify the field value

---

## Adding Custom Fields

You can manually add fields that weren't automatically extracted:

### Steps to Add a Field

1. Click the **Add Field** button in the top right
2. Enter the **Field Name** (e.g., "Passport Number")
3. Enter the **Field Value** (e.g., "123456789")
4. Click **Add Field** to save

**Field Name Requirements**:
- 1-50 characters
- Letters, numbers, spaces, hyphens, and underscores only
- Will be normalized (e.g., "Passport Number" → "passport_number")

**Field Value Requirements**:
- 1-500 characters
- Any text or numbers

### Custom Field Best Practices

- Use descriptive names (e.g., "Work Phone" not "Phone2")
- Keep values concise and accurate
- Group related information logically
- Avoid duplicating existing fields

---

## Searching Fields

Use the search bar to quickly find specific fields:

### Search Capabilities

- Search by **field name** (e.g., "email", "address")
- Search by **field value** (e.g., "john.doe@example.com")
- Case-insensitive matching
- Real-time filtering

### Search Tips

- Use partial matches (e.g., "mail" finds "email", "mailing address")
- Search applies to all tabs
- Clear search to see all fields again

---

## Refreshing Your Profile

Your profile automatically updates when you process new documents. You can also manually refresh:

### When to Refresh

- After uploading and processing new documents
- If you suspect data is outdated (older than 1 hour)
- To re-aggregate data after document deletions

### How to Refresh

1. Click the **Refresh** button in the top right
2. Wait for the process to complete (usually a few seconds)
3. Your profile will be updated with the latest data

**Note**: Refreshing re-aggregates data from ALL your documents and may update confidence scores.

---

## Deleting Profile Data

You have two options for removing profile data:

### Delete Individual Fields

- Removes a single field from your profile
- Other fields remain intact
- Can be regenerated by refreshing

### Delete Entire Profile

Located in the **Danger Zone** at the bottom:

1. Click **Delete Entire Profile**
2. Confirm you understand this action
3. Click **Yes, Delete Profile**

**Important Notes**:
- This action cannot be undone
- Your documents are NOT deleted
- You can regenerate your profile by clicking "Refresh Profile"
- Useful for clearing all profile data before re-extraction

---

## Troubleshooting

### Profile Not Loading

**Problem**: Profile page shows an error or doesn't load

**Solutions**:
1. Check your internet connection
2. Refresh the page
3. Log out and log back in
4. Clear browser cache
5. Contact support if issue persists

### Missing Fields

**Problem**: Expected fields are not showing up

**Solutions**:
1. Click **Refresh** to re-aggregate data
2. Verify documents were successfully processed (check Document Library)
3. Check if documents contain the expected information
4. Add missing fields manually using "Add Field"

### Low Confidence Scores

**Problem**: Many fields have low confidence scores

**Solutions**:
1. Upload higher quality document scans
2. Process multiple documents with the same information
3. Manually verify and edit field values
4. Use well-lit, clear photos of documents

### Cannot Edit Field

**Problem**: Edit button doesn't work or input is disabled

**Solutions**:
1. Ensure you're not already editing another field
2. Check if a background operation is in progress
3. Refresh the page
4. Try a different browser

### Validation Errors

**Problem**: Cannot save edited field due to validation error

**Solutions**:
- **Email**: Ensure format is `user@domain.com`
- **Phone**: Use format like `555-123-4567` or `(555) 123-4567`
- **SSN**: Use format `XXX-XX-XXXX` or `XXXXXXXXX`
- **Date**: Use format `YYYY-MM-DD`, `MM/DD/YYYY`, or `MM-DD-YYYY`

### Profile Updates Not Saving

**Problem**: Changes don't persist after saving

**Solutions**:
1. Check for network errors in browser console
2. Verify you have permission to update your profile
3. Ensure you're not in a read-only mode
4. Contact support if issue persists

### Duplicate Fields

**Problem**: Same field appears multiple times

**Solutions**:
1. Deduplication should handle this automatically
2. If duplicates persist, delete the unwanted instances
3. Refresh profile to re-aggregate
4. Report the issue if problem continues

---

## Data Privacy and Security

### How Your Data is Protected

- All profile data is encrypted at rest
- Transmitted over secure HTTPS connections
- Access restricted to your account only
- Regular security audits and updates

### Data Retention

- Profile data is stored as long as your account is active
- Deleting your profile removes aggregated data
- Original documents remain in Document Library unless deleted
- Account deletion removes all associated data

### Compliance

IntelliFill complies with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- SOC 2 Type II standards
- Industry security best practices

---

## Best Practices

### Regular Profile Maintenance

1. **Review monthly**: Check your profile for accuracy
2. **Update changes**: Edit fields when information changes
3. **Remove outdated**: Delete obsolete information
4. **Add missing**: Manually add important fields not extracted

### Document Management

1. **Upload quality scans**: Use 300 DPI or higher
2. **Process regularly**: Don't let documents pile up
3. **Verify extraction**: Review extracted data after processing
4. **Keep originals**: Maintain copies of important documents

### Security Tips

1. **Use strong password**: Protect your IntelliFill account
2. **Enable 2FA**: Add two-factor authentication
3. **Log out**: Always log out on shared computers
4. **Monitor access**: Check active sessions in Security Settings

---

## Keyboard Shortcuts

Speed up your workflow with these shortcuts:

| Action | Shortcut |
|--------|----------|
| Save field edit | `Enter` |
| Cancel field edit | `Escape` |
| Search fields | `Ctrl/Cmd + F` |
| Navigate tabs | `Arrow Keys` (when focused on tabs) |

---

## Related Documentation

- [Document Processing Guide](./document-processing.md)
- [OCR Best Practices](./ocr-best-practices.md)
- [Data Security Overview](../security/data-security.md)
- [API Documentation](../../api/profile-api.md)

---

## Getting Help

If you need additional assistance:

1. **Documentation**: Check our [Help Center](https://help.intellifill.com)
2. **Support**: Email [support@intellifill.com](mailto:support@intellifill.com)
3. **Community**: Join our [Discord community](https://discord.gg/intellifill)
4. **FAQ**: Visit our [FAQ page](https://intellifill.com/faq)

---

## Feedback

We're constantly improving IntelliFill. Share your feedback:

- **Feature requests**: [feedback@intellifill.com](mailto:feedback@intellifill.com)
- **Bug reports**: [bugs@intellifill.com](mailto:bugs@intellifill.com)
- **General feedback**: Use the feedback form in Settings

Thank you for using IntelliFill!

---

*Last updated: January 2025*
*Version: 1.0.0*
