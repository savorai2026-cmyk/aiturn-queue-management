# Featurn

מערכת SaaS רב־עסקית לניהול תורים. מנהלי עסקים עובדים דרך ממשק React,
ולקוחות יקבעו תורים בהמשך דרך סוכן קולי או סוכן WhatsApp.

## הרצה מקומית

דרישות:

- Node.js
- פרויקט Supabase
- קובץ `.env` עם `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`

```bash
npm install
npm run dev
```

## פריסה ל-Google Cloud Run

האתר הוא SPA סטטי. בקונסול של השותף הוא יושב ליד שרת ה-Flask, בפרויקט
`savorai-497807`, אזור `europe-west1`.

חד-פעמי במחשב שיש בו `gcloud` ומחובר לחשבון של הפרויקט:

```bash
gcloud config set project savorai-497807
gcloud run deploy featurn-web \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VITE_SUPABASE_URL=https://pcslxlckklfmkaskkbry.supabase.co,VITE_SUPABASE_ANON_KEY=PUT_ANON_KEY_HERE
```

אחרי הפריסה הראשונה, להעתיק את כתובת השירות
(`https://featurn-web-....run.app`) ולהוסיף אותה ב-Supabase:
Authentication → URL Configuration → Redirect URLs
(`https://featurn-web-....run.app/**`).

את מפתח ה-anon שמים כמשתנה סביבה ב-Cloud Run, לא בקוד. הוא אותו ערך כמו
`VITE_SUPABASE_ANON_KEY` בקובץ `.env` המקומי.

בדיקות איכות:

```bash
npm run build
npm run lint
npm test
```

## מבנה הפרויקט

```text
src/
├── features/
│   ├── appointments/  # תורים, יומן, מיפוי ל-FullCalendar
│   ├── auth/          # session, כניסה והרשמה
│   ├── business/      # העסק הפעיל ו-onboarding
│   ├── clients/       # לקוחות
│   └── settings/      # הגדרות עסק ושירותים
├── components/        # רכיבי UI קיימים; מועברים לפיצ'רים בהדרגה
├── shared/            # hooks ורכיבים שאינם שייכים לדומיין יחיד
├── types/
│   └── database.ts    # נוצר אוטומטית מסכמת Supabase
├── App.tsx            # providers ומעטפת הניווט
└── supabaseClient.ts  # מופע Supabase יחיד ומטופס
```

## כללי ארכיטקטורה

כל פיצ'ר מחולק לפי אחריות:

- `*.types.ts` — טיפוסי domain וטיפוסים שמקורם במסד.
- `*.api.ts` — הגישה היחידה של הפיצ'ר ל-Supabase.
- `*.mappers.ts` — המרות בין שורות DB למודלים של המסך.
- `use*.ts` — מצב אסינכרוני, טעינה ורענון.
- `*.test.ts` — לוגיקה טהורה שניתנת לבדיקה ללא דפדפן.

רכיב React לא אמור לבנות שאילתת Supabase בעצמו. הוא משתמש ב-hook או בפונקציית
API של הפיצ'ר. כך שינוי במסד אינו מתפזר בין רכיבי UI.

`businessCode` הוא מזהה העסק הפעיל. אין להחליף אותו ב-`user.id`: משתמש ועסק
הם ישויות שונות, והקשר ביניהם מנוהל בטבלת `business_members`.

## Supabase

ההרשאות מבוססות RLS. גם אם הקוד מסנן לפי `business_code`, האבטחה חייבת
להישאר במסד הנתונים.

אחרי שינוי בסכמה יש לחדש את הטיפוסים:

```bash
npx --yes supabase gen types typescript \
  --project-id <project-ref> > src/types/database.ts
```

שינויי מסד חדשים נשמרים תחת `supabase/migrations`. אין לשים `service_role`,
טוקנים של ספקים או סודות אחרים בקוד React או בקובץ שמגיע לדפדפן.

## הערות בקוד

הקוד אמור להסביר מה הוא עושה באמצעות שמות ברורים וטיפוסים. מוסיפים הערה רק
כאשר צריך להסביר החלטה, מגבלה או סיבה שאינן ברורות מהקוד עצמו. אין להשאיר
הערות שמתארות שורה באופן מילולי או TODO ללא בעלות ותוכנית.
