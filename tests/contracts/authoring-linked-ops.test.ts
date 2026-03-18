import { describe, expect, it } from 'vitest';
import { expandLinkedOps } from '../../bob/components/td-menu-content/linkedOps';

describe('authoring linked-op contracts', () => {
  it('expands radius-link toggles from the shared linked-op contract', () => {
    const expanded = expandLinkedOps({
      compiled: { controls: [], presets: null } as any,
      instanceData: {
        pod: {
          radius: '4xl',
          radiusTL: '2xl',
          radiusTR: '2xl',
          radiusBR: '2xl',
          radiusBL: '2xl',
        },
      },
      ops: [{ op: 'set', path: 'pod.radiusLinked', value: true }],
    });

    expect(expanded).toEqual([
      { op: 'set', path: 'pod.radiusLinked', value: true },
      { op: 'set', path: 'pod.radius', value: '2xl' },
      { op: 'set', path: 'pod.radiusTL', value: '2xl' },
      { op: 'set', path: 'pod.radiusTR', value: '2xl' },
      { op: 'set', path: 'pod.radiusBR', value: '2xl' },
      { op: 'set', path: 'pod.radiusBL', value: '2xl' },
    ]);
  });

  it('expands v2 padding-link toggles from the shared linked-op contract', () => {
    const expanded = expandLinkedOps({
      compiled: { controls: [], presets: null } as any,
      instanceData: {
        stage: {
          padding: {
            desktop: {
              all: 32,
              top: 20,
              right: 20,
              bottom: 20,
              left: 20,
            },
          },
        },
      },
      ops: [{ op: 'set', path: 'stage.padding.desktop.linked', value: true }],
    });

    expect(expanded).toEqual([
      { op: 'set', path: 'stage.padding.desktop.linked', value: true },
      { op: 'set', path: 'stage.padding.desktop.all', value: 20 },
      { op: 'set', path: 'stage.padding.desktop.top', value: 20 },
      { op: 'set', path: 'stage.padding.desktop.right', value: 20 },
      { op: 'set', path: 'stage.padding.desktop.bottom', value: 20 },
      { op: 'set', path: 'stage.padding.desktop.left', value: 20 },
    ]);
  });

  it('expands inside-shadow link toggles from the shared linked-op contract', () => {
    const topShadow = {
      x: 1,
      y: 8,
      blur: 16,
      alpha: 12,
      color: '#000000',
      inset: true,
      spread: -8,
      enabled: true,
    };
    const expanded = expandLinkedOps({
      compiled: { controls: [], presets: null } as any,
      instanceData: {
        appearance: {
          cardwrapper: {
            insideShadow: {
              all: {
                x: 0,
                y: 0,
                blur: 0,
                alpha: 0,
                color: '#000000',
                inset: true,
                spread: 0,
                enabled: false,
              },
              top: topShadow,
              right: topShadow,
              bottom: topShadow,
              left: topShadow,
            },
          },
        },
      },
      ops: [{ op: 'set', path: 'appearance.cardwrapper.insideShadow.linked', value: true }],
    });

    expect(expanded).toEqual([
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.linked', value: true },
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.all', value: topShadow },
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.top', value: topShadow },
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.right', value: topShadow },
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.bottom', value: topShadow },
      { op: 'set', path: 'appearance.cardwrapper.insideShadow.left', value: topShadow },
    ]);
  });
});
