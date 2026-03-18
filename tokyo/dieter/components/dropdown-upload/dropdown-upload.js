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

  // components/dropdown-upload/dropdown-upload.ts
  var dropdown_upload_exports = {};
  __export(dropdown_upload_exports, {
    hydrateDropdownUpload: () => hydrateDropdownUpload
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
  var WIDGET_PUBLIC_ID_RE = /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/i;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ASSET_VERSION_PATH_RE = /^\/assets\/v\/([^/?#]+)$/;
  var ASSET_VERSION_KEY_RE = /^assets\/versions\/([^/]+)\/([^/]+)\/[^/]+$/;
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
  function normalizeWidgetPublicId(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return null;
    return WIDGET_PUBLIC_ID_RE.test(value) ? value : null;
  }
  function isWidgetPublicId(raw) {
    return normalizeWidgetPublicId(raw) != null;
  }
  function decodePathPart(raw) {
    try {
      return decodeURIComponent(String(raw || "")).trim();
    } catch {
      return "";
    }
  }
  function pathnameFromRawAssetRef(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    if (value.startsWith("/")) return value;
    if (!/^https?:\/\//i.test(value)) return null;
    try {
      return new URL(value).pathname || "/";
    } catch {
      return null;
    }
  }
  function decodeAssetVersionToken(raw) {
    const token = decodePathPart(raw);
    if (!token) return null;
    try {
      const key = decodeURIComponent(token).trim();
      if (!key || key.startsWith("/") || key.includes("..")) return null;
      return key;
    } catch {
      return null;
    }
  }
  function isUuid(raw) {
    const value = typeof raw === "string" ? raw.trim() : "";
    return Boolean(value && UUID_RE.test(value));
  }
  function parseCanonicalAssetRef(raw) {
    const pathname = pathnameFromRawAssetRef(raw);
    if (!pathname) return null;
    const version = pathname.match(ASSET_VERSION_PATH_RE);
    if (!version) return null;
    const versionToken = decodePathPart(version[1]);
    const versionKey = decodeAssetVersionToken(versionToken);
    if (!versionKey) return null;
    const keyMatch = versionKey.match(ASSET_VERSION_KEY_RE);
    if (!keyMatch) return null;
    const accountId = decodePathPart(keyMatch[1]);
    const assetId = decodePathPart(keyMatch[2]);
    if (!isUuid(accountId) || !isUuid(assetId)) return null;
    return {
      accountId,
      assetId,
      kind: "version",
      pathname,
      versionToken,
      versionKey
    };
  }
  function toCanonicalAssetVersionPath(versionKey) {
    const key = typeof versionKey === "string" ? versionKey.trim() : "";
    if (!key || key.startsWith("/") || key.includes("..") || !ASSET_VERSION_KEY_RE.test(key)) return null;
    return `/assets/v/${encodeURIComponent(key)}`;
  }

  // components/shared/hostedAssetBridge.ts
  var HOSTED_ASSET_BRIDGE_KEY = "__CK_CLICKEEN_HOSTED_ACCOUNT_ASSET_BRIDGE__";
  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function resolveHostedAssetBridge() {
    const root = globalThis;
    const candidate = root[HOSTED_ASSET_BRIDGE_KEY];
    if (!isRecord(candidate)) return null;
    const listAssets = candidate.listAssets;
    const resolveAssets = candidate.resolveAssets;
    const uploadAsset = candidate.uploadAsset;
    if (typeof listAssets !== "function" || typeof resolveAssets !== "function" || typeof uploadAsset !== "function") {
      return null;
    }
    return {
      listAssets,
      resolveAssets,
      uploadAsset
    };
  }

  // components/shared/assetUpload.ts
  function isPublicId(value) {
    return isWidgetPublicId(value);
  }
  function isWidgetType(value) {
    return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
  }
  function readDatasetValue(name) {
    if (typeof document === "undefined") return "";
    const value = document.documentElement.dataset?.[name];
    return typeof value === "string" ? value.trim() : "";
  }
  function resolveAssetUploadEndpoint() {
    return readDatasetValue("ckAssetUploadEndpoint").trim();
  }
  function isAccountScopedRomaUploadEndpoint(value) {
    return /\/api\/account\/assets\/upload(?:\?|$)/i.test(value) || /\/api\/accounts\/[0-9a-f-]{36}\/assets\/upload(?:\?|$)/i.test(value);
  }
  function isDevStudioUploadEndpoint(value) {
    return /\/api\/devstudio\/assets\/upload(?:\?|$)/i.test(value);
  }
  function resolveContextFromDocument() {
    const accountId = readDatasetValue("ckOwnerAccountId");
    const publicId = readDatasetValue("ckPublicId");
    const widgetType = readDatasetValue("ckWidgetType");
    if (!accountId || !isUuid(accountId)) return null;
    const context = {
      accountId
    };
    if (publicId && isPublicId(publicId)) context.publicId = publicId;
    if (widgetType && isWidgetType(widgetType)) context.widgetType = widgetType.toLowerCase();
    return context;
  }
  function safeJsonParse(text) {
    if (!text || typeof text !== "string") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  function normalizeAssetUrl(payload) {
    const direct = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!direct) return null;
    const parsed = parseCanonicalAssetRef(direct);
    if (!parsed || parsed.kind !== "version") return null;
    if (/^https?:\/\//i.test(direct)) return direct;
    return parsed.pathname;
  }
  function normalizeAssetRef(payload) {
    const direct = typeof payload.assetRef === "string" ? payload.assetRef.trim() : "";
    if (!direct) return null;
    const parsed = parseCanonicalAssetRef(direct);
    if (!parsed || parsed.kind !== "version") return null;
    return parsed.versionKey;
  }
  function assertUploadContext(context) {
    const accountId = String(context.accountId || "").trim();
    const publicId = String(context.publicId || "").trim();
    const widgetType = String(context.widgetType || "").trim().toLowerCase();
    if (!isUuid(accountId)) {
      throw new Error("coreui.errors.accountId.invalid");
    }
    if (publicId && !isPublicId(publicId)) {
      throw new Error("coreui.errors.publicId.invalid");
    }
    if (widgetType && !isWidgetType(widgetType)) {
      throw new Error("coreui.errors.widgetType.invalid");
    }
    return {
      accountId,
      publicId: publicId || void 0,
      widgetType: widgetType || void 0
    };
  }
  async function uploadEditorAsset(args) {
    const file = args.file;
    if (!(file instanceof File) || file.size <= 0) {
      throw new Error("coreui.errors.payload.empty");
    }
    const context = assertUploadContext(args.context ?? resolveContextFromDocument() ?? {});
    const source = args.source || "api";
    const headers = new Headers();
    headers.set("content-type", file.type || "application/octet-stream");
    headers.set("x-filename", file.name || "upload.bin");
    headers.set("x-source", source);
    if (context.publicId) headers.set("x-public-id", context.publicId);
    if (context.widgetType) headers.set("x-widget-type", context.widgetType);
    const hostedBridge = resolveHostedAssetBridge();
    let payload = null;
    if (hostedBridge) {
      headers.set("x-clickeen-surface", "roma-assets");
      payload = await hostedBridge.uploadAsset(file, Object.fromEntries(headers.entries()));
    } else {
      const endpoint = (args.endpoint || resolveAssetUploadEndpoint()).trim();
      if (!endpoint) {
        throw new Error("coreui.errors.builder.command.hostUnavailable");
      }
      if (!isAccountScopedRomaUploadEndpoint(endpoint) && !isDevStudioUploadEndpoint(endpoint)) {
        throw new Error("coreui.errors.assets.uploadEndpoint.invalid");
      }
      if (isDevStudioUploadEndpoint(endpoint)) {
        headers.set("x-account-id", context.accountId);
      }
      headers.set("x-clickeen-surface", isDevStudioUploadEndpoint(endpoint) ? "devstudio" : "roma-assets");
      const response = await fetch(`${endpoint.replace(/\/$/, "")}?_t=${Date.now()}`, {
        method: "POST",
        headers,
        body: file
      });
      const text = await response.text().catch(() => "");
      payload = safeJsonParse(text);
      if (!response.ok) {
        const errorRecord = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.error : void 0;
        const reasonKey = typeof errorRecord?.reasonKey === "string" ? errorRecord.reasonKey : "";
        const detail = typeof errorRecord?.detail === "string" ? errorRecord.detail : "";
        throw new Error(reasonKey || detail || `coreui.errors.assets.uploadFailed (${response.status})`);
      }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    const payloadRecord = payload;
    const assetId = typeof payloadRecord.assetId === "string" ? payloadRecord.assetId.trim() : "";
    const assetRef = normalizeAssetRef(payloadRecord);
    if (!assetId) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    if (!assetRef) {
      throw new Error("coreui.errors.assets.uploadFailed");
    }
    const url = normalizeAssetUrl(payloadRecord) || toCanonicalAssetVersionPath(assetRef) || "";
    if (!url) throw new Error("coreui.errors.assets.uploadFailed");
    const assetType = typeof payloadRecord.assetType === "string" ? payloadRecord.assetType.trim() : "";
    const contentType = typeof payloadRecord.contentType === "string" ? payloadRecord.contentType.trim() : "";
    const sizeBytesRaw = Number(payloadRecord.sizeBytes);
    const filename = typeof payloadRecord.filename === "string" ? payloadRecord.filename.trim() : "";
    const createdAt = typeof payloadRecord.createdAt === "string" ? payloadRecord.createdAt.trim() : "";
    return {
      assetId,
      assetRef,
      url,
      assetType: assetType || "other",
      contentType: contentType || file.type || "application/octet-stream",
      sizeBytes: Number.isFinite(sizeBytesRaw) ? Math.max(0, Math.trunc(sizeBytesRaw)) : file.size,
      filename: filename || file.name || "upload.bin",
      createdAt: createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
  }

  // components/shared/assetResolve.ts
  function readDocumentDatasetValue(key) {
    if (typeof document === "undefined") return "";
    const value = document.documentElement.dataset[key];
    return typeof value === "string" ? value.trim() : "";
  }
  function resolveAssetApiBase() {
    return readDocumentDatasetValue("ckAssetApiBase").replace(/\/+$/, "");
  }
  function resolveEditorAssetAccountId() {
    const accountId = readDocumentDatasetValue("ckOwnerAccountId");
    return isUuid(accountId) ? accountId : null;
  }
  function normalizeResolvedEditorAssetChoice(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const asset = raw;
    const assetId = String(asset.assetId || "").trim();
    const assetRef = String(asset.assetRef || "").trim();
    const url = String(asset.url || "").trim();
    if (!isUuid(assetId) || !assetRef || !url) return null;
    return { assetId, assetRef, url };
  }
  async function resolveEditorAssetChoices(assetIdsRaw) {
    const accountId = resolveEditorAssetAccountId();
    if (!accountId) {
      throw new Error("No account context available.");
    }
    const seen = /* @__PURE__ */ new Set();
    const assetIds = assetIdsRaw.map((entry) => String(entry || "").trim()).filter((assetId) => {
      if (!isUuid(assetId) || seen.has(assetId)) return false;
      seen.add(assetId);
      return true;
    });
    if (!assetIds.length) return /* @__PURE__ */ new Map();
    const hostedBridge = resolveHostedAssetBridge();
    let payload = null;
    if (hostedBridge) {
      payload = await hostedBridge.resolveAssets(assetIds);
    } else {
      const assetApiBase = resolveAssetApiBase();
      if (!assetApiBase) {
        throw new Error("coreui.errors.builder.command.hostUnavailable");
      }
      const endpoint = `${assetApiBase}/resolve`;
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ assetIds })
      });
      payload = await response.json().catch(() => null);
      if (!response.ok) {
        const reasonKey = String(payload?.error?.reasonKey || "").trim();
        throw new Error(reasonKey || `HTTP_${response.status}`);
      }
    }
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    const resolved = /* @__PURE__ */ new Map();
    for (const asset of assets) {
      const normalized = normalizeResolvedEditorAssetChoice(asset);
      if (!normalized) continue;
      resolved.set(normalized.assetId, normalized);
    }
    return resolved;
  }

  // components/dropdown-upload/dropdown-upload.ts
  var states = /* @__PURE__ */ new Map();
  var UUID_FILENAME_STEM_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ASSET_UNAVAILABLE_MESSAGE = "Asset URL is unavailable. Upload a new file to restore preview.";
  var ASSET_ENTITLEMENT_REASON_KEYS = /* @__PURE__ */ new Set([
    "coreui.upsell.reason.budgetExceeded",
    "coreui.upsell.reason.capReached"
  ]);
  function isAssetEntitlementReasonKey(value) {
    const reasonKey = String(value || "").trim();
    return ASSET_ENTITLEMENT_REASON_KEYS.has(reasonKey);
  }
  function dispatchAssetEntitlementGate(root, reasonKey) {
    root.dispatchEvent(
      new CustomEvent("bob-upsell", {
        bubbles: true,
        detail: { reasonKey }
      })
    );
    if (typeof window === "undefined") return;
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ type: "bob:asset-entitlement-denied", reasonKey }, "*");
  }
  var hydrateHost = createDropdownHydrator({
    rootSelector: ".diet-dropdown-upload",
    triggerSelector: ".diet-dropdown-upload__control",
    onOpen: (root) => {
      const state = states.get(root);
      if (!state) return;
      syncFromInputs(state);
    }
  });
  function hydrateDropdownUpload(scope) {
    const roots = Array.from(scope.querySelectorAll(".diet-dropdown-upload"));
    if (!roots.length) return;
    roots.forEach((root) => {
      if (states.has(root)) return;
      const state = createState(root);
      if (!state) return;
      states.set(root, state);
      installHandlers(state);
      const initialValue = state.input.value || state.input.getAttribute("value") || "";
      syncFromInputs(state, initialValue);
    });
    hydrateHost(scope);
  }
  function createState(root) {
    const input = root.querySelector(".diet-dropdown-upload__value-field");
    const headerLabel = root.querySelector(".diet-dropdown-header-label");
    const headerValue = root.querySelector(".diet-dropdown-header-value");
    const headerValueLabel = root.querySelector(".diet-dropdown-upload__label");
    const previewPanel = root.querySelector(".diet-dropdown-upload__panel");
    const previewImg = root.querySelector(".diet-dropdown-upload__preview-img");
    const previewVideoEl = root.querySelector('[data-role="videoEl"]');
    const previewName = root.querySelector('[data-role="name"]');
    const previewExt = root.querySelector('[data-role="ext"]');
    const previewError = root.querySelector('[data-role="error"]');
    const uploadButton = root.querySelector(".diet-dropdown-upload__upload-btn");
    const replaceButton = root.querySelector(".diet-dropdown-upload__replace-btn");
    const removeButton = root.querySelector(".diet-dropdown-upload__remove-btn");
    const fileInput = root.querySelector(".diet-dropdown-upload__file-input");
    const metaInput = root.querySelector(".diet-dropdown-upload__meta-field");
    const metaHasPath = Boolean(metaInput?.getAttribute("data-bob-path"));
    if (!input || !previewPanel || !previewImg || !previewVideoEl || !previewName || !previewExt || !previewError || !uploadButton || !replaceButton || !removeButton || !fileInput) {
      return null;
    }
    const accept = (input.dataset.accept || fileInput.getAttribute("accept") || "image/*").trim();
    const maxImageKbRaw = (input.dataset.maxImageKb || "").trim();
    const maxVideoKbRaw = (input.dataset.maxVideoKb || "").trim();
    const maxOtherKbRaw = (input.dataset.maxOtherKb || "").trim();
    const maxImageKb = maxImageKbRaw ? Number(maxImageKbRaw) : void 0;
    const maxVideoKb = maxVideoKbRaw ? Number(maxVideoKbRaw) : void 0;
    const maxOtherKb = maxOtherKbRaw ? Number(maxOtherKbRaw) : void 0;
    if (accept) fileInput.setAttribute("accept", accept);
    return {
      root,
      input,
      metaInput,
      metaHasPath,
      headerLabel,
      baseHeaderLabelText: (headerLabel?.textContent || "").trim(),
      headerValue,
      headerValueLabel,
      previewPanel,
      previewImg,
      previewVideoEl,
      previewName,
      previewExt,
      previewError,
      uploadButton,
      replaceButton,
      removeButton,
      fileInput,
      accept,
      maxImageKb: Number.isFinite(maxImageKb) ? maxImageKb : void 0,
      maxVideoKb: Number.isFinite(maxVideoKb) ? maxVideoKb : void 0,
      maxOtherKb: Number.isFinite(maxOtherKb) ? maxOtherKb : void 0,
      localObjectUrl: null,
      nativeValue: captureNativeValue(input),
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
    state.input.addEventListener("external-sync", () => syncFromInputs(state));
    state.input.addEventListener("input", () => syncFromInputs(state));
    if (state.metaInput) {
      state.metaInput.addEventListener("external-sync", () => syncFromInputs(state));
      state.metaInput.addEventListener("input", () => syncFromInputs(state));
    }
    const handlePreviewMediaError = (kind, currentSrc) => {
      const raw = state.input.value || "";
      const expected = extractPrimaryUrl(raw) || "";
      if (!expected) return;
      if (state.previewPanel.dataset.kind !== kind) return;
      if (!sameAssetUrl(currentSrc, expected)) return;
      const fallbackLabel = state.previewName.textContent?.trim() || "Asset unavailable";
      setHeaderWithFile(state, fallbackLabel, true);
      setError(state, ASSET_UNAVAILABLE_MESSAGE);
    };
    const handlePreviewMediaReady = (kind, currentSrc) => {
      const raw = state.input.value || "";
      const expected = extractPrimaryUrl(raw) || "";
      if (!expected || state.previewPanel.dataset.kind !== kind) return;
      if (!sameAssetUrl(currentSrc, expected)) return;
      if ((state.previewError.textContent || "").trim() === ASSET_UNAVAILABLE_MESSAGE) {
        clearError(state);
      }
    };
    state.previewImg.addEventListener("error", () => {
      handlePreviewMediaError("image", state.previewImg.currentSrc || state.previewImg.src || "");
    });
    state.previewImg.addEventListener("load", () => {
      handlePreviewMediaReady("image", state.previewImg.currentSrc || state.previewImg.src || "");
    });
    state.previewVideoEl.addEventListener("error", () => {
      handlePreviewMediaError("video", state.previewVideoEl.currentSrc || state.previewVideoEl.src || "");
    });
    state.previewVideoEl.addEventListener("loadeddata", () => {
      handlePreviewMediaReady("video", state.previewVideoEl.currentSrc || state.previewVideoEl.src || "");
    });
    const pickUploadFile = (event) => {
      event.preventDefault();
      state.fileInput.value = "";
      state.fileInput.click();
    };
    const pickReplaceFile = (event) => {
      event.preventDefault();
      state.fileInput.value = "";
      state.fileInput.click();
    };
    state.uploadButton.addEventListener("click", pickUploadFile);
    state.replaceButton.addEventListener("click", pickReplaceFile);
    state.removeButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.localObjectUrl) {
        URL.revokeObjectURL(state.localObjectUrl);
        state.localObjectUrl = null;
      }
      setMetaValue(state, null, true);
      setFileKey(state, "transparent", true);
    });
    state.fileInput.addEventListener("change", async () => {
      const file = state.fileInput.files && state.fileInput.files[0];
      if (!file) return;
      const error = validateFileSelection(state, file);
      if (error) {
        setError(state, error);
        return;
      }
      clearError(state);
      try {
        setUploadingState(state, true);
        const uploaded = await uploadEditorAsset({
          file,
          source: "api"
        });
        const existingMeta = readMeta(state);
        const nextMeta = {
          ...existingMeta || {},
          name: file.name,
          assetId: uploaded.assetId,
          source: typeof existingMeta?.source === "string" && existingMeta.source.trim() ? existingMeta.source.trim() : "user"
        };
        const { kind, ext } = classifyByNameAndType(file.name, file.type);
        state.root.dataset.localName = file.name;
        setMetaValue(state, nextMeta, true);
        setHeaderWithFile(state, file.name, false);
        setPreview(state, {
          kind,
          previewUrl: kind === "image" || kind === "video" ? uploaded.url : void 0,
          name: file.name,
          ext,
          hasFile: true
        });
        setFileKey(state, "transparent", true);
        clearError(state);
      } catch (error2) {
        const message = error2 instanceof Error ? error2.message : "coreui.errors.assets.uploadFailed";
        if (isAssetEntitlementReasonKey(message)) {
          dispatchAssetEntitlementGate(state.root, message);
        }
        setError(state, message);
      } finally {
        setUploadingState(state, false);
        state.fileInput.value = "";
      }
    });
  }
  function setUploadingState(state, uploading) {
    state.root.dataset.uploading = uploading ? "true" : "false";
    state.uploadButton.disabled = uploading;
    state.replaceButton.disabled = uploading;
    state.removeButton.disabled = uploading;
  }
  function validateFileSelection(state, file) {
    const { kind } = classifyByNameAndType(file.name, file.type);
    const capKb = kind === "image" ? state.maxImageKb : kind === "video" ? state.maxVideoKb : state.maxOtherKb;
    if (capKb && Number.isFinite(capKb)) {
      const maxBytes = capKb * 1024;
      if (file.size > maxBytes) return `File too large (max ${capKb}KB)`;
    }
    const accept = state.accept;
    if (!accept) return null;
    const accepted = accept.split(",").map((s) => s.trim()).filter(Boolean);
    if (!accepted.length) return null;
    const nameLower = file.name.toLowerCase();
    const typeLower = (file.type || "").toLowerCase();
    const ok = accepted.some((rule) => {
      if (rule === "*/*") return true;
      if (rule.endsWith("/*")) {
        const prefix = rule.slice(0, -2).toLowerCase();
        return typeLower.startsWith(`${prefix}/`);
      }
      if (rule.startsWith(".")) {
        return nameLower.endsWith(rule.toLowerCase());
      }
      return typeLower === rule.toLowerCase();
    });
    return ok ? null : "File type not allowed";
  }
  function syncFromInputs(state, fallbackValue) {
    const value = fallbackValue ?? state.input.value;
    const meta = readMeta(state);
    syncFromValue(state, value, meta);
  }
  function readMeta(state) {
    if (!state.metaInput) return null;
    const raw = state.metaInput.value || state.metaInput.getAttribute("value") || "";
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function extractPrimaryUrl(raw) {
    const v = (raw || "").trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v) || v.startsWith("/")) return v;
    const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (m && m[2]) {
      const extracted = m[2].trim();
      if (/^https?:\/\//i.test(extracted) || extracted.startsWith("/")) return extracted;
    }
    return null;
  }
  function readMetaAssetId(meta) {
    const assetId = typeof meta?.assetId === "string" ? meta.assetId.trim() : "";
    return isUuid(assetId) ? assetId : "";
  }
  function readCurrentAssetId(state) {
    const metaAssetId = readMetaAssetId(readMeta(state));
    if (metaAssetId) return metaAssetId;
    const rawValue = String(state.input.value || "").trim();
    return isUuid(rawValue) ? rawValue : "";
  }
  function sameAssetUrl(leftRaw, rightRaw) {
    const left = normalizeUrlForCompare(leftRaw);
    const right = normalizeUrlForCompare(rightRaw);
    if (!left || !right) return false;
    return left === right;
  }
  function normalizeUrlForCompare(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const parsed = new URL(value, window.location.href);
      return parsed.toString();
    } catch {
      return value;
    }
  }
  async function resolvePreviewFromAssetId(state, assetId, displayName, kindName) {
    try {
      const resolved = await resolveEditorAssetChoices([assetId]);
      if (readCurrentAssetId(state) !== assetId) return;
      const entry = resolved.get(assetId);
      if (!entry?.url) {
        setHeaderWithFile(state, displayName, true);
        setError(state, ASSET_UNAVAILABLE_MESSAGE);
        return;
      }
      const resolvedName = displayName || guessNameFromUrl(entry.url) || "Uploaded file";
      const { kind, ext } = classifyByNameAndType(kindName || resolvedName, "");
      setPreview(state, {
        kind,
        previewUrl: entry.url,
        name: resolvedName,
        ext,
        hasFile: true
      });
      clearError(state);
    } catch (_error) {
      if (readCurrentAssetId(state) !== assetId) return;
      setHeaderWithFile(state, displayName, true);
      setError(state, ASSET_UNAVAILABLE_MESSAGE);
    }
  }
  function previewFromUrl(state, raw, name, kindName) {
    const url = extractPrimaryUrl(raw);
    if (!url) return;
    const ext = (guessExtFromName(kindName) || "").toLowerCase();
    const kind = classifyByNameAndType(kindName || "file", "").kind;
    setPreview(state, { kind, previewUrl: url, name, ext, hasFile: true });
  }
  function syncFromValue(state, raw, meta = null) {
    let key = String(raw ?? "").trim();
    if (key === "transparent") key = "";
    const placeholder = state.headerValue?.dataset.placeholder ?? "";
    const metaName = typeof meta?.name === "string" ? meta.name.trim() : "";
    const expectsMeta = state.metaHasPath;
    const assetId = readMetaAssetId(meta);
    const rawAssetId = isUuid(key) ? key : "";
    const rawUrl = extractPrimaryUrl(key) || "";
    const kindName = metaName || guessNameFromUrl(rawUrl) || "";
    const guessedUrlName = guessNameFromUrl(rawUrl);
    const fallbackName = expectsMeta ? "" : state.root.dataset.localName || guessedUrlName || (rawUrl ? "Uploaded file" : key || "Uploaded file");
    const displayName = metaName || fallbackName || (expectsMeta ? "Unnamed file" : "Uploaded file");
    const currentAssetId = assetId || rawAssetId;
    if (!key && !rawUrl && !currentAssetId) {
      clearError(state);
      setHeaderEmpty(state, placeholder);
      state.root.dataset.hasFile = "false";
      setPreview(state, { kind: "empty", previewUrl: void 0, name: "", ext: "", hasFile: false });
      delete state.root.dataset.localName;
      return;
    }
    state.root.dataset.hasFile = "true";
    const hasMetaError = expectsMeta && !metaName && !rawUrl && !currentAssetId;
    if (hasMetaError) {
      setError(state, "Missing file metadata.");
    } else {
      clearError(state);
    }
    if (currentAssetId) {
      setHeaderWithFile(state, displayName, false);
      setPreview(state, {
        kind: "unknown",
        previewUrl: void 0,
        name: displayName,
        ext: guessExtFromName(kindName || displayName).toLowerCase(),
        hasFile: true
      });
      void resolvePreviewFromAssetId(state, currentAssetId, displayName, kindName || displayName);
      return;
    }
    if (rawUrl) {
      setHeaderWithFile(state, displayName, false);
      previewFromUrl(state, rawUrl, displayName, kindName || displayName);
      return;
    }
    setPreview(state, { kind: "unknown", previewUrl: void 0, name: "", ext: "", hasFile: true });
    setHeaderWithFile(state, "Invalid value", true);
    setError(state, "Unsupported value. Expected an absolute URL (http/https) or root-relative path.");
  }
  function setFileKey(state, fileKey, emit) {
    state.internalWrite = true;
    state.input.value = fileKey;
    state.internalWrite = false;
    if (emit) state.input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setMetaValue(state, meta, emit) {
    if (!state.metaInput) return;
    const next = meta ? JSON.stringify(meta) : "";
    state.metaInput.value = next;
    if (emit) state.metaInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function setPreview(state, args) {
    state.previewPanel.dataset.hasFile = args.hasFile ? "true" : "false";
    state.previewPanel.dataset.kind = args.kind;
    state.previewName.textContent = args.name || "";
    state.previewExt.textContent = args.ext ? args.ext.toUpperCase() : "";
    if (args.hasFile && args.name) setHeaderWithFile(state, args.name, false);
    if (args.kind === "image" && args.previewUrl) {
      state.previewImg.src = args.previewUrl;
    } else {
      state.previewImg.removeAttribute("src");
    }
    if (args.kind === "video" && args.previewUrl) {
      state.previewVideoEl.src = args.previewUrl;
      state.previewVideoEl.load();
    } else {
      state.previewVideoEl.removeAttribute("src");
    }
  }
  function setError(state, message) {
    state.previewError.textContent = message;
  }
  function clearError(state) {
    state.previewError.textContent = "";
  }
  function setHeaderEmpty(state, placeholder) {
    if (state.headerLabel) state.headerLabel.textContent = placeholder;
    if (state.headerValueLabel) state.headerValueLabel.textContent = "";
    if (state.headerValue) {
      state.headerValue.hidden = true;
      state.headerValue.dataset.muted = "true";
    }
  }
  function setHeaderWithFile(state, rightText, muted) {
    if (state.headerLabel) state.headerLabel.textContent = state.baseHeaderLabelText || "File";
    if (state.headerValueLabel) state.headerValueLabel.textContent = rightText;
    if (state.headerValue) {
      state.headerValue.hidden = false;
      state.headerValue.dataset.muted = muted ? "true" : "false";
    }
  }
  function classifyByNameAndType(name, mimeType) {
    const ext = guessExtFromName(name);
    const mt = (mimeType || "").toLowerCase();
    const extLower = (ext || "").toLowerCase();
    const isImage = mt.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extLower);
    if (isImage) return { kind: "image", ext: extLower };
    const isVideo = mt.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extLower);
    if (isVideo) return { kind: "video", ext: extLower };
    const isDoc = mt === "application/pdf" || mt === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mt === "application/vnd.ms-excel" || ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip", "csv", "lottie", "json"].includes(extLower);
    if (isDoc) return { kind: "doc", ext: extLower };
    return { kind: "unknown", ext: extLower };
  }
  function guessExtFromName(name) {
    const base = (name || "").split("?")[0];
    const parts = base.split(".").filter(Boolean);
    if (parts.length < 2) return "";
    return parts[parts.length - 1];
  }
  function guessNameFromUrl(url) {
    const cleaned = url.split("?")[0];
    const parts = cleaned.split("/").filter(Boolean);
    if (!parts.length) return "";
    const filename = decodePathPart2(parts[parts.length - 1]);
    if (!filename || !filename.includes(".")) return "";
    const stem = filename.replace(/\.[^.]+$/, "");
    if (!stem || UUID_FILENAME_STEM_RE.test(stem)) return "";
    return filename;
  }
  function decodePathPart2(raw) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
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
  return __toCommonJS(dropdown_upload_exports);
})();
window.Dieter = { ...__prevDieter, ...Dieter };
