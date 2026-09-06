import type { AILanguage } from './types'

/**
 * Single source of truth for "what can this app do?".
 * Used by the offline local AI to answer onboarding, feature-explanation and
 * security questions WITHOUT hallucinating — only facts that match the real
 * app are listed here. Keep it in sync when features change.
 */

export type FeatureKnowledge = {
  id: string
  keywords: string[]
  titleEn: string
  titleUr: string
  whatEn: string
  whatUr: string
  howEn: string
  howUr: string
  examplesEn: string[]
  examplesUr: string[]
  fieldsEn: string[]
  fieldsUr: string[]
  page: string
}

export const FEATURES: FeatureKnowledge[] = [
  {
    id: 'getting-started',
    keywords: ['get started', 'getting started', 'start using', 'open khata', 'khata khol', 'khata khul', 'khata kese', 'khata kaise', 'open my khata', 'naya khata', 'نیا کھاتہ', 'کھاتہ کھولیں', 'شروع سے', 'شروع کیسے', 'how to start'],
    titleEn: 'Getting started — opening your khata',
    titleUr: 'شروع کرنا — اپنا کھاتہ کھولنا',
    whatEn:
      'Digital Khata is an offline-first udhaar ledger and business assistant for shopkeepers. Your customers, credit, payments, sales, products and profit stay in one place on this device — it works even without internet.',
    whatUr:
      'ڈیجیٹل خاتہ دکانداروں کے لیے آف لائن اُدھار کھاتہ اور کاروباری معاون ہے۔ آپ کے گاہک، ادھار، وصولی، فروخت، مصنوعات اور منافع سب ایک جگہ محفوظ رہتے ہیں — انٹرنیٹ کے بغیر بھی چلتا ہے۔',
    howEn:
      '1. Add your first customer on the Customers page (or say: "Add new customer Ahmed").\n2. Record credit given on the Udhaar page (or say: "Give 5000 credit to Ahmed").\n3. Record payments when a customer pays (or say: "Receive 2000 payment from Ahmed").\n4. Log your daily sales on the Sales page (or say: "Record sale 3000").\n5. Check Reports and export PDFs whenever you need.',
    howUr:
      '1. گاہک صفحے پر اپنا پہلا گاہک شامل کریں (یا کہیں: "نیا گاہک احمد")\n2. ادھار صفحے پر دیا گیا ادھار لکھیں (یا کہیں: "احمد کو 5000 ادھار دو")\n3. گاہک کی ادائیگی وصول کریں (یا کہیں: "احمد کی 2000 ادائیگی لے لو")\n4. فروخت صفحے پر روزانہ فروخت لکھیں (یا کہیں: "3000 کی فروخت لکھو")\n5. رپورٹس دیکھیں اور ضرورت پر PDF بنائیں۔',
    examplesEn: ['Ask: "What can this app do?"', 'Say: "How do I open my khata?"'],
    examplesUr: ['پوچھیں: "یہ ایپ کیا کرتی ہے؟"', 'کہیں: "میں کھاتہ کیسے کھولوں؟"'],
    fieldsEn: [],
    fieldsUr: [],
    page: '/dashboard',
  },
  {
    id: 'customers',
    keywords: ['customer', 'customers', 'گاہک', 'گاہکوں', 'client', 'clients'],
    titleEn: 'Customers',
    titleUr: 'گاہک',
    whatEn:
      'Keep every customer with their name, phone, address and CNIC. Add, edit, delete or restore customers anytime — balances update automatically.',
    whatUr:
      'ہر گاہک کا نام، فون نمبر، پتہ اور شناختی کارڈ محفوظ رکھیں۔ گاہک شامل کریں، ترمیم کریں، حذف یا بحال کریں — بیلنس خود اپ ڈیٹ ہوتا ہے۔',
    howEn:
      'Go to Customers and tap Add. You can also tell me: "Add new customer Ahmed" and I will prepare it for you.',
    howUr:
      'گاہک صفحے پر جائیں اور شامل کریں پر دبائیں۔ یا مجھ سے کہیں: "نیا گاہک احمد شامل کرو" اور میں تیار کر دوں گی۔',
    examplesEn: ['"Add new customer Ahmed"', '"What is Ahmed\'s address?"'],
    examplesUr: ['"نیا گاہک احمد شامل کرو"', '"احمد کا پتہ کیا ہے؟"'],
    fieldsEn: [
      '• Name — required. The customer\'s full name, e.g. "Ahmed Khan".',
      '• Phone — optional. Write it like 03XX XXXXXXX, e.g. 03011234567.',
      '• Address — optional. Street, city or area, e.g. "Shop 4, Lyari, Karachi".',
      '• Initial Udhaar — optional. Only if the new customer already owes you: enter an Amount (e.g. 5000) and a Description (e.g. "Rice, 20kg").',
    ],
    fieldsUr: [
      '• نام — ضروری۔ گاہک کا مکمل نام، مثلاً "احمد خان"۔',
      '• فون — اختیاری۔ اس طرح لکھیں 03XX XXXXXXX، مثلاً 03011234567۔',
      '• پتہ — اختیاری۔ گلی، شہر یا علاقہ، مثلاً "دکان 4، لیاری، کراچی"۔',
      '• ابتدائی ادھار — اختیاری۔ صرف اگر نیا گاہک پہلے سے مقروض ہے: رقم (مثلاً 5000) اور وضاحت (مثلاً "چاول، 20 کلو")۔',
    ],
    page: '/customers',
  },
  {
    id: 'udhaar',
    keywords: ['udhaar', 'udaar', 'udhar', 'credit', 'ادھار', 'قرض', 'بقایا'],
    titleEn: 'Udhaar (credit)',
    titleUr: 'ادھار',
    whatEn:
      'Record credit given to a customer, optionally with items and a due date. Outstanding balance is tracked automatically per customer.',
    whatUr:
      'گاہک کو دیا گیا ادھار ریکارڈ کریں — اشیاء اور واپسی کی تاریخ کے ساتھ۔ بقایا بیلنس ہر گاہک کے لیے خود بنتا ہے۔',
    howEn:
      'On the Udhaar page pick a customer, enter items and amount, and save. Or tell me: "Give 5000 credit to Ahmed" and review my proposal.',
    howUr:
      'ادھار صفحے پر گاہک منتخب کریں، رقم درج کریں اور محفوظ کریں۔ یا کہیں: "احمد کو 5000 ادھار دو" اور میری تجویز دیکھیں۔',
    examplesEn: ['"Ahmed ka balance" / "Ahmed balance"', '"Give 5000 credit to Ahmed"'],
    examplesUr: ['"احمد کا بیلنس بتاؤ"', '"احمد کو 5000 ادھار دو"'],
    fieldsEn: [
      '• Customer — required. Pick from your customer list.',
      '• Description — what the credit is for, e.g. "Grocery items".',
      '• Credit Amount — the total amount given, e.g. 5000.',
      '• Due Date — optional. When you expect payment back.',
    ],
    fieldsUr: [
      '• گاہک — ضروری۔ اپنی فہرست میں سے منتخب کریں۔',
      '• وضاحت — ادھار کس چیز کا ہے، مثلاً "گروسری اشیاء"۔',
      '• ادھار کی رقم — کل رقم، مثلاً 5000۔',
      '• واپسی کی تاریخ — اختیاری۔ ادائیگی کب متوقع ہے۔',
    ],
    page: '/udhaar',
  },
  {
    id: 'payments',
    keywords: ['payment', 'payments', 'وصولی', 'ادائیگی', 'ادائیگیاں', 'collect', 'receive payment'],
    titleEn: 'Payments (vussoli)',
    titleUr: 'ادائیگی اور وصولی',
    whatEn:
      'Record payments received — Cash, Bank Transfer, JazzCash or Easypaisa. Each payment reduces the customer\'s outstanding instantly.',
    whatUr:
      'وصول شدہ ادائیگی ریکارڈ کریں — نقد، بینک ٹرانسفر، جاز کیش یا ایزی پیسہ۔ ہر ادائیگی سے گاہک کا بقایا فوراً کم ہو جاتا ہے۔',
    howEn:
      'On the Payments page pick the customer, method and amount. Or tell me: "Receive 2000 payment from Ahmed".',
    howUr:
      'ادائیگی صفحے پر گاہک، طریقہ اور رقم منتخب کریں۔ یا کہیں: "احمد کی 2000 ادائیگی وصول کر لو"۔',
    examplesEn: ['"Receive 2000 payment from Ahmed"', '"How much has Ahmed paid?"'],
    examplesUr: ['"احمد کی 2000 ادائیگی وصول کر لو"', '"احمد نے کتنی ادائیگی کی؟"'],
    fieldsEn: [
      '• Customer — required. Who is paying.',
      '• Against Udhaar — optional. Link to a specific credit entry if you want.',
      '• Amount — how much was received, e.g. 2000.',
      '• Method — Cash, Bank Transfer, JazzCash or Easypaisa.',
      '• Date — defaults to today.',
    ],
    fieldsUr: [
      '• گاہک — ضروری۔ کون ادائیگی کر رہا ہے۔',
      '• کس ادھار کے خلاف — اختیاری۔ کسی خاص ادھار سے جوڑنا ہو۔',
      '• رقم — کتنی وصول ہوئی، مثلاً 2000۔',
      '• طریقہ — کیش، بینک ٹرانسفر، جاز کیش یا ایزی پیسہ۔',
      '• تاریخ — خود آج کی ہوتی ہے۔',
    ],
    page: '/payments',
  },
  {
    id: 'sales',
    keywords: ['sale', 'sales', 'فروخت', 'سیل', 'sold'],
    titleEn: 'Sales',
    titleUr: 'فروخت',
    whatEn:
      'Log your daily sales, optionally with items and a linked customer. View summaries by day, week or month.',
    whatUr:
      'روزانہ فروخت لکھیں — اشیاء اور گاہک کے ساتھ۔ دن، ہفتے یا مہینے کی فروخت کے خلاصے دیکھیں۔',
    howEn:
      'On the Sales page enter the amount (and items) and save. Or tell me: "Record sale 3000".',
    howUr:
      'فروخت صفحے پر رقم (اور اشیاء) درج کریں اور محفوظ کریں۔ یا کہیں: "3000 کی فروخت لکھو"۔',
    examplesEn: ['"Record sale 3000"', '"This month sales"', '"Yesterday ki sales"'],
    examplesUr: ['"3000 کی فروخت لکھو"', '"اس مہینے کی فروخت کتنی ہے؟"', '"کل کی فروخت بتاؤ"'],
    fieldsEn: [
      '• Customer — optional. A known customer, or leave blank for a walk-in sale.',
      '• Description — required. What was sold, e.g. "Bulk order".',
      '• Amount — total sale. Or pick saved products with quantity and the total adds up automatically.',
      '• Date — defaults to today.',
    ],
    fieldsUr: [
      '• گاہک — اختیاری۔ معلوم گاہک، یا عام (واک اِن) فروخت کے لیے خالی چھوڑیں۔',
      '• وضاحت — ضروری۔ کیا بکا، مثلاً "بلک آرڈر"۔',
      '• رقم — کل فروخت۔ یا محفوظ مصنوعات اور مقدار منتخب کریں، کل خود بنتا ہے۔',
      '• تاریخ — خود آج کی ہوتی ہے۔',
    ],
    page: '/sales',
  },
  {
    id: 'products',
    keywords: ['product', 'products', 'inventory', 'stock', 'مصنوعات', 'انویںٹری', 'انوینٹری', 'اسٹاک', 'اشیاء کی فہرست', 'مال'],
    titleEn: 'Products & inventory',
    titleUr: 'مصنوعات اور اسٹاک',
    whatEn:
      'Maintain a product list with rate, cost price and stock. Stock drops automatically when you record a sale, and low-stock items (5 or fewer) are highlighted.',
    whatUr:
      'مصنوعات کی فہرست رکھیں — ریٹ، لاگت اور اسٹاک کے ساتھ۔ فروخت لکھنے پر اسٹاک خود کم ہوتا ہے اور کم اسٹاک والی اشیاء نمایاں ہوتی ہیں۔',
    howEn:
      'Go to Products, add a product with its rate, cost and stock. When recording a sale, saved products appear with autocomplete and stock is reduced automatically.',
    howUr:
      'مصنوعات صفحے پر جائیں اور ریٹ، لاگت اور اسٹاک کے ساتھ شامل کریں۔ فروخت لکھتے وقت محفوظ مصنوعات خود ظاہر ہوتی ہیں اور اسٹاک خود کم ہوتا ہے۔',
    examplesEn: ['"Show me products page"', '"What is stock?"', '"Add product Sugar"'],
    examplesUr: ['"مصنوعات کا صفحہ کھولو"', '"اسٹاک کیا ہے؟"'],
    fieldsEn: [
      '• Name — product name, e.g. "Basmati Rice".',
      '• Rate — selling price per unit.',
      '• Cost price — your purchase price (used to calculate profit).',
      '• Stock — quantity you have; 5 or fewer shows a low-stock warning.',
      'Tip: recording a sale later reduces stock automatically.',
    ],
    fieldsUr: [
      '• نام — مصنوعات کا نام، مثلاً "بسمتی چاول"۔',
      '• ریٹ — فی عدد فروخت کی قیمت۔',
      '• لاگت — آپ کی خرید کی قیمت (منافع کے حساب کے لیے)۔',
      '• اسٹاک — موجود مقدار؛ 5 یا کم پر کم اسٹاک کی نشان دہی ہوتی ہے۔',
      'نوٹ: بعد میں فروخت لکھنے پر اسٹاک خود کم ہو جاتا ہے۔',
    ],
    page: '/products',
  },
  {
    id: 'profit',
    keywords: ['profit', 'loss', 'munafa', 'نفع', 'منافع', 'نقصان', 'margin', 'cost price', 'لاگت'],
    titleEn: 'Profit & cost tracking',
    titleUr: 'منافع اور لاگت',
    whatEn:
      'With a cost price on each product you can see margin %, profit from recorded sales (sold revenue minus cost), and potential profit on stock.',
    whatUr:
      'ہر مصنوعات کی لاگت درج کرنے پر منافع کی شرح، فروخت سے حاصل منافع اور اسٹاک پر ممکنہ منافع نظر آتا ہے۔',
    howEn:
      'Add a cost price on each product. Profit cards appear on the Dashboard and Products pages.',
    howUr:
      'ہر مصنوعات پر لاگت درج کریں۔ منافع کے کارڈز ڈیش بورڈ اور مصنوعات صفحے پر نظر آتے ہیں۔',
    examplesEn: ['"What is my profit?"', '"Which product has the best margin?"'],
    examplesUr: ['"میرا منافع کتنا ہے؟"', '"کس مصنوعات کا منافع سب سے زیادہ ہے؟"'],
    fieldsEn: [
      '• Product form — the Cost price field is what feeds profit: fill it when adding/editing each product.',
      '• Then profit cards appear on the Dashboard and Products pages — no extra entry needed.',
    ],
    fieldsUr: [
      '• مصنوعات کے فارم میں "لاگت" کا خانہ منافع کا ذریعہ ہے— ہر مصنوعات میں بھریں۔',
      '• پھر منافع کے کارڈ ڈیش بورڈ اور مصنوعات صفحات پر خود نظر آتے ہیں — مزید اندراج کی ضرورت نہیں۔',
    ],
    page: '/products',
  },
  {
    id: 'reports',
    keywords: ['report', 'reports', 'رپورٹ', 'رپورٹس', 'summary'],
    titleEn: 'Reports',
    titleUr: 'رپورٹس',
    whatEn:
      'Daily, weekly and monthly reports, plus outstanding and received-payments reports. All can be exported as PDF.',
    whatUr:
      'روزانہ، ہفتہ وار اور ماہانہ رپورٹس، بقایا اور وصولی کی رپورٹس — سب کو PDF کے طور پر نکال سکتے ہیں۔',
    howEn:
      'Open Reports, pick a period and type. Each report has a PDF download button.',
    howUr:
      'رپورٹس کھولیں، مدت اور قسم منتخب کریں۔ ہر رپورٹ کے ساتھ PDF ڈاؤن لوڈ کا بٹن ہے۔',
    examplesEn: ['"Today\'s report"', '"Outstanding report"', '"Weekly report"'],
    examplesUr: ['"آج کی رپورٹ"', '"بقایا رپورٹ"', '"ہفتے کی رپورٹ"'],
    fieldsEn: [
      '• Period — Daily, Weekly or Monthly.',
      '• Type — summary, outstanding, received payments, or customer report.',
      '• Every report shows totals and has a PDF download button.',
    ],
    fieldsUr: [
      '• مدت — روزانہ، ہفتہ یا مہینہ۔',
      '• قسم — خلاصہ، بقایا، وصولی، یا گاہک رپورٹ۔',
      '• ہر رپورٹ میں کل رقم اور PDF بٹن ہے۔',
    ],
    page: '/reports',
  },
  {
    id: 'receipts-pdf',
    keywords: ['receipt', 'receipts', 'thermal', 'print', 'pdf', 'invoice', 'رسیٹ', 'پرنٹ', 'پیرچی'],
    titleEn: 'Receipts & PDF exports',
    titleUr: 'رسیٹ اور PDF',
    whatEn:
      'Print 80mm thermal-style receipts for udhaar and sales, and export stylish PDF reports — cashbook, reports, top items and products & profit.',
    whatUr:
      'ادھار اور فروخت کے لیے 80mm پرنٹ رسیٹ نکالیں، اور خوبصورت PDF رپورٹس بنائیں — کیش بک، رپورٹس، اشیاء اور مصنوعات و منافع۔',
    howEn:
      'On receipt-friendly pages (Udhaar, Sales) tap the receipt/print button. On Reports and Products pages use the PDF download button.',
    howUr:
      'ادھار اور فروخت کے صفحات پر رسیٹ/پرنٹ بٹن دبائیں۔ رپورٹس اور مصنوعات کے صفحات پر PDF بٹن استعمال کریں۔',
    examplesEn: ['"Print receipt"', '"Download PDF report"'],
    examplesUr: ['"رسیٹ پرنٹ کرو"', '"PDF رپورٹ ڈاؤن لوڈ کرو"'],
    fieldsEn: [
      '• No data entry — done in one tap, no fields to fill.',
      '• Receipt (80mm thermal): open the Udhaar or Sales entry and tap the receipt/print icon.',
      '• PDF: on Reports and Products pages, tap the PDF download button on a report.',
    ],
    fieldsUr: [
      '• کوئی خانہ نہیں — صرف ایک ٹیپ، انٹری کی ضرورت نہیں۔',
      '• رسیٹ (80mm): ادھار یا فروخت کے اندراج پر پرنٹ/رسیٹ آئیکن دبائیں۔',
      '• PDF: رپورٹس اور مصنوعات صفحات پر PDF ڈاؤن لوڈ بٹن۔',
    ],
    page: '/reports',
  },
  {
    id: 'reminders',
    keywords: ['reminder', 'reminders', 'whatsapp', 'sms', 'یاد دہانی', 'یاد دلاؤ', 'پیغام بھیج'],
    titleEn: 'Reminders (WhatsApp/SMS)',
    titleUr: 'یاد دہانی (واٹس ایپ/ایس ایم ایس)',
    whatEn:
      'Send a payment reminder to a customer via WhatsApp or SMS with their outstanding balance pre-filled.',
    whatUr:
      'گاہک کو بقایا کی یاد دہانی واٹس ایپ یا ایس ایم ایس کے ذریعے بھیجیں — رقم پیغام میں پہلے سے موجود ہوتی ہے۔',
    howEn:
      'Open Reminders, pick a customer and channel. Or tell me: "Send reminder to Ahmed" and I will open it for preview.',
    howUr:
      'یاد دہانی صفحے پر گاہک اور طریقہ منتخب کریں۔ یا کہیں: "احمد کو یاد دہانی بھیجو" اور میں پیش کر دوں گی۔',
    examplesEn: ['"Send reminder to Ahmed"', '"Which customers are overdue?"'],
    examplesUr: ['"احمد کو یاد دہانی بھیجو"', '"کس کے ادھار تاخیر شدہ ہیں؟"'],
    fieldsEn: [
      '• Customer — pick who to remind, or use "remind all overdue" for all at once.',
      '• Channel — WhatsApp or SMS.',
      '• Message is pre-filled with the name and due amount — preview before sending.',
    ],
    fieldsUr: [
      '• گاہک — جسے یاد دلانا ہے منتخب کریں، یا "سب مقروضہ کو یاد دلاؤ"۔',
      '• طریقہ — واٹس ایپ یا ایس ایم ایس۔',
      '• پیغام نام اور رقم کے ساتھ خود تیار ہوتا ہے — بھیجنے سے پہلے دیکھ لیں۔',
    ],
    page: '/reminders',
  },
  {
    id: 'ai-voice',
    keywords: ['voice', 'speak', 'type', 'assistant', 'ai', 'بات', 'آواز', 'بولیں', 'ٹائپ'],
    titleEn: 'AI Assistant (voice & text)',
    titleUr: 'ایکسی آسستانٹ (آواز اور ٹیکسٹ)',
    whatEn:
      'I am Khata AI. Ask in English or Urdu — by typing or speaking — to get balances, record payments, credit and sales, view reports and open pages.',
    whatUr:
      'میں خاتہ AI ہوں۔ انگریزی یا اردو میں ٹائپ یا بول کر بیلنس پوچھیں، ادائیگی، ادھار اور فروخت ریکارڈ کریں، رپورٹ دیکھیں اور صفحے کھولیں۔',
    howEn:
      'Tap the microphone in the AI chat and speak, or type your request. Examples: "Ahmed balance", "Receive 2000 payment from Ahmed", "This month sales".',
    howUr:
      'اے آئی چیٹ میں مائیکروفون دبائیں اور بولیں، یا لکھیں۔ مثالیں: "احمد کا بیلنس"، "احمد کی 2000 ادائیگی لے لو"، "اس مہینے کی فروخت"۔',
    examplesEn: ['"Ahmed balance"', '"Business overview"', '"Overdue customers"'],
    examplesUr: ['"احمد کا بیلنس"', '"کاروبار کا جائزہ"', '"تاخیر شدہ گاہک"'],
    fieldsEn: [
      '• No form — just tap the mic and speak, or type your question.',
      '• Example: "Ahmed ka balance" → instantly answers from your khata.',
      '• Tip: I answer offline for common requests; harder questions use a secure cloud AI.',
    ],
    fieldsUr: [
      '• کوئی فارم نہیں — مائیک دبائیں اور بولیں، یا لکھ دیں۔',
      '• مثال: "احمد کا بیلنس" → فوراً آپ کے کھاتے سے جواب۔',
      '• نوٹ: عام سوالات آف لائن فوراً جواب ہوتے ہیں؛ مشکل سوالات محفوظ کلاؤڈ AI سے۔',
    ],
    page: '/ai',
  },
  {
    id: 'settings',
    keywords: ['settings', 'settings', 'setting', 'profile', 'shop name', 'theme', 'language', 'notification', 'ترتیبات', 'پروفائل', 'تھیم', 'زبان', 'فونٹ'],
    titleEn: 'Settings & profile',
    titleUr: 'ترتیبات اور پروفائل',
    whatEn:
      'Update your profile and shop name, switch the app language (English/Urdu), pick a light or dark theme, and control notification preferences.',
    whatUr:
      'اپنا پروفائل اور دکان کا نام اپ ڈیٹ کریں، ایپ کی زبان بدلیں (انگریزی/اردو)، لائٹ یا ڈارک تھیم منتخب کریں اور نوٹیفکیشنز کنٹرول کریں۔',
    howEn:
      'Open Settings. Every option is a simple tap; you can also ask me to switch language or theme.',
    howUr:
      'ترتیبات کھولیں۔ ہر آپشن ایک ٹیپ ہے؛ زبان یا تھیم بدلنے کے لیے مجھ سے بھی کہہ سکتے ہیں۔',
    examplesEn: ['"Open settings"', '"Switch to dark theme"', '"Change language to Urdu"'],
    examplesUr: ['"ترتیبات کھولو"', '"ڈارک تھیم کر دو"', '"زبان اردو کرو"'],
    fieldsEn: [
      '• Profile — your name and shop name.',
      '• PIN Lock — set a 4+ digit PIN to protect the app (optional).',
      '• Language — English or Urdu.',
      '• Theme — light or dark.',
      '• Notifications — on/off for summaries and reminders.',
    ],
    fieldsUr: [
      '• پروفائل — آپ کا نام اور دکان کا نام۔',
      '• PIN لاک — 4+ ہندسوں کا PIN (اختیاری) ایپ کی حفاظت کے لیے۔',
      '• زبان — انگریزی یا اردو۔',
      '• تھیم — لائٹ یا ڈارک۔',
      '• نوٹیفکیشن — خلاصوں اور یاد دہانیوں کا آن/آف۔',
    ],
    page: '/settings',
  },
  {
    id: 'security',
    keywords: ['secure', 'security', 'safe', 'safety', 'privacy', 'private', 'pin', 'lock', 'محفوظ', 'سیکورٹی', 'پرائیویسی', 'پن', 'چھپا'],
    titleEn: 'Security & privacy',
    titleUr: 'سیکورٹی اور پرائیویسی',
    whatEn:
      'Your data stays on your device. An optional PIN lock protects the app, passwords are stored hashed, financial answers only come from your own khata, and your data is never shared or sold.',
    whatUr:
      'آپ کا ڈیٹا آپ کی ڈیوائس پر رہتا ہے۔ اختیاری PIN لاک ایپ کی حفاظت کرتا ہے، پاس ورڈ محفوظ طریقے سے رکھے جاتے ہیں، صرف آپ کے اپنے خاتے کے اعداد بتائے جاتے ہیں، اور ڈیٹا شیئر یا فروخت نہیں کیا جاتا۔',
    howEn:
      'Turn on the PIN lock from Settings. Never share your PIN or account password with anyone — I will never ask you for it.',
    howUr:
      'ترتیبات سے PIN لاک چالو کریں۔ اپنا PIN یا پاس ورڈ کسی کو نہ دیں — میں کبھی نہیں پوچھوں گی۔',
    examplesEn: ['"Is my data safe?"', '"How do I set a PIN lock?"'],
    examplesUr: ['"کیا میرا ڈیٹا محفوظ ہے؟"', '"PIN لاک کیسے لگاؤں؟"'],
    fieldsEn: [
      '• Settings → PIN Lock — the only field you ever set for security.',
      '• No personal information is ever asked for — never share your PIN or password.',
    ],
    fieldsUr: [
      '• ترتیبات → PIN لاک — سیکورٹی کے لیے صرف یہی خانہ بھرنا ہے۔',
      '• کوئی ذاتی معلومات نہیں مانگی جاتی — PIN یا پاس ورڈ کبھی کسی کو نہ دیں۔',
    ],
    page: '/settings',
  },
  {
    id: 'offline-sync',
    keywords: ['offline', 'online', 'sync', 'cloud', 'backup', 'آف لائن', 'آن لائن', 'سنک', 'بیک اپ', 'کلاؤڈ'],
    titleEn: 'Offline & cloud sync',
    titleUr: 'آف لائن اور کلاؤڈ سنک',
    whatEn:
      'The app works fully offline — records, reports and AI answers run on the device. With an account you can sync to the cloud and log in from another device.',
    whatUr:
      'ایپ مکمل آف لائن چلتی ہے — ریکارڈ، رپورٹس اور AI جوابات ڈیوائس پر بنتے ہیں۔ اکاؤنٹ کے ذریعے کلاؤڈ سنک کر کے کسی بھی ڈیوائس سے لاگ ان ہو سکتے ہیں۔',
    howEn:
      'Use normally with no internet. To sync, create/log in with your account on the welcome screen; sync happens automatically when online.',
    howUr:
      'بغیر انٹرنیٹ کے معمول کے مطابق استعمال کریں۔ سنک کے لیے ویلکم اسکرین پر اکاؤنٹ بنائیں/لاگ ان کریں؛ آن لائن ہونے پر سنک خود ہو جاتا ہے۔',
    examplesEn: ['"Does this work offline?"', '"Where is my data stored?"'],
    examplesUr: ['"کیا یہ آف لائن چلتا ہے؟"', '"میرا ڈیٹا کہاں رہتا ہے؟"'],
    fieldsEn: [
      '• No form — the app simply works offline with nothing to configure.',
      '• To sync: log in / create an account on the welcome screen; sync is automatic when online.',
    ],
    fieldsUr: [
      '• کوئی فارم نہیں — ایپ بغیر کسی ترتیب کے آف لائن چلتی ہے۔',
      '• سنک کے لیے: ویلکم اسکرین پر اکاؤنٹ سے لاگ ان کریں؛ آن لائن ہونے پر سنک خود ہو جاتا ہے۔',
    ],
    page: '/settings',
  },
]

