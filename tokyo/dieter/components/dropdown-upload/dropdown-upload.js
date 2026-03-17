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
    const endpoint = (args.endpoint || resolveAssetUploadEndpoint() || "/api/assets/upload").trim();
    const headers = new Headers();
    headers.set("content-type", file.type || "application/octet-stream");
    headers.set("x-account-id", context.accountId);
    headers.set("x-filename", file.name || "upload.bin");
    headers.set("x-source", source);
    headers.set("x-clickeen-surface", endpoint.includes("/api/devstudio/assets/upload") ? "devstudio" : "roma-assets");
    if (context.publicId) headers.set("x-public-id", context.publicId);
    if (context.widgetType) headers.set("x-widget-type", context.widgetType);
    const response = await fetch(`${endpoint.replace(/\/$/, "")}?_t=${Date.now()}`, {
      method: "POST",
      headers,
      body: file
    });
    const text = await response.text().catch(() => "");
    const payload = safeJsonParse(text);
    if (!response.ok) {
      const errorRecord = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.error : void 0;
      const reasonKey = typeof errorRecord?.reasonKey === "string" ? errorRecord.reasonKey : "";
      const detail = typeof errorRecord?.detail === "string" ? errorRecord.detail : "";
      throw new Error(reasonKey || detail || `coreui.errors.assets.uploadFailed (${response.status})`);
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
    const assetApiBase = resolveAssetApiBase();
    const endpoint = assetApiBase ? `${assetApiBase}/${encodeURIComponent(accountId)}/resolve` : `/api/assets/${encodeURIComponent(accountId)}/resolve`;
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ assetIds })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const reasonKey = String(payload?.error?.reasonKey || "").trim();
      throw new Error(reasonKey || `HTTP_${response.status}`);
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
