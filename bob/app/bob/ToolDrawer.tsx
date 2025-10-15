import { useState, useEffect, type FC } from 'react';
import styles from './bob.module.css';
import { getIcon } from '@bob/lib/icons';
import { Dropdown } from '@bob/controls/Dropdown';
import { RangeSlider } from '@bob/controls/RangeSlider';
import { Segmented } from '@bob/controls/Segmented';
import { ColorControl } from '@bob/controls/ColorControl';
import { Repeater } from '@bob/controls/Repeater';
import { Textfield } from '@bob/controls/Textfield';
import { interpretSchema } from '@bob/lib/schemaInterpreter';
import { loadDieterCss } from '@bob/lib/dieter-css';
import { get, set } from '@bob/lib/nested-helpers';

interface ToolDrawerProps {
  widgetType: string | undefined;
  config: any;
  setConfig: (fn: (prev: any) => any) => void;
  postPreviewPatch: (fields: Record<string, unknown>) => void;
  isLoading: boolean;
}

type AssistMode = 'manual' | 'copilot';

export const ToolDrawer: FC<ToolDrawerProps> = ({
  widgetType,
  config,
  setConfig,
  postPreviewPatch,
  isLoading,
}) => {
  const [assistMode, setAssistMode] = useState<AssistMode>('manual');
  const [activeMenu, setActiveMenu] = useState<string>('content');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const spec = interpretSchema(widgetType);
  const activePanelSchema = spec?.panels?.[activeMenu];
  const resolvedConfig = config ?? {};

  useEffect(() => {
    if (!spec) return;
    const first = spec.tabs?.[0]?.id;
    if (!first) return;
    if (!spec.panels?.[activeMenu]) {
      setActiveMenu(first);
    }
  }, [spec?.tabs?.length, activeMenu, spec?.panels]);

  useEffect(() => {
    if (!spec) return;
    const currentPanel = activePanelSchema ? activeMenu : spec.tabs?.[0]?.id;
    if (currentPanel) {
      loadDieterCss(spec.requiresByPanel?.[currentPanel]);
    }
  }, [spec?.tabs?.length, activeMenu, activePanelSchema, spec?.requiresByPanel]);

  const updateConfig = (updater: (prev: any) => any) => {
    setConfig((prev) => updater(prev ?? {}));
  };

  const updatePath = (path: string, value: unknown) => {
    updateConfig((prev) => set(prev, path, value));
  };

  const renderControl = (control: any) => {
    const value = get(resolvedConfig, control.configPath);
    if (control.condition) {
      const conditionValue = get(resolvedConfig, control.condition.configPath);
      if (conditionValue !== control.condition.value) {
        return null;
      }
    }

    switch (control.type) {
      case 'textfield': {
        return (
          <Textfield
            key={control.configPath}
            label={control.label}
            value={value || ''}
            placeholder={control.placeholder}
            onChange={(next) => {
              updatePath(control.configPath, next);
              postPreviewPatch({ [control.configPath]: next });
            }}
          />
        );
      }
      case 'dropdown':
        return (
          <Dropdown
            key={control.configPath}
            trigger={
              <button
                type="button"
                className="diet-btn diet-btn--block diet-btn--split"
                data-size="lg"
                data-variant="primary"
                data-dropdown-trigger
                aria-haspopup="menu"
              >
                <span className="diet-btn__label">{control.triggerLabel(value)}</span>
                <span className="diet-btn__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon('chevron.down') }} />
              </button>
            }
          >
            {control.options.map((opt: any) => (
              <button
                key={opt.value}
                type="button"
                className="diet-btn"
                data-size="lg"
                data-variant="neutral"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  updatePath(control.configPath, opt.value);
                  postPreviewPatch({ [control.configPath]: opt.value });
                }}
              >
                <span className="diet-btn__label">{opt.label}</span>
              </button>
            ))}
          </Dropdown>
        );
      case 'rangeslider':
        return (
          <RangeSlider
            key={control.configPath}
            label={control.label}
            value={value ?? control.min}
            min={control.min}
            max={control.max}
            unit={control.unit}
            onChange={(next) => {
              updatePath(control.configPath, next);
              postPreviewPatch({ [control.configPath]: next });
            }}
          />
        );
      case 'segmented':
        return (
          <Segmented
            key={control.configPath}
            value={value}
            options={control.options}
            onChange={(next) => {
              updatePath(control.configPath, next);
              postPreviewPatch({ [control.configPath]: next });
            }}
          />
        );
      case 'toggle': {
        const checked = value === true;
        return (
          <label key={control.configPath} className="diet-toggle diet-toggle--split" data-size="lg" htmlFor={control.configPath}>
            <span className="diet-toggle__label label">{control.label}</span>
            <input
              id={control.configPath}
              type="checkbox"
              role="switch"
              className="diet-toggle__input sr-only"
              checked={checked}
              onChange={(event) => {
                updatePath(control.configPath, event.target.checked);
                postPreviewPatch({ [control.configPath]: event.target.checked });
              }}
            />
            <span className="diet-toggle__switch">
              <span className="diet-toggle__knob" />
            </span>
          </label>
        );
      }
      case 'color':
        return (
          <ColorControl
            key={control.configPath}
            label={control.label}
            color={value || '#000000'}
            onChange={(next) => {
              updatePath(control.configPath, next);
              postPreviewPatch({ [control.configPath]: next });
            }}
          />
        );
      case 'repeater':
        return (
          <Repeater
            key={control.configPath}
            label={control.label}
            items={Array.isArray(value) ? value : []}
            onAdd={() => {
              const items = Array.isArray(value) ? value : [];
              updatePath(control.configPath, [...items, { id: `item_${Date.now()}` }]);
            }}
            onRemove={(index) => {
              const items = Array.isArray(value) ? value : [];
              updatePath(
                control.configPath,
                items.filter((_: any, idx: number) => idx !== index),
              );
            }}
            renderItem={(item) => (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title || String(item.id)}
              </span>
            )}
          />
        );
      default:
        return (
          <div key={control.configPath} style={{ fontSize: 12, opacity: 0.6 }}>
            Unsupported control type: {String(control.type)}
          </div>
        );
    }
  };

  const categories: any[] = Array.isArray(resolvedConfig.categories) ? resolvedConfig.categories : [];

  const renderCategoryList = () => (
    <>
      <div className="heading-3" style={{ width: '100%', minHeight: '28px', display: 'flex', alignItems: 'center', paddingInline: 'var(--space-2)', lineHeight: '28px', marginBottom: 'var(--space-2)' }}>
        Content
      </div>
      <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
        <Textfield
          label="Widget Title"
          value={resolvedConfig.title || ''}
          placeholder="Frequently Asked Questions"
          onChange={(next) => {
            updatePath('title', next);
            postPreviewPatch({ title: next });
          }}
        />
        <label className="diet-toggle diet-toggle--split" data-size="lg" htmlFor="content-toggle-title">
          <span className="diet-toggle__label label">Show Title</span>
          <input
            id="content-toggle-title"
            type="checkbox"
            role="switch"
            className="diet-toggle__input sr-only"
            checked={resolvedConfig.showTitle !== false}
            onChange={(event) => {
              updatePath('showTitle', event.target.checked);
              postPreviewPatch({ showTitle: event.target.checked });
            }}
          />
          <span className="diet-toggle__switch">
            <span className="diet-toggle__knob" />
          </span>
        </label>
        <label className="diet-toggle diet-toggle--split" data-size="lg" htmlFor="content-toggle-category-titles">
          <span className="diet-toggle__label label">Show Category Titles</span>
          <input
            id="content-toggle-category-titles"
            type="checkbox"
            role="switch"
            className="diet-toggle__input sr-only"
            checked={resolvedConfig.showCategoryTitles !== false}
            onChange={(event) => {
              updatePath('showCategoryTitles', event.target.checked);
              postPreviewPatch({ showCategoryTitles: event.target.checked });
            }}
          />
          <span className="diet-toggle__switch">
            <span className="diet-toggle__knob" />
          </span>
        </label>
        <div>
          <div className="label" style={{ marginBottom: 'var(--space-2)' }}>
            Categories
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {categories.length === 0 ? (
              <div className={styles.placeholder} style={{ padding: 'var(--space-2)', textAlign: 'left' }}>No categories yet.</div>
            ) : (
              categories.map((category, index) => {
                const questionCount = Array.isArray(category.items) ? category.items.length : 0;
                return (
                  <div key={category.id || index} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="diet-btn diet-btn--block"
                      data-size="md"
                      data-variant="neutral"
                      style={{ justifyContent: 'flex-start', flex: 1 }}
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingQuestionId(null);
                      }}
                    >
                      <span className="diet-btn__label" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {category.title || `Category ${index + 1}`}
                        </span>
                        <span style={{ opacity: 0.6 }}>
                          {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="diet-btn"
                      data-size="sm"
                      data-variant="ghost"
                      onClick={() => {
                        updateConfig((prev) => set(prev, 'categories', categories.filter((cat) => cat.id !== category.id)));
                        if (editingCategoryId === category.id) {
                          setEditingCategoryId(null);
                          setEditingQuestionId(null);
                        }
                      }}
                    >
                      <span className="diet-btn__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon('trash') }} />
                      <span className="diet-btn__label">Remove</span>
                    </button>
                  </div>
                );
              })
            )}
            <button
              type="button"
              className="diet-btn"
              data-size="md"
              data-variant="neutral"
              onClick={() => {
                const newCategory = { id: `cat_${Date.now()}`, title: 'New Category', icon: 'blank', items: [] };
                updateConfig((prev) => {
                  const current = Array.isArray(prev.categories) ? prev.categories : [];
                  return set(prev, 'categories', [...current, newCategory]);
                });
              }}
            >
              <span className="diet-btn__label">+ Add Category</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  const renderQuestionEditor = (categoryIndex: number, questionIndex: number) => {
    const category = categories[categoryIndex];
    const items = Array.isArray(category?.items) ? category.items : [];
    const question = items[questionIndex] ?? {};
    const questionId = question.id || `q_${questionIndex}`;

    return (
      <>
        <div className="heading-3" style={{ width: '100%', minHeight: '28px', display: 'flex', alignItems: 'center', paddingInline: 'var(--space-2)', lineHeight: '28px', marginBottom: 'var(--space-2)' }}>
          <button className="diet-btn" data-variant="ghost" data-size="sm" type="button" onClick={() => setEditingQuestionId(null)} style={{ marginRight: 'var(--space-2)' }}>
            <span className="diet-btn__icon" dangerouslySetInnerHTML={{ __html: getIcon('arrow.left') }} />
          </button>
          Edit Question
        </div>
        <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
          <Textfield
            label="Question"
            value={question.question || ''}
            onChange={(next) => updatePath(`categories[${categoryIndex}].items[${questionIndex}].question`, next)}
          />
          <div className="diet-input" data-size="lg">
            <label className="diet-input__label label" htmlFor={`answer_${questionId}`}>Answer</label>
            <div className="diet-input__inner">
              <textarea
                id={`answer_${questionId}`}
                className="diet-input__field"
                rows={8}
                value={question.answer || ''}
                placeholder="Answer"
                onChange={(event) => updatePath(`categories[${categoryIndex}].items[${questionIndex}].answer`, event.target.value)}
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderCategoryEditor = (categoryIndex: number) => {
    const category = categories[categoryIndex];
    const items = Array.isArray(category?.items) ? category.items : [];

    return (
      <>
        <div className="heading-3" style={{ width: '100%', minHeight: '28px', display: 'flex', alignItems: 'center', paddingInline: 'var(--space-2)', lineHeight: '28px', marginBottom: 'var(--space-2)' }}>
          <button className="diet-btn" data-variant="ghost" data-size="sm" type="button" onClick={() => { setEditingCategoryId(null); setEditingQuestionId(null); }} style={{ marginRight: 'var(--space-2)' }}>
            <span className="diet-btn__icon" dangerouslySetInnerHTML={{ __html: getIcon('arrow.left') }} />
          </button>
          Edit Category
        </div>
        <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
          <Textfield
            label="Category Title"
            value={category.title || ''}
            onChange={(next) => updatePath(`categories[${categoryIndex}].title`, next)}
          />
          <div>
            <div className="label" style={{ marginBottom: 'var(--space-2)' }}>Questions</div>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {items.length === 0 ? (
                <div className={styles.placeholder} style={{ padding: 'var(--space-2)', textAlign: 'left' }}>No questions yet.</div>
              ) : (
                items.map((item: any, index: number) => (
                  <div key={item.id || index} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="diet-btn diet-btn--block"
                      data-size="md"
                      data-variant="neutral"
                      style={{ justifyContent: 'flex-start', flex: 1 }}
                      onClick={() => setEditingQuestionId(item.id)}
                    >
                      <span className="diet-btn__label" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.question || `Question ${index + 1}`}</span>
                        <span style={{ opacity: 0.6 }}>{(item.answer || '').length > 0 ? 'Answer added' : 'Needs answer'}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="diet-btn"
                      data-size="sm"
                      data-variant="ghost"
                      onClick={() => updatePath(`categories[${categoryIndex}].items`, items.filter((q: any) => q.id !== item.id))}
                    >
                      <span className="diet-btn__icon" dangerouslySetInnerHTML={{ __html: getIcon('trash') }} />
                      <span className="diet-btn__label">Remove</span>
                    </button>
                  </div>
                ))
              )}
              <button
                type="button"
                className="diet-btn"
                data-size="md"
                data-variant="neutral"
                onClick={() => {
                  const newQuestion = { id: `q_${Date.now()}`, question: 'New Question?', answer: 'New Answer.' };
                  updatePath(`categories[${categoryIndex}].items`, [...items, newQuestion]);
                  setEditingQuestionId(newQuestion.id);
                }}
              >
                <span className="diet-btn__label">+ Add Question</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="diet-btn"
              data-size="sm"
              data-variant="ghost"
              onClick={() => {
                updateConfig((prev) => set(prev, 'categories', categories.filter((_, idx) => idx !== categoryIndex)));
                setEditingCategoryId(null);
                setEditingQuestionId(null);
              }}
            >
              <span className="diet-btn__icon" dangerouslySetInnerHTML={{ __html: getIcon('trash') }} />
              <span className="diet-btn__label">Delete Category</span>
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderContentPanel = () => {
    if (!Array.isArray(categories)) {
      return renderCategoryList();
    }
    if (editingCategoryId) {
      const categoryIndex = categories.findIndex((cat) => cat.id === editingCategoryId);
      if (categoryIndex === -1) {
        setEditingCategoryId(null);
        setEditingQuestionId(null);
        return renderCategoryList();
      }
      if (editingQuestionId) {
        const questionIndex = Array.isArray(categories[categoryIndex]?.items)
          ? categories[categoryIndex].items.findIndex((q: any) => q.id === editingQuestionId)
          : -1;
        if (questionIndex > -1) {
          return renderQuestionEditor(categoryIndex, questionIndex);
        }
        setEditingQuestionId(null);
      }
      return renderCategoryEditor(categoryIndex);
    }
    return renderCategoryList();
  };

  return (
    <aside id="tooldrawer" className={styles.tooldrawer} aria-label="tooldrawer">
      <header className={styles.tdheader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%' }}>
          <div className="diet-segmented" data-size="lg" role="group" aria-label="Assist mode" style={{ width: '100%' }}>
            <label className="diet-segment" data-type="icon-text" style={{ flex: 1 }}>
              <input
                className="diet-segment__input"
                type="radio"
                name="ck-assist"
                value="manual"
                checked={assistMode === 'manual'}
                onChange={() => setAssistMode('manual')}
              />
              <span className="diet-segment__surface" />
              <span className="diet-segment__icon" dangerouslySetInnerHTML={{ __html: getIcon('square.and.pencil') }} />
              <span className="diet-segment__label" style={{ justifyContent: 'center' }}>Manual</span>
            </label>
            <label className="diet-segment" data-type="icon-text" style={{ flex: 1 }}>
              <input
                className="diet-segment__input"
                type="radio"
                name="ck-assist"
                value="copilot"
                checked={assistMode === 'copilot'}
                onChange={() => setAssistMode('copilot')}
              />
              <span className="diet-segment__surface" />
              <span className="diet-segment__icon" dangerouslySetInnerHTML={{ __html: getIcon('sparkles') }} />
              <span className="diet-segment__label" style={{ justifyContent: 'center' }}>AI Copilot</span>
            </label>
          </div>
        </div>
      </header>
      <div className={styles.tdcontent}>
        <div className={styles.tdmenu}>
          {spec?.tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className="diet-btn"
              data-size="lg"
              data-type="icon-only"
              data-variant={activeMenu === item.id ? 'primary' : 'neutral'}
              onClick={() => {
                setActiveMenu(item.id);
                setEditingCategoryId(null);
                setEditingQuestionId(null);
              }}
              aria-label={item.label}
            >
              <span className="diet-btn__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon(item.icon) }} />
              <span className="sr-only">{item.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.tdmenucontent}>
          {isLoading ? (
            <div className={styles.placeholder}>Loading...</div>
          ) : !config || !spec ? (
            <div className={styles.placeholder}>Widget not found.</div>
          ) : activeMenu === 'content' ? (
            renderContentPanel()
          ) : activePanelSchema ? (
            <>
              <div className="heading-3" style={{ width: '100%', minHeight: '28px', display: 'flex', alignItems: 'center', paddingInline: 'var(--space-2)', lineHeight: '28px', marginBottom: 'var(--space-2)' }}>
                {activePanelSchema.title}
              </div>
              <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
                {activePanelSchema.controls.map((control: any) => renderControl(control))}
              </div>
            </>
          ) : (
            <div className={styles.placeholder}>
              <div style={{ opacity: 0.5, textAlign: 'center', padding: '16px' }}>Select a panel</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
