/**
 * i18n.js — Bilingual translation system for Wadi Saqra dashboard
 * Supports English (en) and Arabic (ar) with RTL/LTR layout switching
 */

const i18n = {
  currentLanguage: localStorage.getItem("dashboard-language") || "en",

  languages: {
    en: {
      // Header & Navigation
      "header.title": "Wadi Saqra Traffic Digital Twin",
      "header.subtitle": "Live digital twin with AI-powered signal optimization",
      "header.readOnly": "Read-only analytical system",
      "header.readOnlyDetail": "Signal timing outputs are recommendations for operator review only",
      "header.liveMode": "Live Mode",

      // Language & Theme
      "nav.language": "العربية",
      "nav.languageCode": "ar",
      "nav.theme": "🌓 Theme",

      // Tab Names
      "tab.liveDigitalTwin": "Live Digital Twin",
      "tab.videoAnalytics": "Video Analytics",

      // Data Source Banner
      "banner.connecting": "Connecting to data source…",
      "banner.startingUp": "Starting up — please wait",
      "banner.live": "Live traffic data (Google Routes + SUMO)",
      "banner.fallback": "Using fallback data (detector CSVs)",
      "banner.replay": "Replay mode — offline simulation",

      // Map & Map Controls
      "map.title": "Live Digital Twin Map",
      "map.subtitle": "Google traffic overlay + simulated vehicles",
      "map.vehicles": "Vehicles",
      "map.zoomIn": "＋ Zoom In",
      "map.zoomOut": "－ Zoom Out",
      "map.resetView": "⌂ Reset View",
      "map.hoverCoords": "Hover over map to see coordinates",
      "map.sumoMode": "📡 SUMO Digital Twin",
      "map.satelliteMode": "🗺 Satellite View",

      // KPI Cards
      "kpi.networkQueue": "Network Queue",
      "kpi.avgSpeed": "Avg Speed",
      "kpi.avgSpeedUnit": "km/h",
      "kpi.dominantQueue": "Dominant Queue",
      "kpi.googleDelay": "Max Delay",
      "kpi.co2Emissions": "CO₂ Emissions",
      "kpi.co2Unit": "g/h",
      "kpi.forecast15": "15-min Forecast",
      "kpi.forecastUnit": "vehicles/h",

      // Traffic Status
      "traffic.meters": "m in monitored approaches",
      "traffic.acrossApproaches": "across all approaches",
      "traffic.approachUnderStress": "approach currently under stress",
      "traffic.maxTravelTime": "largest live travel-time delta",

      // Signals & Timing
      "signal.title": "Traffic Signals at Junction",
      "signal.description": "Each section shows one approach with incoming lanes. Green/Yellow/Red indicates current signal, along with queue, vehicles, and speed.",
      "signal.currentVsWebster": "Signal Plan: Current vs Webster Optimal",
      "signal.computing": "Computing optimal timing…",

      // System Health
      "health.title": "System Health",
      "health.uptime": "Uptime",
      "health.googleAPI": "Google API",
      "health.detectors": "Detectors",
      "health.database": "Database",
      "health.sumoEngine": "SUMO Engine",
      "health.ok": "OK",
      "health.failed": "Failed",
      "health.connecting": "Connecting…",

      // Phase 3 Events
      "events.title": "Active Incidents",
      "events.noActive": "No active incidents",
      "events.activeCount": "active",
      "events.type": "Type",
      "events.severity": "Severity",
      "events.location": "Location",
      "events.time": "Time",
      "events.abnormalStop": "Abnormal Stop",
      "events.stalledVehicle": "Stalled Vehicle",
      "events.queueSpillback": "Queue Spillback",
      "events.gridlock": "Gridlock",
      "events.severe": "Severe",
      "events.high": "High",
      "events.medium": "Medium",
      "events.low": "Low",

      // Forecast
      "forecast.title": "Traffic Forecast",
      "forecast.15min": "15 min",
      "forecast.30min": "30 min",
      "forecast.60min": "60 min",
      "forecast.demand": "Demand",
      "forecast.confidence": "Confidence",
      "forecast.trend": "Trend",

      // Comparison Table
      "table.title": "Direction Comparison",
      "table.subtitle": "Google vs SUMO by Direction",
      "table.direction": "Direction",
      "table.googleCorridor": "Google Corridor",
      "table.googleSpeed": "Google Speed",
      "table.liveDemand": "Live Demand",
      "table.simulatedFlow": "Simulated Flow",
      "table.queueLength": "Queue Length",
      "table.simSpeed": "Sim Speed",
      "table.laneStatus": "Lane Status",

      // Directions
      "dir.northbound": "Northbound",
      "dir.southbound": "Southbound",
      "dir.eastbound": "Eastbound",
      "dir.westbound": "Westbound",

      // Decision Support
      "decision.title": "Decision Support",
      "decision.recommendation": "Recommended Signal Plan",
      "decision.alerts": "Operational Alerts",

      // History
      "history.title": "10-Minute History",
      "history.subtitle": "Rolling traffic metrics (1 Hz)",

      // How To Read
      "guide.title": "Quick Guide",
      "guide.subtitle": "How to read this dashboard",
      "guide.greenSignal": "Green signal = traffic can move",
      "guide.redSignal": "Red signal = vehicles waiting",
      "guide.queueLength": "Queue length = total distance waiting",
      "guide.liveData": "Live data = Google Routes (real traffic)",
      "guide.simData": "Sim data = SUMO lane-level detail",
      "guide.forecast": "Forecast = AI prediction of future demand",
      "guide.adaptive": "Adaptive mode = system is optimizing signals",

      // Video Analytics
      "va.title": "Video Analytics",
      "va.summary": "Video Processing Summary",
      "va.gallery": "Wadi Saqra Video Gallery",
      "va.player": "Video Player with YOLO Overlay",
      "va.timeline": "Traffic Density Timeline",
      "va.events": "Detected Events",
      "va.useCases": "Proven Use Cases",
      "va.play": "▶ Play",
      "va.noVideos": "No videos available yet",
      "va.detectedIncidents": "Detected Incidents",
      "va.noIncidents": "No incidents detected",
      "va.stats": "Processing Stats",
      "va.videosProcessed": "Videos Processed",
      "va.avgDetectionTime": "Avg Detection Time",

      // Buttons
      "btn.toggleAdaptive": "Adaptive:",
      "btn.on": "On",
      "btn.off": "Off",
      "btn.refresh": "Refresh",

      // Status Labels
      "status.normal": "Normal",
      "status.slowTraffic": "Slow Traffic",
      "status.heavyJam": "Heavy Jam",
      "status.free": "Free Flow",
      "status.light": "Light Traffic",
      "status.moderate": "Moderate Delay",
      "status.heavy": "Heavy Delay",
      "status.severe": "Severe Jam",

      // Time
      "time.updated": "Last updated",
      "time.seconds": "seconds ago",
      "time.minutes": "minutes ago",
      "time.unknown": "--",
    },

    ar: {
      // Header & Navigation
      "header.title": "التوأم الرقمي المباشر لحركة وادي صقرة",
      "header.subtitle": "نظام ذكي لتحسين إشارات المرور بقوة الذكاء الاصطناعي",
      "header.readOnly": "نظام تحليلي للقراءة فقط",
      "header.readOnlyDetail": "توصيات توقيت الإشارة مخصصة لمراجعة المشغل فقط",
      "header.liveMode": "الوضع المباشر",

      // Language & Theme
      "nav.language": "English",
      "nav.languageCode": "en",
      "nav.theme": "🌓 المظهر",

      // Tab Names
      "tab.liveDigitalTwin": "التوأم الرقمي المباشر",
      "tab.videoAnalytics": "تحليلات الفيديو",

      // Data Source Banner
      "banner.connecting": "جاري الاتصال بمصدر البيانات…",
      "banner.startingUp": "جاري البدء - يرجى الانتظار",
      "banner.live": "بيانات حركة المرور المباشرة (Google Routes + SUMO)",
      "banner.fallback": "استخدام البيانات الاحتياطية (ملفات الكشاف)",
      "banner.replay": "وضع إعادة التشغيل - محاكاة بلا اتصال",

      // Map & Map Controls
      "map.title": "خريطة التوأم الرقمي المباشر",
      "map.subtitle": "تراكب حركة المرور من Google + المركبات المحاكاة",
      "map.vehicles": "المركبات",
      "map.zoomIn": "＋ تكبير",
      "map.zoomOut": "－ تصغير",
      "map.resetView": "⌂ إعادة تعيين العرض",
      "map.hoverCoords": "مرر الماوس فوق الخريطة لرؤية الإحداثيات",
      "map.sumoMode": "📡 التوأم الرقمي SUMO",
      "map.satelliteMode": "🗺 عرض الأقمار الصناعية",

      // KPI Cards
      "kpi.networkQueue": "طابور الشبكة",
      "kpi.avgSpeed": "متوسط السرعة",
      "kpi.avgSpeedUnit": "كم/س",
      "kpi.dominantQueue": "الطابور السائد",
      "kpi.googleDelay": "التأخير الأقصى",
      "kpi.co2Emissions": "انبعاثات CO₂",
      "kpi.co2Unit": "غ/س",
      "kpi.forecast15": "توقع 15 دقيقة",
      "kpi.forecastUnit": "مركبة/س",

      // Traffic Status
      "traffic.meters": "م في المقاطع المراقبة",
      "traffic.acrossApproaches": "عبر جميع المقاطع",
      "traffic.approachUnderStress": "المقطع تحت الضغط حالياً",
      "traffic.maxTravelTime": "أكبر فارق وقت سفر مباشر",

      // Signals & Timing
      "signal.title": "إشارات المرور عند التقاطع",
      "signal.description": "يعرض كل قسم مقطع واحد مع المسارات الواردة. يشير الأخضر/الأصفر/الأحمر إلى الإشارة الحالية، مع الطابور والمركبات والسرعة.",
      "signal.currentVsWebster": "خطة الإشارة: الحالية مقابل الأمثل (Webster)",
      "signal.computing": "جاري حساب الوقت الأمثل…",

      // System Health
      "health.title": "صحة النظام",
      "health.uptime": "وقت التشغيل",
      "health.googleAPI": "Google API",
      "health.detectors": "الكواشف",
      "health.database": "قاعدة البيانات",
      "health.sumoEngine": "محرك SUMO",
      "health.ok": "تمام",
      "health.failed": "فشل",
      "health.connecting": "جاري الاتصال…",

      // Phase 3 Events
      "events.title": "الحوادث النشطة",
      "events.noActive": "لا توجد حوادث نشطة",
      "events.activeCount": "نشط",
      "events.type": "النوع",
      "events.severity": "الخطورة",
      "events.location": "الموقع",
      "events.time": "الوقت",
      "events.abnormalStop": "توقف غير طبيعي",
      "events.stalledVehicle": "مركبة متعطلة",
      "events.queueSpillback": "تجاوز الطابور",
      "events.gridlock": "شلل كامل",
      "events.severe": "خطير",
      "events.high": "مرتفع",
      "events.medium": "متوسط",
      "events.low": "منخفض",

      // Forecast
      "forecast.title": "توقع حركة المرور",
      "forecast.15min": "15 دقيقة",
      "forecast.30min": "30 دقيقة",
      "forecast.60min": "60 دقيقة",
      "forecast.demand": "الطلب",
      "forecast.confidence": "الثقة",
      "forecast.trend": "الاتجاه",

      // Comparison Table
      "table.title": "مقارنة الاتجاهات",
      "table.subtitle": "Google مقابل SUMO حسب الاتجاه",
      "table.direction": "الاتجاه",
      "table.googleCorridor": "ممر Google",
      "table.googleSpeed": "سرعة Google",
      "table.liveDemand": "الطلب المباشر",
      "table.simulatedFlow": "التدفق المحاكى",
      "table.queueLength": "طول الطابور",
      "table.simSpeed": "السرعة المحاكاة",
      "table.laneStatus": "حالة المسار",

      // Directions
      "dir.northbound": "شمال",
      "dir.southbound": "جنوب",
      "dir.eastbound": "شرق",
      "dir.westbound": "غرب",

      // Decision Support
      "decision.title": "دعم القرار",
      "decision.recommendation": "خطة الإشارة الموصى بها",
      "decision.alerts": "تنبيهات التشغيل",

      // History
      "history.title": "السجل لمدة 10 دقائق",
      "history.subtitle": "مقاييس حركة المرور المتحركة (1 Hz)",

      // How To Read
      "guide.title": "دليل سريع",
      "guide.subtitle": "كيفية قراءة لوحة المعلومات هذه",
      "guide.greenSignal": "الإشارة الخضراء = يمكن لحركة المرور أن تتحرك",
      "guide.redSignal": "الإشارة الحمراء = المركبات في انتظار",
      "guide.queueLength": "طول الطابور = إجمالي المسافة في الانتظار",
      "guide.liveData": "البيانات المباشرة = Google Routes (حركة مرور فعلية)",
      "guide.simData": "بيانات المحاكاة = تفاصيل المسار SUMO",
      "guide.forecast": "التوقع = تنبؤ ذكي بالطلب المستقبلي",
      "guide.adaptive": "الوضع التكيفي = النظام يحسّن الإشارات",

      // Video Analytics
      "va.title": "تحليلات الفيديو",
      "va.summary": "ملخص معالجة الفيديو",
      "va.gallery": "معرض فيديو وادي صقرة",
      "va.player": "مشغل الفيديو مع تراكب YOLO",
      "va.timeline": "خط الزمن لكثافة حركة المرور",
      "va.events": "الأحداث المكتشفة",
      "va.useCases": "حالات الاستخدام المثبتة",
      "va.play": "▶ تشغيل",
      "va.noVideos": "لا توجد مقاطع فيديو متاحة حتى الآن",
      "va.detectedIncidents": "الحوادث المكتشفة",
      "va.noIncidents": "لم يتم اكتشاف حوادث",
      "va.stats": "إحصائيات المعالجة",
      "va.videosProcessed": "مقاطع الفيديو المعالجة",
      "va.avgDetectionTime": "متوسط وقت الكشف",

      // Buttons
      "btn.toggleAdaptive": "التكيفي:",
      "btn.on": "مشغل",
      "btn.off": "معطل",
      "btn.refresh": "تحديث",

      // Status Labels
      "status.normal": "عادي",
      "status.slowTraffic": "حركة بطيئة",
      "status.heavyJam": "اختناق شديد",
      "status.free": "تدفق حر",
      "status.light": "حركة خفيفة",
      "status.moderate": "تأخير متوسط",
      "status.heavy": "تأخير كبير",
      "status.severe": "اختناق شديد",

      // Time
      "time.updated": "آخر تحديث",
      "time.seconds": "ثوانٍ مضت",
      "time.minutes": "دقائق مضت",
      "time.unknown": "--",
    },
  },

  /**
   * Get translated string
   * @param {string} key - Translation key like "header.title"
   * @param {object} params - Optional parameters for templating
   * @returns {string} Translated string
   */
  t(key, params = {}) {
    const lang = this.currentLanguage;
    let text = this.languages[lang]?.[key] || this.languages.en[key] || `[${key}]`;
    
    // Simple parameter substitution
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });
    
    return text;
  },

  /**
   * Set current language and update DOM
   * @param {string} lang - "en" or "ar"
   */
  setLanguage(lang) {
    if (!this.languages[lang]) lang = "en";
    this.currentLanguage = lang;
    localStorage.setItem("dashboard-language", lang);
    
    // Update HTML lang and dir attributes
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    
    // Dispatch custom event so components can re-render
    window.dispatchEvent(new CustomEvent("i18n-changed", { detail: { lang } }));
  },

  /**
   * Get language toggle info
   */
  getToggleLanguage() {
    const nextLang = this.currentLanguage === "en" ? "ar" : "en";
    return {
      current: this.currentLanguage,
      next: nextLang,
      nextLabel: this.t("nav.language"),
      nextCode: this.t("nav.languageCode"),
    };
  },

  /**
   * Check if current language is RTL
   */
  isRTL() {
    return this.currentLanguage === "ar";
  },
};

// Initialize on page load
document.documentElement.lang = i18n.currentLanguage;
document.documentElement.dir = i18n.isRTL() ? "rtl" : "ltr";