export function explainFeature(input: string): FeatureKnowledge | undefined {
  const norm = input.toLowerCase()
  return FEATURES.find((f) => f.keywords.some((k) => norm.includes(k)))
}

export function isSecurityQuestion(input: string): boolean {
  const norm = input.toLowerCase()
  return (
    norm.includes('data safe') || norm.includes('is this secure') || norm.includes('is it safe') ||
    norm.includes('privacy') || norm.includes('secure') || norm.includes('محفوظ') ||
    norm.includes('سیکورٹی') || norm.includes('اسپائی') || norm.includes('نجی')
  )
}

export function formatFeature(f: FeatureKnowledge, language: AILanguage): string {
  const title = language === 'ur' ? f.titleUr : f.titleEn
  const what = language === 'ur' ? f.whatUr : f.whatEn
  const how = language === 'ur' ? f.howUr : f.howEn
  const examples = language === 'ur' ? f.examplesUr : f.examplesEn
  const fields = language === 'ur' ? f.fieldsUr : f.fieldsEn

  const lines = [`${title} (${f.page})`, '', what, '', how]
  if (fields.length > 0) {
    lines.push('', language === 'ur' ? 'فیلڈز اور کیا لکھیں:' : 'Fields & what to enter:')
    fields.forEach((line) => lines.push(line))
  }
  if (examples.length > 0) {
    lines.push('', language === 'ur' ? 'آزمائیں:' : 'Try:')
    examples.forEach((ex) => lines.push(`• ${ex}`))
  }
  return lines.join('\n')
}

