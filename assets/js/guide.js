// In-app user guide (คู่มือการเล่น). Update it whenever a feature changes.
// Each section: { id, icon, title, items: [string | { b: bold, text }] }.
export const GUIDE = {
  th: [
    {
      id: 'start', icon: '🚀', title: 'เริ่มต้นใช้งาน',
      items: [
        'เลือกภาษาที่จะเรียน (อังกฤษ เกาหลี ญี่ปุ่น) และภาษาคำแปลในหน้า "ฝึก"',
        'ติ๊กเลือกชุดคำศัพท์ที่อยากฝึก (เลือกได้หลายชุด) แถบสีเขียวใต้ชื่อชุดบอกว่าจำได้แล้วกี่คำ',
        'เลือกโหมดเกมและจำนวนข้อ แล้วกด "เริ่มเล่น"',
        'กดปุ่ม 🔊 เพื่อฟังเสียงอ่านได้ทุกที่',
      ],
    },
    {
      id: 'modes', icon: '🎮', title: 'โหมดเกม',
      items: [
        { b: '🃏 แฟลชการ์ด', text: 'แตะการ์ดเพื่อพลิกดูความหมาย แล้วกด "จำได้แล้ว" หรือ "ยังจำไม่ได้" ตามจริง' },
        { b: '🔤 เลือกความหมาย', text: 'ดูคำศัพท์ แล้วเลือกคำแปลที่ถูกจาก 4 ตัวเลือก' },
        { b: '🔁 เลือกคำศัพท์', text: 'ดูคำแปล แล้วเลือกคำศัพท์ที่ถูก' },
        { b: '🎧 ฟังแล้วตอบ', text: 'ฟังเสียง แล้วเลือกคำแปล (แตะ 🔊 เพื่อฟังซ้ำ)' },
        { b: '⌨️ พิมพ์คำศัพท์', text: 'ดูคำแปล แล้วพิมพ์คำศัพท์ ภาษาเกาหลีพิมพ์ฮันกึลหรือโรมันได้ ภาษาญี่ปุ่นพิมพ์คันจิ คานะ หรือโรมาจิได้ (เช่น ohayou หรือ ohayo)' },
        { b: '🧩 จับคู่', text: 'แตะคำศัพท์ทางซ้าย แล้วแตะคำแปลทางขวาให้ตรงกัน รอบละ 6 คู่ ถ้าจับผิดคำนั้นจะนับว่ายังจำไม่ได้' },
      ],
    },
    {
      id: 'srs', icon: '🧠', title: 'ระบบทบทวนอัจฉริยะ',
      items: [
        'ทุกคำมีระดับความจำ 0–5 ตอบถูกระดับจะขึ้นทีละ 1 ตอบผิดจะกลับไปที่ 0',
        'คำที่อยู่ระดับ 3 ขึ้นไปนับว่า "จำได้แล้ว"',
        'เกมจะสุ่มคำที่ยังไม่เคยเห็นและคำที่ยังจำไม่ได้มาให้บ่อยกว่า',
        'จบเกมแล้วกด "ฝึกคำที่ผิดอีกครั้ง" เพื่อทบทวนเฉพาะคำที่พลาด',
      ],
    },
    {
      id: 'progress', icon: '📊', title: 'ดูความคืบหน้า',
      items: [
        'แท็บ "ความคืบหน้า" แสดงภาพรวมทุกภาษา: จำนวนคำที่จำได้ ความแม่นยำ วันเรียนต่อเนื่อง และกราฟจำนวนคำตอบ 14 วันล่าสุด',
        'แตะแท่งกราฟเพื่อดูตัวเลขของวันนั้น',
        'แตะชื่อภาษาเพื่อดูรายละเอียด: ความคืบหน้าแยกชุด, คำที่ผิดบ่อย (กดฝึกได้ทันที) และประวัติการเล่น',
        'ความคืบหน้าเก็บไว้ในเครื่องนี้เท่านั้น ถ้าล้างข้อมูลเว็บไซต์ใน Safari ความคืบหน้าจะหายไป',
      ],
    },
    {
      id: 'install', icon: '📲', title: 'เพิ่มไปยังหน้าจอโฮม (iPhone / iPad)',
      items: [
        { b: '1.', text: 'เปิดแอปนี้ใน Safari' },
        { b: '2.', text: 'แตะปุ่ม แชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) บน iPhone อยู่แถบล่าง บน iPad อยู่มุมขวาบน ถ้าไม่เห็นให้แตะปุ่ม ••• ก่อน' },
        { b: '3.', text: 'เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม"' },
        { b: '4.', text: 'เปิด "เปิดเป็นเว็บแอป" ไว้ แล้วแตะ "เพิ่ม"' },
        'จากนั้นเปิดจากไอคอนบนหน้าโฮม แอปจะแสดงเต็มจอ ไม่มีแถบ Safari และใช้งานออฟไลน์ได้',
        'ถ้าตั้งไอคอนหน้าโฮมของ iOS เป็นแบบมืดหรือแบบสี ระบบจะปรับสีไอคอนให้อัตโนมัติ',
      ],
    },
    {
      id: 'voice', icon: '🔊', title: 'เสียงอ่าน',
      items: [
        'ใช้เสียงที่มีในเครื่อง ถ้าไม่มีเสียง ให้ไปที่ การตั้งค่า › การช่วยการเข้าถึง › เนื้อหาที่พูด › เสียง แล้วดาวน์โหลดเสียงภาษาที่เรียน',
        'ถ้าไม่ได้ยินเสียง ให้ตรวจว่าสวิตช์ปิดเสียงไม่ได้เปิดอยู่ และเพิ่มระดับเสียงขึ้น',
        'ปิดหรือเปิด "ออกเสียงอัตโนมัติ" ได้ในหน้าตั้งค่า',
      ],
    },
    {
      id: 'display', icon: '🎨', title: 'การแสดงผล',
      items: [
        'ธีม: เลือก "ตามระบบ" (ค่าเริ่มต้น) "สว่าง" หรือ "มืด" ได้ในหน้า "ฝึก" ส่วนตั้งค่า',
        'เปิด "แสดงคำอ่าน" เพื่อดูคำอ่านคานะ (ญี่ปุ่น) และคำอ่านโรมันใต้คำศัพท์',
        'ใช้ได้ทั้งแนวตั้งและแนวนอน บน iPad แนวนอนหน้าตั้งค่าจะแบ่งเป็น 2 คอลัมน์',
      ],
    },
    {
      id: 'keys', icon: '⌨️', title: 'คีย์ลัด (iPad ที่ต่อคีย์บอร์ด)',
      items: [
        { b: '1–4', text: 'เลือกคำตอบ' },
        { b: 'Enter / Space', text: 'ไปข้อต่อไป หรือพลิกการ์ด' },
        { b: '← / →', text: 'ในโหมดแฟลชการ์ด ใช้เลือก "ยังจำไม่ได้" หรือ "จำได้แล้ว"' },
      ],
    },
    {
      id: 'about', icon: 'ℹ️', title: 'ข้อมูลและลิขสิทธิ์',
      items: [
        'คำศัพท์ทั้งหมดเขียนขึ้นใหม่และเผยแพร่แบบ CC0 (สาธารณสมบัติ) จึงใช้ได้ฟรี รวมถึงเชิงพาณิชย์',
        'ดูรายการสิ่งที่เปลี่ยนในแต่ละเวอร์ชันได้ที่หน้า "มีอะไรใหม่"',
      ],
    },
  ],
  en: [
    {
      id: 'start', icon: '🚀', title: 'Getting started',
      items: [
        'On the "Practice" tab, choose the language to learn (English, Korean, Japanese) and the translation language',
        'Tick the word sets you want (several at once). The green bar shows how many words you have mastered',
        'Choose a game mode and the number of questions, then tap "Start"',
        'Tap 🔊 anywhere to hear the pronunciation',
      ],
    },
    {
      id: 'modes', icon: '🎮', title: 'Game modes',
      items: [
        { b: '🃏 Flashcards', text: 'Tap the card to flip it, then honestly choose "Got it" or "Not yet"' },
        { b: '🔤 Pick the meaning', text: 'See the word, choose its translation from 4 options' },
        { b: '🔁 Pick the word', text: 'See the translation, choose the word' },
        { b: '🎧 Listen & answer', text: 'Listen, then choose the translation (tap 🔊 to replay)' },
        { b: '⌨️ Type the word', text: 'See the translation, type the word. Korean accepts Hangul or romanization; Japanese accepts kanji, kana or romaji (e.g. ohayou or ohayo)' },
        { b: '🧩 Match pairs', text: 'Tap a word on the left, then its translation on the right. 6 pairs per round; a wrong match counts the word as not yet learned' },
      ],
    },
    {
      id: 'srs', icon: '🧠', title: 'Smart review',
      items: [
        'Every word has a memory level 0–5. A correct answer moves it up one level; a wrong one sends it back to 0',
        'Words at level 3 or higher count as "mastered"',
        'New and weak words come up more often',
        'After a game, tap "Practice mistakes" to review only the words you missed',
      ],
    },
    {
      id: 'progress', icon: '📊', title: 'Tracking progress',
      items: [
        'The "Progress" tab shows all languages: words mastered, accuracy, day streak, and answers over the last 14 days',
        'Tap a bar to see that day\'s numbers',
        'Tap a language for details: per-set progress, most-missed words (practice them in one tap) and recent games',
        'Progress is stored on this device only; clearing website data in Safari erases it',
      ],
    },
    {
      id: 'install', icon: '📲', title: 'Add to Home Screen (iPhone / iPad)',
      items: [
        { b: '1.', text: 'Open this app in Safari' },
        { b: '2.', text: 'Tap Share (square with an up arrow): bottom bar on iPhone, top right on iPad. If hidden, tap ••• first' },
        { b: '3.', text: 'Scroll down and choose "Add to Home Screen"' },
        { b: '4.', text: 'Keep "Open as Web App" on, then tap "Add"' },
        'Launch it from the Home Screen icon: full screen, no Safari bars, works offline',
        'With dark or tinted Home Screen icons, iOS recolors the icon automatically',
      ],
    },
    {
      id: 'voice', icon: '🔊', title: 'Pronunciation',
      items: [
        'Uses the voices on your device. If none, go to Settings › Accessibility › Spoken Content › Voices and download one',
        'No sound? Check the silent switch and the volume',
        'Turn "Auto pronounce" on or off in the options',
      ],
    },
    {
      id: 'display', icon: '🎨', title: 'Display',
      items: [
        'Theme: "System" (default), "Light" or "Dark" in the Practice tab options',
        'Turn on "Show reading" for kana (Japanese) and romanization under each word',
        'Works in portrait and landscape; on iPad landscape the setup uses two columns',
      ],
    },
    {
      id: 'keys', icon: '⌨️', title: 'Keyboard shortcuts (iPad with keyboard)',
      items: [
        { b: '1–4', text: 'choose an answer' },
        { b: 'Enter / Space', text: 'next question or flip the card' },
        { b: '← / →', text: 'flashcards: "Not yet" / "Got it"' },
      ],
    },
    {
      id: 'about', icon: 'ℹ️', title: 'About & license',
      items: [
        'All vocabulary was written for this app and released under CC0 (public domain), free for any use including commercial',
        'See what changed in each version on the "What\'s new" page',
      ],
    },
  ],
};
