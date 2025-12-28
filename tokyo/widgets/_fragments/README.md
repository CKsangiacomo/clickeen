# Widget Spec Fragments

To keep specs tiny, use Dieter element shorthands and let the compiler expand them:

```html
<bob-panel id='content'>
  <diet-textfield path='title' label='Title' size='md' />
</bob-panel>
```

Rules:
- `path` is mandatory (`instanceData` binding).
- `label` optional; defaults to path.
- `size` optional; defaults to `md`.
- For toggles: `<diet-toggle path='showTitle' label='Show title' />`

The compiler will pull the Dieter component markup from the CDN and inject `data-bob-path`/`data-bob-showif` automatically. Keep specs in plain HTML for AI friendliness.