export function appOverview(language: AILanguage): string {
  if (language === 'ur') {
    return [
      'ڈیجیٹل خاتہ دکانداروں کے لیے ایک آف لائن اُدھار کھاتہ اور کاروباری ایپ ہے۔',
      'ایک جگہ رکھیں: گاہک، ادھار، وصولی، روزانہ فروخت، مصنوعات اور اسٹاک، اور منافع — انٹرنیٹ کے بغیر بھی۔',
      '',
      'کیا کیا جا سکتا ہے:',
      '• گاہک: شامل، ترمیم، حذف، بحال (فون، پتہ، شناختی کارڈ)',
      '• ادھار: اشیاء اور واپسی کی تاریخ کے ساتھ ادھار لکھیں، بقایا خود بنتا ہے',
      '• وصولی: کیش، بینک ٹرانسفر، جاز کیش، ایزی پیسہ',
      '• فروخت: روزانہ فروخت، دن/ہفتہ/مہینہ کے خلاصے',
      '• مصنوعات و اسٹاک: ریٹ، لاگت، اسٹاک؛ کم اسٹاک کی خبر؛ فروخت پر اسٹاک خود کم',
      '• منافع: لاگت سے منافع کی شرح اور منافع',
      '• رپورٹس اور PDF: روزانہ/ہفتہ/مہینہ، بقایا، وصولی، اشیاء — خوبصورت PDF اور رسیٹ',
      '• یاد دہانی: واٹس ایپ یا ایس ایم ایس پر بقایا کی یاد دہانی',
      '• اے آئی اسسٹنٹ: انگریزی یا اردو میں ٹائپ یا بول کر سب کریں',
      '• ترتیبات: پروفائل، دکان کا نام، PIN لاک، زبان، تھیم، نوٹیفکیشن',
      '',
      'کیا سیکھنا چاہیں گے کہ کھاتہ کیسے کھولیں؟ بس کہیں: "کھاتہ کیسے کھولوں؟"',
    ].join('\n')
  }
  return [
    'Digital Khata is an offline-first udhaar ledger and business assistant for shopkeepers.',
    'One place for: customers, credit given, payments received, daily sales, products & stock, and profit — it works even without internet.',
    '',
    'What you can do:',
    '• Customers: add, edit, delete, restore (phone, address, CNIC)',
    '• Udhaar: record credit with items and a due date; outstanding is tracked automatically',
    '• Payments: Cash, Bank Transfer, JazzCash or Easypaisa',
    '• Sales: log daily sales, view day/week/month summaries',
    '• Products & stock: rate, cost, stock; low-stock alerts; stock drops when a sale is recorded',
    '• Profit: cost price gives you margin % and profit from sales',
    '• Reports & PDFs: daily/weekly/monthly, outstanding, received, items — plus PDF exports and receipts',
    '• Reminders: send WhatsApp or SMS payment reminders',
    '• AI Assistant: ask in English or Urdu — type or speak',
    '• Settings: profile, shop name, PIN lock, language, theme, notifications',
    '',
    'Want to learn how to open your khata? Just ask: "How do I open my khata?"',
  ].join('\n')
}

export function securityAwareness(language: AILanguage): string {
  if (language === 'ur') {
    return [
      'آپ کا ڈیٹا محفوظ ہے:',
      '• ڈیٹا آپ کی اپنی ڈیوائس پر رہتا ہے، خریدا یا شیئر نہیں جاتا',
      '• اختیاری PIN لاک ایپ کو بند آنکھوں سے چھپا کر رکھتا ہے (ترتیبات سے)',
      '• آپ کا پاس ورڈ محفوظ ہیش میں رکھا جاتا ہے — سادہ متن میں کہیں نہیں',
      '• مالی جوابات صرف آپ کے اپنے خاتے کے ریکارڈ سے آتے ہیں',
      '• میں کبھی آپ کا PIN یا پاس ورڈ نہیں پوچھوں گی — اگر کوئی پوچھے تو مت بتائیں',
    ].join('\n')
  }
  return [
    'Your data is safe:',
    '• Data stays on your device and is never sold or shared',
    '• An optional PIN lock protects the app from prying eyes (turn it on in Settings)',
    '• Your password is stored as a secure hash — never in plain text',
    '• Financial answers only come from your own khata records',
    '• I will never ask for your PIN or password — do not share them with anyone who asks',
  ].join('\n')
}