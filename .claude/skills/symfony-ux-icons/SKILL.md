---
name: symfony-ux-icons
description: "Render SVG icons in Symfony with UX Icons. TRIGGER when: user works with icon rendering, SVG icons, Iconify, ux:icon Twig function, or icon sets in Symfony. Covers local SVG icons, Iconify integration, icon customization, and caching. DO NOT TRIGGER when: user works with font icons (FontAwesome CSS classes) or image tags."
license: Complete terms in LICENSE.txt
---

# Symfony UX Icons

Symfony UX Icons provides a simple way to render SVG icons in Twig templates. It supports local SVG files and the Iconify icon catalog (200,000+ icons).

## Installation

```bash
composer require symfony/ux-icons
```

## Basic Usage

### Rendering Icons

```twig
{# Render a local SVG icon from assets/icons/ #}
{{ ux_icon('user') }}
{# Looks for: assets/icons/user.svg #}

{# Subdirectory #}
{{ ux_icon('actions/edit') }}
{# Looks for: assets/icons/actions/edit.svg #}

{# Iconify (any icon from iconify.dev) #}
{{ ux_icon('mdi:home') }}
{{ ux_icon('lucide:search') }}
{{ ux_icon('heroicons:arrow-right') }}

{# Using the Twig component syntax #}
<twig:ux:icon name="user" />
<twig:ux:icon name="lucide:heart" class="text-red" />
```

### Adding HTML Attributes

```twig
{{ ux_icon('check', {
    class: 'icon icon-lg text-success',
    width: '24',
    height: '24',
    'aria-hidden': 'true',
}) }}

{# With Twig component syntax #}
<twig:ux:icon name="spinner" class="animate-spin" width="20" height="20" />
```

---

## Local Icons

Place SVG files in `assets/icons/`:

```
assets/
└── icons/
    ├── user.svg
    ├── check.svg
    ├── actions/
    │   ├── edit.svg
    │   ├── delete.svg
    │   └── view.svg
    └── social/
        ├── github.svg
        └── twitter.svg
```

```twig
{# Reference by path relative to assets/icons/ #}
{{ ux_icon('user') }}
{{ ux_icon('actions/edit') }}
{{ ux_icon('social/github') }}
```

### SVG Requirements

Local SVGs should use `currentColor` for fill/stroke to support CSS color inheritance:

```xml
<!-- assets/icons/check.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" 
     stroke="currentColor" stroke-width="2">
    <path d="M20 6L9 17l-5-5"/>
</svg>
```

---

## Iconify Integration

Access 200,000+ icons from [Iconify](https://iconify.design/) using `prefix:name` syntax:

```twig
{# Popular icon sets #}
{{ ux_icon('mdi:account') }}              {# Material Design Icons #}
{{ ux_icon('lucide:settings') }}          {# Lucide #}
{{ ux_icon('heroicons:home-solid') }}     {# Heroicons #}
{{ ux_icon('fa6-solid:star') }}           {# Font Awesome 6 #}
{{ ux_icon('bi:envelope') }}              {# Bootstrap Icons #}
{{ ux_icon('tabler:brand-github') }}      {# Tabler Icons #}
{{ ux_icon('ph:camera-bold') }}           {# Phosphor Icons #}
```

### Configuration

```yaml
# config/packages/ux_icons.yaml
ux_icons:
    # Default attributes applied to all icons
    default_icon_attributes:
        fill: currentColor
        height: '1em'
        width: '1em'
    
    # Iconify endpoint (default: Iconify public API)
    iconify:
        enabled: true
        on_demand:
            enabled: true  # Fetch icons at runtime if not cached
```

---

## Caching

Icons fetched from Iconify are cached automatically. In production, warm the cache:

```bash
# Pre-download all Iconify icons used in templates
php bin/console ux:icons:warm-cache
```

---

## Styling Icons

```css
/* Size via font-size (icons use 1em by default) */
.icon-sm { font-size: 16px; }
.icon-md { font-size: 24px; }
.icon-lg { font-size: 32px; }

/* Color via currentColor */
.text-primary svg { color: #0d6efd; }
.text-danger svg { color: #dc3545; }

/* Or directly */
svg.icon { transition: color 0.2s; }
svg.icon:hover { color: #667eea; }
```

```twig
<span class="text-primary">
    {{ ux_icon('lucide:check-circle', {class: 'icon-lg'}) }}
</span>
```

---

## Decision Tree

```
Need to display an icon?
├─ Custom/brand icon → Local SVG in assets/icons/
├─ Common UI icon → Iconify (lucide, heroicons, etc.)
├─ Need CSS color control → Use currentColor in SVG
├─ Production optimization → Run ux:icons:warm-cache
└─ Accessibility → Add aria-label or aria-hidden
```

## Common Pitfalls

- **Icon not found** — Check the file exists in `assets/icons/` or verify the Iconify prefix:name
- **Color not working** — SVG must use `currentColor` for `fill` or `stroke`
- **Performance** — Use `ux:icons:warm-cache` in production to avoid runtime Iconify API calls
- **Sizing** — Default is `1em` × `1em`; override with `width`/`height` attributes or CSS
