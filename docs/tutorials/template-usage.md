# User Guide: Template Management

Templates in IntelliFill allow you to save and reuse field mappings for forms you fill frequently. This guide will show you how to create, manage, and use templates effectively.

## Table of Contents

1. [What are Templates?](#what-are-templates)
2. [Creating Templates](#creating-templates)
3. [Managing Templates](#managing-templates)
4. [Using Templates](#using-templates)
5. [Template Marketplace](#template-marketplace)
6. [Best Practices](#best-practices)

---

## What are Templates?

Templates are pre-configured sets of field mappings that tell IntelliFill how to fill out specific forms. Instead of manually mapping fields every time you fill out a W-2 form or job application, you can save the mapping as a template and reuse it instantly.

### Benefits of Templates

- **Save Time**: Create the mapping once, use it unlimited times
- **Consistency**: Ensure forms are filled the same way every time
- **Share**: Make your templates public to help others
- **Auto-Detection**: IntelliFill can automatically suggest the right template based on form fields

### Supported Form Types

IntelliFill comes with pre-loaded templates for common forms:

- **W-2**: Wage and Tax Statement
- **I-9**: Employment Eligibility Verification
- **Passport**: US Passport Application
- **Job Application**: Standard employment applications
- **Custom**: Any other form type

---

## Creating Templates

### Method 1: Create from Scratch

1. Navigate to the **Templates** page from the sidebar
2. Click **New Template** button
3. Fill in the template details:
   - **Name**: Give your template a descriptive name (e.g., "ABC Company W-2")
   - **Form Type**: Select the type of form (W2, I9, Passport, etc.)
   - **Description** (optional): Add notes about when to use this template
4. Click **Create Template**
5. You'll add field mappings when you first use the template

### Method 2: Create While Filling a Form

1. Go to the **Fill Form** page
2. Upload your form PDF
3. Map the fields as usual
4. Click **Save as Template** after mapping
5. Give your template a name and save

### Template Details

**Name**: Choose a clear, descriptive name

- Good: "W-2 for ABC Corp 2025"
- Bad: "Template 1"

**Form Type**: Select the appropriate type for better auto-detection

- Choose CUSTOM if your form doesn't fit any category

**Field Mappings**: The heart of your template

- Links source data (from your profile) to form fields
- Example: `employer_ein` → `Box c (Employer's EIN)`
- Includes confidence scores for each mapping

---

## Managing Templates

### Viewing Your Templates

1. Navigate to **Templates** page
2. View your templates in grid or list layout
3. Search templates by name or description
4. Click any template to view details

### Editing Templates

1. Find the template you want to edit
2. Click the **Edit** button (pencil icon)
3. Modify:
   - Template name
   - Description
   - Form type
   - Field mappings
   - Public/private status
4. Click **Save Changes**

### Deleting Templates

1. Find the template to delete
2. Click the **Delete** button (trash icon)
3. Confirm deletion in the dialog

**Note**: Deleted templates are soft-deleted and can be recovered by administrators if needed.

### Making Templates Public

Share your templates with the IntelliFill community:

1. Edit your template
2. Toggle **Make Public** switch
3. Save changes

Your template will appear in the marketplace for other users to use.

**Requirements for Public Templates:**

- Clear, descriptive name
- Helpful description
- Complete field mappings
- Accurate form type

---

## Using Templates

### Apply Template Manually

1. Go to **Fill Form** page
2. Upload your form PDF
3. Click **Use Template** button
4. Select your template from the list
5. Review and adjust mappings if needed
6. Click **Fill Form**

### Auto-Suggested Templates

IntelliFill can automatically suggest templates when you upload a form:

1. Upload your form PDF
2. IntelliFill analyzes the form fields
3. If a matching template is found, you'll see a suggestion banner
4. Click **Use Template** to apply it
5. Proceed with form filling

### Template Matching

IntelliFill uses sophisticated algorithms to match forms with templates:

- **Field Name Analysis**: Compares form field names with template mappings
- **Fuzzy Matching**: Recognizes similar field names (e.g., "SSN" vs "Social Security Number")
- **Confidence Scoring**: Shows how well the template matches (0-100%)
- **Smart Ranking**: Best matches appear first

**Matching Example:**

```
Your Form Fields:
- employer_ein
- employee_ssn
- wages
- federal_tax

Matched Template: "W-2 Tax Form" (85% match)
- employer_ein ✓
- employee_ssn ✓
- wages ✓
- federal_income_tax ≈ (fuzzy match with federal_tax)
```

---

## Template Marketplace

The Template Marketplace is where you can browse and use templates shared by the IntelliFill community.

### Accessing the Marketplace

1. Navigate to **Templates** page
2. Click the **Marketplace** tab
3. Browse available public templates

### Using Marketplace Templates

1. Find a template that fits your needs
2. Click **Use Template**
3. The template will be applied to your current form
4. IntelliFill tracks usage to help rank popular templates

### Pre-loaded Templates

IntelliFill includes official templates for common forms:

#### W-2 Wage and Tax Statement

Maps all standard W-2 boxes:

- Employee information (SSN, name, address)
- Employer information (EIN, name, address)
- Wage and tax boxes (1-20)
- State and local information

#### I-9 Employment Eligibility Verification

Covers all sections:

- Employee information and attestation
- Document verification (List A, B, C)
- Employer review and certification
- Reverification and rehires

#### US Passport Application (DS-11)

Includes all required fields:

- Personal information
- Birth information
- Physical characteristics
- Contact information
- Emergency contact
- Parental information

#### Job Application

Standard employment application fields:

- Personal information
- Position applying for
- Education history
- Work experience
- References
- Availability

---

## Best Practices

### Naming Conventions

Use clear, descriptive names that include:

- Form type: "W-2", "Job Application"
- Context: "ABC Corp", "Remote Positions"
- Year (if applicable): "2025"

**Examples:**

- ✓ "W-2 for ABC Corp 2025"
- ✓ "Job Application - Tech Positions"
- ✓ "Passport Renewal Application"
- ✗ "Template 1"
- ✗ "Form"

### Organizing Templates

- Create separate templates for different employers/contexts
- Use descriptions to note special requirements
- Delete old/unused templates to keep your list clean
- Make frequently-used templates easy to identify

### Field Mapping Tips

1. **Use Consistent Source Fields**: Match your profile field names
2. **Set Confidence Scores**: Higher for exact matches, lower for approximations
3. **Test Thoroughly**: Fill a form with the template to verify all mappings work
4. **Update Regularly**: If form layouts change, update your templates

### Security Best Practices

1. **Don't Include Sensitive Data**: Templates store mapping rules, not actual data
2. **Review Before Sharing**: Only make templates public if they don't contain personal information
3. **Use Specific Templates**: Create separate templates for different contexts to avoid data leakage

### Maintenance

- **Review Quarterly**: Check templates are still accurate
- **Update After Changes**: If you update your profile fields, update related templates
- **Test Periodically**: Ensure templates still work with current form versions
- **Delete Obsolete**: Remove templates for forms you no longer use

---

## Troubleshooting

### Template Not Matching

**Problem**: IntelliFill doesn't suggest your template for a form

**Solutions**:

1. Check form type is correct
2. Verify field names match between template and form
3. Update field mappings to match current form layout
4. Check template is active (not deleted)

### Missing Field Mappings

**Problem**: Template doesn't fill all form fields

**Solutions**:

1. Edit template and add missing field mappings
2. Check source fields exist in your profile
3. Verify field names are spelled correctly
4. Update your profile data if fields are missing

### Template Auto-Detection Not Working

**Problem**: No templates suggested when uploading form

**Causes**:

1. No templates created yet for this form type
2. Form fields don't match template mappings closely enough
3. Custom forms may not trigger auto-detection

**Solutions**:

1. Create a template for this form type
2. Manually select template from template list
3. Use form type detection to identify form type first

---

## FAQ

**Q: How many templates can I create?**
A: There's no limit on the number of templates you can create.

**Q: Can I export templates?**
A: Currently, templates are stored in your account. Export functionality is planned for a future release.

**Q: What happens to my forms if I delete a template?**
A: Previously filled forms are not affected. Only future form fills will not have access to the deleted template.

**Q: Can I use marketplace templates without creating an account?**
A: No, authentication is required to use any IntelliFill features, including marketplace templates.

**Q: How do I know which template to use?**
A: IntelliFill's auto-detection will suggest the best match. You can also manually browse templates and check the similarity score when matching.

**Q: Are my templates private by default?**
A: Yes, all templates are private unless you explicitly make them public.

**Q: Can I modify marketplace templates?**
A: You can use marketplace templates, but to modify them, you'll need to create your own copy first.

---

## Related Documentation

- [API Reference: Templates](/docs/api/reference/templates.md)
- [User Guide: Profile Management](/docs/guides/user/profile.md)
- [User Guide: Form Filling](/docs/guides/user/form-filling.md)
- [FAQ: Common Questions](/docs/faq.md)

---

## Need Help?

If you have questions or issues with templates:

1. Check this guide and the FAQ
2. Contact support at support@intellifill.app
3. Join our community forum at community.intellifill.app

**Version**: 1.0.0 (November 2025)
