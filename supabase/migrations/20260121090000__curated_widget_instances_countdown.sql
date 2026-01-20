-- Add curated baseline instance for countdown so DevStudio can load it.
BEGIN;

INSERT INTO public.curated_widget_instances (public_id, widget_type, kind, status, config)
SELECT 'wgt_main_countdown', 'countdown', 'baseline', 'published', $json${
  "stage": {
    "canvas": {
      "mode": "viewport",
      "width": 0,
      "height": 0
    },
    "padding": {
      "mobile": {
        "all": 24,
        "top": 24,
        "left": 24,
        "right": 24,
        "bottom": 24,
        "linked": true
      },
      "desktop": {
        "all": 80,
        "top": 80,
        "left": 80,
        "right": 80,
        "bottom": 80,
        "linked": true
      }
    },
    "alignment": "center",
    "background": "var(--color-system-gray-5)"
  },
  "pod": {
    "radius": "4xl",
    "padding": {
      "mobile": {
        "all": 28,
        "top": 28,
        "left": 28,
        "right": 28,
        "bottom": 28,
        "linked": true
      },
      "desktop": {
        "all": 52,
        "top": 52,
        "left": 52,
        "right": 52,
        "bottom": 52,
        "linked": true
      }
    },
    "radiusBL": "4xl",
    "radiusBR": "4xl",
    "radiusTL": "4xl",
    "radiusTR": "4xl",
    "widthMode": "wrap",
    "background": "var(--color-system-white)",
    "contentWidth": 960,
    "radiusLinked": true
  },
  "typography": {
    "globalFamily": "Inter",
    "roleScales": {
      "heading": {
        "xs": "24px",
        "s": "28px",
        "m": "32px",
        "l": "36px",
        "xl": "40px"
      },
      "timer": {
        "xs": "32px",
        "s": "40px",
        "m": "48px",
        "l": "56px",
        "xl": "64px"
      },
      "label": {
        "xs": "11px",
        "s": "12px",
        "m": "14px",
        "l": "16px",
        "xl": "18px"
      },
      "button": {
        "xs": "12px",
        "s": "14px",
        "m": "16px",
        "l": "18px",
        "xl": "20px"
      }
    },
    "roles": {
      "heading": {
        "family": "Inter",
        "sizePreset": "custom",
        "sizeCustom": "32px",
        "fontStyle": "normal",
        "weight": "600",
        "color": "var(--color-system-black)"
      },
      "timer": {
        "family": "Inter",
        "sizePreset": "custom",
        "sizeCustom": "48px",
        "fontStyle": "normal",
        "weight": "700",
        "color": "var(--color-system-black)"
      },
      "label": {
        "family": "Inter",
        "sizePreset": "custom",
        "sizeCustom": "14px",
        "fontStyle": "normal",
        "weight": "400",
        "color": "color-mix(in oklab, var(--color-system-black), transparent 45%)"
      },
      "button": {
        "family": "Inter",
        "sizePreset": "custom",
        "sizeCustom": "16px",
        "fontStyle": "normal",
        "weight": "500",
        "color": "var(--color-system-white)"
      }
    }
  },
  "timer": {
    "mode": "date",
    "targetDate": "2026-01-20T12:00",
    "timezone": "UTC",
    "headline": "Get 50% off before it's too late \ud83c\udfaf",
    "timeAmount": 1,
    "timeUnit": "hours",
    "repeat": "never",
    "targetNumber": 1000,
    "startingNumber": 0,
    "countDuration": 5
  },
  "layout": {
    "position": "inline",
    "width": "auto",
    "alignment": "center",
    "customWidth": 960
  },
  "appearance": {
    "theme": "custom",
    "animation": "fade",
    "background": "var(--color-system-white)",
    "textColor": "var(--color-system-black)",
    "timerBoxColor": "var(--color-system-gray-5)",
    "separator": ":"
  },
  "behavior": {
    "showBacklink": true
  },
  "actions": {
    "during": {
      "type": "link",
      "url": "",
      "text": "Purchase now",
      "style": "primary",
      "newTab": true
    },
    "after": {
      "type": "hide",
      "url": "",
      "text": ""
    }
  },
  "seoGeo": {
    "enabled": false
  }
}$json$::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.curated_widget_instances WHERE public_id = 'wgt_main_countdown'
);

COMMIT;
