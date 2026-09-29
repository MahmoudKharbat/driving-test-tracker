/**
 * Every user-facing string in the app, in Hebrew, masculine grammatical forms.
 *
 * Centralised so no Hebrew literal is stranded inside a component — that keeps
 * the wording consistent and makes a future locale split a data change rather
 * than a hunt through JSX.
 */

export const strings = {
  auth: {
    title: 'מבחני נהיגה',
    subtitle: 'מעקב אחר תוצאות מבחנים לפי מורה',
    email: 'אימייל',
    password: 'סיסמה',
    emailPlaceholder: 'name@example.com',
    showPassword: 'הצג סיסמה',
    hidePassword: 'הסתר סיסמה',
    forgotPassword: 'שכחת סיסמה?',
    resetSentTitle: 'בדוק את תיבת הדואר',
    resetSentBody: (email: string) =>
      `אם קיים חשבון עבור ${email}, נשלח אליו קישור לאיפוס הסיסמה.`,
    name: 'שם מלא',
    signIn: 'כניסה',
    signUp: 'הרשמה',
    noAccount: 'אין לך חשבון?',
    haveAccount: 'יש לך חשבון?',
    signOut: 'התנתקות',
    signOutConfirmTitle: 'התנתקות',
    signOutConfirmBody: 'להתנתק מהחשבון?',
    errors: {
      emailRequired: 'יש להזין אימייל',
      emailForReset: 'הזן את האימייל שלך כדי לאפס את הסיסמה',
      emailInvalid: 'כתובת אימייל לא תקינה',
      passwordRequired: 'יש להזין סיסמה',
      passwordTooShort: 'הסיסמה חייבת להכיל לפחות 6 תווים',
      nameRequired: 'יש להזין שם מלא',
      invalidCredentials: 'אימייל או סיסמה שגויים',
      emailInUse: 'כתובת האימייל כבר רשומה במערכת',
      weakPassword: 'הסיסמה חלשה מדי',
      networkFailed: 'אין חיבור לאינטרנט. נסה שוב מאוחר יותר',
      tooManyRequests: 'יותר מדי ניסיונות. נסה שוב בעוד מספר דקות',
      generic: 'אירעה שגיאה. נסה שוב',
    },
  },

  nav: {
    teacherDetail: 'פרטי מורה',
  },

  teachers: {
    title: 'סיכום מבחנים',
    search: 'חיפוש',
    searchPlaceholder: 'חיפוש מורה או עיר',
    cancelSearch: 'ביטול',
    more: 'עוד',
    allCities: 'כל הערים',
    allTeachers: 'כל המורים',
    results: (n: number) => (n === 1 ? 'תוצאה אחת' : `${n} תוצאות`),
    noMatch: 'לא נמצא מורה בשם הזה',
    addTeacherCta: 'הוספת מורה חדש',
    addMenu: 'הוספת מורה או עיר',
    empty: 'עדיין אין מורים רשומים',
    emptyHint: 'הוסף מבחן ראשון כדי להתחיל',
    noResults: 'לא נמצאו מורים התואמים לסינון',
    noTests: 'אין מבחנים',
    /** e.g. "אחרון 26.09" */
    last: (date: string) => `אחרון ${date}`,
    stats: {
      passRate: 'הצלחה כוללת',
      tests: 'מבחנים',
      teachers: 'מורים',
      cities: 'ערים',
    },
    /** Chip label, kept short so it never wraps: "מיון: תאריך". */
    sortChip: (label: string) => `מיון: ${label}`,
    sort: {
      mostTests: 'מבחנים',
      lowestPassRate: 'אחוז הצלחה',
      recentlyTested: 'תאריך',
      name: 'שם',
    },
    /** Direction chip: [natural order, reversed]. */
    order: {
      mostTests: ['רב ← מעט', 'מעט ← רב'],
      lowestPassRate: ['נמוך ← גבוה', 'גבוה ← נמוך'],
      recentlyTested: ['חדש ← ישן', 'ישן ← חדש'],
      name: ['א ← ת', 'ת ← א'],
    },
    reverseOrder: 'היפוך סדר המיון',
    allTime: 'כל הזמנים',
  },

  teacherDetail: {
    passed: 'עברו',
    failed: 'נכשלו',
    total: 'סה״כ',
    passRate: 'אחוז מעבר',
    history: 'היסטוריית מבחנים',
    empty: 'עדיין לא נרשמו מבחנים למורה זה',
    statsPending: 'מסונכרן…',
    deleteTeacher: 'מחיקת מורה',
    deleteTeacherConfirmTitle: 'מחיקת מורה',
    deleteTeacherConfirmBody:
      'פעולה זו תמחק את המורה ואת כל המבחנים שנרשמו לו. לא ניתן לבטל.',
  },

  newTest: {
    title: 'מבחן חדש',
    city: 'עיר',
    cityPlaceholder: 'בחר עיר',
    noCities: 'אין ערים עדיין — הוסף עיר',
    teacher: 'מורה',
    teacherPlaceholder: 'בחר מורה',
    teacherPickCityFirst: 'בחר עיר תחילה',
    date: 'תאריך',
    result: 'תוצאה',
    pass: 'עבר',
    fail: 'נכשל',
    save: 'שמירה',
    errors: {
      cityRequired: 'יש לבחור עיר',
      teacherRequired: 'יש לבחור מורה',
      resultRequired: 'יש לבחור תוצאה',
      dateInFuture: 'לא ניתן לרשום מבחן בתאריך עתידי',
    },
  },

  add: {
    title: 'הוספה',
    tabs: { teacher: 'מורה', city: 'עיר' },
    teacherName: 'שם המורה',
    teacherNamePlaceholder: 'שם פרטי ושם משפחה',
    city: 'עיר',
    cityPlaceholder: 'בחר עיר',
    noCities: 'אין ערים עדיין — הוסף עיר',
    saveTeacher: 'הוספת מורה',
    cityName: 'שם העיר',
    cityNamePlaceholder: 'לדוגמה: רעננה',
    existingCities: 'כבר קיימות',
    /** Shown in the sheet after a save, which stays open for the next one. */
    added: (name: string) => `נוסף: ${name}`,
    existingChosen: (name: string) => `${name} כבר קיים — לא נוסף מורה חדש`,
    saveCity: 'הוספת עיר',
    errors: {
      teacherNameRequired: 'יש להזין שם מורה',
      cityRequired: 'יש לבחור עיר',
      cityNameRequired: 'יש להזין שם עיר',
      cityExists: 'העיר כבר קיימת ברשימה',
    },
  },

  teacherPicker: {
    title: 'בחירת מורה',
    search: 'חיפוש או שם מורה חדש',
    createNew: (name: string) => `יצירת מורה חדש: ${name}`,
    empty: 'אין מורים רשומים בעיר זו',
    emptyHint: 'הקלד שם כדי ליצור מורה חדש',
    testsCount: (n: number) => (n === 1 ? 'מבחן אחד' : `${n} מבחנים`),
    noTests: 'ללא מבחנים',
  },

  duplicateGuard: {
    title: 'האם התכוונת למורה קיים?',
    /** e.g. "האם התכוונת ל־יעקב דפוס? (רשומים לו 4 מבחנים)" */
    question: (name: string, tests: number) =>
      `האם התכוונת ל־${name}? (${
        tests === 1 ? 'רשום לו מבחן אחד' : `רשומים לו ${tests} מבחנים`
      })`,
    questionNoTests: (name: string) => `האם התכוונת ל־${name}? (טרם נרשמו לו מבחנים)`,
    createAnyway: (name: string) => `לא, צור מורה חדש: ${name}`,
    cancel: 'ביטול',
  },

  importSheet: {
    action: 'ייבוא מאקסל',
    title: 'ייבוא מאקסל',
    intro:
      'בחר את קובץ האקסל שבו רשמת את המבחנים (xlsx, xls או csv). הקובץ צריך לכלול עמודות תאריך, עיר, שם מורה ועבר/נכשל.',
    introSheets: 'אם הקובץ בגוגל שיטס: קובץ ← הורדה ← Microsoft Excel, ואז בחר אותו כאן.',
    pick: 'בחירת קובץ',
    reading: 'קורא את הקובץ…',
    noTable: 'לא נמצאה בקובץ טבלה עם עמודות תאריך, עיר, שם מורה ועבר/נכשל',
    readFailed: 'לא ניתן לקרוא את הקובץ',
    summary: (tests: number, teachers: number) => `${tests} מבחנים · ${teachers} מורים`,
    range: (from: string, to: string) => `מ־${from} עד ${to}`,
    year: 'שנת המבחן הראשון',
    yearHint: 'בקובץ אין שנה. השנה מתקדמת מעצמה במעבר מדצמבר לינואר.',
    skipped: (n: number, rows: string) =>
      `${n === 1 ? 'שורה אחת דולגה' : `${n} שורות דולגו`} (חסר תאריך, מורה או תוצאה): ${rows}`,
    citiesTitle: 'ערים',
    citiesHint: 'אפשר לתקן שם עיר — כל המורים שלה יירשמו תחת השם המתוקן.',
    cityCount: (n: number) => (n === 1 ? 'מבחן אחד' : `${n} מבחנים`),
    newCity: 'חדשה',
    pairsTitle: 'אותו מורה?',
    pairsHint: 'שמות דומים באותה עיר. רק אתה יודע אם זה אותו אדם — שום דבר לא מאוחד בלי אישורך.',
    inApp: 'כבר באפליקציה',
    same: 'אותו מורה',
    different: 'מורים שונים',
    undecided: (n: number) => (n === 1 ? 'נותרה החלטה אחת' : `נותרו ${n} החלטות`),
    run: (n: number) => `ייבוא ${n} מבחנים`,
    doneTitle: 'הייבוא הושלם',
    done: (tests: number, teachers: number) =>
      `נוספו ${tests} מבחנים ו־${teachers} מורים חדשים.`,
    doneSkipped: (n: number) =>
      `${n} מבחנים כבר היו באפליקציה ולא נוספו שוב.`,
    close: 'סיום',
  },

  exportCsv: {
    action: 'ייצוא לאקסל (CSV)',
    title: 'ייצוא מבחנים',
    failed: 'הייצוא נכשל. נסה שוב',
    columns: { date: 'תאריך', teacher: 'מורה', city: 'עיר', result: 'תוצאה' },
  },

  editTest: {
    title: 'עריכת מבחן',
    save: 'שמירת שינויים',
    delete: 'מחיקת מבחן',
    deleteConfirmTitle: 'מחיקת מבחן',
    deleteConfirmBody: 'למחוק את המבחן? לא ניתן לבטל.',
  },

  /** Copyright line under the main screen's action bar. */
  footer: (version: string) => `© 2026 KhTech · גרסה ${version}`,

  common: {
    cancel: 'ביטול',
    delete: 'מחיקה',
    close: 'סגירה',
    error: 'שגיאה',
  },
} as const;
