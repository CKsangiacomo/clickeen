var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
"use strict";
var Dieter = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // components/dropdown-fill/dropdown-fill.ts
  var dropdown_fill_exports = {};
  __export(dropdown_fill_exports, {
    hydrateDropdownFill: () => hydrateDropdownFill
  });

  // components/shared/dropdownToggle.ts
  function createDropdownHydrator(config) {
    const {
      rootSelector,
      triggerSelector,
      popoverSelector = ".diet-popover",
      onOpen,
      onClose,
      initialState = "closed",
      isInsideTarget
    } = config;
    const hostRegistry = /* @__PURE__ */ new Map();
    let globalHandlersBound = false;
    const setOpen = (record, open) => {
      const { root, trigger, popover } = record;
      const next = open ? "open" : "closed";
      if (root.dataset.state === next) return;
      root.dataset.state = next;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        record.onOpen?.(root, popover, trigger);
      } else {
        record.onClose?.(root, popover, trigger);
      }
    };
    return function hydrate(scope) {
      const roots = Array.from(scope.querySelectorAll(rootSelector));
      if (!roots.length) return;
      roots.forEach((root) => {
        if (hostRegistry.has(root)) return;
        const trigger = root.querySelector(triggerSelector);
        const popover = root.querySelector(popoverSelector);
        if (!trigger || !popover) return;
        const record = { root, trigger, popover, onOpen, onClose };
        hostRegistry.set(root, record);
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          setOpen(record, root.dataset.state !== "open");
        });
        const requestedState = root.dataset.state || initialState;
        setOpen(record, requestedState === "open");
      });
      if (!globalHandlersBound) {
        globalHandlersBound = true;
        document.addEventListener(
          "pointerdown",
          (event) => {
            const target = event.target;
            if (!target) return;
            hostRegistry.forEach((record) => {
              const { root } = record;
              const insideRoot = root.contains(target);
              const insideExtraTarget = isInsideTarget?.(root, target) ?? false;
              if (!insideRoot && !insideExtraTarget && root.dataset.state === "open") {
                setOpen(record, false);
              }
            });
          },
          true
        );
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          hostRegistry.forEach((record) => {
            const { root } = record;
            if (root.dataset.state === "open") setOpen(record, false);
          });
        });
      }
    };
  }

  // ../packages/l10n/src/index.ts
  var LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;
  function normalizeLocaleToken(raw) {
    const value = typeof raw === "string" ? raw.trim().toLowerCase().replace(/_/g, "-") : "";
    if (!value) return null;
    if (!LOCALE_PATTERN.test(value)) return null;
    return value;
  }
  function normalizeCanonicalLocalesFile(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of raw) {
      if (typeof entry === "string") {
        const code2 = normalizeLocaleToken(entry);
        if (!code2 || seen.has(code2)) continue;
        seen.add(code2);
        out.push({ code: code2 });
        continue;
      }
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const code = normalizeLocaleToken(entry.code);
      if (!code || seen.has(code)) continue;
      const nativeLabelRaw = typeof entry.nativeLabel === "string" ? entry.nativeLabel.trim() : "";
      const nativeLabel = nativeLabelRaw ? nativeLabelRaw : void 0;
      const labelsRaw = entry.labels;
      const labels = {};
      if (labelsRaw && typeof labelsRaw === "object" && !Array.isArray(labelsRaw)) {
        for (const [rawKey, rawValue] of Object.entries(labelsRaw)) {
          const key = normalizeLocaleToken(rawKey);
          const value = typeof rawValue === "string" ? rawValue.trim() : "";
          if (!key || !value) continue;
          labels[key] = value;
        }
      }
      seen.add(code);
      out.push({
        code,
        nativeLabel,
        labels: Object.keys(labels).length ? labels : void 0
      });
    }
    return out;
  }

  // ../packages/l10n/locales.json
  var locales_default = [
    {
      code: "en",
      nativeLabel: "English",
      labels: {
        en: "English",
        es: "Ingl\xE9s",
        pt: "Ingl\xEAs",
        de: "Englisch",
        fr: "Anglais",
        it: "Inglese",
        nl: "Engels",
        ja: "\u82F1\u8A9E",
        "zh-hans": "\u82F1\u8BED",
        "zh-tw": "\u82F1\u8A9E",
        hi: "\u0905\u0902\u0917\u094D\u0930\u0947\u091C\u0940",
        ko: "\uC601\uC5B4",
        pl: "Angielski",
        tr: "\u0130ngilizce",
        ar: "\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629",
        vi: "Ti\u1EBFng Anh",
        id: "Inggris",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29",
        he: "\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA",
        uk: "\u0410\u043D\u0433\u043B\u0456\u0439\u0441\u044C\u043A\u0430",
        cs: "Angli\u010Dtina",
        ro: "Englez\u0103",
        hu: "Angol",
        sv: "Engelska",
        da: "Engelsk",
        nb: "Engelsk",
        fi: "Englanti",
        fil: "Ingles",
        bn: "\u0987\u0982\u09B0\u09C7\u099C\u09BF"
      }
    },
    {
      code: "es",
      nativeLabel: "Espa\xF1ol",
      labels: {
        en: "Spanish",
        es: "Espa\xF1ol",
        pt: "Espanhol",
        de: "Spanisch",
        fr: "Espagnol",
        it: "Spagnolo",
        nl: "Spaans",
        ja: "\u30B9\u30DA\u30A4\u30F3\u8A9E",
        "zh-hans": "\u897F\u73ED\u7259\u8BED",
        "zh-tw": "\u897F\u73ED\u7259\u8A9E",
        hi: "\u0938\u094D\u092A\u0947\u0928\u093F\u0936",
        ko: "\uC2A4\uD398\uC778\uC5B4",
        pl: "Hiszpa\u0144ski",
        tr: "\u0130spanyolca",
        ar: "\u0627\u0644\u0625\u0633\u0628\u0627\u0646\u064A\u0629",
        vi: "Ti\u1EBFng T\xE2y Ban Nha",
        id: "Spanyol",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2A\u0E40\u0E1B\u0E19",
        he: "\u05E1\u05E4\u05E8\u05D3\u05D9\u05EA",
        uk: "\u0406\u0441\u043F\u0430\u043D\u0441\u044C\u043A\u0430",
        cs: "\u0160pan\u011Bl\u0161tina",
        ro: "Spaniol\u0103",
        hu: "Spanyol",
        sv: "Spanska",
        da: "Spansk",
        nb: "Spansk",
        fi: "Espanja",
        fil: "Espanyol",
        bn: "\u09B8\u09CD\u09AA\u09C7\u09A8\u09C0\u09AF\u09BC"
      }
    },
    {
      code: "pt",
      nativeLabel: "Portugu\xEAs",
      labels: {
        en: "Portuguese",
        es: "Portugu\xE9s",
        pt: "Portugu\xEAs",
        de: "Portugiesisch",
        fr: "Portugais",
        it: "Portoghese",
        nl: "Portugees",
        ja: "\u30DD\u30EB\u30C8\u30AC\u30EB\u8A9E",
        "zh-hans": "\u8461\u8404\u7259\u8BED",
        "zh-tw": "\u8461\u8404\u7259\u8A9E",
        hi: "\u092A\u0941\u0930\u094D\u0924\u0917\u093E\u0932\u0940",
        ko: "\uD3EC\uB974\uD22C\uAC08\uC5B4",
        pl: "Portugalski",
        tr: "Portekizce",
        ar: "\u0627\u0644\u0628\u0631\u062A\u063A\u0627\u0644\u064A\u0629",
        vi: "Ti\u1EBFng B\u1ED3 \u0110\xE0o Nha",
        id: "Portugis",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E42\u0E1B\u0E23\u0E15\u0E38\u0E40\u0E01\u0E2A",
        he: "\u05E4\u05D5\u05E8\u05D8\u05D5\u05D2\u05D6\u05D9\u05EA",
        uk: "\u041F\u043E\u0440\u0442\u0443\u0433\u0430\u043B\u044C\u0441\u044C\u043A\u0430",
        cs: "Portugal\u0161tina",
        ro: "Portughez\u0103",
        hu: "Portug\xE1l",
        sv: "Portugisiska",
        da: "Portugisisk",
        nb: "Portugisisk",
        fi: "Portugali",
        fil: "Portuges",
        bn: "\u09AA\u09B0\u09CD\u09A4\u09C1\u0997\u09BF\u099C"
      }
    },
    {
      code: "de",
      nativeLabel: "Deutsch",
      labels: {
        en: "German",
        es: "Alem\xE1n",
        pt: "Alem\xE3o",
        de: "Deutsch",
        fr: "Allemand",
        it: "Tedesco",
        nl: "Duits",
        ja: "\u30C9\u30A4\u30C4\u8A9E",
        "zh-hans": "\u5FB7\u8BED",
        "zh-tw": "\u5FB7\u8A9E",
        hi: "\u091C\u0930\u094D\u092E\u0928",
        ko: "\uB3C5\uC77C\uC5B4",
        pl: "Niemiecki",
        tr: "Almanca",
        ar: "\u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064A\u0629",
        vi: "Ti\u1EBFng \u0110\u1EE9c",
        id: "Jerman",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E22\u0E2D\u0E23\u0E21\u0E31\u0E19",
        he: "\u05D2\u05E8\u05DE\u05E0\u05D9\u05EA",
        uk: "\u041D\u0456\u043C\u0435\u0446\u044C\u043A\u0430",
        cs: "N\u011Bm\u010Dina",
        ro: "German\u0103",
        hu: "N\xE9met",
        sv: "Tyska",
        da: "Tysk",
        nb: "Tysk",
        fi: "Saksa",
        fil: "Aleman",
        bn: "\u099C\u09BE\u09B0\u09CD\u09AE\u09BE\u09A8"
      }
    },
    {
      code: "fr",
      nativeLabel: "Fran\xE7ais",
      labels: {
        en: "French",
        es: "Franc\xE9s",
        pt: "Franc\xEAs",
        de: "Franz\xF6sisch",
        fr: "Fran\xE7ais",
        it: "Francese",
        nl: "Frans",
        ja: "\u30D5\u30E9\u30F3\u30B9\u8A9E",
        "zh-hans": "\u6CD5\u8BED",
        "zh-tw": "\u6CD5\u8A9E",
        hi: "\u092B\u094D\u0930\u0947\u0902\u091A",
        ko: "\uD504\uB791\uC2A4\uC5B4",
        pl: "Francuski",
        tr: "Frans\u0131zca",
        ar: "\u0627\u0644\u0641\u0631\u0646\u0633\u064A\u0629",
        vi: "Ti\u1EBFng Ph\xE1p",
        id: "Prancis",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E1D\u0E23\u0E31\u0E48\u0E07\u0E40\u0E28\u0E2A",
        he: "\u05E6\u05E8\u05E4\u05EA\u05D9\u05EA",
        uk: "\u0424\u0440\u0430\u043D\u0446\u0443\u0437\u044C\u043A\u0430",
        cs: "Francouz\u0161tina",
        ro: "Francez\u0103",
        hu: "Francia",
        sv: "Franska",
        da: "Fransk",
        nb: "Fransk",
        fi: "Ranska",
        fil: "Pranses",
        bn: "\u09AB\u09B0\u09BE\u09B8\u09BF"
      }
    },
    {
      code: "it",
      nativeLabel: "Italiano",
      labels: {
        en: "Italian",
        es: "Italiano",
        pt: "Italiano",
        de: "Italienisch",
        fr: "Italien",
        it: "Italiano",
        nl: "Italiaans",
        ja: "\u30A4\u30BF\u30EA\u30A2\u8A9E",
        "zh-hans": "\u610F\u5927\u5229\u8BED",
        "zh-tw": "\u610F\u5927\u5229\u8A9E",
        hi: "\u0907\u0924\u093E\u0932\u0935\u0940",
        ko: "\uC774\uD0C8\uB9AC\uC544\uC5B4",
        pl: "W\u0142oski",
        tr: "\u0130talyanca",
        ar: "\u0627\u0644\u0625\u064A\u0637\u0627\u0644\u064A\u0629",
        vi: "Ti\u1EBFng \xDD",
        id: "Italia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E34\u0E15\u0E32\u0E25\u0E35",
        he: "\u05D0\u05D9\u05D8\u05DC\u05E7\u05D9\u05EA",
        uk: "\u0406\u0442\u0430\u043B\u0456\u0439\u0441\u044C\u043A\u0430",
        cs: "Ital\u0161tina",
        ro: "Italian\u0103",
        hu: "Olasz",
        sv: "Italienska",
        da: "Italiensk",
        nb: "Italiensk",
        fi: "Italia",
        fil: "Italyano",
        bn: "\u0987\u09A4\u09BE\u09B2\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "nl",
      nativeLabel: "Nederlands",
      labels: {
        en: "Dutch",
        es: "Holand\xE9s",
        pt: "Holand\xEAs",
        de: "Niederl\xE4ndisch",
        fr: "N\xE9erlandais",
        it: "Olandese",
        nl: "Nederlands",
        ja: "\u30AA\u30E9\u30F3\u30C0\u8A9E",
        "zh-hans": "\u8377\u5170\u8BED",
        "zh-tw": "\u8377\u862D\u8A9E",
        hi: "\u0921\u091A",
        ko: "\uB124\uB35C\uB780\uB4DC\uC5B4",
        pl: "Holenderski",
        tr: "Hollandaca",
        ar: "\u0627\u0644\u0647\u0648\u0644\u0646\u062F\u064A\u0629",
        vi: "Ti\u1EBFng H\xE0 Lan",
        id: "Belanda",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E14\u0E31\u0E15\u0E0A\u0E4C",
        he: "\u05D4\u05D5\u05DC\u05E0\u05D3\u05D9\u05EA",
        uk: "\u041D\u0456\u0434\u0435\u0440\u043B\u0430\u043D\u0434\u0441\u044C\u043A\u0430",
        cs: "Nizozem\u0161tina",
        ro: "Olandez\u0103",
        hu: "Holland",
        sv: "Nederl\xE4ndska",
        da: "Nederlandsk",
        nb: "Nederlandsk",
        fi: "Hollanti",
        fil: "Dutch",
        bn: "\u09A1\u09BE\u099A"
      }
    },
    {
      code: "ja",
      nativeLabel: "\u65E5\u672C\u8A9E",
      labels: {
        en: "Japanese",
        es: "Japon\xE9s",
        pt: "Japon\xEAs",
        de: "Japanisch",
        fr: "Japonais",
        it: "Giapponese",
        nl: "Japans",
        ja: "\u65E5\u672C\u8A9E",
        "zh-hans": "\u65E5\u8BED",
        "zh-tw": "\u65E5\u8A9E",
        hi: "\u091C\u093E\u092A\u093E\u0928\u0940",
        ko: "\uC77C\uBCF8\uC5B4",
        pl: "Japo\u0144ski",
        tr: "Japonca",
        ar: "\u0627\u0644\u064A\u0627\u0628\u0627\u0646\u064A\u0629",
        vi: "Ti\u1EBFng Nh\u1EADt",
        id: "Jepang",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E0D\u0E35\u0E48\u0E1B\u0E38\u0E48\u0E19",
        he: "\u05D9\u05E4\u05E0\u05D9\u05EA",
        uk: "\u042F\u043F\u043E\u043D\u0441\u044C\u043A\u0430",
        cs: "Japon\u0161tina",
        ro: "Japonez\u0103",
        hu: "Jap\xE1n",
        sv: "Japanska",
        da: "Japansk",
        nb: "Japansk",
        fi: "Japani",
        fil: "Hapon",
        bn: "\u099C\u09BE\u09AA\u09BE\u09A8\u09BF"
      }
    },
    {
      code: "zh-hans",
      nativeLabel: "\u7B80\u4F53\u4E2D\u6587",
      labels: {
        en: "Chinese (Simplified)",
        es: "Chino (Simplificado)",
        pt: "Chin\xEAs (Simplificado)",
        de: "Chinesisch (vereinfacht)",
        fr: "Chinois (Simplifi\xE9)",
        it: "Cinese (Semplificato)",
        nl: "Chinees (Vereenvoudigd)",
        ja: "\u4E2D\u56FD\u8A9E\uFF08\u7C21\u4F53\u5B57\uFF09",
        "zh-hans": "\u7B80\u4F53\u4E2D\u6587",
        "zh-tw": "\u7C21\u9AD4\u4E2D\u6587",
        hi: "\u091A\u0940\u0928\u0940 (\u0938\u0930\u0932\u0940\u0915\u0943\u0924)",
        ko: "\uC911\uAD6D\uC5B4(\uAC04\uCCB4)",
        pl: "Chi\u0144ski (Uproszczony)",
        tr: "\xC7ince (Basitle\u015Ftirilmi\u015F)",
        ar: "\u0627\u0644\u0635\u064A\u0646\u064A\u0629 (\u0645\u0628\u0633\u0637\u0629)",
        vi: "Ti\u1EBFng Trung (Gi\u1EA3n th\u1EC3)",
        id: "Cina (Disederhanakan)",
        th: "\u0E08\u0E35\u0E19 (\u0E07\u0E48\u0E32\u0E22)",
        he: "\u05E1\u05D9\u05E0\u05D9\u05EA (\u05DE\u05E4\u05D5\u05E9\u05D8\u05EA)",
        uk: "\u041A\u0438\u0442\u0430\u0439\u0441\u044C\u043A\u0430 (\u0421\u043F\u0440\u043E\u0449\u0435\u043D\u0430)",
        cs: "\u010C\xEDn\u0161tina (Zjednodu\u0161en\xE1)",
        ro: "Chinez\u0103 (Simplificat\u0103)",
        hu: "K\xEDnai (egyszer\u0171s\xEDtett)",
        sv: "Kinesiska (F\xF6renklade)",
        da: "Kinesisk (Forenklet)",
        nb: "Kinesisk (Forenklet)",
        fi: "Kiina (Yksinkertaistettu)",
        fil: "Tsino (Pinasimple)",
        bn: "\u099A\u09BE\u0987\u09A8\u09BF\u099C (\u09B8\u09B0\u09B2\u09C0\u0995\u09C3\u09A4)"
      }
    },
    {
      code: "zh-tw",
      nativeLabel: "\u7E41\u9AD4\u4E2D\u6587",
      labels: {
        en: "Chinese (Traditional)",
        es: "Chino (Tradicional)",
        pt: "Chin\xEAs (Tradicional)",
        de: "Chinesisch (traditionell)",
        fr: "Chinois (Traditionnel)",
        it: "Cinese (Tradizionale)",
        nl: "Chinees (Traditioneel)",
        ja: "\u4E2D\u56FD\u8A9E\uFF08\u7E41\u4F53\u5B57\uFF09",
        "zh-hans": "\u7E41\u4F53\u4E2D\u6587",
        "zh-tw": "\u7E41\u9AD4\u4E2D\u6587",
        hi: "\u091A\u0940\u0928\u0940 (\u092A\u093E\u0930\u0902\u092A\u0930\u093F\u0915)",
        ko: "\uC911\uAD6D\uC5B4(\uBC88\uCCB4)",
        pl: "Chi\u0144ski (Tradycyjny)",
        tr: "\xC7ince (Geleneksel)",
        ar: "\u0627\u0644\u0635\u064A\u0646\u064A\u0629 (\u0627\u0644\u062A\u0642\u0644\u064A\u062F\u064A\u0629)",
        vi: "Ti\u1EBFng Trung (Ph\u1ED3n th\u1EC3)",
        id: "Cina (Tradisional)",
        th: "\u0E08\u0E35\u0E19 (\u0E15\u0E31\u0E27\u0E40\u0E15\u0E47\u0E21)",
        he: "\u05E1\u05D9\u05E0\u05D9\u05EA (\u05DE\u05E1\u05D5\u05E8\u05EA\u05D9\u05EA)",
        uk: "\u041A\u0438\u0442\u0430\u0439\u0441\u044C\u043A\u0430 (\u0422\u0440\u0430\u0434\u0438\u0446\u0456\u0439\u043D\u0430)",
        cs: "\u010C\xEDn\u0161tina (Tradi\u010Dn\xED)",
        ro: "Chinez\u0103 (Tradi\u021Bional\u0103)",
        hu: "K\xEDnai (hagyom\xE1nyos)",
        sv: "Kinesiska (Traditionell)",
        da: "Kinesisk (Traditionel)",
        nb: "Kinesisk (Tradisjonell)",
        fi: "Kiina (Perinteinen)",
        fil: "Tsino (Tradisyonal)",
        bn: "\u099A\u09BE\u0987\u09A8\u09BF\u099C (\u0990\u09A4\u09BF\u09B9\u09CD\u09AF\u09AC\u09BE\u09B9\u09C0)"
      }
    },
    {
      code: "hi",
      nativeLabel: "\u0939\u093F\u0928\u094D\u0926\u0940",
      labels: {
        en: "Hindi",
        es: "Hindi",
        pt: "Hindi",
        de: "Hindi",
        fr: "Hindi",
        it: "Hindi",
        nl: "Hindi",
        ja: "\u30D2\u30F3\u30C7\u30A3\u30FC\u8A9E",
        "zh-hans": "\u5370\u5730\u8BED",
        "zh-tw": "\u5370\u5730\u8A9E",
        hi: "\u0939\u093F\u0928\u094D\u0926\u0940",
        ko: "\uD78C\uB514\uC5B4",
        pl: "Hindi",
        tr: "Hint\xE7e",
        ar: "\u0627\u0644\u0647\u0646\u062F\u064A\u0629",
        vi: "Ti\u1EBFng Hindi",
        id: "Hindi",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2E\u0E34\u0E19\u0E14\u0E35",
        he: "\u05D4\u05D9\u05E0\u05D3\u05D9\u05EA",
        uk: "\u0413\u0456\u043D\u0434\u0456",
        cs: "Hind\u0161tina",
        ro: "Hindi",
        hu: "Hindi",
        sv: "Hindi",
        da: "Hindi",
        nb: "Hindi",
        fi: "Hindi",
        fil: "Hindi",
        bn: "\u09B9\u09BF\u09A8\u09CD\u09A6\u09BF"
      }
    },
    {
      code: "ko",
      nativeLabel: "\uD55C\uAD6D\uC5B4",
      labels: {
        en: "Korean",
        es: "Coreano",
        pt: "Coreano",
        de: "Koreanisch",
        fr: "Cor\xE9en",
        it: "Coreano",
        nl: "Koreaans",
        ja: "\u97D3\u56FD\u8A9E",
        "zh-hans": "\u97E9\u8BED",
        "zh-tw": "\u97D3\u8A9E",
        hi: "\u0915\u094B\u0930\u093F\u092F\u093E\u0908",
        ko: "\uD55C\uAD6D\uC5B4",
        pl: "Korea\u0144ski",
        tr: "Korece",
        ar: "\u0627\u0644\u0643\u0648\u0631\u064A\u0629",
        vi: "Ti\u1EBFng H\xE0n",
        id: "Korea",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E01\u0E32\u0E2B\u0E25\u0E35",
        he: "\u05E7\u05D5\u05E8\u05D9\u05D0\u05E0\u05D9\u05EA",
        uk: "\u041A\u043E\u0440\u0435\u0439\u0441\u044C\u043A\u0430",
        cs: "Korej\u0161tina",
        ro: "Coreean\u0103",
        hu: "Koreai",
        sv: "Koreanska",
        da: "Koreansk",
        nb: "Koreansk",
        fi: "Korea",
        fil: "Koreano",
        bn: "\u0995\u09CB\u09B0\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "pl",
      nativeLabel: "Polski",
      labels: {
        en: "Polish",
        es: "Polaco",
        pt: "Polon\xEAs",
        de: "Polnisch",
        fr: "Polonais",
        it: "Polacco",
        nl: "Pools",
        ja: "\u30DD\u30FC\u30E9\u30F3\u30C9\u8A9E",
        "zh-hans": "\u6CE2\u5170\u8BED",
        "zh-tw": "\u6CE2\u862D\u8A9E",
        hi: "\u092A\u094B\u0932\u093F\u0936",
        ko: "\uD3F4\uB780\uB4DC\uC5B4",
        pl: "Polski",
        tr: "Leh\xE7e",
        ar: "\u0627\u0644\u0628\u0648\u0644\u0646\u062F\u064A\u0629",
        vi: "Ti\u1EBFng Ba Lan",
        id: "Polandia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E42\u0E1B\u0E41\u0E25\u0E19\u0E14\u0E4C",
        he: "\u05E4\u05D5\u05DC\u05E0\u05D9\u05EA",
        uk: "\u041F\u043E\u043B\u044C\u0441\u044C\u043A\u0430",
        cs: "Pol\u0161tina",
        ro: "Polonez\u0103",
        hu: "Lengyel",
        sv: "Polska",
        da: "Polsk",
        nb: "Polsk",
        fi: "Puola",
        fil: "Polako",
        bn: "\u09AA\u09CB\u09B2\u09BF\u09B6"
      }
    },
    {
      code: "tr",
      nativeLabel: "T\xFCrk\xE7e",
      labels: {
        en: "Turkish",
        es: "Turco",
        pt: "Turco",
        de: "T\xFCrkisch",
        fr: "Turc",
        it: "Turco",
        nl: "Turks",
        ja: "\u30C8\u30EB\u30B3\u8A9E",
        "zh-hans": "\u571F\u8033\u5176\u8BED",
        "zh-tw": "\u571F\u8033\u5176\u8A9E",
        hi: "\u0924\u0941\u0930\u094D\u0915\u0940",
        ko: "\uD130\uD0A4\uC5B4",
        pl: "Turecki",
        tr: "T\xFCrk\xE7e",
        ar: "\u0627\u0644\u062A\u0631\u0643\u064A\u0629",
        vi: "Ti\u1EBFng Th\u1ED5 Nh\u0129 K\u1EF3",
        id: "Turki",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E15\u0E38\u0E23\u0E01\u0E35",
        he: "\u05D8\u05D5\u05E8\u05E7\u05D9\u05EA",
        uk: "\u0422\u0443\u0440\u0435\u0446\u044C\u043A\u0430",
        cs: "Ture\u010Dtina",
        ro: "Turc\u0103",
        hu: "T\xF6r\xF6k",
        sv: "Turkiska",
        da: "Tyrkisk",
        nb: "Tyrkisk",
        fi: "Turkki",
        fil: "Turkish",
        bn: "\u09A4\u09C1\u09B0\u09CD\u0995\u09BF"
      }
    },
    {
      code: "ar",
      nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
      labels: {
        en: "Arabic",
        es: "\xC1rabe",
        pt: "\xC1rabe",
        de: "Arabisch",
        fr: "Arabe",
        it: "Arabo",
        nl: "Arabisch",
        ja: "\u30A2\u30E9\u30D3\u30A2\u8A9E",
        "zh-hans": "\u963F\u62C9\u4F2F\u8BED",
        "zh-tw": "\u963F\u62C9\u4F2F\u8A9E",
        hi: "\u0905\u0930\u092C\u0940",
        ko: "\uC544\uB78D\uC5B4",
        pl: "Arabski",
        tr: "Arap\xE7a",
        ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
        vi: "Ti\u1EBFng \u1EA2 R\u1EADp",
        id: "Arab",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E32\u0E2B\u0E23\u0E31\u0E1A",
        he: "\u05E2\u05E8\u05D1\u05D9\u05EA",
        uk: "\u0410\u0440\u0430\u0431\u0441\u044C\u043A\u0430",
        cs: "Arab\u0161tina",
        ro: "Arab\u0103",
        hu: "Arab",
        sv: "Arabiska",
        da: "Arabisk",
        nb: "Arabisk",
        fi: "Arabia",
        fil: "Arabe",
        bn: "\u0986\u09B0\u09AC\u09BF"
      }
    },
    {
      code: "vi",
      nativeLabel: "Ti\u1EBFng Vi\u1EC7t",
      labels: {
        en: "Vietnamese",
        es: "Vietnamita",
        pt: "Vietnamita",
        de: "Vietnamesisch",
        fr: "Vietnamien",
        it: "Vietnamita",
        nl: "Vietnamees",
        ja: "\u30D9\u30C8\u30CA\u30E0\u8A9E",
        "zh-hans": "\u8D8A\u5357\u8BED",
        "zh-tw": "\u8D8A\u5357\u8A9E",
        hi: "\u0935\u093F\u092F\u0924\u0928\u093E\u092E\u0940",
        ko: "\uBCA0\uD2B8\uB0A8\uC5B4",
        pl: "Wietnamski",
        tr: "Vietnamca",
        ar: "\u0627\u0644\u0641\u064A\u062A\u0646\u0627\u0645\u064A\u0629",
        vi: "Ti\u1EBFng Vi\u1EC7t",
        id: "Vietnam",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E27\u0E35\u0E22\u0E14\u0E19\u0E32\u0E21",
        he: "\u05D5\u05D9\u05D9\u05D8\u05E0\u05DE\u05D9\u05EA",
        uk: "\u0412'\u0454\u0442\u043D\u0430\u043C\u0441\u044C\u043A\u0430",
        cs: "Vietnam\u0161tina",
        ro: "Vietnamez\u0103",
        hu: "Vietnami",
        sv: "Vietnamesiska",
        da: "Vietnamesisk",
        nb: "Vietnamesisk",
        fi: "Vietnami",
        fil: "Vietnamese",
        bn: "\u09AD\u09BF\u09AF\u09BC\u09C7\u09A4\u09A8\u09BE\u09AE\u09BF"
      }
    },
    {
      code: "id",
      nativeLabel: "Bahasa Indonesia",
      labels: {
        en: "Indonesian",
        es: "Indonesio",
        pt: "Indon\xE9sio",
        de: "Indonesisch",
        fr: "Indon\xE9sien",
        it: "Indonesiano",
        nl: "Indonesisch",
        ja: "\u30A4\u30F3\u30C9\u30CD\u30B7\u30A2\u8A9E",
        "zh-hans": "\u5370\u5EA6\u5C3C\u897F\u4E9A\u8BED",
        "zh-tw": "\u5370\u5C3C\u8A9E",
        hi: "\u0907\u0902\u0921\u094B\u0928\u0947\u0936\u093F\u092F\u093E\u0908",
        ko: "\uC778\uB3C4\uB124\uC2DC\uC544\uC5B4",
        pl: "Indonezyjski",
        tr: "Endonezce",
        ar: "\u0627\u0644\u0625\u0646\u062F\u0648\u0646\u064A\u0633\u064A\u0629",
        vi: "Ti\u1EBFng Indonesia",
        id: "Bahasa Indonesia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E34\u0E19\u0E42\u0E14\u0E19\u0E35\u0E40\u0E0B\u0E35\u0E22",
        he: "\u05D0\u05D9\u05E0\u05D3\u05D5\u05E0\u05D6\u05D9\u05EA",
        uk: "\u0406\u043D\u0434\u043E\u043D\u0435\u0437\u044C\u043A\u0430",
        cs: "Indon\xE9\u0161tina",
        ro: "Indonezian\u0103",
        hu: "Indon\xE9z",
        sv: "Indonesiska",
        da: "Indonesisk",
        nb: "Indonesisk",
        fi: "Indonesia",
        fil: "Indonesian",
        bn: "\u0987\u09A8\u09CD\u09A6\u09CB\u09A8\u09C7\u09B6\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "th",
      nativeLabel: "\u0E44\u0E17\u0E22",
      labels: {
        en: "Thai",
        es: "Tailand\xE9s",
        pt: "Tailand\xEAs",
        de: "Thai",
        fr: "Tha\xEF",
        it: "Tailandese",
        nl: "Thai",
        ja: "\u30BF\u30A4\u8A9E",
        "zh-hans": "\u6CF0\u8BED",
        "zh-tw": "\u6CF0\u8A9E",
        hi: "\u0925\u093E\u0908",
        ko: "\uD0DC\uAD6D\uC5B4",
        pl: "Tajski",
        tr: "Tayca",
        ar: "\u0627\u0644\u062A\u0627\u064A\u0644\u0627\u0646\u062F\u064A\u0629",
        vi: "Ti\u1EBFng Th\xE1i",
        id: "Thailand",
        th: "\u0E44\u0E17\u0E22",
        he: "\u05EA\u05D0\u05D9\u05EA",
        uk: "\u0422\u0430\u0457\u043B\u0430\u043D\u0434\u0441\u044C\u043A\u0430",
        cs: "Thaj\u0161tina",
        ro: "Thailandez\u0103",
        hu: "Thai",
        sv: "Thai",
        da: "Thai",
        nb: "Thai",
        fi: "Thai",
        fil: "Thai",
        bn: "\u09A5\u09BE\u0987"
      }
    },
    {
      code: "he",
      nativeLabel: "\u05E2\u05D1\u05E8\u05D9\u05EA",
      labels: {
        en: "Hebrew",
        es: "Hebreo",
        pt: "Hebraico",
        de: "Hebr\xE4isch",
        fr: "H\xE9breu",
        it: "Ebraico",
        nl: "Hebreeuws",
        ja: "\u30D8\u30D6\u30E9\u30A4\u8A9E",
        "zh-hans": "\u5E0C\u4F2F\u6765\u8BED",
        "zh-tw": "\u5E0C\u4F2F\u4F86\u8A9E",
        hi: "\u0939\u093F\u092C\u094D\u0930\u0942",
        ko: "\uD788\uBE0C\uB9AC\uC5B4",
        pl: "Hebrajski",
        tr: "\u0130branice",
        ar: "\u0627\u0644\u0639\u0628\u0631\u064A\u0629",
        vi: "Ti\u1EBFng Do Th\xE1i",
        id: "Ibrani",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2E\u0E34\u0E1A\u0E23\u0E39",
        he: "\u05E2\u05D1\u05E8\u05D9\u05EA",
        uk: "\u0406\u0432\u0440\u0438\u0442",
        cs: "Hebrej\u0161tina",
        ro: "Ebraic\u0103",
        hu: "H\xE9ber",
        sv: "Hebreiska",
        da: "Hebraisk",
        nb: "Hebraisk",
        fi: "Heprea",
        fil: "Hebreo",
        bn: "\u09B9\u09BF\u09AC\u09CD\u09B0\u09C1"
      }
    },
    {
      code: "uk",
      nativeLabel: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430",
      labels: {
        en: "Ukrainian",
        es: "Ucraniano",
        pt: "Ucraniano",
        de: "Ukrainisch",
        fr: "Ukrainien",
        it: "Ucraino",
        nl: "Oekra\xEFens",
        ja: "\u30A6\u30AF\u30E9\u30A4\u30CA\u8A9E",
        "zh-hans": "\u4E4C\u514B\u5170\u8BED",
        "zh-tw": "\u70CF\u514B\u862D\u8A9E",
        hi: "\u092F\u0942\u0915\u094D\u0930\u0947\u0928\u0940",
        ko: "\uC6B0\uD06C\uB77C\uC774\uB098\uC5B4",
        pl: "Ukrai\u0144ski",
        tr: "Ukraynaca",
        ar: "\u0627\u0644\u0623\u0648\u0643\u0631\u0627\u0646\u064A\u0629",
        vi: "Ti\u1EBFng Ukraine",
        id: "Ukraina",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E22\u0E39\u0E40\u0E04\u0E23\u0E19",
        he: "\u05D0\u05D5\u05E7\u05E8\u05D0\u05D9\u05E0\u05D9\u05EA",
        uk: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430",
        cs: "Ukrajin\u0161tina",
        ro: "Ucrainean\u0103",
        hu: "Ukr\xE1n",
        sv: "Ukrainska",
        da: "Ukrainsk",
        nb: "Ukrainsk",
        fi: "Ukraina",
        fil: "Ukrainian",
        bn: "\u0987\u0989\u0995\u09CD\u09B0\u09C7\u09A8\u09C0\u09AF\u09BC"
      }
    },
    {
      code: "cs",
      nativeLabel: "\u010Ce\u0161tina",
      labels: {
        en: "Czech",
        es: "Checo",
        pt: "Tcheco",
        de: "Tschechisch",
        fr: "Tch\xE8que",
        it: "Ceco",
        nl: "Tsjechisch",
        ja: "\u30C1\u30A7\u30B3\u8A9E",
        "zh-hans": "\u6377\u514B\u8BED",
        "zh-tw": "\u6377\u514B\u8A9E",
        hi: "\u091A\u0947\u0915",
        ko: "\uCCB4\uCF54\uC5B4",
        pl: "Czeski",
        tr: "\xC7ek\xE7e",
        ar: "\u0627\u0644\u062A\u0634\u064A\u0643\u064A\u0629",
        vi: "Ti\u1EBFng S\xE9c",
        id: "Ceko",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E0A\u0E47\u0E01",
        he: "\u05E6'\u05DB\u05D9\u05EA",
        uk: "\u0427\u0435\u0441\u044C\u043A\u0430",
        cs: "\u010Ce\u0161tina",
        ro: "Ceh\u0103",
        hu: "Cseh",
        sv: "Tjeckiska",
        da: "Tjekkisk",
        nb: "Tsjekkisk",
        fi: "T\u0161ekki",
        fil: "Czech",
        bn: "\u099A\u09C7\u0995"
      }
    },
    {
      code: "ro",
      nativeLabel: "Rom\xE2n\u0103",
      labels: {
        en: "Romanian",
        es: "Rumano",
        pt: "Romeno",
        de: "Rum\xE4nisch",
        fr: "Roumain",
        it: "Rumeno",
        nl: "Roemeens",
        ja: "\u30EB\u30FC\u30DE\u30CB\u30A2\u8A9E",
        "zh-hans": "\u7F57\u9A6C\u5C3C\u4E9A\u8BED",
        "zh-tw": "\u7F85\u99AC\u5C3C\u4E9E\u8A9E",
        hi: "\u0930\u094B\u092E\u093E\u0928\u093F\u092F\u093E\u0908",
        ko: "\uB8E8\uB9C8\uB2C8\uC544\uC5B4",
        pl: "Rumu\u0144ski",
        tr: "Rumence",
        ar: "\u0627\u0644\u0631\u0648\u0645\u0627\u0646\u064A\u0629",
        vi: "Ti\u1EBFng Romania",
        id: "Rumania",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E42\u0E23\u0E21\u0E32\u0E40\u0E19\u0E35\u0E22",
        he: "\u05E8\u05D5\u05DE\u05E0\u05D9\u05EA",
        uk: "\u0420\u0443\u043C\u0443\u043D\u0441\u044C\u043A\u0430",
        cs: "Rumun\u0161tina",
        ro: "Rom\xE2n\u0103",
        hu: "Rom\xE1n",
        sv: "Rum\xE4nska",
        da: "Rum\xE6nsk",
        nb: "Rumensk",
        fi: "Romania",
        fil: "Romanian",
        bn: "\u09B0\u09CB\u09AE\u09BE\u09A8\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "hu",
      nativeLabel: "Magyar",
      labels: {
        en: "Hungarian",
        es: "H\xFAngaro",
        pt: "H\xFAngaro",
        de: "Ungarisch",
        fr: "Hongrois",
        it: "Ungherese",
        nl: "Hongaars",
        ja: "\u30CF\u30F3\u30AC\u30EA\u30FC\u8A9E",
        "zh-hans": "\u5308\u7259\u5229\u8BED",
        "zh-tw": "\u5308\u7259\u5229\u8A9E",
        hi: "\u0939\u0902\u0917\u0947\u0930\u093F\u092F\u093E\u0908",
        ko: "\uD5DD\uAC00\uB9AC\uC5B4",
        pl: "W\u0119gierski",
        tr: "Macarca",
        ar: "\u0627\u0644\u0645\u062C\u0631\u064A\u0629",
        vi: "Ti\u1EBFng Hungary",
        id: "Hungaria",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2E\u0E31\u0E07\u0E01\u0E32\u0E23\u0E35",
        he: "\u05D4\u05D5\u05E0\u05D2\u05E8\u05D9\u05EA",
        uk: "\u0423\u0433\u043E\u0440\u0441\u044C\u043A\u0430",
        cs: "Ma\u010Far\u0161tina",
        ro: "Maghiar\u0103",
        hu: "Magyar",
        sv: "Ungerska",
        da: "Ungarsk",
        nb: "Ungarsk",
        fi: "Unkari",
        fil: "Hungarian",
        bn: "\u09B9\u09BE\u0999\u09CD\u0997\u09C7\u09B0\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "sv",
      nativeLabel: "Svenska",
      labels: {
        en: "Swedish",
        es: "Sueco",
        pt: "Sueco",
        de: "Schwedisch",
        fr: "Su\xE9dois",
        it: "Svedese",
        nl: "Zweeds",
        ja: "\u30B9\u30A6\u30A7\u30FC\u30C7\u30F3\u8A9E",
        "zh-hans": "\u745E\u5178\u8BED",
        "zh-tw": "\u745E\u5178\u8A9E",
        hi: "\u0938\u094D\u0935\u0940\u0921\u093F\u0936",
        ko: "\uC2A4\uC6E8\uB374\uC5B4",
        pl: "Szwedzki",
        tr: "\u0130sve\xE7\xE7e",
        ar: "\u0627\u0644\u0633\u0648\u064A\u062F\u064A\u0629",
        vi: "Ti\u1EBFng Th\u1EE5y \u0110i\u1EC3n",
        id: "Swedia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E2A\u0E27\u0E35\u0E40\u0E14\u0E19",
        he: "\u05E9\u05D5\u05D5\u05D3\u05D9\u05EA",
        uk: "\u0428\u0432\u0435\u0434\u0441\u044C\u043A\u0430",
        cs: "\u0160v\xE9d\u0161tina",
        ro: "Suedez\u0103",
        hu: "Sv\xE9d",
        sv: "Svenska",
        da: "Svensk",
        nb: "Svensk",
        fi: "Ruotsi",
        fil: "Swedish",
        bn: "\u09B8\u09C1\u0987\u09A1\u09BF\u09B6"
      }
    },
    {
      code: "da",
      nativeLabel: "Dansk",
      labels: {
        en: "Danish",
        es: "Dan\xE9s",
        pt: "Dinamarqu\xEAs",
        de: "D\xE4nisch",
        fr: "Danois",
        it: "Danese",
        nl: "Deens",
        ja: "\u30C7\u30F3\u30DE\u30FC\u30AF\u8A9E",
        "zh-hans": "\u4E39\u9EA6\u8BED",
        "zh-tw": "\u4E39\u9EA5\u8A9E",
        hi: "\u0921\u0947\u0928\u093F\u0936",
        ko: "\uB374\uB9C8\uD06C\uC5B4",
        pl: "Du\u0144ski",
        tr: "Danca",
        ar: "\u0627\u0644\u062F\u0646\u0645\u0627\u0631\u0643\u064A\u0629",
        vi: "Ti\u1EBFng \u0110an M\u1EA1ch",
        id: "Denmark",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E14\u0E19\u0E21\u0E32\u0E23\u0E4C\u0E01",
        he: "\u05D3\u05E0\u05D9\u05EA",
        uk: "\u0414\u0430\u043D\u0441\u044C\u043A\u0430",
        cs: "D\xE1n\u0161tina",
        ro: "Danez\u0103",
        hu: "D\xE1n",
        sv: "Dansk",
        da: "Dansk",
        nb: "Dansk",
        fi: "Tanska",
        fil: "Danish",
        bn: "\u09A1\u09CD\u09AF\u09BE\u09A8\u09BF\u09B6"
      }
    },
    {
      code: "nb",
      nativeLabel: "Norsk",
      labels: {
        en: "Norwegian",
        es: "Noruego",
        pt: "Noruegu\xEAs",
        de: "Norwegisch",
        fr: "Norv\xE9gien",
        it: "Norvegese",
        nl: "Noors",
        ja: "\u30CE\u30EB\u30A6\u30A7\u30FC\u8A9E",
        "zh-hans": "\u632A\u5A01\u8BED",
        "zh-tw": "\u632A\u5A01\u8A9E",
        hi: "\u0928\u0949\u0930\u094D\u0935\u0947\u091C\u093F\u092F\u093E\u0908",
        ko: "\uB178\uB974\uC6E8\uC774\uC5B4",
        pl: "Norweski",
        tr: "Norve\xE7\xE7e",
        ar: "\u0627\u0644\u0646\u0631\u0648\u064A\u062C\u064A\u0629",
        vi: "Ti\u1EBFng Na Uy",
        id: "Norwegia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E19\u0E2D\u0E23\u0E4C\u0E40\u0E27\u0E22\u0E4C",
        he: "\u05E0\u05D5\u05E8\u05D5\u05D5\u05D2\u05D9\u05EA",
        uk: "\u041D\u043E\u0440\u0432\u0435\u0437\u044C\u043A\u0430",
        cs: "Nor\u0161tina",
        ro: "Norvegian\u0103",
        hu: "Norv\xE9g",
        sv: "Norska",
        da: "Norsk",
        nb: "Norsk",
        fi: "Norja",
        fil: "Norwegian",
        bn: "\u09A8\u09B0\u0993\u09AF\u09BC\u09C7\u099C\u09BF\u09AF\u09BC\u09BE\u09A8"
      }
    },
    {
      code: "fi",
      nativeLabel: "Suomi",
      labels: {
        en: "Finnish",
        es: "Finland\xE9s",
        pt: "Finland\xEAs",
        de: "Finnisch",
        fr: "Finnois",
        it: "Finlandese",
        nl: "Fins",
        ja: "\u30D5\u30A3\u30F3\u30E9\u30F3\u30C9\u8A9E",
        "zh-hans": "\u82AC\u5170\u8BED",
        "zh-tw": "\u82AC\u862D\u8A9E",
        hi: "\u092B\u093F\u0928\u093F\u0936",
        ko: "\uD540\uB780\uB4DC\uC5B4",
        pl: "Fi\u0144ski",
        tr: "Fince",
        ar: "\u0627\u0644\u0641\u0646\u0644\u0646\u062F\u064A\u0629",
        vi: "Ti\u1EBFng Ph\u1EA7n Lan",
        id: "Finlandia",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E1F\u0E34\u0E19\u0E41\u0E25\u0E19\u0E14\u0E4C",
        he: "\u05E4\u05D9\u05E0\u05D9\u05EA",
        uk: "\u0424\u0456\u043D\u0441\u044C\u043A\u0430",
        cs: "Fin\u0161tina",
        ro: "Finlandez\u0103",
        hu: "Finn",
        sv: "Finska",
        da: "Finsk",
        nb: "Finsk",
        fi: "Suomi",
        fil: "Finnish",
        bn: "\u09AB\u09BF\u09A8\u09BF\u09B6"
      }
    },
    {
      code: "fil",
      nativeLabel: "Filipino",
      labels: {
        en: "Filipino",
        es: "Filipino",
        pt: "Filipino",
        de: "Filipino",
        fr: "Filipin",
        it: "Filippino",
        nl: "Filipijns",
        ja: "\u30D5\u30A3\u30EA\u30D4\u30F3\u8A9E",
        "zh-hans": "\u83F2\u5F8B\u5BBE\u8BED",
        "zh-tw": "\u83F2\u5F8B\u8CD3\u8A9E",
        hi: "\u092B\u093F\u0932\u093F\u092A\u093F\u0928\u094B",
        ko: "\uD544\uB9AC\uD540\uC5B4",
        pl: "Filipino",
        tr: "Filipin\xE7a",
        ar: "\u0627\u0644\u0641\u064A\u0644\u064A\u0628\u064A\u0646\u064A\u0629",
        vi: "Ti\u1EBFng Philippines",
        id: "Pilipino",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E1F\u0E34\u0E25\u0E34\u0E1B\u0E1B\u0E34\u0E19\u0E2A\u0E4C",
        he: "\u05E4\u05D9\u05DC\u05D9\u05E4\u05D9\u05E0\u05D9\u05EA",
        uk: "\u0424\u0456\u043B\u0456\u043F\u043F\u0456\u043D\u0441\u044C\u043A\u0430",
        cs: "Filip\xEDn\u0161tina",
        ro: "Filipinez\u0103",
        hu: "Filipp\xEDn\xF3",
        sv: "Filippinska",
        da: "Filippinsk",
        nb: "Filippinsk",
        fi: "Filippiini",
        fil: "Filipino",
        bn: "\u09AB\u09BF\u09B2\u09BF\u09AA\u09BF\u09A8\u09CB"
      }
    },
    {
      code: "bn",
      nativeLabel: "\u09AC\u09BE\u0982\u09B2\u09BE",
      labels: {
        en: "Bengali",
        es: "Bengal\xED",
        pt: "Bengali",
        de: "Bengalisch",
        fr: "Bengali",
        it: "Bengalese",
        nl: "Bengaals",
        ja: "\u30D9\u30F3\u30AC\u30EB\u8A9E",
        "zh-hans": "\u5B5F\u52A0\u62C9\u8BED",
        "zh-tw": "\u5B5F\u52A0\u62C9\u8A9E",
        hi: "\u092C\u0902\u0917\u093E\u0932\u0940",
        ko: "\uBCB5\uACE8\uC5B4",
        pl: "Bengalski",
        tr: "Bengalce",
        ar: "\u0627\u0644\u0628\u0646\u063A\u0627\u0644\u064A\u0629",
        vi: "Ti\u1EBFng Bengali",
        id: "Bengali",
        th: "\u0E20\u0E32\u0E29\u0E32\u0E40\u0E1A\u0E07\u0E01\u0E2D\u0E25",
        he: "\u05D1\u05E0\u05D2\u05DC\u05D9\u05EA",
        uk: "\u0411\u0435\u043D\u0433\u0430\u043B\u044C\u0441\u044C\u043A\u0430",
        cs: "Beng\xE1l\u0161tina",
        ro: "Bengalez\u0103",
        hu: "Bengali",
        sv: "Bengali",
        da: "Bengali",
        nb: "Bengali",
        fi: "Bengali",
        fil: "Bengali",
        bn: "\u09AC\u09BE\u0982\u09B2\u09BE"
      }
    }
  ];

  // ../packages/ck-contracts/src/user-settings-geo.js
  var USER_SETTINGS_COUNTRY_TIMEZONES = Object.freeze({
    AD: Object.freeze(["Europe/Andorra"]),
    AE: Object.freeze(["Asia/Dubai"]),
    AF: Object.freeze(["Asia/Kabul"]),
    AG: Object.freeze(["America/Antigua"]),
    AI: Object.freeze(["America/Anguilla"]),
    AL: Object.freeze(["Europe/Tirane"]),
    AM: Object.freeze(["Asia/Yerevan"]),
    AO: Object.freeze(["Africa/Luanda"]),
    AQ: Object.freeze(["Antarctica/McMurdo", "Antarctica/Casey", "Antarctica/Davis", "Antarctica/DumontDUrville", "Antarctica/Mawson", "Antarctica/Palmer", "Antarctica/Rothera", "Antarctica/Syowa", "Antarctica/Troll", "Antarctica/Vostok"]),
    AR: Object.freeze(["America/Argentina/Buenos_Aires", "America/Argentina/Cordoba", "America/Argentina/Salta", "America/Argentina/Jujuy", "America/Argentina/Tucuman", "America/Argentina/Catamarca", "America/Argentina/La_Rioja", "America/Argentina/San_Juan", "America/Argentina/Mendoza", "America/Argentina/San_Luis", "America/Argentina/Rio_Gallegos", "America/Argentina/Ushuaia"]),
    AS: Object.freeze(["Pacific/Pago_Pago"]),
    AT: Object.freeze(["Europe/Vienna"]),
    AU: Object.freeze(["Australia/Lord_Howe", "Antarctica/Macquarie", "Australia/Hobart", "Australia/Melbourne", "Australia/Sydney", "Australia/Broken_Hill", "Australia/Brisbane", "Australia/Lindeman", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth", "Australia/Eucla"]),
    AW: Object.freeze(["America/Aruba"]),
    AX: Object.freeze(["Europe/Mariehamn"]),
    AZ: Object.freeze(["Asia/Baku"]),
    BA: Object.freeze(["Europe/Sarajevo"]),
    BB: Object.freeze(["America/Barbados"]),
    BD: Object.freeze(["Asia/Dhaka"]),
    BE: Object.freeze(["Europe/Brussels"]),
    BF: Object.freeze(["Africa/Ouagadougou"]),
    BG: Object.freeze(["Europe/Sofia"]),
    BH: Object.freeze(["Asia/Bahrain"]),
    BI: Object.freeze(["Africa/Bujumbura"]),
    BJ: Object.freeze(["Africa/Porto-Novo"]),
    BL: Object.freeze(["America/St_Barthelemy"]),
    BM: Object.freeze(["Atlantic/Bermuda"]),
    BN: Object.freeze(["Asia/Brunei"]),
    BO: Object.freeze(["America/La_Paz"]),
    BQ: Object.freeze(["America/Kralendijk"]),
    BR: Object.freeze(["America/Noronha", "America/Belem", "America/Fortaleza", "America/Recife", "America/Araguaina", "America/Maceio", "America/Bahia", "America/Sao_Paulo", "America/Campo_Grande", "America/Cuiaba", "America/Santarem", "America/Porto_Velho", "America/Boa_Vista", "America/Manaus", "America/Eirunepe", "America/Rio_Branco"]),
    BS: Object.freeze(["America/Nassau"]),
    BT: Object.freeze(["Asia/Thimphu"]),
    BW: Object.freeze(["Africa/Gaborone"]),
    BY: Object.freeze(["Europe/Minsk"]),
    BZ: Object.freeze(["America/Belize"]),
    CA: Object.freeze(["America/St_Johns", "America/Halifax", "America/Glace_Bay", "America/Moncton", "America/Goose_Bay", "America/Blanc-Sablon", "America/Toronto", "America/Iqaluit", "America/Atikokan", "America/Winnipeg", "America/Resolute", "America/Rankin_Inlet", "America/Regina", "America/Swift_Current", "America/Edmonton", "America/Cambridge_Bay", "America/Inuvik", "America/Creston", "America/Dawson_Creek", "America/Fort_Nelson", "America/Whitehorse", "America/Dawson", "America/Vancouver"]),
    CC: Object.freeze(["Indian/Cocos"]),
    CD: Object.freeze(["Africa/Kinshasa", "Africa/Lubumbashi"]),
    CF: Object.freeze(["Africa/Bangui"]),
    CG: Object.freeze(["Africa/Brazzaville"]),
    CH: Object.freeze(["Europe/Zurich"]),
    CI: Object.freeze(["Africa/Abidjan"]),
    CK: Object.freeze(["Pacific/Rarotonga"]),
    CL: Object.freeze(["America/Santiago", "America/Coyhaique", "America/Punta_Arenas", "Pacific/Easter"]),
    CM: Object.freeze(["Africa/Douala"]),
    CN: Object.freeze(["Asia/Shanghai", "Asia/Urumqi"]),
    CO: Object.freeze(["America/Bogota"]),
    CR: Object.freeze(["America/Costa_Rica"]),
    CU: Object.freeze(["America/Havana"]),
    CV: Object.freeze(["Atlantic/Cape_Verde"]),
    CW: Object.freeze(["America/Curacao"]),
    CX: Object.freeze(["Indian/Christmas"]),
    CY: Object.freeze(["Asia/Nicosia", "Asia/Famagusta"]),
    CZ: Object.freeze(["Europe/Prague"]),
    DE: Object.freeze(["Europe/Berlin", "Europe/Busingen"]),
    DJ: Object.freeze(["Africa/Djibouti"]),
    DK: Object.freeze(["Europe/Copenhagen"]),
    DM: Object.freeze(["America/Dominica"]),
    DO: Object.freeze(["America/Santo_Domingo"]),
    DZ: Object.freeze(["Africa/Algiers"]),
    EC: Object.freeze(["America/Guayaquil", "Pacific/Galapagos"]),
    EE: Object.freeze(["Europe/Tallinn"]),
    EG: Object.freeze(["Africa/Cairo"]),
    EH: Object.freeze(["Africa/El_Aaiun"]),
    ER: Object.freeze(["Africa/Asmara"]),
    ES: Object.freeze(["Europe/Madrid", "Africa/Ceuta", "Atlantic/Canary"]),
    ET: Object.freeze(["Africa/Addis_Ababa"]),
    FI: Object.freeze(["Europe/Helsinki"]),
    FJ: Object.freeze(["Pacific/Fiji"]),
    FK: Object.freeze(["Atlantic/Stanley"]),
    FM: Object.freeze(["Pacific/Chuuk", "Pacific/Pohnpei", "Pacific/Kosrae"]),
    FO: Object.freeze(["Atlantic/Faroe"]),
    FR: Object.freeze(["Europe/Paris"]),
    GA: Object.freeze(["Africa/Libreville"]),
    GB: Object.freeze(["Europe/London"]),
    GD: Object.freeze(["America/Grenada"]),
    GE: Object.freeze(["Asia/Tbilisi"]),
    GF: Object.freeze(["America/Cayenne"]),
    GG: Object.freeze(["Europe/Guernsey"]),
    GH: Object.freeze(["Africa/Accra"]),
    GI: Object.freeze(["Europe/Gibraltar"]),
    GL: Object.freeze(["America/Nuuk", "America/Danmarkshavn", "America/Scoresbysund", "America/Thule"]),
    GM: Object.freeze(["Africa/Banjul"]),
    GN: Object.freeze(["Africa/Conakry"]),
    GP: Object.freeze(["America/Guadeloupe"]),
    GQ: Object.freeze(["Africa/Malabo"]),
    GR: Object.freeze(["Europe/Athens"]),
    GS: Object.freeze(["Atlantic/South_Georgia"]),
    GT: Object.freeze(["America/Guatemala"]),
    GU: Object.freeze(["Pacific/Guam"]),
    GW: Object.freeze(["Africa/Bissau"]),
    GY: Object.freeze(["America/Guyana"]),
    HK: Object.freeze(["Asia/Hong_Kong"]),
    HN: Object.freeze(["America/Tegucigalpa"]),
    HR: Object.freeze(["Europe/Zagreb"]),
    HT: Object.freeze(["America/Port-au-Prince"]),
    HU: Object.freeze(["Europe/Budapest"]),
    ID: Object.freeze(["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"]),
    IE: Object.freeze(["Europe/Dublin"]),
    IL: Object.freeze(["Asia/Jerusalem"]),
    IM: Object.freeze(["Europe/Isle_of_Man"]),
    IN: Object.freeze(["Asia/Kolkata"]),
    IO: Object.freeze(["Indian/Chagos"]),
    IQ: Object.freeze(["Asia/Baghdad"]),
    IR: Object.freeze(["Asia/Tehran"]),
    IS: Object.freeze(["Atlantic/Reykjavik"]),
    IT: Object.freeze(["Europe/Rome"]),
    JE: Object.freeze(["Europe/Jersey"]),
    JM: Object.freeze(["America/Jamaica"]),
    JO: Object.freeze(["Asia/Amman"]),
    JP: Object.freeze(["Asia/Tokyo"]),
    KE: Object.freeze(["Africa/Nairobi"]),
    KG: Object.freeze(["Asia/Bishkek"]),
    KH: Object.freeze(["Asia/Phnom_Penh"]),
    KI: Object.freeze(["Pacific/Tarawa", "Pacific/Kanton", "Pacific/Kiritimati"]),
    KM: Object.freeze(["Indian/Comoro"]),
    KN: Object.freeze(["America/St_Kitts"]),
    KP: Object.freeze(["Asia/Pyongyang"]),
    KR: Object.freeze(["Asia/Seoul"]),
    KW: Object.freeze(["Asia/Kuwait"]),
    KY: Object.freeze(["America/Cayman"]),
    KZ: Object.freeze(["Asia/Almaty", "Asia/Qyzylorda", "Asia/Qostanay", "Asia/Aqtobe", "Asia/Aqtau", "Asia/Atyrau", "Asia/Oral"]),
    LA: Object.freeze(["Asia/Vientiane"]),
    LB: Object.freeze(["Asia/Beirut"]),
    LC: Object.freeze(["America/St_Lucia"]),
    LI: Object.freeze(["Europe/Vaduz"]),
    LK: Object.freeze(["Asia/Colombo"]),
    LR: Object.freeze(["Africa/Monrovia"]),
    LS: Object.freeze(["Africa/Maseru"]),
    LT: Object.freeze(["Europe/Vilnius"]),
    LU: Object.freeze(["Europe/Luxembourg"]),
    LV: Object.freeze(["Europe/Riga"]),
    LY: Object.freeze(["Africa/Tripoli"]),
    MA: Object.freeze(["Africa/Casablanca"]),
    MC: Object.freeze(["Europe/Monaco"]),
    MD: Object.freeze(["Europe/Chisinau"]),
    ME: Object.freeze(["Europe/Podgorica"]),
    MF: Object.freeze(["America/Marigot"]),
    MG: Object.freeze(["Indian/Antananarivo"]),
    MH: Object.freeze(["Pacific/Majuro", "Pacific/Kwajalein"]),
    MK: Object.freeze(["Europe/Skopje"]),
    ML: Object.freeze(["Africa/Bamako"]),
    MM: Object.freeze(["Asia/Yangon"]),
    MN: Object.freeze(["Asia/Ulaanbaatar", "Asia/Hovd"]),
    MO: Object.freeze(["Asia/Macau"]),
    MP: Object.freeze(["Pacific/Saipan"]),
    MQ: Object.freeze(["America/Martinique"]),
    MR: Object.freeze(["Africa/Nouakchott"]),
    MS: Object.freeze(["America/Montserrat"]),
    MT: Object.freeze(["Europe/Malta"]),
    MU: Object.freeze(["Indian/Mauritius"]),
    MV: Object.freeze(["Indian/Maldives"]),
    MW: Object.freeze(["Africa/Blantyre"]),
    MX: Object.freeze(["America/Mexico_City", "America/Cancun", "America/Merida", "America/Monterrey", "America/Matamoros", "America/Chihuahua", "America/Ciudad_Juarez", "America/Ojinaga", "America/Mazatlan", "America/Bahia_Banderas", "America/Hermosillo", "America/Tijuana"]),
    MY: Object.freeze(["Asia/Kuala_Lumpur", "Asia/Kuching"]),
    MZ: Object.freeze(["Africa/Maputo"]),
    NA: Object.freeze(["Africa/Windhoek"]),
    NC: Object.freeze(["Pacific/Noumea"]),
    NE: Object.freeze(["Africa/Niamey"]),
    NF: Object.freeze(["Pacific/Norfolk"]),
    NG: Object.freeze(["Africa/Lagos"]),
    NI: Object.freeze(["America/Managua"]),
    NL: Object.freeze(["Europe/Amsterdam"]),
    NO: Object.freeze(["Europe/Oslo"]),
    NP: Object.freeze(["Asia/Kathmandu"]),
    NR: Object.freeze(["Pacific/Nauru"]),
    NU: Object.freeze(["Pacific/Niue"]),
    NZ: Object.freeze(["Pacific/Auckland", "Pacific/Chatham"]),
    OM: Object.freeze(["Asia/Muscat"]),
    PA: Object.freeze(["America/Panama"]),
    PE: Object.freeze(["America/Lima"]),
    PF: Object.freeze(["Pacific/Tahiti", "Pacific/Marquesas", "Pacific/Gambier"]),
    PG: Object.freeze(["Pacific/Port_Moresby", "Pacific/Bougainville"]),
    PH: Object.freeze(["Asia/Manila"]),
    PK: Object.freeze(["Asia/Karachi"]),
    PL: Object.freeze(["Europe/Warsaw"]),
    PM: Object.freeze(["America/Miquelon"]),
    PN: Object.freeze(["Pacific/Pitcairn"]),
    PR: Object.freeze(["America/Puerto_Rico"]),
    PS: Object.freeze(["Asia/Gaza", "Asia/Hebron"]),
    PT: Object.freeze(["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"]),
    PW: Object.freeze(["Pacific/Palau"]),
    PY: Object.freeze(["America/Asuncion"]),
    QA: Object.freeze(["Asia/Qatar"]),
    RE: Object.freeze(["Indian/Reunion"]),
    RO: Object.freeze(["Europe/Bucharest"]),
    RS: Object.freeze(["Europe/Belgrade"]),
    RU: Object.freeze(["Europe/Kaliningrad", "Europe/Moscow", "Europe/Kirov", "Europe/Volgograd", "Europe/Astrakhan", "Europe/Saratov", "Europe/Ulyanovsk", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk", "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk", "Asia/Khandyga", "Asia/Vladivostok", "Asia/Ust-Nera", "Asia/Magadan", "Asia/Sakhalin", "Asia/Srednekolymsk", "Asia/Kamchatka", "Asia/Anadyr"]),
    RW: Object.freeze(["Africa/Kigali"]),
    SA: Object.freeze(["Asia/Riyadh"]),
    SB: Object.freeze(["Pacific/Guadalcanal"]),
    SC: Object.freeze(["Indian/Mahe"]),
    SD: Object.freeze(["Africa/Khartoum"]),
    SE: Object.freeze(["Europe/Stockholm"]),
    SG: Object.freeze(["Asia/Singapore"]),
    SH: Object.freeze(["Atlantic/St_Helena"]),
    SI: Object.freeze(["Europe/Ljubljana"]),
    SJ: Object.freeze(["Arctic/Longyearbyen"]),
    SK: Object.freeze(["Europe/Bratislava"]),
    SL: Object.freeze(["Africa/Freetown"]),
    SM: Object.freeze(["Europe/San_Marino"]),
    SN: Object.freeze(["Africa/Dakar"]),
    SO: Object.freeze(["Africa/Mogadishu"]),
    SR: Object.freeze(["America/Paramaribo"]),
    SS: Object.freeze(["Africa/Juba"]),
    ST: Object.freeze(["Africa/Sao_Tome"]),
    SV: Object.freeze(["America/El_Salvador"]),
    SX: Object.freeze(["America/Lower_Princes"]),
    SY: Object.freeze(["Asia/Damascus"]),
    SZ: Object.freeze(["Africa/Mbabane"]),
    TC: Object.freeze(["America/Grand_Turk"]),
    TD: Object.freeze(["Africa/Ndjamena"]),
    TF: Object.freeze(["Indian/Kerguelen"]),
    TG: Object.freeze(["Africa/Lome"]),
    TH: Object.freeze(["Asia/Bangkok"]),
    TJ: Object.freeze(["Asia/Dushanbe"]),
    TK: Object.freeze(["Pacific/Fakaofo"]),
    TL: Object.freeze(["Asia/Dili"]),
    TM: Object.freeze(["Asia/Ashgabat"]),
    TN: Object.freeze(["Africa/Tunis"]),
    TO: Object.freeze(["Pacific/Tongatapu"]),
    TR: Object.freeze(["Europe/Istanbul"]),
    TT: Object.freeze(["America/Port_of_Spain"]),
    TV: Object.freeze(["Pacific/Funafuti"]),
    TW: Object.freeze(["Asia/Taipei"]),
    TZ: Object.freeze(["Africa/Dar_es_Salaam"]),
    UA: Object.freeze(["Europe/Simferopol", "Europe/Kyiv"]),
    UG: Object.freeze(["Africa/Kampala"]),
    UM: Object.freeze(["Pacific/Midway", "Pacific/Wake"]),
    US: Object.freeze(["America/New_York", "America/Detroit", "America/Kentucky/Louisville", "America/Kentucky/Monticello", "America/Indiana/Indianapolis", "America/Indiana/Vincennes", "America/Indiana/Winamac", "America/Indiana/Marengo", "America/Indiana/Petersburg", "America/Indiana/Vevay", "America/Chicago", "America/Indiana/Tell_City", "America/Indiana/Knox", "America/Menominee", "America/North_Dakota/Center", "America/North_Dakota/New_Salem", "America/North_Dakota/Beulah", "America/Denver", "America/Boise", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "America/Juneau", "America/Sitka", "America/Metlakatla", "America/Yakutat", "America/Nome", "America/Adak", "Pacific/Honolulu"]),
    UY: Object.freeze(["America/Montevideo"]),
    UZ: Object.freeze(["Asia/Samarkand", "Asia/Tashkent"]),
    VA: Object.freeze(["Europe/Vatican"]),
    VC: Object.freeze(["America/St_Vincent"]),
    VE: Object.freeze(["America/Caracas"]),
    VG: Object.freeze(["America/Tortola"]),
    VI: Object.freeze(["America/St_Thomas"]),
    VN: Object.freeze(["Asia/Ho_Chi_Minh"]),
    VU: Object.freeze(["Pacific/Efate"]),
    WF: Object.freeze(["Pacific/Wallis"]),
    WS: Object.freeze(["Pacific/Apia"]),
    YE: Object.freeze(["Asia/Aden"]),
    YT: Object.freeze(["Indian/Mayotte"]),
    ZA: Object.freeze(["Africa/Johannesburg"]),
    ZM: Object.freeze(["Africa/Lusaka"]),
    ZW: Object.freeze(["Africa/Harare"])
  });
  var USER_SETTINGS_COUNTRY_CODES = Object.freeze(Object.keys(USER_SETTINGS_COUNTRY_TIMEZONES));

  // ../packages/ck-contracts/src/index.js
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var CK_ERROR_CODE = Object.freeze({
    VALIDATION: "VALIDATION",
    NOT_FOUND: "NOT_FOUND",
    DENY: "DENY",
    INTERNAL: "INTERNAL"
  });
  var INSTANCE_PUBLISH_STATUS = Object.freeze({
    PUBLISHED: "published",
    UNPUBLISHED: "unpublished"
  });
  var RENDER_SNAPSHOT_ACTION = Object.freeze({
    UPSERT: "upsert",
    DELETE: "delete"
  });
  var SUPPORTED_LOCALES = new Set(normalizeCanonicalLocalesFile(locales_default).map((entry) => entry.code));
  function isUuid(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    return Boolean(value && UUID_RE.test(value));
  }

  // components/dropdown-fill/fill-types.ts
  var MODE_ORDER = ["color", "gradient", "image", "video"];
  var DEFAULT_GRADIENT = {
    angle: 135,
    stops: [
      { color: "#ff3b30", position: 0 },
      { color: "#007aff", position: 100 }
    ]
  };

  // components/dropdown-fill/color-utils.ts
  function clampNumber(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(Math.max(value, min), max);
  }
  function roundTo(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
  function normalizeHex(value) {
    const hex = value.trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return `#${hex.split("").map((c) => c + c).join("")}`;
    }
    if (/^[0-9a-f]{4}$/.test(hex)) {
      const expanded = hex.split("").map((c) => c + c).join("");
      return `#${expanded.slice(0, 6)}`;
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`;
    return null;
  }
  function normalizeAssetReferenceUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const baseHref = typeof window !== "undefined" ? window.location.href : "http://localhost/";
      return new URL(trimmed, baseHref).toString();
    } catch {
      return trimmed;
    }
  }
  function sameAssetReferenceUrl(left, right) {
    const leftNormalized = normalizeAssetReferenceUrl(left);
    const rightNormalized = normalizeAssetReferenceUrl(right);
    if (!leftNormalized || !rightNormalized) return false;
    return leftNormalized === rightNormalized;
  }
  function hexToRgba(value) {
    const raw = value.trim().replace(/^#/, "");
    if (!/^[0-9a-f]+$/i.test(raw)) return null;
    if (raw.length === 3) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      return { r, g, b, a: 1 };
    }
    if (raw.length === 4) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      const a = parseInt(raw[3] + raw[3], 16) / 255;
      return { r, g, b, a };
    }
    if (raw.length === 6 || raw.length === 8) {
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      const a = raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }
  function rgbToHsv(r, g, b, alpha = 1) {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      switch (max) {
        case rNorm:
          h = 60 * ((gNorm - bNorm) / delta % 6);
          break;
        case gNorm:
          h = 60 * ((bNorm - rNorm) / delta + 2);
          break;
        case bNorm:
          h = 60 * ((rNorm - gNorm) / delta + 4);
          break;
        default:
          break;
      }
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    return { h, s, v, a: clampNumber(alpha, 0, 1) };
  }
  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }
  function toHex(value) {
    return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  }
  function formatHex(hsv) {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function getComputedColor(value, root) {
    const temp = document.createElement("div");
    temp.style.color = value;
    temp.style.display = "none";
    root.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    root.removeChild(temp);
    return computed;
  }
  function tryParseTransparentColorMix(value, root) {
    const trimmed = value.trim();
    if (!/^color-mix\(/i.test(trimmed)) return null;
    const parsePct = (raw) => {
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      if (num < 0 || num > 100) return null;
      return num / 100;
    };
    const tailTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s*,\s*transparent\s+([0-9.]+)%\s*\)$/i);
    const headTransparent = trimmed.match(/^color-mix\(\s*in\s+oklab\s*,\s*transparent\s+([0-9.]+)%\s*,\s*(.+?)\s*\)$/i);
    let colorExpr = null;
    let transparentWeight = null;
    if (tailTransparent) {
      colorExpr = tailTransparent[1]?.trim() ?? null;
      transparentWeight = parsePct(tailTransparent[2] ?? "");
    } else if (headTransparent) {
      transparentWeight = parsePct(headTransparent[1] ?? "");
      colorExpr = headTransparent[2]?.trim() ?? null;
    }
    if (!colorExpr || transparentWeight == null) return null;
    const base = colorStringToRgba(colorExpr, root);
    if (!base) return null;
    const baseWeight = 1 - transparentWeight;
    return { r: base.r, g: base.g, b: base.b, a: clampNumber(base.a * baseWeight, 0, 1) };
  }
  function colorStringToRgba(value, root) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const transparentMix = tryParseTransparentColorMix(trimmed, root);
    if (transparentMix) return transparentMix;
    if (trimmed.startsWith("#")) {
      return hexToRgba(trimmed);
    }
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !/\bvar\(/i.test(trimmed) && !CSS.supports("color", trimmed)) {
      return null;
    }
    const computed = getComputedColor(trimmed, root);
    return parseCssColor(computed);
  }
  function parseColor(value, root) {
    const rgba = colorStringToRgba(value, root);
    if (!rgba) return null;
    return rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a);
  }
  function parseCssColor(computed) {
    const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
    const clamp255 = (value) => Math.min(Math.max(value, 0), 255);
    const parseAlpha = (token) => {
      if (!token) return 1;
      const raw = token.trim();
      if (!raw) return 1;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        return Number.isFinite(pct) ? clamp01(pct / 100) : 1;
      }
      const num = Number.parseFloat(raw);
      return Number.isFinite(num) ? clamp01(num) : 1;
    };
    const parseRgb255 = (token) => {
      const raw = token.trim();
      if (!raw) return null;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        if (!Number.isFinite(pct)) return null;
        return clamp255(Math.round(pct / 100 * 255));
      }
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      return clamp255(Math.round(num));
    };
    const parseSrgbChannel = (token) => {
      const raw = token.trim();
      if (!raw) return null;
      if (raw.endsWith("%")) {
        const pct = Number.parseFloat(raw.slice(0, -1));
        if (!Number.isFinite(pct)) return null;
        return clamp255(Math.round(pct / 100 * 255));
      }
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) return null;
      const normalized = num > 1 ? num / 255 : num;
      return clamp255(Math.round(clamp01(normalized) * 255));
    };
    const trimmed = computed.trim();
    const hexMatch = trimmed.match(/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) return hexToRgba(trimmed);
    const srgbMatch = trimmed.match(/^color\(\s*srgb\s+(.+)\)$/i);
    if (srgbMatch) {
      const body = srgbMatch[1].trim().replace(/\)\s*$/, "");
      const [channelsPart, alphaPart] = body.split(/\s*\/\s*/);
      const channels = channelsPart.split(/\s+/).filter(Boolean);
      if (channels.length >= 3) {
        const r = parseSrgbChannel(channels[0]);
        const g = parseSrgbChannel(channels[1]);
        const b = parseSrgbChannel(channels[2]);
        if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaPart) };
      }
    }
    const rgbMatch = trimmed.match(/^rgba?\(\s*(.+)\s*\)$/i);
    if (rgbMatch) {
      const body = rgbMatch[1];
      const hasSlash = body.includes("/");
      const [channelsPartRaw, alphaPartRaw] = hasSlash ? body.split(/\s*\/\s*/) : [body, null];
      const tokens = channelsPartRaw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      let alphaToken = alphaPartRaw ? alphaPartRaw.trim() : null;
      if (!alphaToken && tokens.length >= 4) {
        alphaToken = tokens[3];
      }
      if (tokens.length >= 3) {
        const r = parseRgb255(tokens[0]);
        const g = parseRgb255(tokens[1]);
        const b = parseRgb255(tokens[2]);
        if (r != null && g != null && b != null) return { r, g, b, a: parseAlpha(alphaToken) };
      }
    }
    return null;
  }

  // components/dropdown-fill/fill-parser.ts
  function normalizeAssetId(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    return isUuid(value) ? value : "";
  }
  function normalizeImageValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { fit: "cover", position: "center", repeat: "no-repeat" };
    }
    const value = raw;
    const assetId = normalizeAssetId(value.assetId);
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const repeat = typeof value.repeat === "string" && value.repeat.trim() ? value.repeat.trim() : "no-repeat";
    return {
      ...assetId ? { assetId } : {},
      ...name ? { name } : {},
      fit,
      position,
      repeat
    };
  }
  function normalizeVideoValue(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { fit: "cover", position: "center", loop: true, muted: true, autoplay: true };
    }
    const value = raw;
    const assetId = normalizeAssetId(value.assetId);
    const posterAssetId = normalizeAssetId(value.posterAssetId);
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const fit = value.fit === "contain" ? "contain" : "cover";
    const position = typeof value.position === "string" && value.position.trim() ? value.position.trim() : "center";
    const loop = typeof value.loop === "boolean" ? value.loop : true;
    const muted = typeof value.muted === "boolean" ? value.muted : true;
    const autoplay = typeof value.autoplay === "boolean" ? value.autoplay : true;
    return {
      ...assetId ? { assetId } : {},
      ...posterAssetId ? { posterAssetId } : {},
      ...name ? { name } : {},
      fit,
      position,
      loop,
      muted,
      autoplay
    };
  }
  function normalizeGradientValue(raw) {
    if (typeof raw === "string") {
      const css2 = raw.trim();
      return css2 ? { css: css2 } : void 0;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
    const value = raw;
    const css = typeof value.css === "string" ? value.css.trim() : "";
    if (css) return { css };
    const kindRaw = typeof value.kind === "string" ? value.kind.trim() : "";
    const kind = kindRaw === "radial" || kindRaw === "conic" ? kindRaw : "linear";
    const angle = clampNumber(typeof value.angle === "number" ? value.angle : 0, 0, 360);
    const stopsRaw = Array.isArray(value.stops) ? value.stops : [];
    const stops = stopsRaw.map((stop) => {
      if (!stop || typeof stop !== "object" || Array.isArray(stop)) return null;
      const entry = stop;
      const color = typeof entry.color === "string" ? entry.color.trim() : "";
      if (!color) return null;
      const position = clampNumber(typeof entry.position === "number" ? entry.position : 0, 0, 100);
      return { color, position };
    }).filter((stop) => Boolean(stop));
    return { kind, angle, stops };
  }
  function coerceFillValue(raw) {
    const typeRaw = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
    if (!typeRaw) return { type: "none" };
    if (typeRaw === "none") return { type: "none" };
    if (!MODE_ORDER.includes(typeRaw)) return null;
    if (typeRaw === "color") {
      const color = typeof raw.color === "string" ? raw.color.trim() : "";
      const value = typeof raw.value === "string" ? raw.value.trim() : "";
      return { type: "color", color: color || value || "transparent" };
    }
    if (typeRaw === "gradient") {
      return { type: "gradient", gradient: normalizeGradientValue(raw.gradient) };
    }
    if (typeRaw === "image") {
      return { type: "image", image: normalizeImageValue(raw.image) };
    }
    if (typeRaw === "video") {
      return { type: "video", video: normalizeVideoValue(raw.video) };
    }
    return { type: "none" };
  }
  function parseFillString(value, root) {
    if (!value) return { type: "none" };
    if (/url\(\s*(['"]?)([^'")]+)\1\s*\)/i.test(value)) return null;
    if (/^https?:\/\//i.test(value) || value.startsWith("/")) return null;
    if (/-gradient\(/i.test(value)) {
      return { type: "gradient", gradient: { css: value } };
    }
    const parsed = parseColor(value, root);
    if (!parsed) return null;
    return { type: "color", color: value };
  }
  function parseFillValue(raw, root) {
    const value = String(raw ?? "").trim();
    if (!value) return { type: "none" };
    if (value.startsWith("{") || value.startsWith("[") || value.startsWith('"')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "string") return parseFillString(parsed, root);
        if (parsed == null) return { type: "none" };
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
        return coerceFillValue(parsed);
      } catch {
        return parseFillString(value, root);
      }
    }
    return parseFillString(value, root);
  }
  function resolveModeFromFill(currentMode, allowedModes, fill) {
    const desired = fill.type === "none" ? currentMode : fill.type;
    if (allowedModes.includes(desired)) return desired;
    return allowedModes[0] || "color";
  }
  function readImageName(fill) {
    return typeof fill.image?.name === "string" && fill.image.name.trim() ? fill.image.name.trim() : null;
  }
  function readVideoName(fill) {
    return typeof fill.video?.name === "string" && fill.video.name.trim() ? fill.video.name.trim() : null;
  }
  function readImageAssetId(fill) {
    const assetId = typeof fill.image?.assetId === "string" ? fill.image.assetId.trim() : "";
    return isUuid(assetId) ? assetId : null;
  }
  function readVideoAssetId(fill) {
    const assetId = typeof fill.video?.assetId === "string" ? fill.video.assetId.trim() : "";
    return isUuid(assetId) ? assetId : null;
  }
  function readVideoPosterAssetId(fill) {
    const assetId = typeof fill.video?.posterAssetId === "string" ? fill.video.posterAssetId.trim() : "";
    return isUuid(assetId) ? assetId : null;
  }

  // components/dropdown-fill/dropdown-fill-gradient.ts
  var gradientStopIdCounter = 0;
  function createGradientStopId() {
    gradientStopIdCounter += 1;
    return `gradient-stop-${gradientStopIdCounter}`;
  }
  function createGradientStopState(root, stop) {
    const parsed = parseColor(stop.color, root);
    const safeColor = parsed ? stop.color : DEFAULT_GRADIENT.stops[0].color;
    const hsv = parsed || parseColor(safeColor, root) || { h: 0, s: 0, v: 0, a: 1 };
    return {
      id: createGradientStopId(),
      color: safeColor,
      position: clampNumber(stop.position, 0, 100),
      hsv
    };
  }
  function createDefaultGradientStops(root) {
    return DEFAULT_GRADIENT.stops.map((stop) => createGradientStopState(root, stop));
  }
  function installGradientHandlers(state, deps) {
    if (state.gradientAngleInput) {
      state.gradientAngleInput.addEventListener("input", () => {
        const angle = clampNumber(Number(state.gradientAngleInput?.value), 0, 360);
        state.gradientCss = null;
        state.gradient.angle = angle;
        syncGradientUI(state, { commit: true }, deps);
      });
    }
    installGradientStopBarHandlers(state, deps);
    installGradientEditorHandlers(state, deps);
  }
  function applyGradientSwatch(state, parsed, deps) {
    const stop = getActiveGradientStop(state);
    stop.hsv.h = parsed.h;
    stop.hsv.s = parsed.s;
    stop.hsv.v = parsed.v;
    stop.hsv.a = 1;
    commitGradientStopFromHsv(state, deps);
  }
  function applyGradientFromFill(state, gradient) {
    state.gradient = { angle: DEFAULT_GRADIENT.angle };
    state.gradientStops = createDefaultGradientStops(state.root);
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    state.gradientCss = null;
    if (!gradient || typeof gradient !== "object" || Array.isArray(gradient)) return;
    if ("css" in gradient) {
      const css = typeof gradient.css === "string" ? gradient.css.trim() : "";
      state.gradientCss = css || null;
      return;
    }
    if (!("kind" in gradient)) return;
    const angle = typeof gradient.angle === "number" ? gradient.angle : DEFAULT_GRADIENT.angle;
    state.gradient.angle = clampNumber(angle, 0, 360);
    if (Array.isArray(gradient.stops) && gradient.stops.length >= 2) {
      state.gradientStops = gradient.stops.map(
        (stop) => createGradientStopState(state.root, {
          color: typeof stop?.color === "string" ? stop.color : DEFAULT_GRADIENT.stops[0].color,
          position: typeof stop?.position === "number" ? stop.position : 0
        })
      );
      state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
    }
  }
  function syncGradientUI(state, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    ensureGradientStops(state);
    if (state.gradientAngleInput) {
      state.gradientAngleInput.value = String(clampNumber(state.gradient.angle, 0, 360));
      state.gradientAngleInput.style.setProperty("--value", state.gradientAngleInput.value);
      state.gradientAngleInput.style.setProperty("--min", "0");
      state.gradientAngleInput.style.setProperty("--max", "360");
    }
    syncGradientStopButtons(state);
    syncActiveGradientStopUI(state);
    updateGradientAddButton(state);
    updateGradientPreview(state, { commit: opts.commit, updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function ensureGradientStops(state) {
    if (state.gradientStops.length >= 2) return;
    state.gradientStops = createDefaultGradientStops(state.root);
    state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
  }
  function getSortedGradientStops(stops) {
    return [...stops].sort((a, b) => a.position - b.position);
  }
  function getActiveGradientStop(state) {
    let active = state.gradientStops.find((stop) => stop.id === state.gradientActiveStopId);
    if (!active) {
      ensureGradientStops(state);
      active = state.gradientStops[0];
      state.gradientActiveStopId = active?.id ?? "";
    }
    return active;
  }
  function getGradientStopMetrics(state) {
    const bar = state.gradientStopBar;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return null;
    const sampleButton = state.gradientStopButtons.values().next().value;
    const sampleRect = sampleButton?.getBoundingClientRect();
    const sizeFallback = parseFloat(getComputedStyle(bar).getPropertyValue("--control-size-md")) || 24;
    const stopSize = sampleRect?.width || sizeFallback;
    const half = stopSize / 2;
    const minX = half;
    const maxX = Math.max(half, rect.width - half);
    return { rect, minX, maxX };
  }
  function gradientPercentToPx(state, position) {
    const metrics = getGradientStopMetrics(state);
    if (!metrics) return null;
    const percent = clampNumber(position, 0, 100);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return metrics.minX;
    return metrics.minX + span * percent / 100;
  }
  function gradientPxToPercent(state, clientX) {
    const metrics = getGradientStopMetrics(state);
    if (!metrics) return 0;
    const x = clampNumber(clientX - metrics.rect.left, metrics.minX, metrics.maxX);
    const span = metrics.maxX - metrics.minX;
    if (span <= 0) return 0;
    return clampNumber((x - metrics.minX) / span * 100, 0, 100);
  }
  function getActiveGradientStopIndex(state) {
    const sorted = getSortedGradientStops(state.gradientStops);
    const index = sorted.findIndex((stop) => stop.id === state.gradientActiveStopId);
    return { sorted, index };
  }
  function updateGradientAddButton(state) {
    const button = state.gradientStopAdd;
    if (!button) return;
    const { sorted, index } = getActiveGradientStopIndex(state);
    const removable = index > 0 && index < sorted.length - 1;
    button.textContent = removable ? "-" : "+";
    button.classList.toggle("is-remove", removable);
    button.setAttribute("aria-label", removable ? "Remove color stop" : "Add color stop");
  }
  function syncGradientStopButtons(state) {
    const bar = state.gradientStopBar;
    if (!bar) return;
    const sorted = getSortedGradientStops(state.gradientStops);
    const existing = state.gradientStopButtons;
    const keep = new Set(sorted.map((stop) => stop.id));
    Array.from(existing.entries()).forEach(([id, btn]) => {
      if (!keep.has(id)) {
        btn.remove();
        existing.delete(id);
      }
    });
    sorted.forEach((stop) => {
      let btn = existing.get(stop.id);
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "diet-dropdown-fill__gradient-stop-btn";
        btn.dataset.stopId = stop.id;
        btn.setAttribute("aria-label", "Edit gradient stop");
        bindGradientStopButton(state, btn, stop.id);
        existing.set(stop.id, btn);
        bar.appendChild(btn);
      }
      const leftPx = gradientPercentToPx(state, stop.position);
      btn.style.left = leftPx == null ? `${stop.position}%` : `${leftPx}px`;
      btn.style.setProperty("--stop-color", stop.color);
      const isActive = stop.id === state.gradientActiveStopId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }
  function getSwatchTarget(swatch) {
    const container = swatch.closest(".diet-dropdown-fill__swatches");
    return container?.dataset.swatchTarget === "gradient" ? "gradient" : "color";
  }
  function syncActiveGradientStopUI(state) {
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const hex = formatHex({ h: hsv.h, s: hsv.s, v: hsv.v, a: 1 });
    const alphaPercent = Math.round(hsv.a * 100);
    if (state.gradientEditor) {
      state.gradientEditor.style.setProperty("--picker-hue", hsv.h.toString());
      state.gradientEditor.style.setProperty("--picker-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    }
    if (state.gradientStopHueInput) {
      state.gradientStopHueInput.value = hsv.h.toString();
      state.gradientStopHueInput.style.setProperty("--value", state.gradientStopHueInput.value);
      state.gradientStopHueInput.style.setProperty("--min", "0");
      state.gradientStopHueInput.style.setProperty("--max", "360");
    }
    if (state.gradientStopAlphaInput) {
      state.gradientStopAlphaInput.value = alphaPercent.toString();
      state.gradientStopAlphaInput.style.setProperty("--value", state.gradientStopAlphaInput.value);
      state.gradientStopAlphaInput.style.setProperty("--min", "0");
      state.gradientStopAlphaInput.style.setProperty("--max", "100");
    }
    if (state.gradientStopHexInput) {
      state.gradientStopHexInput.value = hex;
    }
    if (state.gradientStopAlphaField) {
      state.gradientStopAlphaField.value = `${alphaPercent}%`;
    }
    if (state.gradientStopSvThumb) {
      const left = `${hsv.s * 100}%`;
      const top = `${(1 - hsv.v) * 100}%`;
      state.gradientStopSvThumb.style.left = left;
      state.gradientStopSvThumb.style.top = top;
    }
    const normalizedCurrent = normalizeHex(hex);
    state.swatches.forEach((swatch) => {
      if (getSwatchTarget(swatch) !== "gradient") return;
      const swatchHex = normalizeHex(swatch.dataset.color || "");
      const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function setActiveGradientStop(state, stopId) {
    state.gradientActiveStopId = stopId;
    syncGradientStopButtons(state);
    syncActiveGradientStopUI(state);
    updateGradientAddButton(state);
  }
  function updateGradientPreview(state, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const css = state.gradientCss || buildGradientCss(state);
    if (state.gradientPreview) state.gradientPreview.style.backgroundImage = css;
    if (opts.commit) {
      deps.setInputValue(state, buildGradientFill(state), true);
    }
    if (shouldUpdateHeader) {
      deps.updateHeader(state, { text: "", muted: false, chipColor: css });
    }
    if (shouldUpdateRemove) {
      deps.setRemoveFillState(state, false);
    }
  }
  function addGradientStop(state, deps) {
    ensureGradientStops(state);
    const sorted = getSortedGradientStops(state.gradientStops);
    const active = getActiveGradientStop(state);
    const activeIndex = sorted.findIndex((stop2) => stop2.id === active.id);
    const right = sorted[activeIndex + 1] ?? null;
    const left = sorted[activeIndex - 1] ?? null;
    let position = 50;
    if (right) position = (active.position + right.position) / 2;
    else if (left) position = (left.position + active.position) / 2;
    const stop = createGradientStopState(state.root, { color: active.color, position });
    stop.hsv = { ...active.hsv };
    state.gradientStops.push(stop);
    state.gradientActiveStopId = stop.id;
    state.gradientCss = null;
    syncGradientUI(state, { commit: true }, deps);
  }
  function removeGradientStop(state, stopId, deps) {
    if (state.gradientStops.length <= 2) return;
    const idx = state.gradientStops.findIndex((stop) => stop.id === stopId);
    if (idx === -1) return;
    const removed = state.gradientStops[idx];
    state.gradientStops.splice(idx, 1);
    if (state.gradientActiveStopId === stopId) {
      const sorted = getSortedGradientStops(state.gradientStops);
      let nearest = sorted[0];
      let dist = Math.abs((nearest?.position ?? 0) - removed.position);
      sorted.forEach((stop) => {
        const nextDist = Math.abs(stop.position - removed.position);
        if (nextDist < dist) {
          dist = nextDist;
          nearest = stop;
        }
      });
      state.gradientActiveStopId = nearest?.id ?? "";
    }
    state.gradientCss = null;
    syncGradientUI(state, { commit: true }, deps);
  }
  function bindGradientStopButton(state, button, stopId) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveGradientStop(state, stopId);
    });
  }
  function commitGradientStopFromHsv(state, deps) {
    const stop = getActiveGradientStop(state);
    stop.color = colorStringFromHsv(stop.hsv);
    state.gradientCss = null;
    syncGradientUI(state, { commit: true }, deps);
  }
  function handleGradientStopHexInput(state, deps) {
    if (!state.gradientStopHexInput) return;
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const raw = state.gradientStopHexInput.value.trim();
    if (!raw) {
      state.gradientStopHexInput.value = formatHex(hsv);
      return;
    }
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    const rgba = hexToRgba(normalized);
    if (!rgba) {
      state.gradientStopHexInput.value = formatHex(hsv);
      return;
    }
    const next = rgbToHsv(rgba.r, rgba.g, rgba.b, 1);
    hsv.h = next.h;
    hsv.s = next.s;
    hsv.v = next.v;
    commitGradientStopFromHsv(state, deps);
  }
  function handleGradientStopAlphaField(state, deps) {
    if (!state.gradientStopAlphaField) return;
    const stop = getActiveGradientStop(state);
    const hsv = stop.hsv;
    const raw = state.gradientStopAlphaField.value.trim().replace("%", "");
    if (!raw) {
      state.gradientStopAlphaField.value = `${Math.round(hsv.a * 100)}%`;
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      state.gradientStopAlphaField.value = `${Math.round(hsv.a * 100)}%`;
      return;
    }
    const percent = clampNumber(parsed, 0, 100);
    hsv.a = percent / 100;
    commitGradientStopFromHsv(state, deps);
  }
  function installGradientStopBarHandlers(state, deps) {
    if (state.gradientStopAdd) {
      state.gradientStopAdd.addEventListener("click", (event) => {
        event.preventDefault();
        const { sorted, index } = getActiveGradientStopIndex(state);
        const removable = index > 0 && index < sorted.length - 1;
        if (removable) {
          removeGradientStop(state, state.gradientActiveStopId, deps);
          return;
        }
        addGradientStop(state, deps);
      });
    }
    const bar = state.gradientStopBar;
    if (!bar) return;
    const getStopIdFromTarget = (target) => {
      if (!(target instanceof HTMLElement)) return null;
      const btn = target.closest(".diet-dropdown-fill__gradient-stop-btn");
      return btn?.dataset.stopId ?? null;
    };
    const findNearestStopId = (clientX) => {
      if (!state.gradientStops.length) return null;
      const percent = gradientPxToPercent(state, clientX);
      const sorted = getSortedGradientStops(state.gradientStops);
      let nearest = sorted[0];
      let dist = Math.abs(nearest.position - percent);
      sorted.forEach((stop) => {
        const nextDist = Math.abs(stop.position - percent);
        if (nextDist < dist) {
          dist = nextDist;
          nearest = stop;
        }
      });
      return nearest?.id ?? null;
    };
    const moveStop = (stopId, event) => {
      const stop = state.gradientStops.find((entry) => entry.id === stopId);
      if (!stop) return;
      stop.position = gradientPxToPercent(state, event.clientX);
      state.gradientCss = null;
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true, updateRemove: false }, deps);
    };
    const finishDrag = (stopId, event) => {
      const rect = bar.getBoundingClientRect();
      const outside = event.clientY < rect.top - 24 || event.clientY > rect.bottom + 24;
      state.gradientDrag = void 0;
      if (outside) {
        removeGradientStop(state, stopId, deps);
        return;
      }
      syncGradientStopButtons(state);
      updateGradientPreview(state, { commit: true, updateHeader: true }, deps);
    };
    bar.addEventListener("pointerdown", (event) => {
      const stopId = getStopIdFromTarget(event.target) || findNearestStopId(event.clientX);
      if (!stopId) return;
      event.preventDefault();
      setActiveGradientStop(state, stopId);
      state.gradientDrag = { id: stopId, pointerId: event.pointerId };
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener("pointermove", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      if (event.pressure === 0 && event.buttons === 0) return;
      moveStop(state.gradientDrag.id, event);
    });
    bar.addEventListener("pointerup", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      finishDrag(state.gradientDrag.id, event);
    });
    bar.addEventListener("pointercancel", (event) => {
      if (!state.gradientDrag) return;
      if (state.gradientDrag.pointerId !== event.pointerId) return;
      finishDrag(state.gradientDrag.id, event);
    });
  }
  function installGradientEditorHandlers(state, deps) {
    if (state.gradientStopSv) {
      const move = (event) => {
        const rect = state.gradientStopSv?.getBoundingClientRect();
        if (!rect) return;
        const x = clampNumber(event.clientX - rect.left, 0, rect.width);
        const y = clampNumber(event.clientY - rect.top, 0, rect.height);
        const s = rect.width ? x / rect.width : 0;
        const v = rect.height ? 1 - y / rect.height : 0;
        const stop = getActiveGradientStop(state);
        stop.hsv.s = clampNumber(s, 0, 1);
        stop.hsv.v = clampNumber(v, 0, 1);
        if (stop.hsv.a === 0) stop.hsv.a = 1;
        commitGradientStopFromHsv(state, deps);
      };
      const handlePointerDown = (event) => {
        event.preventDefault();
        state.gradientStopSv?.setPointerCapture(event.pointerId);
        move(event);
      };
      state.gradientStopSv.addEventListener("pointerdown", handlePointerDown);
      state.gradientStopSv.addEventListener("pointermove", (event) => {
        if (event.pressure === 0 && event.buttons === 0) return;
        move(event);
      });
      state.gradientStopSv.addEventListener("click", (event) => {
        move(event);
      });
    }
    if (state.gradientStopHueInput) {
      state.gradientStopHueInput.addEventListener("input", () => {
        const hue = clampNumber(Number(state.gradientStopHueInput?.value), 0, 360);
        const stop = getActiveGradientStop(state);
        stop.hsv.h = hue;
        if (stop.hsv.a === 0) stop.hsv.a = 1;
        commitGradientStopFromHsv(state, deps);
      });
    }
    if (state.gradientStopAlphaInput) {
      state.gradientStopAlphaInput.addEventListener("input", () => {
        const alpha = clampNumber(Number(state.gradientStopAlphaInput?.value) / 100, 0, 1);
        const stop = getActiveGradientStop(state);
        stop.hsv.a = alpha;
        commitGradientStopFromHsv(state, deps);
      });
    }
    if (state.gradientStopHexInput) {
      const handler = () => handleGradientStopHexInput(state, deps);
      state.gradientStopHexInput.addEventListener("change", handler);
      state.gradientStopHexInput.addEventListener("blur", handler);
    }
    if (state.gradientStopAlphaField) {
      const handler = () => handleGradientStopAlphaField(state, deps);
      state.gradientStopAlphaField.addEventListener("change", handler);
      state.gradientStopAlphaField.addEventListener("blur", handler);
    }
  }
  function normalizeGradientColor(state, raw, fallback) {
    let value = raw.trim();
    if (!value) return fallback;
    if (!value.startsWith("#") && /^[0-9a-f]{3,8}$/i.test(value)) {
      value = `#${value}`;
    }
    const parsed = parseColor(value, state.root);
    return parsed ? value : fallback;
  }
  function normalizeGradientStopsForOutput(state) {
    const fallbackStops = DEFAULT_GRADIENT.stops;
    const sourceStops = state.gradientStops.length >= 2 ? getSortedGradientStops(state.gradientStops) : null;
    const stopsToUse = sourceStops ?? fallbackStops.map((stop) => ({ ...stop }));
    return stopsToUse.map((stop, index) => {
      const fallback = fallbackStops[Math.min(index, fallbackStops.length - 1)]?.color || fallbackStops[0].color;
      return {
        color: normalizeGradientColor(state, stop.color, fallback),
        position: clampNumber(stop.position, 0, 100)
      };
    });
  }
  function buildGradientFill(state) {
    const angle = clampNumber(state.gradient.angle, 0, 360);
    const normalizedStops = normalizeGradientStopsForOutput(state);
    return {
      type: "gradient",
      gradient: {
        kind: "linear",
        angle,
        stops: normalizedStops
      }
    };
  }
  function buildGradientCss(state) {
    const angle = clampNumber(state.gradient.angle, 0, 360);
    const normalizedStops = normalizeGradientStopsForOutput(state);
    const stopList = normalizedStops.map((stop) => `${stop.color} ${clampNumber(stop.position, 0, 100)}%`).join(", ");
    return `linear-gradient(${angle}deg, ${stopList})`;
  }
  function colorStringFromHsv(hsv) {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return hsv.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(hsv.a, 2)})` : formatHex({ ...hsv, a: 1 });
  }

  // components/dropdown-fill/media-controller.ts
  function setFillUploadingState(state, uploading) {
    state.root.dataset.uploading = uploading ? "true" : "false";
    if (state.uploadButton) state.uploadButton.disabled = uploading;
    if (state.chooseButton) state.chooseButton.disabled = uploading;
    if (state.removeButton) state.removeButton.disabled = uploading;
    if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
    if (state.videoChooseButton) state.videoChooseButton.disabled = uploading;
    if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
  }
  function formatSizeBytes(sizeBytes) {
    const size = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${size} B`;
  }
  function dispatchUpsell(root, reasonKey) {
    root.dispatchEvent(
      new CustomEvent("bob-upsell", {
        detail: { reasonKey },
        bubbles: true
      })
    );
  }
  function isUpsellReason(reasonKey) {
    return reasonKey === "coreui.upsell.reason.budgetExceeded" || reasonKey === "coreui.upsell.reason.capReached" || reasonKey === "coreui.upsell.reason.platform.uploads";
  }
  function setBrowserOpen(browser, button, open) {
    if (browser) browser.hidden = !open;
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setAssetPanelMessage(target, message) {
    if (!target) return;
    target.textContent = message;
    target.hidden = !message;
  }
  function clearAssetBrowser(browserList) {
    if (!browserList) return;
    browserList.innerHTML = "";
  }
  function filterAssetsForKind(assets, kind) {
    if (kind === "image") {
      return assets.filter((asset) => asset.assetType === "image" || asset.assetType === "vector");
    }
    return assets.filter((asset) => asset.assetType === "video");
  }
  function syncImageHeader(state, deps) {
    if (state.imageSrc && !state.imageUnavailable) {
      const label = state.imageName || "Image selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
  }
  function syncVideoHeader(state, deps) {
    if (state.videoSrc && !state.videoUnavailable) {
      const label = state.videoName || "Video selected";
      deps.updateHeader(state, { text: label, muted: false, chipColor: null });
      return;
    }
    deps.updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
  }
  function hasAvailableImage(state) {
    return Boolean(state.imageSrc && !state.imageUnavailable);
  }
  function hasAvailableVideo(state) {
    return Boolean(state.videoSrc && !state.videoUnavailable);
  }
  function syncImageMediaState(state, opts, deps) {
    const hasImage = hasAvailableImage(state);
    if (state.imagePanel) {
      state.imagePanel.dataset.hasImage = hasImage ? "true" : "false";
    }
    if (state.removeButton) {
      state.removeButton.hidden = !hasImage;
      state.removeButton.disabled = !hasImage;
    }
    if (state.imagePreview) {
      state.imagePreview.style.backgroundImage = hasImage ? `url("${state.imageSrc}")` : "none";
    }
    if (opts.updateHeader !== false) {
      syncImageHeader(state, deps);
    }
    if (opts.updateRemove !== false) {
      deps.setRemoveFillState(state, !hasImage);
    }
  }
  function syncVideoMediaState(state, opts, deps) {
    const hasVideo = hasAvailableVideo(state);
    if (state.videoPanel) {
      state.videoPanel.dataset.hasVideo = hasVideo ? "true" : "false";
    }
    if (state.videoRemoveButton) {
      state.videoRemoveButton.hidden = !hasVideo;
      state.videoRemoveButton.disabled = !hasVideo;
    }
    if (opts.updateHeader !== false) {
      syncVideoHeader(state, deps);
    }
    if (opts.updateRemove !== false) {
      deps.setRemoveFillState(state, !hasVideo);
    }
  }
  function verifyImageAvailability(state, src, deps) {
    const normalizedSrc = normalizeAssetReferenceUrl(src);
    if (!normalizedSrc) {
      state.imageUnavailable = true;
      if (state.mode === "image") syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      return;
    }
    state.imageAvailabilityRequestId += 1;
    const requestId = state.imageAvailabilityRequestId;
    const probe = new Image();
    const finalize = (available) => {
      if (state.imageAvailabilityRequestId !== requestId) return;
      if (!sameAssetReferenceUrl(state.imageSrc || "", normalizedSrc)) return;
      const nextUnavailable = !available;
      if (state.imageUnavailable === nextUnavailable) return;
      state.imageUnavailable = nextUnavailable;
      if (state.mode === "image") syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
    };
    probe.addEventListener("load", () => finalize(true), { once: true });
    probe.addEventListener("error", () => finalize(false), { once: true });
    probe.src = normalizedSrc;
  }
  function setImageSrc(state, src, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const previousSrc = state.imageSrc;
    if (state.imageObjectUrl && previousSrc && previousSrc === state.imageObjectUrl && src !== previousSrc) {
      URL.revokeObjectURL(state.imageObjectUrl);
      state.imageObjectUrl = null;
    }
    state.imageSrc = src;
    if (!src) {
      state.imageUnavailable = false;
      state.imageAvailabilityRequestId += 1;
    } else if (!sameAssetReferenceUrl(src, previousSrc ?? "")) {
      state.imageUnavailable = false;
    }
    if (opts.commit) {
      const assetId = String(state.imageAssetId || "").trim();
      const fill = assetId ? {
        type: "image",
        image: {
          assetId,
          ...state.imageName ? { name: state.imageName } : {},
          fit: "cover",
          position: "center",
          repeat: "no-repeat"
        }
      } : { type: "none" };
      deps.setInputValue(state, fill, true);
    }
    if (src) {
      verifyImageAvailability(state, src, deps);
    }
    syncImageMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function setVideoSrc(state, src, opts, deps) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const previousSrc = state.videoSrc;
    if (state.videoObjectUrl && previousSrc && previousSrc === state.videoObjectUrl && src !== previousSrc) {
      URL.revokeObjectURL(state.videoObjectUrl);
      state.videoObjectUrl = null;
    }
    state.videoSrc = src;
    if (!src) {
      state.videoUnavailable = false;
    } else if (!sameAssetReferenceUrl(src, previousSrc ?? "")) {
      state.videoUnavailable = false;
    }
    if (opts.commit) {
      const assetId = String(state.videoAssetId || "").trim();
      const fill = assetId ? {
        type: "video",
        video: {
          assetId,
          ...state.videoName ? { name: state.videoName } : {},
          ...state.videoPosterAssetId ? { posterAssetId: state.videoPosterAssetId } : {},
          fit: "cover",
          position: "center",
          loop: true,
          muted: true,
          autoplay: true
        }
      } : { type: "none" };
      deps.setInputValue(state, fill, true);
    }
    if (state.videoPreview) {
      state.videoPreview.src = src || "";
      if (src) state.videoPreview.load();
    }
    syncVideoMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
  }
  function renderAssetBrowserRows(args) {
    const browserList = args.kind === "image" ? args.state.imageBrowserList : args.state.videoBrowserList;
    if (!browserList) return;
    browserList.innerHTML = "";
    if (!args.assets.length) {
      const empty = document.createElement("div");
      empty.className = "diet-dropdown-fill__asset-browser-empty body-s";
      empty.textContent = "No assets found.";
      browserList.appendChild(empty);
      return;
    }
    args.assets.forEach((asset) => {
      const row = document.createElement("div");
      row.className = "diet-dropdown-fill__asset-browser-row";
      const meta = document.createElement("div");
      meta.className = "diet-dropdown-fill__asset-browser-meta";
      const name = document.createElement("div");
      name.className = "diet-dropdown-fill__asset-browser-name label-s";
      name.textContent = asset.filename;
      meta.appendChild(name);
      const subline = document.createElement("div");
      subline.className = "diet-dropdown-fill__asset-browser-subline body-xs";
      subline.textContent = `${asset.assetType} \u2022 ${formatSizeBytes(asset.sizeBytes)}`;
      meta.appendChild(subline);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "diet-btn-txt diet-dropdown-fill__asset-browser-use";
      button.setAttribute("data-size", "sm");
      button.setAttribute("data-variant", "line1");
      button.innerHTML = '<span class="diet-btn-txt__label body-s">Use</span>';
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (args.kind === "image") {
          commitImageAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
          setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
          return;
        }
        commitVideoAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
        setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
      });
      row.appendChild(meta);
      row.appendChild(button);
      browserList.appendChild(row);
    });
  }
  async function openAssetBrowser(args) {
    const browser = args.kind === "image" ? args.state.imageBrowser : args.state.videoBrowser;
    const browserMessage = args.kind === "image" ? args.state.imageBrowserMessage : args.state.videoBrowserMessage;
    const browserList = args.kind === "image" ? args.state.imageBrowserList : args.state.videoBrowserList;
    const button = args.kind === "image" ? args.state.chooseButton : args.state.videoChooseButton;
    const oppositeBrowser = args.kind === "image" ? args.state.videoBrowser : args.state.imageBrowser;
    const oppositeButton = args.kind === "image" ? args.state.videoChooseButton : args.state.chooseButton;
    if (!browser || !button) return;
    if (!browser.hidden) {
      setBrowserOpen(browser, button, false);
      return;
    }
    setBrowserOpen(oppositeBrowser, oppositeButton, false);
    setBrowserOpen(browser, button, true);
    setFillUploadingState(args.state, true);
    setAssetPanelMessage(browserMessage, "Loading assets\u2026");
    clearAssetBrowser(browserList);
    try {
      const assets = filterAssetsForKind(await args.state.accountAssets.listAssets(), args.kind);
      setAssetPanelMessage(browserMessage, assets.length ? "" : "No assets available yet.");
      renderAssetBrowserRows({
        state: args.state,
        kind: args.kind,
        assets,
        deps: args.deps
      });
    } catch (error) {
      setAssetPanelMessage(
        browserMessage,
        error instanceof Error ? error.message : "coreui.errors.db.readFailed"
      );
      clearAssetBrowser(browserList);
    } finally {
      setFillUploadingState(args.state, false);
    }
  }
  async function handleAssetUpload(args) {
    setFillUploadingState(args.state, true);
    setAssetPanelMessage(args.kind === "image" ? args.state.imageMessage : args.state.videoMessage, "");
    try {
      const asset = await args.state.accountAssets.uploadAsset(args.file, "api");
      if (args.kind === "image") {
        commitImageAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
        setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
        return;
      }
      commitVideoAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
      setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "coreui.errors.assets.uploadFailed";
      if (isUpsellReason(message)) {
        dispatchUpsell(args.state.root, message);
        return;
      }
      setAssetPanelMessage(args.kind === "image" ? args.state.imageMessage : args.state.videoMessage, message);
    } finally {
      setFillUploadingState(args.state, false);
    }
  }
  function commitImageAssetSelection(state, assetId, filename, commit, deps) {
    state.imageResolveRequestId += 1;
    state.imageAssetId = assetId;
    state.imageName = filename;
    state.imageUnavailable = false;
    setAssetPanelMessage(state.imageMessage, "");
    setImageSrc(state, null, { commit }, deps);
    void resolveImageAsset(state, deps);
  }
  function commitVideoAssetSelection(state, assetId, filename, commit, deps) {
    state.videoResolveRequestId += 1;
    state.videoAssetId = assetId;
    state.videoName = filename;
    state.videoUnavailable = false;
    setAssetPanelMessage(state.videoMessage, "");
    setVideoSrc(state, null, { commit }, deps);
    void resolveVideoAsset(state, deps);
  }
  async function resolveImageAsset(state, deps) {
    const assetId = String(state.imageAssetId || "").trim();
    const requestId = state.imageResolveRequestId;
    setAssetPanelMessage(state.imageMessage, "");
    if (!assetId) return;
    try {
      const { assetsById, missingAssetIds } = await state.accountAssets.resolveAssets([assetId]);
      if (state.imageResolveRequestId !== requestId || String(state.imageAssetId || "").trim() !== assetId) return;
      if (missingAssetIds.includes(assetId)) {
        state.imageUnavailable = true;
        setAssetPanelMessage(state.imageMessage, "Asset unavailable.");
        setImageSrc(state, null, { commit: false }, deps);
        return;
      }
      const asset = assetsById.get(assetId);
      if (!asset) {
        setAssetPanelMessage(state.imageMessage, "Asset unavailable.");
        setImageSrc(state, null, { commit: false }, deps);
        return;
      }
      setImageSrc(state, asset.url, { commit: false }, deps);
    } catch (error) {
      if (state.imageResolveRequestId !== requestId || String(state.imageAssetId || "").trim() !== assetId) return;
      setAssetPanelMessage(
        state.imageMessage,
        error instanceof Error ? error.message : "coreui.errors.db.readFailed"
      );
    }
  }
  async function resolveVideoAsset(state, deps) {
    const assetId = String(state.videoAssetId || "").trim();
    const requestId = state.videoResolveRequestId;
    setAssetPanelMessage(state.videoMessage, "");
    if (!assetId) return;
    try {
      const { assetsById, missingAssetIds } = await state.accountAssets.resolveAssets([assetId]);
      if (state.videoResolveRequestId !== requestId || String(state.videoAssetId || "").trim() !== assetId) return;
      if (missingAssetIds.includes(assetId)) {
        state.videoUnavailable = true;
        setAssetPanelMessage(state.videoMessage, "Asset unavailable.");
        setVideoSrc(state, null, { commit: false }, deps);
        return;
      }
      const asset = assetsById.get(assetId);
      if (!asset) {
        setAssetPanelMessage(state.videoMessage, "Asset unavailable.");
        setVideoSrc(state, null, { commit: false }, deps);
        return;
      }
      setVideoSrc(state, asset.url, { commit: false }, deps);
    } catch (error) {
      if (state.videoResolveRequestId !== requestId || String(state.videoAssetId || "").trim() !== assetId) return;
      setAssetPanelMessage(
        state.videoMessage,
        error instanceof Error ? error.message : "coreui.errors.db.readFailed"
      );
    }
  }
  function installImageHandlers(state, deps) {
    const { uploadButton, chooseButton, removeButton, fileInput } = state;
    if (uploadButton && fileInput) {
      uploadButton.disabled = false;
      uploadButton.hidden = false;
      fileInput.disabled = false;
      uploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        fileInput.value = "";
        fileInput.click();
      });
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        void handleAssetUpload({ state, kind: "image", file, deps });
      });
    }
    if (chooseButton) {
      chooseButton.disabled = false;
      chooseButton.hidden = false;
      chooseButton.addEventListener("click", (event) => {
        event.preventDefault();
        void openAssetBrowser({ state, kind: "image", deps });
      });
    }
    if (removeButton) {
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.imageObjectUrl) {
          URL.revokeObjectURL(state.imageObjectUrl);
          state.imageObjectUrl = null;
        }
        state.imageAssetId = null;
        state.imageName = null;
        setAssetPanelMessage(state.imageMessage, "");
        setBrowserOpen(state.imageBrowser, state.chooseButton, false);
        setImageSrc(state, null, { commit: true }, deps);
      });
    }
  }
  function installVideoHandlers(state, deps) {
    const { videoUploadButton, videoChooseButton, videoRemoveButton, videoFileInput } = state;
    if (state.videoPreview) {
      state.videoPreview.addEventListener("error", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        if (state.videoUnavailable) return;
        state.videoUnavailable = true;
        if (state.mode === "video") syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      });
      state.videoPreview.addEventListener("loadeddata", () => {
        const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || "";
        if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
        if (!state.videoUnavailable) return;
        state.videoUnavailable = false;
        if (state.mode === "video") syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
      });
    }
    if (videoUploadButton && videoFileInput) {
      videoUploadButton.disabled = false;
      videoUploadButton.hidden = false;
      videoFileInput.disabled = false;
      videoUploadButton.addEventListener("click", (event) => {
        event.preventDefault();
        videoFileInput.value = "";
        videoFileInput.click();
      });
      videoFileInput.addEventListener("change", () => {
        const file = videoFileInput.files?.[0];
        if (!file) return;
        void handleAssetUpload({ state, kind: "video", file, deps });
      });
    }
    if (videoChooseButton) {
      videoChooseButton.disabled = false;
      videoChooseButton.hidden = false;
      videoChooseButton.addEventListener("click", (event) => {
        event.preventDefault();
        void openAssetBrowser({ state, kind: "video", deps });
      });
    }
    if (videoRemoveButton) {
      videoRemoveButton.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.videoObjectUrl) {
          URL.revokeObjectURL(state.videoObjectUrl);
          state.videoObjectUrl = null;
        }
        state.videoAssetId = null;
        state.videoPosterAssetId = null;
        state.videoName = null;
        setAssetPanelMessage(state.videoMessage, "");
        setBrowserOpen(state.videoBrowser, state.videoChooseButton, false);
        setVideoSrc(state, null, { commit: true }, deps);
      });
    }
  }

  // components/dropdown-fill/dropdown-fill.ts
  var MODE_LABELS = {
    color: "Color fill",
    gradient: "Gradient fill",
    image: "Image fill",
    video: "Video fill"
  };
  var states = /* @__PURE__ */ new Map();
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-fill",
    triggerSelector: ".diet-dropdown-fill__control",
    isInsideTarget: () => false
  });
  function hydrateDropdownFill(scope, options) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-fill"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root, options.accountAssets);
      if (!state) return;
      wireModes(state);
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("data-bob-json") || state.input.getAttribute("value") || "";
      syncFromValue(state, initialValue);
    });
    hydrateHost(scope);
  }
  function parseAllowedModes(root) {
    const raw = (root.dataset.fillModes || "").trim();
    if (raw) {
      const modes = raw.split(",").map((mode) => mode.trim().toLowerCase()).filter((mode) => MODE_ORDER.includes(mode));
      return modes.length ? modes : ["color"];
    }
    const allowImageAttr = (root.dataset.allowImage || "").trim().toLowerCase();
    const allowImage = allowImageAttr === "" || allowImageAttr === "true" || allowImageAttr === "1" || allowImageAttr === "yes";
    if (!allowImage) return ["color"];
    return ["color", "gradient", "image"];
  }
  function createState(root, accountAssets) {
    const input = root.querySelector(".diet-dropdown-fill__value-field");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-fill__label");
    const headerValueChip = root.querySelector(".diet-dropdown-fill__chip");
    const headerLabel = root.querySelector(".diet-popover__header-label");
    const preview = root.querySelector(".diet-dropdown-fill__preview");
    const nativeColorInput = root.querySelector(".diet-dropdown-fill__native-color");
    const hueInput = root.querySelector(".diet-dropdown-fill__hue");
    const alphaInput = root.querySelector(".diet-dropdown-fill__alpha");
    const hexField = root.querySelector(".diet-dropdown-fill__hex");
    const alphaField = root.querySelector(".diet-dropdown-fill__alpha-input");
    const svCanvas = root.querySelector(".diet-dropdown-fill__sv-canvas");
    const svThumb = root.querySelector(".diet-dropdown-fill__sv-thumb");
    const colorPreview = root.querySelector(".diet-dropdown-fill__color-preview");
    const removeFillActions = Array.from(root.querySelectorAll(".diet-dropdown-fill__remove-fill"));
    const removeFillLabels = removeFillActions.map(
      (action) => action.querySelector(".diet-btn-menuactions__label") ?? null
    );
    const swatches = Array.from(root.querySelectorAll(".diet-dropdown-fill__swatch"));
    const gradientPreview = root.querySelector(".diet-dropdown-fill__gradient-preview");
    const gradientAngleInput = root.querySelector(".diet-dropdown-fill__gradient-angle");
    const gradientEditor = root.querySelector(".diet-dropdown-fill__gradient-editor");
    const gradientStopBar = root.querySelector(".diet-dropdown-fill__gradient-stop-track");
    const gradientStopAdd = root.querySelector(".diet-dropdown-fill__gradient-stop-add");
    const gradientStopSv = root.querySelector(".diet-dropdown-fill__gradient-sv");
    const gradientStopSvThumb = root.querySelector(".diet-dropdown-fill__gradient-sv-thumb");
    const gradientStopHueInput = root.querySelector(".diet-dropdown-fill__gradient-hue");
    const gradientStopAlphaInput = root.querySelector(".diet-dropdown-fill__gradient-alpha");
    const gradientStopHexInput = root.querySelector(".diet-dropdown-fill__gradient-hex");
    const gradientStopAlphaField = root.querySelector(".diet-dropdown-fill__gradient-alpha-field");
    const gradientStops = createDefaultGradientStops(root);
    const gradientActiveStopId = gradientStops[0]?.id ?? "";
    const imagePanel = root.querySelector(".diet-dropdown-fill__panel--image");
    const imagePreview = root.querySelector(".diet-dropdown-fill__image-preview");
    const imageBrowser = root.querySelector(".diet-dropdown-fill__asset-browser--image");
    const imageBrowserMessage = imageBrowser?.querySelector(".diet-dropdown-fill__asset-browser-message") ?? null;
    const imageBrowserList = imageBrowser?.querySelector(".diet-dropdown-fill__asset-browser-list") ?? null;
    const imageMessage = imagePanel?.querySelector(".diet-dropdown-fill__asset-message") ?? null;
    const uploadButton = root.querySelector(".diet-dropdown-fill__upload-btn");
    const chooseButton = root.querySelector(".diet-dropdown-fill__choose-btn");
    const removeButton = root.querySelector(".diet-dropdown-fill__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-fill__file-input");
    const videoPanel = root.querySelector(".diet-dropdown-fill__panel--video");
    const videoPreview = root.querySelector(".diet-dropdown-fill__video-preview");
    const videoBrowser = root.querySelector(".diet-dropdown-fill__asset-browser--video");
    const videoBrowserMessage = videoBrowser?.querySelector(".diet-dropdown-fill__asset-browser-message") ?? null;
    const videoBrowserList = videoBrowser?.querySelector(".diet-dropdown-fill__asset-browser-list") ?? null;
    const videoMessage = videoPanel?.querySelector(".diet-dropdown-fill__asset-message") ?? null;
    const videoUploadButton = root.querySelector(".diet-dropdown-fill__video-upload-btn");
    const videoChooseButton = root.querySelector(".diet-dropdown-fill__video-choose-btn");
    const videoRemoveButton = root.querySelector(".diet-dropdown-fill__video-remove-btn");
    const videoFileInput = root.querySelector(".diet-dropdown-fill__video-file-input");
    if (!input || !hueInput || !alphaInput || !hexField || !alphaField || !svCanvas || !svThumb) {
      return null;
    }
    if (chooseButton) {
      chooseButton.setAttribute("aria-expanded", "false");
    }
    if (videoChooseButton) {
      videoChooseButton.setAttribute("aria-expanded", "false");
    }
    const nativeValue = captureNativeValue(input);
    const allowedModes = parseAllowedModes(root);
    const mode = allowedModes[0] || "color";
    swatches.forEach((swatch) => {
      const color = swatch.dataset.color || "";
      swatch.style.setProperty("--swatch-color", color);
    });
    return {
      root,
      accountAssets,
      input,
      headerValue,
      headerValueLabel,
      headerValueChip,
      headerLabel,
      preview,
      nativeColorInput,
      colorPreview,
      removeFillActions,
      removeFillLabels,
      hueInput,
      alphaInput,
      hexField,
      alphaField,
      svCanvas,
      svThumb,
      swatches,
      hsv: { h: 0, s: 0, v: 0, a: 0 },
      gradientPreview,
      gradientAngleInput,
      gradientEditor,
      gradientStopBar,
      gradientStopAdd,
      gradientStopButtons: /* @__PURE__ */ new Map(),
      gradientStopSv,
      gradientStopSvThumb,
      gradientStopHueInput,
      gradientStopAlphaInput,
      gradientStopHexInput,
      gradientStopAlphaField,
      gradientActiveStopId,
      gradientStops,
      gradient: { angle: DEFAULT_GRADIENT.angle },
      gradientCss: null,
      imagePanel,
      imagePreview,
      imageBrowser,
      imageBrowserMessage,
      imageBrowserList,
      imageMessage,
      uploadButton,
      chooseButton,
      removeButton,
      fileInput,
      imageSrc: null,
      imageAssetId: null,
      imageName: null,
      imageObjectUrl: null,
      imageUnavailable: false,
      imageAvailabilityRequestId: 0,
      imageResolveRequestId: 0,
      videoPanel,
      videoPreview,
      videoBrowser,
      videoBrowserMessage,
      videoBrowserList,
      videoMessage,
      videoUploadButton,
      videoChooseButton,
      videoRemoveButton,
      videoFileInput,
      videoSrc: null,
      videoAssetId: null,
      videoPosterAssetId: null,
      videoName: null,
      videoObjectUrl: null,
      videoUnavailable: false,
      videoResolveRequestId: 0,
      allowedModes,
      mode,
      nativeValue,
      internalWrite: false
    };
  }
  function installHandlers(state) {
    if (state.nativeValue) {
      Object.defineProperty(state.input, "value", {
        configurable: true,
        get: () => state.nativeValue?.get() ?? "",
        set: (next) => {
          state.nativeValue?.set(String(next ?? ""));
          if (!state.internalWrite) syncFromValue(state, String(next ?? ""));
        }
      });
    }
    const readValue = () => state.input.value || state.input.getAttribute("data-bob-json") || "";
    state.input.addEventListener("external-sync", () => syncFromValue(state, readValue()));
    state.input.addEventListener("input", () => {
      if (state.internalWrite) return;
      syncFromValue(state, readValue());
    });
    state.hueInput.addEventListener("input", () => {
      const hue = clampNumber(Number(state.hueInput.value), 0, 360);
      state.hsv.h = hue;
      if (state.hsv.a === 0) state.hsv.a = 1;
      syncColorUI(state, { commit: true });
    });
    state.alphaInput.addEventListener("input", () => {
      const alpha = clampNumber(Number(state.alphaInput.value) / 100, 0, 1);
      state.hsv.a = alpha;
      syncColorUI(state, { commit: true });
    });
    state.hexField.addEventListener("change", () => handleHexInput(state));
    state.hexField.addEventListener("blur", () => handleHexInput(state));
    state.alphaField.addEventListener("change", () => handleAlphaField(state));
    state.alphaField.addEventListener("blur", () => handleAlphaField(state));
    installSvCanvasHandlers(state);
    installSwatchHandlers(state);
    installGradientHandlers(state, mediaDeps());
    installImageHandlers2(state);
    installVideoHandlers2(state);
    installNativeColorPicker(state);
    if (state.removeFillActions.length) {
      state.removeFillActions.forEach((action) => {
        action.addEventListener("click", (event) => {
          event.preventDefault();
          if (action.disabled) return;
          setInputValue(state, { type: "none" }, true);
        });
      });
    }
  }
  function installNativeColorPicker(state) {
    const { preview, nativeColorInput } = state;
    if (!preview || !nativeColorInput) return;
    preview.addEventListener("click", (event) => {
      event.preventDefault();
      const hex = formatHex({ ...state.hsv, a: 1 });
      nativeColorInput.value = hex;
      nativeColorInput.click();
    });
    nativeColorInput.addEventListener("input", () => {
      const rgba = hexToRgba(nativeColorInput.value);
      if (!rgba) return;
      state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
      syncColorUI(state, { commit: true });
    });
  }
  function installSvCanvasHandlers(state) {
    const move = (event) => {
      const rect = state.svCanvas.getBoundingClientRect();
      const x = clampNumber(event.clientX - rect.left, 0, rect.width);
      const y = clampNumber(event.clientY - rect.top, 0, rect.height);
      const s = rect.width ? x / rect.width : 0;
      const v = rect.height ? 1 - y / rect.height : 0;
      state.hsv.s = clampNumber(s, 0, 1);
      state.hsv.v = clampNumber(v, 0, 1);
      if (state.hsv.a === 0) state.hsv.a = 1;
      syncColorUI(state, { commit: true });
    };
    const handlePointerDown = (event) => {
      event.preventDefault();
      state.svCanvas.setPointerCapture(event.pointerId);
      move(event);
    };
    state.svCanvas.addEventListener("pointerdown", handlePointerDown);
    state.svCanvas.addEventListener("pointermove", (event) => {
      if (event.pressure === 0 && event.buttons === 0) return;
      move(event);
    });
    state.svCanvas.addEventListener("click", (event) => {
      move(event);
    });
  }
  function mediaDeps() {
    return {
      setInputValue,
      updateHeader,
      setRemoveFillState
    };
  }
  function installImageHandlers2(state) {
    installImageHandlers(state, mediaDeps());
  }
  function installVideoHandlers2(state) {
    installVideoHandlers(state, mediaDeps());
  }
  function setImageSrc2(state, src, opts) {
    setImageSrc(state, src, opts, mediaDeps());
  }
  function setVideoSrc2(state, src, opts) {
    setVideoSrc(state, src, opts, mediaDeps());
  }
  function setInputValue(state, value, emit) {
    const json = JSON.stringify(value);
    state.internalWrite = true;
    state.input.value = json;
    state.input.setAttribute("data-bob-json", json);
    if (emit) {
      state.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    state.internalWrite = false;
  }
  function setRemoveFillState(state, isEmpty) {
    if (!state.removeFillActions.length) return;
    state.removeFillActions.forEach((action, index) => {
      action.disabled = isEmpty;
      const label = state.removeFillLabels[index];
      if (label) {
        label.textContent = isEmpty ? "No fill to remove" : "Remove fill";
      }
    });
  }
  function getSwatchTarget2(swatch) {
    const container = swatch.closest(".diet-dropdown-fill__swatches");
    return container?.dataset.swatchTarget === "gradient" ? "gradient" : "color";
  }
  function installSwatchHandlers(state) {
    state.swatches.forEach((swatch) => {
      swatch.addEventListener("click", (event) => {
        event.preventDefault();
        const color = swatch.dataset.color || "";
        const parsed = parseColor(color, state.root);
        if (!parsed) return;
        const target = getSwatchTarget2(swatch);
        if (target === "gradient") {
          applyGradientSwatch(state, parsed, mediaDeps());
          return;
        }
        state.hsv = { ...parsed, a: 1 };
        syncColorUI(state, { commit: true });
      });
    });
  }
  function handleHexInput(state) {
    const raw = state.hexField.value.trim();
    if (!raw) {
      state.hexField.value = formatHex(state.hsv).replace(/^#/, "");
      return;
    }
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    const rgba = hexToRgba(normalized);
    if (!rgba) {
      state.hexField.value = formatHex(state.hsv).replace(/^#/, "");
      return;
    }
    state.hsv = { ...rgbToHsv(rgba.r, rgba.g, rgba.b, 1), a: state.hsv.a || 1 };
    syncColorUI(state, { commit: true });
  }
  function handleAlphaField(state) {
    const raw = state.alphaField.value.trim().replace("%", "");
    if (!raw) {
      state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      state.alphaField.value = `${Math.round(state.hsv.a * 100)}%`;
      return;
    }
    const percent = clampNumber(parsed, 0, 100);
    state.hsv.a = percent / 100;
    syncColorUI(state, { commit: true });
  }
  function syncFromValue(state, raw) {
    const fill = parseFillValue(raw, state.root);
    if (!fill) {
      state.root.dataset.invalid = "true";
      updateHeader(state, { text: "Invalid", muted: false, chipColor: null, noneChip: true });
      setRemoveFillState(state, true);
      return;
    }
    delete state.root.dataset.invalid;
    const nextMode = resolveModeFromFill(state.mode, state.allowedModes, fill);
    setMode(state, nextMode);
    if (fill.type === "none") {
      if (nextMode === "image") {
        state.imageResolveRequestId += 1;
        state.imageAssetId = null;
        state.imageName = null;
        setImageSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "video") {
        state.videoResolveRequestId += 1;
        state.videoAssetId = null;
        state.videoPosterAssetId = null;
        state.videoName = null;
        setVideoSrc2(state, null, { commit: false });
        return;
      }
      if (nextMode === "gradient") {
        state.gradient = { angle: DEFAULT_GRADIENT.angle };
        state.gradientStops = createDefaultGradientStops(state.root);
        state.gradientActiveStopId = state.gradientStops[0]?.id ?? "";
        state.gradientCss = null;
        syncGradientUI(state, { commit: false }, mediaDeps());
        return;
      }
      state.hsv = { h: 0, s: 0, v: 0, a: 0 };
      syncColorUI(state, { commit: false });
      return;
    }
    if (fill.type === "color") {
      const parsed = parseColor(fill.color || "", state.root);
      if (!parsed) {
        state.root.dataset.invalid = "true";
        state.hsv = { h: 0, s: 0, v: 0, a: 0 };
        syncColorUI(state, { commit: false });
        return;
      }
      state.hsv = parsed;
      syncColorUI(state, { commit: false });
      return;
    }
    if (fill.type === "gradient") {
      applyGradientFromFill(state, fill.gradient);
      syncGradientUI(state, { commit: false }, mediaDeps());
      return;
    }
    if (fill.type === "image") {
      state.imageResolveRequestId += 1;
      state.imageAssetId = readImageAssetId(fill);
      state.imageName = readImageName(fill);
      setImageSrc2(state, null, { commit: false });
      void resolveImageAsset(state, mediaDeps());
      return;
    }
    if (fill.type === "video") {
      state.videoResolveRequestId += 1;
      state.videoAssetId = readVideoAssetId(fill);
      state.videoPosterAssetId = readVideoPosterAssetId(fill);
      state.videoName = readVideoName(fill);
      setVideoSrc2(state, null, { commit: false });
      void resolveVideoAsset(state, mediaDeps());
      return;
    }
  }
  function syncColorUI(state, opts) {
    const shouldUpdateHeader = opts.updateHeader !== false;
    const shouldUpdateRemove = opts.updateRemove !== false;
    const { h, s, v, a } = state.hsv;
    const rgb = hsvToRgb(h, s, v);
    const hex = formatHex({ h, s, v, a: 1 });
    const alphaPercent = Math.round(a * 100);
    const colorString = a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundTo(a, 2)})` : hex;
    state.root.style.setProperty("--picker-hue", h.toString());
    state.root.style.setProperty("--picker-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
    state.hueInput.value = h.toString();
    state.hueInput.style.setProperty("--value", state.hueInput.value);
    state.hueInput.style.setProperty("--min", "0");
    state.hueInput.style.setProperty("--max", "360");
    state.alphaInput.value = alphaPercent.toString();
    state.alphaInput.style.setProperty("--value", state.alphaInput.value);
    state.alphaInput.style.setProperty("--min", "0");
    state.alphaInput.style.setProperty("--max", "100");
    state.hexField.value = hex.replace(/^#/, "");
    state.alphaField.value = `${alphaPercent}%`;
    const left = `${s * 100}%`;
    const top = `${(1 - v) * 100}%`;
    state.svThumb.style.left = left;
    state.svThumb.style.top = top;
    if (opts.commit) {
      const fill = alphaPercent === 0 ? { type: "none" } : { type: "color", color: colorString };
      setInputValue(state, fill, true);
    }
    if (shouldUpdateHeader) {
      const isInvalid = state.root.dataset.invalid === "true";
      if (isInvalid) {
        updateHeader(state, { text: "Invalid", muted: false, chipColor: null, noneChip: true });
      } else if (alphaPercent === 0) {
        updateHeader(state, { text: "", muted: true, chipColor: null, noneChip: true });
      } else {
        const label = alphaPercent < 100 ? `${alphaPercent}%` : "";
        updateHeader(state, { text: label, muted: false, chipColor: colorString });
      }
    }
    if (state.colorPreview) {
      state.colorPreview.style.backgroundColor = colorString;
    }
    if (shouldUpdateRemove) {
      setRemoveFillState(state, alphaPercent === 0);
    }
    const normalizedCurrent = normalizeHex(hex);
    state.swatches.forEach((swatch) => {
      if (getSwatchTarget2(swatch) !== "color") return;
      const swatchHex = normalizeHex(swatch.dataset.color || "");
      const match = Boolean(normalizedCurrent && swatchHex && swatchHex === normalizedCurrent);
      swatch.classList.toggle("is-selected", match);
      swatch.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }
  function updateHeader(state, opts) {
    const { headerValue, headerValueLabel, headerValueChip } = state;
    if (headerValueLabel) headerValueLabel.textContent = opts.text;
    if (headerValue) {
      headerValue.dataset.muted = opts.muted ? "true" : "false";
      headerValue.classList.toggle("has-chip", !!opts.chipColor || opts.noneChip === true);
    }
    if (headerValueChip) {
      if (opts.noneChip === true) {
        headerValueChip.style.removeProperty("background");
        headerValueChip.hidden = false;
        headerValueChip.classList.add("is-none");
        headerValueChip.classList.remove("is-white");
      } else if (opts.chipColor) {
        headerValueChip.style.background = opts.chipColor;
        headerValueChip.hidden = false;
        headerValueChip.classList.remove("is-none");
        const parsed = parseCssColor(opts.chipColor.trim());
        const isWhite = Boolean(parsed && parsed.r === 255 && parsed.g === 255 && parsed.b === 255);
        headerValueChip.classList.toggle("is-white", isWhite);
      } else {
        headerValueChip.style.background = "transparent";
        headerValueChip.hidden = true;
        headerValueChip.classList.remove("is-none");
        headerValueChip.classList.remove("is-white");
      }
    }
  }
  function setMode(state, mode) {
    const next = state.allowedModes.includes(mode) ? mode : state.allowedModes[0] || "color";
    state.mode = next;
    state.root.dataset.mode = next;
    state.root.dataset.hasModes = state.allowedModes.length > 1 ? "true" : "false";
    const buttons = Array.from(state.root.querySelectorAll(".diet-dropdown-fill__mode-btn"));
    buttons.forEach((btn) => {
      const btnMode = btn.dataset.mode || "";
      const isAllowed = state.allowedModes.includes(btnMode);
      btn.hidden = !isAllowed;
      btn.disabled = !isAllowed;
      const isActive = isAllowed && btnMode === next;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (state.headerLabel) {
      state.headerLabel.textContent = MODE_LABELS[next] || state.headerLabel.textContent;
    }
  }
  function syncModeUI(state, opts) {
    if (state.mode === "gradient") {
      syncGradientUI(state, opts, mediaDeps());
      return;
    }
    if (state.mode === "image") {
      const shouldCommit = opts.commit && Boolean(state.imageSrc);
      setImageSrc2(state, state.imageSrc, {
        commit: shouldCommit,
        updateHeader: opts.updateHeader,
        updateRemove: opts.updateRemove
      });
      return;
    }
    if (state.mode === "video") {
      const shouldCommit = opts.commit && Boolean(state.videoSrc);
      setVideoSrc2(state, state.videoSrc, {
        commit: shouldCommit,
        updateHeader: opts.updateHeader,
        updateRemove: opts.updateRemove
      });
      return;
    }
    syncColorUI(state, opts);
  }
  function wireModes(state) {
    const buttons = Array.from(state.root.querySelectorAll(".diet-dropdown-fill__mode-btn"));
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const mode = btn.dataset.mode || "color";
        setMode(state, mode);
        syncModeUI(state, { commit: true });
      });
    });
    const initial = state.root.dataset.mode || state.mode;
    setMode(state, initial);
  }
  function captureNativeValue(input) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (!desc?.get || !desc?.set) return void 0;
    return {
      get: () => String(desc.get?.call(input) ?? ""),
      set: (next) => {
        desc.set?.call(input, next);
      }
    };
  }
  return __toCommonJS(dropdown_fill_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
