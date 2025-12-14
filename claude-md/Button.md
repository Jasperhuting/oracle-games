# Button Component

A flexible, themed button component with multiple color variants and style modifiers.

## Usage

```tsx
import { Button } from '@/components/Button';
```

## Color Variants

Choose from 5 color variants:

```tsx
<Button variant="primary" text="Primary" />      {/* default */}
<Button variant="secondary" text="Secondary" />
<Button variant="success" text="Success" />
<Button variant="danger" text="Danger" />
<Button variant="warning" text="Warning" />
```

## Style Modifiers

Each color variant can be combined with style modifiers:

### Solid (default)
Standard filled buttons with white text.

```tsx
<Button variant="danger" text="Delete" />
```

### Outline
Transparent background with colored border. Add `outline` prop.

```tsx
<Button variant="danger" outline text="Delete" />
<Button variant="success" outline text="Approve" />
<Button variant="primary" outline text="Learn More" />
```

### Ghost
Transparent background with no border. Add `ghost` prop.

```tsx
<Button variant="danger" ghost text="Cancel" />
<Button variant="success" ghost text="Done" />
<Button variant="primary" ghost text="Skip" />
```

## All Combinations

```tsx
// Solid buttons (default)
<Button variant="primary" text="Primary" />
<Button variant="secondary" text="Secondary" />
<Button variant="success" text="Success" />
<Button variant="danger" text="Danger" />
<Button variant="warning" text="Warning" />

// Outline buttons
<Button variant="primary" outline text="Primary" />
<Button variant="secondary" outline text="Secondary" />
<Button variant="success" outline text="Success" />
<Button variant="danger" outline text="Danger" />
<Button variant="warning" outline text="Warning" />

// Ghost buttons
<Button variant="primary" ghost text="Primary" />
<Button variant="secondary" ghost text="Secondary" />
<Button variant="success" ghost text="Success" />
<Button variant="danger" ghost text="Danger" />
<Button variant="warning" ghost text="Warning" />
```

## Sizes

```tsx
<Button size="sm" text="Small" />
<Button size="md" text="Medium" />  {/* default */}
<Button size="lg" text="Large" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning'` | `'primary'` | Button color variant |
| `outline` | `boolean` | `false` | Apply outline style (transparent with border) |
| `ghost` | `boolean` | `false` | Apply ghost style (transparent, no border) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `text` | `string \| React.ReactNode` | - | Button text content |
| `children` | `React.ReactNode` | - | Alternative to `text` prop |
| `fullWidth` | `boolean` | `false` | Make button full width |
| `disabled` | `boolean` | `false` | Disable button |
| `selected` | `boolean` | `false` | Apply selected state styling |
| `startIcon` | `React.ReactNode` | - | Icon to show before text |
| `endIcon` | `React.ReactNode` | - | Icon to show after text |
| `className` | `string` | - | Additional CSS classes |
| `onClick` | `() => void` | - | Click handler |

## Examples

### With Icons
```tsx
<Button
  variant="primary"
  text="Save"
  startIcon={<SaveIcon />}
/>

<Button
  variant="outline"
  text="Next"
  endIcon={<ArrowRightIcon />}
/>
```

### Full Width
```tsx
<Button
  variant="primary"
  text="Submit"
  fullWidth
/>
```

### Selected State
```tsx
<Button
  variant="outline"
  text="Active Tab"
  selected
/>
```

### Disabled
```tsx
<Button
  variant="primary"
  text="Loading..."
  disabled
/>
```

### Using Children Instead of Text
```tsx
<Button variant="success">
  <span>Custom Content</span>
</Button>
```

### Custom Styling
```tsx
<Button
  variant="primary"
  text="Custom"
  className="shadow-lg rounded-full"
/>
```

## Migrating from Old Theme System

**Old:**
```tsx
<Button theme="green" className="bg-green-600 hover:bg-green-700" />
```

**New:**
```tsx
<Button variant="success" />
```

**Old:**
```tsx
<Button theme="red" className="bg-red-600" />
```

**New:**
```tsx
<Button variant="danger" />
```

**Old:**
```tsx
<Button theme="blue" />
```

**New:**
```tsx
<Button variant="primary" />
```

## Common Use Cases

### Action Buttons
```tsx
// Primary action
<Button variant="primary" text="Save Changes" />

// Secondary action
<Button variant="outline" text="Cancel" />

// Destructive action
<Button variant="danger" text="Delete Account" />

// Confirm destructive action
<Button variant="outline-danger" text="Confirm Delete" />
```

### Form Buttons
```tsx
<div className="flex gap-2">
  <Button variant="primary" text="Submit" fullWidth />
  <Button variant="ghost" text="Reset" fullWidth />
</div>
```

### Icon Buttons
```tsx
<Button variant="ghost-primary" startIcon={<PlusIcon />} size="sm" />
<Button variant="outline-danger" startIcon={<TrashIcon />} text="Delete" />
```

### Loading State
```tsx
<Button variant="primary" text="Loading..." disabled />
```

### Status Actions
```tsx
// Approve
<Button variant="success" text="Approve" size="sm" />

// Reject
<Button variant="ghost-danger" text="Reject" size="sm" />

// Pending
<Button variant="warning" text="Under Review" disabled />
```

## Quick Reference

| Use Case | Recommended Variant |
|----------|-------------------|
| Primary CTA | `variant="primary"` |
| Secondary action | `variant="outline"` or `variant="secondary"` |
| Cancel/Dismiss | `variant="ghost"` or `variant="outline"` |
| Confirm | `variant="success"` |
| Delete/Remove | `variant="danger"` |
| Soft delete | `variant="outline-danger"` or `variant="ghost-danger"` |
| Warning action | `variant="warning"` or `variant="outline-warning"` |
| Subtle action | `variant="ghost-*"` |

## Customizing Variants

To add or modify variants, edit the `variantStyles` object in `Button.tsx`:

```tsx
const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary/90 border-primary',
    // Add your custom variant
    'custom': 'bg-purple-600 text-white hover:bg-purple-700 border-purple-600',
    'outline-custom': 'bg-transparent text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white',
    'ghost-custom': 'bg-transparent text-purple-600 border-transparent hover:bg-purple-50',
};
```

Then update the TypeScript type:
```tsx
variant?: 'primary' | 'secondary' | ... | 'custom' | 'outline-custom' | 'ghost-custom';
```
