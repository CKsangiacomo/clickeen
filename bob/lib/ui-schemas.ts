// This is a temporary mock of the UI schema that will eventually come from Paris/Geneva.
export const MOCK_UI_SCHEMA: Record<string, any> = {
  'widget.faq': {
    tdmenu: [
      { id: 'content', icon: 'scribble', label: 'Content' },
      { id: 'layout', icon: 'square.on.square', label: 'Layout' },
      { id: 'appearance', icon: 'slowmo', label: 'Appearance' },
      { id: 'settings', icon: 'rectangle.on.rectangle.badge.gearshape', label: 'Settings' },
    ],
    tdmenucontent: {
      content: {
        title: 'Content',
        controls: [
          { type: 'textfield', configPath: 'title', label: 'Widget Title' },
          { type: 'toggle', configPath: 'showTitle', label: 'Show Title' },
          { type: 'toggle', configPath: 'showCategoryTitles', label: 'Show Category Titles' },
          {
            type: 'repeater',
            configPath: 'categories',
            label: 'Categories',
          },
        ],
      },
      layout: {
        title: 'Layout',
        controls: [
          {
            type: 'segmented',
            configPath: 'layout',
            options: [
              { label: 'Accordion', value: 'accordion' },
              { label: 'List', value: 'list' },
              { label: 'Multicolumn', value: 'multicolumn' },
            ],
          },
          {
            type: 'segmented',
            configPath: 'accordionIcon',
            options: [
              { label: 'Plus', value: 'plus' },
              { label: 'Arrow', value: 'arrow' },
            ],
          },
          { type: 'toggle', configPath: 'showSearchBar', label: 'Show Search Bar' },
          { type: 'toggle', configPath: 'openFirstByDefault', label: 'Open First Question by Default' },
          { type: 'toggle', configPath: 'multipleActive', label: 'Allow Multiple Active Questions' },
          {
            type: 'textfield',
            configPath: 'searchPlaceholder',
            label: 'Search Placeholder',
            condition: { configPath: 'showSearchBar', value: true },
          },
        ],
      },
      settings: {
        title: 'Settings',
        controls: [
          { type: 'toggle', configPath: 'settings.displayVideos', label: 'Display Videos' },
          { type: 'toggle', configPath: 'settings.displayImages', label: 'Display Images' },
          { type: 'expander', label: 'Custom JS', children: [{ type: 'textarea', configPath: 'settings.customJS' }] },
        ],
      },
      appearance: {
        title: 'Appearance',
        controls: [
          {
            type: 'dropdown',
            configPath: 'appearance.template',
            triggerLabel: (val: string) => val ? val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Background',
            options: [
              { label: 'Clear', value: 'clear' },
              { label: 'Background', value: 'background' },
              { label: 'Background & Shadow', value: 'background-shadow' },
              { label: 'Background & Border', value: 'background-border' },
            ],
          },
          { type: 'color', configPath: 'appearance.itemBackgroundColor', cssVar: '--faq-item-bg', label: 'Item Background' },
          { type: 'color', configPath: 'appearance.questionTextColor', cssVar: '--faq-question-color', label: 'Question Text' },
          { type: 'color', configPath: 'appearance.answerTextColor', cssVar: '--faq-answer-color', label: 'Answer Text' },
          { type: 'expander', label: 'Custom CSS', children: [{ type: 'textarea', configPath: 'appearance.customCSS' }] },
        ],
      },
    },
  },
};
