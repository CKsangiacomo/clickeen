-- Local dev seed data.
-- Applied after migrations during `supabase db reset` (see supabase/config.toml).
--
-- Creates:
-- - 2 widgets (faq, countdown)
-- - 2 widget_instances (wgt_faq_main, wgt_countdown_main)

BEGIN;

INSERT INTO widgets (id, type, name)
VALUES
  ('22222222-2222-2222-2222-222222222222'::uuid, 'faq', 'FAQ'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'countdown', 'Countdown');

INSERT INTO widget_instances (widget_id, public_id, status, config)
VALUES
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'wgt_faq_main',
    'unpublished',
    $${
      "title":"Frequently Asked Questions",
      "showTitle":true,
      "categoryTitle":"All Questions",
      "displayCategoryTitles":true,
      "layout":{
        "type":"accordion",
        "columns":{"desktop":2,"tablet":2,"mobile":1},
        "gap":16
      },
      "appearance":{
        "itemBackground":"var(--color-system-white)",
        "iconStyle":"plus",
        "questionColor":"var(--color-system-black)",
        "answerColor":"color-mix(in oklab, var(--color-system-black), transparent 45%)"
      },
      "behavior":{
        "expandFirst":false,
        "expandAll":false,
        "multiOpen":false,
        "displayVideos":true,
        "displayImages":true,
        "showBacklink":true
      },
      "stage":{
        "background":"var(--color-system-gray-5)",
        "alignment":"center",
        "paddingLinked":true,
        "padding":80,
        "paddingTop":80,
        "paddingRight":80,
        "paddingBottom":80,
        "paddingLeft":80
      },
      "pod":{
        "background":"var(--color-system-white)",
        "paddingLinked":true,
        "padding":40,
        "paddingTop":40,
        "paddingRight":40,
        "paddingBottom":40,
        "paddingLeft":40,
        "widthMode":"full",
        "contentWidth":960,
        "radiusLinked":true,
        "radius":"4xl",
        "radiusTL":"4xl",
        "radiusTR":"4xl",
        "radiusBR":"4xl",
        "radiusBL":"4xl"
      },
      "typography":{
        "globalFamily":"Inter",
        "roleScales":{
          "title":{"xs":"18px","s":"20px","m":"24px","l":"28px","xl":"32px"},
          "section":{"xs":"12px","s":"13px","m":"14px","l":"16px","xl":"18px"},
          "question":{"xs":"14px","s":"15px","m":"16px","l":"18px","xl":"20px"},
          "answer":{"xs":"13px","s":"14px","m":"15px","l":"17px","xl":"19px"}
        },
        "roles":{
          "title":{"family":"Inter","sizePreset":"m","sizeCustom":"24px","fontStyle":"normal","weight":"600"},
          "section":{"family":"Inter","sizePreset":"m","sizeCustom":"14px","fontStyle":"normal","weight":"600"},
          "question":{"family":"Inter","sizePreset":"m","sizeCustom":"16px","fontStyle":"normal","weight":"600"},
          "answer":{"family":"Inter","sizePreset":"m","sizeCustom":"15px","fontStyle":"normal","weight":"400"}
        }
      },
      "objects":{
        "objects":[
          {"id":"q1","type":"faq-qa","payload":{"question":"What is Clickeen?","answer":"Embeddable widgets with conversions built in.","defaultOpen":false}},
          {"id":"q2","type":"faq-qa","payload":{"question":"Is there a free plan?","answer":"Yes, one active widget with core features.","defaultOpen":false}},
          {"id":"q3","type":"faq-qa","payload":{"question":"How do I install a widget?","answer":"Copy the embed code and paste it before </body> on your site.","defaultOpen":false}}
        ]
      },
      "sections":[
        {
          "id":"s1",
          "title":"All Questions",
          "faqs":[
            {"id":"q1","question":"What is Clickeen?","answer":"Embeddable widgets with conversions built in.","defaultOpen":false},
            {"id":"q2","question":"Is there a free plan?","answer":"Yes, one active widget with core features.","defaultOpen":false},
            {"id":"q3","question":"How do I install a widget?","answer":"Copy the embed code and paste it before </body> on your site.","defaultOpen":false}
          ]
        }
      ]
    }$$::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    'wgt_countdown_main',
    'unpublished',
    $${
      "timer":{
        "mode":"personal",
        "heading":"Get 50% off before it's too late ⏰",
        "countdownToDate":{"targetDate":"2025-12-31","targetTime":"23:59","timezone":"browser"},
        "personalCountdown":{"timeAmount":1,"timeUnit":"hours","repeatEnabled":false,"repeatAmount":1,"repeatUnit":"hours"},
        "numberCounter":{"targetNumber":1000,"startingNumber":0,"duration":5}
      },
      "actions":{
        "showButtonDuring":false,
        "buttonText":"Purchase now",
        "buttonUrl":"",
        "buttonStyle":"primary",
        "openInNewTab":true,
        "afterAction":"hide",
        "afterButtonText":"Shop now",
        "afterButtonUrl":"",
        "expiredMessage":"Offer ended"
      },
      "layout":{"type":"full-width","alignment":"center","gap":16},
      "stage":{
        "background":"var(--color-system-gray-5)",
        "alignment":"center",
        "paddingLinked":false,
        "padding":0,
        "paddingTop":0,
        "paddingRight":0,
        "paddingBottom":0,
        "paddingLeft":0
      },
      "pod":{
        "background":"transparent",
        "paddingLinked":true,
        "padding":24,
        "paddingTop":24,
        "paddingRight":24,
        "paddingBottom":24,
        "paddingLeft":24,
        "widthMode":"wrap",
        "contentWidth":960,
        "radiusLinked":false,
        "radius":"4xl",
        "radiusTL":"4xl",
        "radiusTR":"4xl",
        "radiusBR":"4xl",
        "radiusBL":"4xl"
      },
      "theme":{
        "preset":"custom",
        "headingColor":"#FFFFFF",
        "timerColor":"#FFFFFF",
        "labelsColor":"#FFFFFF",
        "buttonColor":"#84CC16",
        "buttonTextColor":"#000000",
        "timerStyle":"separated",
        "animation":"none",
        "separator":"colon",
        "separatorColor":"#FFFFFF",
        "timeFormat":"DHMS",
        "showLabels":true,
        "showDays":true,
        "showHours":true,
        "showMinutes":true,
        "showSeconds":true,
        "headingSize":22,
        "timerSize":110,
        "labelSize":14,
        "buttonSize":100
      },
      "typography":{
        "globalFamily":"Inter",
        "roleScales":{
          "heading":{"xs":"18px","s":"20px","m":"22px","l":"26px","xl":"30px"},
          "timer":{"xs":"60","s":"80","m":"100","l":"120","xl":"140"},
          "label":{"xs":"11px","s":"12px","m":"14px","l":"16px","xl":"18px"},
          "button":{"xs":"12px","s":"14px","m":"16px","l":"18px","xl":"20px"}
        },
        "roles":{
          "heading":{"family":"Inter","sizePreset":"m","sizeCustom":"22px","fontStyle":"normal","weight":"600"},
          "timer":{"family":"Inter","sizePreset":"m","sizeCustom":"100","fontStyle":"normal","weight":"700"},
          "label":{"family":"Inter","sizePreset":"m","sizeCustom":"14px","fontStyle":"normal","weight":"600"},
          "button":{"family":"Inter","sizePreset":"m","sizeCustom":"16px","fontStyle":"normal","weight":"600"}
        }
      },
      "settings":{"language":"en-US","customCSS":"","customJS":""},
      "behavior":{"showBacklink":true}
    }$$::jsonb
  );

COMMIT;
