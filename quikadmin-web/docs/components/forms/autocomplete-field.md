# AutocompleteField Component

An intelligent form field component that provides autocomplete suggestions from user profile data. Features real-time suggestion ranking, keyboard navigation, and confidence indicators.

## Overview

The `AutocompleteField` component enhances traditional input fields with smart autocomplete functionality powered by the user's profile data. It automatically suggests relevant values based on field name similarity, data confidence, and recency.

## Features

- **Intelligent Suggestions**: Automatically fetches and ranks suggestions from user profile
- **Keyboard Navigation**: Full keyboard support with arrow keys, Enter, and Escape
- **Click-to-Fill**: Quick selection via mouse/touch
- **Confidence Indicators**: Visual badges showing data quality (High/Medium/Low)
- **Field Type Support**: Optimized for text, email, phone, date, address, SSN, and number fields
- **Debounced Input**: Efficient API calls with built-in debouncing
- **Accessibility**: Full ARIA support for screen readers
- **Responsive Design**: Works seamlessly on mobile and desktop

## Installation

The component is part of the IntelliFill component library. Ensure you have the required dependencies:

```bash
npm install @radix-ui/react-slot lucide-react
```

## Basic Usage

```tsx
import { AutocompleteField } from '@/components/features/autocomplete-field';
import { FieldType } from '@/services/suggestionEngine';

function MyForm() {
  const [email, setEmail] = useState('');

  return (
    <AutocompleteField
      name="email"
      label="Email Address"
      fieldType={FieldType.EMAIL}
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="you@example.com"
      required
    />
  );
}
```

## Props

### AutocompleteFieldProps

Extends all standard HTML input props with additional features:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | **required** | Field name used for suggestion matching |
| `fieldType` | `FieldType` | auto-detected | Type of field for better filtering (EMAIL, PHONE, DATE, ADDRESS, etc.) |
| `label` | `string` | `undefined` | Label text displayed above the field |
| `showConfidence` | `boolean` | `true` | Whether to show confidence badges on suggestions |
| `maxSuggestions` | `number` | `5` | Maximum number of suggestions to display |
| `onSuggestionSelect` | `(value: string) => void` | `undefined` | Callback when a suggestion is selected |
| `error` | `string` | `undefined` | Error message to display below the field |
| `required` | `boolean` | `false` | Show required indicator (*) |
| `containerClassName` | `string` | `undefined` | Custom className for the container div |

All other standard `<input>` props are supported (placeholder, disabled, etc.)

## Field Types

The `FieldType` enum helps the component filter and rank suggestions appropriately:

```tsx
enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  ADDRESS = 'address',
  SSN = 'ssn',
  NUMBER = 'number',
  UNKNOWN = 'unknown'
}
```

If not specified, the component auto-detects the field type based on the field name.

## Advanced Examples

### Controlled Component with Validation

```tsx
function EmailField() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Validate email
    if (value && !value.includes('@')) {
      setError('Please enter a valid email address');
    } else {
      setError('');
    }
  };

  return (
    <AutocompleteField
      name="email"
      label="Email Address"
      fieldType={FieldType.EMAIL}
      value={email}
      onChange={handleChange}
      error={error}
      required
    />
  );
}
```

### Custom Suggestion Handler

```tsx
function AddressField() {
  const [address, setAddress] = useState('');

  const handleSuggestionSelect = (value: string) => {
    console.log('User selected:', value);

    // Perform additional actions when suggestion is selected
    analytics.track('autocomplete_used', { field: 'address', value });

    setAddress(value);
  };

  return (
    <AutocompleteField
      name="streetAddress"
      label="Street Address"
      fieldType={FieldType.ADDRESS}
      value={address}
      onChange={(e) => setAddress(e.target.value)}
      onSuggestionSelect={handleSuggestionSelect}
      maxSuggestions={3}
    />
  );
}
```

### Phone Number with Custom Styling

```tsx
function PhoneField() {
  const [phone, setPhone] = useState('');

  return (
    <AutocompleteField
      name="phone"
      label="Phone Number"
      fieldType={FieldType.PHONE}
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
      placeholder="(555) 123-4567"
      className="font-mono"
      showConfidence={true}
      containerClassName="max-w-sm"
    />
  );
}
```

### Form with Multiple Autocomplete Fields

```tsx
function CompleteForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form>
      <div className="grid grid-cols-2 gap-4">
        <AutocompleteField
          name="firstName"
          label="First Name"
          value={formData.firstName}
          onChange={(e) => handleFieldChange('firstName', e.target.value)}
          required
        />

        <AutocompleteField
          name="lastName"
          label="Last Name"
          value={formData.lastName}
          onChange={(e) => handleFieldChange('lastName', e.target.value)}
          required
        />

        <AutocompleteField
          name="email"
          label="Email"
          fieldType={FieldType.EMAIL}
          value={formData.email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          required
        />

        <AutocompleteField
          name="phone"
          label="Phone"
          fieldType={FieldType.PHONE}
          value={formData.phone}
          onChange={(e) => handleFieldChange('phone', e.target.value)}
        />
      </div>
    </form>
  );
}
```

