#!/usr/bin/env python3
import io, sys
p = 'app/assets/web/js/i18n.js'
s = io.open(p, encoding='utf-8').read()
R = [
('app_tag: "संत रामपाल जी महाराज · भक्त सेवा डायरी"', 'app_tag: "भक्त सेवा डायरी"'),
('quick_add: "तुरंत जोड़ें"', 'quick_add: "जोड़ें"'), ('recent: "हाल की सेवा"', 'recent: "हाल की"'),
('view_all: "सभी देखें"', 'view_all: "सभी"'), ('today_seva: "आज की सेवा"', 'today_seva: "आज"'),
('streak: "लगातार दिन"', 'streak: "लगातार"'), ('this_month: "इस माह"', 'this_month: "माह"'),
('make_banner: "बैनर बनाएं"', 'make_banner: "बैनर"'), ('share_text: "निमंत्रण भेजें"', 'share_text: "निमंत्रण"'),
('reminder: "दैनिक रिमाइंडर", reminder_sub: "रोज सेवा याद दिलाएं"', 'reminder: "रोज रिमाइंडर", reminder_sub: "रोज याद"'),
('notif_perm: "सूचना अनुमति"', 'notif_perm: "सूचनाएं"'), ('security: "सुरक्षा और डेटा"', 'security: "सुरक्षा"'),
('app_lock: "ऐप लॉक PIN", app_lock_sub: "डेटा AES-256 एन्क्रिप्टेड"', 'app_lock: "ऐप लॉक PIN", app_lock_sub: "PIN से खुलेगा"'),
('set_pin: "PIN सेट करें"', 'set_pin: "PIN लगाएं"'),
('backup: "बैकअप लें"', 'backup: "बैकअप"'), ('restore: "बैकअप से बहाल"', 'restore: "वापसी"'),
('wipe: "सारा डेटा मिटाएं"', 'wipe: "डेटा मिटाएं"'), ('encrypted_note: "डेटा डिवाइस पर AES-256-GCM + कम्प्रेशन के साथ सुरक्षित"', 'encrypted_note: "डेटा आपके फोन पर सुरक्षित है"'),
('updates: "ऐप अपडेट"', 'updates: "अपडेट"'), ('check_update: "अपडेट जांचें"', 'check_update: "अपडेट देखें"'),
('up_to_date: "ऐप अपडेट है"', 'up_to_date: "सब अपडेट"'), ('update_avail: "नया अपडेट उपलब्ध"', 'update_avail: "नया अपडेट"'),
('upd_title: "अपडेट उपलब्ध"', 'upd_title: "नया अपडेट"'), ('upd_now: "अभी अपडेट करें"', 'upd_now: "अपडेट"'),
('upd_apk_sub: "नेटिव शेल पुराना है — कृपया नया APK डाउनलोड कर इंस्टॉल करें"', 'upd_apk_sub: "नया APK इंस्टॉल करें"'),
('roll_back: "पिछला संस्करण बहाल करें"', 'roll_back: "पुराना वर्शन"'), ('about: "ऐप के बारे"', 'about: "जानकारी"'),
('shell_ver: "नेटिव शेल"', 'shell_ver: "शेल"'), ('entries: "प्रविष्टियां"', 'entries: "सेवाएं"'),
('no_seva_sub: "नीचे ＋ दबाकर अपनी पहली सेवा जोड़ें"', 'no_seva_sub: "＋ दबाकर सेवा जोड़ें"'),
('stats_7d: "पिछले 7 दिन"', 'stats_7d: "7 दिन"'), ('stats_type: "प्रकार अनुसार"', 'stats_type: "प्रकार"'),
('avg_day: "औसत/दिन"', 'avg_day: "औसत"'), ('retry: "फिर प्रयास"', 'retry: "दोबारा"'),
('shared: "शेयर हो गया"', 'shared: "शेयर हुआ"'), ('update_notif: "सतलोक सेवा अपडेट उपलब्ध"', 'update_notif: "नया अपडेट"'),
('made_with: "भक्ति भाव से निर्मित"', 'made_with: "भक्ति से निर्मित"'), ('nav_more: "अधिक"', 'nav_more: "मेनू"'),
('community: "संगत के लिए, संगत द्वारा"', 'community: "संगत के लिए"'),
('inv_note: "नोट",\n      sevadar: "सेवादार"', 'inv_note: "नोट",\n      author: "लेखक", verified: "सत्यापित बिल्ड", last_check: "आखिरी जांच",\n      sevadar: "सेवादार"'),
('app_tag: "Sant Rampal Ji Maharaj · Bhakt Seva Diary"', 'app_tag: "Bhakt seva diary"'),
('quick_add: "Quick add"', 'quick_add: "Add"'), ('recent: "Recent seva"', 'recent: "Recent"'),
('view_all: "View all"', 'view_all: "All"'), ('today_seva: "Today\'s Seva"', 'today_seva: "Today"'),
('streak: "Day streak"', 'streak: "Streak"'), ('this_month: "This month"', 'this_month: "Month"'),
('make_banner: "Make banner"', 'make_banner: "Banner"'), ('share_text: "Send invite"', 'share_text: "Invite"'),
('reminder: "Daily reminder", reminder_sub: "Remind me to log seva"', 'reminder: "Daily reminder", reminder_sub: "Every day"'),
('notif_perm: "Notification permission"', 'notif_perm: "Notifications"'), ('security: "Security & Data"', 'security: "Security"'),
('app_lock: "App lock PIN", app_lock_sub: "Data AES-256 encrypted"', 'app_lock: "App lock PIN", app_lock_sub: "Opens with PIN"'),
('backup: "Take backup"', 'backup: "Backup"'), ('restore: "Restore backup"', 'restore: "Restore"'),
('wipe: "Erase all data"', 'wipe: "Erase data"'), ('encrypted_note: "Data stored on-device with AES-256-GCM + compression"', 'encrypted_note: "Your data stays safe on this phone"'),
('updates: "App updates"', 'updates: "Update"'), ('check_update: "Check for update"', 'check_update: "Check update"'),
('up_to_date: "App is up to date"', 'up_to_date: "Up to date"'), ('update_avail: "New update available"', 'update_avail: "Update available"'),
('upd_title: "Update available"', 'upd_title: "New update"'), ('upd_now: "Update now"', 'upd_now: "Update"'),
('upd_apk_sub: "Native shell is outdated — download & install the new APK"', 'upd_apk_sub: "Install the new APK"'),
('roll_back: "Restore previous version"', 'roll_back: "Old version"'),
('shell_ver: "Native shell"', 'shell_ver: "Shell"'), ('entries: "entries"', 'entries: "sevas"'),
('no_seva_sub: "Tap ＋ below to log your first seva"', 'no_seva_sub: "Tap + to add seva"'),
('stats_7d: "Last 7 days"', 'stats_7d: "7 days"'),
('update_notif: "Satlok Seva update available"', 'update_notif: "Update available"'),
('made_with: "Made with devotion"', 'made_with: "Made with love"'), ('nav_more: "More"', 'nav_more: "Menu"'),
('community: "For the sangat, by the sangat"', 'community: "For the sangat"'),
('inv_note: "Note",\n      sevadar: "Sevadar"', 'inv_note: "Note",\n      author: "Author", verified: "Verified build", last_check: "Last check",\n      sevadar: "Sevadar"'),
('app_tag: "ਸੰਤ ਰਾਮਪਾਲ ਜੀ ਮਹਾਰਾਜ · ਭਗਤ ਸੇਵਾ ਡਾਇਰੀ"', 'app_tag: "ਭਗਤ ਸੇਵਾ ਡਾਇਰੀ"'),
('quick_add: "ਜਲਦੀ ਜੋੜੋ"', 'quick_add: "ਜੋੜੋ"'), ('recent: "ਹਾਲੀਆ ਸੇਵਾ"', 'recent: "ਹਾਲ ਹੀ"'),
('view_all: "ਸਭ ਵੇਖੋ"', 'view_all: "ਸਭ"'), ('today_seva: "ਅੱਜ ਦੀ ਸੇਵਾ"', 'today_seva: "ਅੱਜ"'),
('streak: "ਲਗਾਤਾਰ ਦਿਨ"', 'streak: "ਲਗਾਤਾਰ"'), ('this_month: "ਇਸ ਮਹੀਨੇ"', 'this_month: "ਮਹੀਨਾ"'),
('make_banner: "ਬੈਨਰ ਬਣਾਓ"', 'make_banner: "ਬੈਨਰ"'), ('share_text: "ਸੱਦਾ ਭੇਜੋ"', 'share_text: "ਸੱਦਾ"'),
('reminder: "ਰੋਜ਼ਾਨਾ ਯਾਦ", reminder_sub: "ਰੋਜ਼ ਸੇਵਾ ਯਾਦ ਕਰਵਾਓ"', 'reminder: "ਰੋਜ਼ ਯਾਦ", reminder_sub: "ਹਰ ਰੋਜ਼"'),
('notif_perm: "ਸੂਚਨਾ ਇਜਾਜ਼ਤ"', 'notif_perm: "ਸੂਚਨਾਵਾਂ"'), ('security: "ਸੁਰੱਖਿਆ ਤੇ ਡਾਟਾ"', 'security: "ਸੁਰੱਖਿਆ"'),
('app_lock: "ਐਪ ਲੌਕ PIN", app_lock_sub: "ਡਾਟਾ AES-256 ਇਨਕ੍ਰਿਪਟਡ"', 'app_lock: "ਐਪ ਲੌਕ PIN", app_lock_sub: "PIN ਨਾਲ ਖੁਲ੍ਹੇਗਾ"'),
('backup: "ਬੈਕਅਪ ਲਓ"', 'backup: "ਬੈਕਅਪ"'), ('restore: "ਬੈਕਅਪ ਵਾਪਸ"', 'restore: "ਵਾਪਸੀ"'),
('wipe: "ਸਭ ਡਾਟਾ ਮਿਟਾਓ"', 'wipe: "ਡਾਟਾ ਮਿਟਾਓ"'), ('encrypted_note: "ਡਾਟਾ ਡਿਵਾਈਸ ਤੇ AES-256-GCM + ਕੰਪਰੈਸ਼ਨ ਨਾਲ ਸੁਰੱਖਿਅਤ"', 'encrypted_note: "ਡਾਟਾ ਫੋਨ ਤੇ ਸੁਰੱਖਿਅਤ ਹੈ"'),
('updates: "ਐਪ ਅਪਡੇਟ"', 'updates: "ਅਪਡੇਟ"'),
('up_to_date: "ਐਪ ਅਪਡੇਟ ਹੈ"', 'up_to_date: "ਸਭ ਅਪਡੇਟ"'), ('update_avail: "ਨਵਾਂ ਅਪਡੇਟ ਉਪਲਬਧ"', 'update_avail: "ਨਵਾਂ ਅਪਡੇਟ"'),
('upd_title: "ਅਪਡੇਟ ਉਪਲਬਧ"', 'upd_title: "ਨਵਾਂ ਅਪਡੇਟ"'), ('upd_now: "ਹੁਣੇ ਅਪਡੇਟ ਕਰੋ"', 'upd_now: "ਅਪਡੇਟ"'),
('upd_apk_sub: "ਨੇਟਿਵ ਸ਼ੈਲ ਪੁਰਾਣਾ ਹੈ — ਨਵਾਂ APK ਲਾਓ"', 'upd_apk_sub: "ਨਵਾਂ APK ਲਾਓ"'),
('roll_back: "ਪਿਛਲਾ ਵਰਜ਼ਨ ਵਾਪਸ"', 'roll_back: "ਪੁਰਾਣਾ ਵਰਜਨ"'), ('about: "ਐਪ ਬਾਰੇ"', 'about: "ਜਾਣਕਾਰੀ"'),
('shell_ver: "ਨੇਟਿਵ ਸ਼ੈਲ"', 'shell_ver: "ਸ਼ੈਲ"'), ('entries: "ਇੰਦਰਾਜ"', 'entries: "ਸੇਵਾਵਾਂ"'),
('no_seva_sub: "ਹੇਠਾਂ ＋ ਦਬਾ ਕੇ ਪਹਿਲੀ ਸੇਵਾ ਜੋੜੋ"', 'no_seva_sub: "＋ ਦਬਾ ਕੇ ਸੇਵਾ ਜੋੜੋ"'),
('stats_7d: "ਪਿਛਲੇ 7 ਦਿਨ"', 'stats_7d: "7 ਦਿਨ"'), ('stats_type: "ਕਿਸਮ ਪੱਖੋਂ"', 'stats_type: "ਕਿਸਮ"'),
('avg_day: "ਔਸਤ/ਦਿਨ"', 'avg_day: "ਔਸਤ"'), ('update_notif: "ਸਤਲੋਕ ਸੇਵਾ ਅਪਡੇਟ ਉਪਲਬਧ"', 'update_notif: "ਨਵਾਂ ਅਪਡੇਟ"'),
('made_with: "ਭਗਤੀ ਨਾਲ ਬਣਿਆ"', 'made_with: "ਪਿਆਰ ਨਾਲ ਬਣਿਆ"'), ('nav_more: "ਹੋਰ"', 'nav_more: "ਮੇਨੂ"'),
('community: "ਸੰਗਤ ਲਈ, ਸੰਗਤ ਵੱਲੋਂ"', 'community: "ਸੰਗਤ ਲਈ"'),
('inv_note: "ਨੋਟ",\n      sevadar: "ਸੇਵਾਦਾਰ"', 'inv_note: "ਨੋਟ",\n      author: "ਲੇਖਕ", verified: "ਤਸਦੀਕ ਬਿਲਡ", last_check: "ਆਖਰੀ ਜਾਂਚ",\n      sevadar: "ਸੇਵਾਦਾਰ"'),
]
miss = []
for old, new in R:
    if old in s:
        s = s.replace(old, new, 1); continue
    v = old[:-1] + ' "'
    if v in s:
        s = s.replace(v, new, 1); continue
    miss.append(old[:50])
if miss:
    print("MISS:", *miss, sep="\n  "); sys.exit(1)
io.open(p, 'w', encoding='utf-8').write(s)
print("i18n simplified:", len(R), "keys")
