import type { LegalContentMap } from '../src/controllers/legal/legal.constants';

/** Default HTML for admin-editable legal pages (en / ar / de). */
export const DEFAULT_LEGAL_CONTENT: LegalContentMap = {
  privacy: {
    en: `<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> June 2026</p>
<p>NUX ("we", "our", "us") operates the NUX guest mobile application and the nuxapp.de website. This Privacy Policy explains how we collect, use, and protect your personal data when you use our services.</p>
<h2>1. Data we collect</h2>
<ul>
<li><strong>Account data:</strong> name, email address, password (if you register with email), or information from Google Sign-In when you choose that option.</li>
<li><strong>Profile &amp; usage:</strong> restaurant visits, wallet balance, transactions, loyalty points, orders, and in-app preferences including language.</li>
<li><strong>Device data:</strong> device identifiers and push notification tokens (FCM) to deliver alerts when the app is closed.</li>
<li><strong>Location &amp; camera:</strong> only when you grant permission, for QR scanning at partner restaurants.</li>
<li><strong>Payment data:</strong> payments are processed by Stripe; we do not store full card numbers on our servers.</li>
</ul>
<h2>2. How we use your data</h2>
<p>We use your data to provide and improve NUX, authenticate you, process wallet top-ups and in-venue payments, send service notifications, prevent fraud, and comply with legal obligations.</p>
<h2>3. Legal basis (GDPR)</h2>
<p>Processing is based on contract performance, legitimate interests (security, service improvement), your consent where required (e.g. marketing notifications), and legal obligations.</p>
<h2>4. Sharing</h2>
<p>We share data only with partner restaurants when you transact with them, payment providers (Stripe), cloud hosting, and push services (Firebase/Google), and when required by law.</p>
<h2>5. Retention</h2>
<p>We retain data while your account is active and as needed for legal, tax, and dispute resolution purposes.</p>
<h2>6. Your rights</h2>
<p>You may request access, correction, deletion, or restriction of your data, and withdraw consent where applicable. Contact us at <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a>.</p>
<h2>7. Contact</h2>
<p>NUX — Email: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — Website: <a href="https://nuxapp.de">nuxapp.de</a></p>`,
    ar: `<h1>سياسة الخصوصية</h1>
<p><strong>آخر تحديث:</strong> يونيو 2026</p>
<p>تدير NUX تطبيق الضيوف وموقع nuxapp.de. توضح هذه السياسة كيفية جمع واستخدام وحماية بياناتك الشخصية عند استخدام خدماتنا.</p>
<h2>1. البيانات التي نجمعها</h2>
<ul>
<li><strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، كلمة المرور (عند التسجيل بالبريد)، أو معلومات من Google عند اختيار تسجيل الدخول بها.</li>
<li><strong>الملف والاستخدام:</strong> زيارات المطاعم، رصيد المحفظة، المعاملات، نقاط الولاء، الطلبات، وتفضيلات التطبيق بما فيها اللغة.</li>
<li><strong>بيانات الجهاز:</strong> معرّفات الجهاز ورموز الإشعارات (FCM) لإرسال التنبيهات عند إغلاق التطبيق.</li>
<li><strong>الموقع والكاميرا:</strong> فقط بإذنك، لمسح رموز QR في المطاعم الشريكة.</li>
<li><strong>المدفوعات:</strong> تُعالج عبر Stripe؛ لا نخزّن أرقام البطاقات كاملة على خوادمنا.</li>
</ul>
<h2>2. كيفية استخدام البيانات</h2>
<p>نستخدم بياناتك لتقديم NUX وتحسينه، والمصادقة، ومعالجة شحن المحفظة والمدفوعات في المطاعم، وإرسال إشعارات الخدمة، ومنع الاحتيال، والامتثال للقانون.</p>
<h2>3. الأساس القانوني (GDPR)</h2>
<p>يعتمد المعالجة على تنفيذ العقد، والمصالح المشروعة (الأمان وتحسين الخدمة)، وموافقتك عند الحاجة، والالتزامات القانونية.</p>
<h2>4. المشاركة</h2>
<p>نشارك البيانات فقط مع المطاعم الشريكة عند إجراء معاملات، ومزودي الدفع (Stripe)، والاستضافة السحابية، وخدمات الإشعارات (Firebase/Google)، وعندما يقتضي القانون ذلك.</p>
<h2>5. الاحتفاظ</h2>
<p>نحتفظ بالبيانات طالما حسابك نشط ووفقاً لمتطلبات قانونية وضريبية وتسوية النزاعات.</p>
<h2>6. حقوقك</h2>
<p>يمكنك طلب الوصول أو التصحيح أو الحذف أو تقييد المعالجة وسحب الموافقة حيث ينطبق. تواصل معنا: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a></p>
<h2>7. التواصل</h2>
<p>NUX — البريد: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — الموقع: <a href="https://nuxapp.de">nuxapp.de</a></p>`,
    de: `<h1>Datenschutzerklärung</h1>
<p><strong>Stand:</strong> Juni 2026</p>
<p>NUX betreibt die Gäste-Mobile-App und die Website nuxapp.de. Diese Datenschutzerklärung erläutert, wie wir personenbezogene Daten erheben, nutzen und schützen.</p>
<h2>1. Erhobene Daten</h2>
<ul>
<li><strong>Kontodaten:</strong> Name, E-Mail, Passwort (bei E-Mail-Registrierung) oder Angaben über Google Sign-In.</li>
<li><strong>Profil &amp; Nutzung:</strong> Restaurantbesuche, Wallet-Guthaben, Transaktionen, Treuepunkte, Bestellungen und App-Einstellungen inkl. Sprache.</li>
<li><strong>Gerätedaten:</strong> Geräte-IDs und Push-Tokens (FCM) für Benachrichtigungen bei geschlossener App.</li>
<li><strong>Standort &amp; Kamera:</strong> nur mit Ihrer Erlaubnis zum QR-Scannen in Partnerrestaurants.</li>
<li><strong>Zahlungen:</strong> über Stripe; vollständige Kartennummern speichern wir nicht.</li>
</ul>
<h2>2. Verwendung</h2>
<p>Wir nutzen Daten zur Bereitstellung und Verbesserung von NUX, Authentifizierung, Wallet-Aufladung und Zahlungen vor Ort, Service-Benachrichtigungen, Betrugsprävention und gesetzlichen Pflichten.</p>
<h2>3. Rechtsgrundlage (DSGVO)</h2>
<p>Verarbeitung auf Basis von Vertragserfüllung, berechtigten Interessen, Einwilligung wo erforderlich und gesetzlichen Verpflichtungen.</p>
<h2>4. Weitergabe</h2>
<p>An Partnerrestaurants bei Transaktionen, Zahlungsdienstleister (Stripe), Hosting, Push-Dienste (Firebase/Google) und Behörden wenn gesetzlich erforderlich.</p>
<h2>5. Aufbewahrung</h2>
<p>Solange Ihr Konto aktiv ist und soweit gesetzlich, steuerlich oder zur Streitbeilegung erforderlich.</p>
<h2>6. Ihre Rechte</h2>
<p>Auskunft, Berichtigung, Löschung, Einschränkung und Widerruf der Einwilligung. Kontakt: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a></p>
<h2>7. Kontakt</h2>
<p>NUX — E-Mail: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — Web: <a href="https://nuxapp.de">nuxapp.de</a></p>`,
  },
  terms: {
    en: `<h1>Terms of Use</h1>
<p><strong>Last updated:</strong> June 2026</p>
<p>By using the NUX mobile application or nuxapp.de website, you agree to these Terms of Use. If you do not agree, do not use our services.</p>
<h2>1. Service description</h2>
<p>NUX connects guests with partner restaurants through digital menus, QR codes, wallet payments, loyalty features, and related hospitality tools. Restaurant operators use separate business dashboards.</p>
<h2>2. Accounts</h2>
<p>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. Google Sign-In is optional and subject to Google's terms as well.</p>
<h2>3. Acceptable use</h2>
<ul>
<li>Do not misuse the platform, attempt unauthorized access, or interfere with other users.</li>
<li>Do not use NUX for unlawful purposes or fraudulent payments.</li>
<li>Respect restaurant rules and local laws when dining or paying through the app.</li>
</ul>
<h2>4. Wallet &amp; payments</h2>
<p>Wallet top-ups and card payments are processed via third-party providers. Balances and promotions are subject to restaurant and platform rules displayed in the app. Refunds follow applicable law and restaurant policies.</p>
<h2>5. Availability</h2>
<p>We strive for reliable service but do not guarantee uninterrupted access. Features may change with notice where reasonable.</p>
<h2>6. Limitation of liability</h2>
<p>To the extent permitted by law, NUX is not liable for indirect damages. Our liability is limited to the amount you paid us in the preceding 12 months for paid services, if any.</p>
<h2>7. Termination</h2>
<p>You may stop using NUX at any time. We may suspend accounts that violate these terms or applicable law.</p>
<h2>8. Governing law</h2>
<p>These terms are governed by applicable law in the jurisdiction of NUX's registered operation. Mandatory consumer rights in your country remain unaffected.</p>
<h2>9. Contact</h2>
<p>Questions: <a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — <a href="https://nuxapp.de">nuxapp.de</a></p>`,
    ar: `<h1>شروط الاستخدام</h1>
<p><strong>آخر تحديث:</strong> يونيو 2026</p>
<p>باستخدام تطبيق NUX أو موقع nuxapp.de، فإنك توافق على هذه الشروط. إذا لم توافق، لا تستخدم خدماتنا.</p>
<h2>1. وصف الخدمة</h2>
<p>يربط NUX الضيوف بالمطاعم الشريكة عبر قوائم رقمية ورموز QR ومحفظة إلكترونية وميزات ولاء. يستخدم مشغلو المطاعم لوحات تحكم منفصلة.</p>
<h2>2. الحسابات</h2>
<p>يجب تقديم معلومات دقيقة والحفاظ على سرية بيانات الدخول. أنت مسؤول عن نشاط حسابك. تسجيل الدخول عبر Google اختياري ويخضع لشروط Google أيضاً.</p>
<h2>3. الاستخدام المقبول</h2>
<ul>
<li>عدم إساءة استخدام المنصة أو محاولة الوصول غير المصرح به.</li>
<li>عدم استخدام NUX لأغراض غير قانونية أو مدفوعات احتيالية.</li>
<li>احترام قواعد المطعم والقوانين المحلية.</li>
</ul>
<h2>4. المحفظة والمدفوعات</h2>
<p>تُعالج الشحن والبطاقات عبر مزودين خارجيين. الأرصدة والعروض تخضع لقواعد المطعم والمنصة. الاسترداد وفق القانون وسياسات المطعم.</p>
<h2>5. التوفر</h2>
<p>نسعى لخدمة موثوقة دون ضمان وصول متواصل. قد تتغير الميزات مع إشعار معقول.</p>
<h2>6. حدود المسؤولية</h2>
<p>في الحدود التي يسمح بها القانون، لا نتحمل أضراراً غير مباشرة.</p>
<h2>7. الإنهاء</h2>
<p>يمكنك التوقف عن الاستخدام في أي وقت. قد نعلق الحسابات المخالفة.</p>
<h2>8. القانون الحاكم</h2>
<p>تخضع الشروط للقانون المعمول به مع بقاء حقوق المستهلك الإلزامية.</p>
<h2>9. التواصل</h2>
<p><a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — <a href="https://nuxapp.de">nuxapp.de</a></p>`,
    de: `<h1>Nutzungsbedingungen</h1>
<p><strong>Stand:</strong> Juni 2026</p>
<p>Mit der Nutzung der NUX-App oder von nuxapp.de akzeptieren Sie diese Bedingungen. Andernfalls nutzen Sie unsere Dienste nicht.</p>
<h2>1. Leistungsbeschreibung</h2>
<p>NUX verbindet Gäste mit Partnerrestaurants über digitale Speisekarten, QR-Codes, Wallet-Zahlungen und Treuefunktionen. Restaurantbetreiber nutzen separate Dashboards.</p>
<h2>2. Konten</h2>
<p>Richtige Angaben und sichere Zugangsdaten sind erforderlich. Sie sind für Aktivitäten unter Ihrem Konto verantwortlich. Google Sign-In ist optional.</p>
<h2>3. Zulässige Nutzung</h2>
<ul>
<li>Kein Missbrauch, kein unbefugter Zugriff, keine Störung anderer Nutzer.</li>
<li>Keine rechtswidrigen oder betrügerischen Zahlungen.</li>
<li>Restaurantregeln und lokale Gesetze beachten.</li>
</ul>
<h2>4. Wallet &amp; Zahlungen</h2>
<p>Aufladungen und Kartenzahlungen über Drittanbieter. Guthaben und Aktionen unterliegen Restaurant- und Plattformregeln.</p>
<h2>5. Verfügbarkeit</h2>
<p>Wir bemühen uns um zuverlässigen Betrieb ohne Garantie auf unterbrechungsfreien Zugang.</p>
<h2>6. Haftungsbeschränkung</h2>
<p>Soweit gesetzlich zulässig keine Haftung für indirekte Schäden.</p>
<h2>7. Kündigung</h2>
<p>Nutzung jederzeit beendbar. Wir können Konten bei Verstößen sperren.</p>
<h2>8. Anwendbares Recht</h2>
<p>Anwendbares Recht am Sitz von NUX; zwingende Verbraucherrechte bleiben unberührt.</p>
<h2>9. Kontakt</h2>
<p><a href="mailto:Info@nuxapp.de">Info@nuxapp.de</a> — <a href="https://nuxapp.de">nuxapp.de</a></p>`,
  },
};
