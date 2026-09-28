/**
 * Every user-facing string in the app, in Hebrew, masculine grammatical forms.
 *
 * Centralised so no Hebrew literal is stranded inside a component — that keeps
 * the wording consistent and makes a future locale split a data change rather
 * than a hunt through JSX.
 */

export const strings = {
  appName: 'מבחני נהיגה',

  auth: {
    title: 'מבחני נהיגה',
    subtitle: 'מעקב אחר תוצאות מבחנים לפי מורה',
    email: 'אימייל',
    password: 'סיסמה',
    name: 'שם מלא',
    signIn: 'כניסה',
    signUp: 'הרשמה',
    toggleToSignUp: 'אין לך חשבון? הירשם',
    toggleToSignIn: 'יש לך חשבון? היכנס',
    signOut: 'התנתקות',
    signOutConfirmTitle: 'התנתקות',
    signOutConfirmBody: 'להתנתק מהחשבון?',
    errors: {
      emailRequired: 'יש להזין אימייל',
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
    teachers: 'מורים',
    newTest: 'מבחן חדש',
    teacherDetail: 'פרטי מורה',
    editTest: 'עריכת מבחן',
  },

  teachers: {
    title: 'מורים',
    search: 'חיפוש מורה',
    allCities: 'כל הערים',
    empty: 'עדיין אין מורים רשומים',
    emptyHint: 'הוסף מבחן ראשון כדי להתחיל',
    noResults: 'לא נמצאו מורים התואמים לחיפוש',
    noTests: 'אין מבחנים',
    sortBy: 'מיון',
    sort: {
      mostTests: 'הכי הרבה מבחנים',
      lowestPassRate: 'אחוז מעבר נמוך',
      recentlyTested: 'נבחנו לאחרונה',
      name: 'שם',
    },
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

  editTest: {
    title: 'עריכת מבחן',
    save: 'שמירת שינויים',
    delete: 'מחיקת מבחן',
    deleteConfirmTitle: 'מחיקת מבחן',
    deleteConfirmBody: 'למחוק את המבחן? לא ניתן לבטל.',
  },

  common: {
    cancel: 'ביטול',
    delete: 'מחיקה',
    save: 'שמירה',
    close: 'סגירה',
    error: 'שגיאה',
  },
} as const;