## Keyboard Navigation

The component supports full keyboard navigation:

| Key | Action |
|-----|--------|
| `ArrowDown` | Navigate to next suggestion (or open dropdown if closed) |
| `ArrowUp` | Navigate to previous suggestion |
| `Enter` | Select the highlighted suggestion |
| `Escape` | Close the dropdown without selecting |
| `Tab` | Close the dropdown and move to next field |

## Accessibility

The component implements ARIA best practices:

- `role="textbox"` on the input element
- `role="listbox"` on the suggestions container
- `role="option"` on each suggestion
- `aria-autocomplete="list"` indicates autocomplete behavior
- `aria-expanded` reflects dropdown state
- `aria-controls` links input to suggestions
- `aria-selected` indicates highlighted suggestion
- `aria-invalid` when errors are present
- `aria-describedby` links to error messages
- `aria-label` on interactive elements

## Styling

The component uses Tailwind CSS and integrates with your design system. Key styling features:

- Dropdown appears below the input with smooth animations
- Active/hover states provide clear visual feedback
- Confidence badges use semantic colors (success/warning/muted)
- Responsive design adapts to mobile screens
- Dark mode support via Tailwind classes

### Customizing Styles

```tsx
<AutocompleteField
  name="email"
  className="border-blue-500 focus:ring-blue-500"
  containerClassName="mb-6"
/>
```

## Suggestion Ranking

Suggestions are ranked using a sophisticated algorithm that considers:

1. **Field Name Similarity (40%)**: How closely the field name matches the profile data key
2. **Confidence Score (30%)**: Data quality from OCR extraction (0-100)
3. **Recency (20%)**: How recently the data was updated
4. **Source Count (10%)**: Number of documents containing this data

The ranking ensures the most relevant and reliable suggestions appear first.

## Performance

- **Debouncing**: Input is debounced by 300ms to reduce API calls
- **Caching**: Profile data is cached for 5 minutes to minimize network requests
- **Lazy Loading**: Suggestions are only fetched when the field is focused
- **Virtual Scrolling**: Large suggestion lists remain performant

## Integration with React Hook Form

The component works seamlessly with React Hook Form:

```tsx
import { useForm, Controller } from 'react-hook-form';

function FormWithRHF() {
  const { control, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="email"
        control={control}
        rules={{ required: 'Email is required' }}
        render={({ field, fieldState }) => (
          <AutocompleteField
            {...field}
            label="Email Address"
            fieldType={FieldType.EMAIL}
            error={fieldState.error?.message}
          />
        )}
      />
    </form>
  );
}
```

## Testing

The component is fully tested with Vitest and React Testing Library. See the test file for examples:

```bash
npm test autocomplete-field.test.tsx
```

Test coverage includes:
- Rendering and basic functionality
- Keyboard navigation
- Suggestion ranking
- Click-to-fill interaction
- Debouncing logic
- Accessibility (ARIA attributes)
- Controlled/uncontrolled modes

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Troubleshooting

### No suggestions appear

1. Ensure the user has uploaded documents with extracted data
2. Check that the profile API endpoint is returning data: `GET /api/users/me/profile`
3. Verify the field name matches or is similar to profile data keys
4. Check browser console for API errors

### Suggestions don't match the field

1. Specify the `fieldType` prop explicitly
2. Use descriptive field names (e.g., "email" instead of "field1")
3. Ensure profile data keys are normalized (lowercase, underscores)

### Dropdown doesn't close

1. Check for JavaScript errors in the console
2. Ensure the component is not inside a form that's preventing event propagation
3. Verify that `onBlur` is not being overridden

### Performance issues with many suggestions

1. Reduce `maxSuggestions` prop (default is 5)
2. Ensure profile data is properly cached
3. Check for memory leaks in parent components

## Related Components

- `Input`: Base input component used internally
- `Badge`: Confidence indicator component
- `Popover`: Could be used for more complex dropdown layouts

## API Reference

### SuggestionEngine

The underlying service that powers suggestions:

```tsx
import { getSuggestionEngine } from '@/services/suggestionEngine';

const engine = getSuggestionEngine();

// Fetch suggestions
const suggestions = await engine.getSuggestions(
  'email',           // field name
  FieldType.EMAIL,   // field type
  'john',            // current value
  5                  // max suggestions
);

// Refresh profile cache
await engine.refreshProfile();

// Clear cache
engine.clearCache();
```

## Contributing

When contributing to this component:

1. Add tests for new features
2. Update documentation
3. Ensure accessibility standards are maintained
4. Follow the existing code style
5. Test on multiple browsers

## License

Part of the IntelliFill project.
