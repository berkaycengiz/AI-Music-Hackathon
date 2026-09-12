# Museum Sonic Explorer — Kapsamlı Mimari, Teknik Kararlar ve Ses Tasarımı Spesifikasyonu

> **AI Music Hackathon 2026** — Berghotel Rudolfshütte  
> **Challenge 6:** Multimodal & Accessible Tactile Music Installation  
> **Donanım Altyapısı:** AlphaTheta CHORDCAT (8-Track Groovebox) + Web Tabanlı Dokunsal Arayüz  
> **Doküman Sürümü:** 2.1 (Merkez Tabanlı Sürekli Miks)  

---

## Güncel Prototip Kararı — İki Müzikal Deneyim

Navbar, aynı eser verisini kullanan iki yaklaşımı karşılaştırır:

1. **Region Chords:** Görünmeyen semantik polygonlar dwell ve anlatım için korunur; aktif alan kendi akorunu veya motifini icra eder.
2. **Full Composition:** Polygonlar ses seviyesi sınırı değildir. Her bölgenin alan-ağırlıklı bir müzikal merkezi vardır ve parmağın bütün merkezlere uzaklığı tüm stem seviyelerini aynı anda sürekli biçimde belirler. Stem'ler rollerine göre `%10–18` tabanın altına düşmez, merkezde `%100` olur ve Web Audio gain geçişleri yaklaşık yarım saniyede yumuşar.

Arayüzde polygon dolguları, sınırları ve büyük bölge etiketleri gösterilmez; yalnızca renkli `T1…T8` merkez noktaları ve parmak imleci görünür. Polygonlar yalnızca kısa dwell sonrasında semantik TTS anlatımını seçmek için perde arkasında kalır. CHORDCAT tarafındaki hedef, aynı sürekli seviyeleri ilgili track'lere CC11 expression olarak iletmektir; bu eşleme fiziksel cihazla doğrulanacaktır.

---

## 1. Proje Bağlamı ve Tasarım Felsefesi

### 1.1 Temel Problem
Dünya çapındaki müzelerde görme engelli bireyler için sunulan mevcut çözümler çoğunlukla **monoton, pasif ve tek boyutlu sesli rehberlerden (audio tour)** ibarettir. Görme engelli bir ziyaretçi:
* Tablonun fiziksel kompozisyonunu ve boyutlarını kavrayamaz.
* Figürlerin ve objelerin birbirine göre uzamsal konumlarını (spatial layout) hissedemez.
* Renk kontrastlarının yarattığı psikolojik gerilimi ve atmosferi deneyimleyemez.
* En önemlisi; sanat eseriyle **etkileşime geçemez**, yalnızca pasif bir dinleyici olarak kalır.

### 1.2 Çözüm Vizyonu: "Tabloyu İcra Etmek" (Performative Tactile Exploration)
Museum Sonic Explorer, eserin 3D kabartmalı (rölyef) bir kopyası üzerinde gezinen parmak hareketini, eserin bestesini icra eden bir orkestra şefine dönüştürür.
* Ziyaretçi **ses efekti tetiklemez** (sound trigger yaklaşımı reddedilmiştir).
* Ziyaretçi eserin üzerinde dolaştıkça, o eserin tematik orkestrasyonunun kanallarını (stem'lerini) canlı olarak miksler.
* Eserin **AlphaTheta CHORDCAT 8-Track Groovebox** üzerine yazılmış partisyonu, parmağın konumuna ve bölgenin renk/ışık değerlerine göre şekillenir.

---

## 2. Alınan Kritik Mimari Kararlar ve Teknik Gerekçeleri

### Karar 1: Challenge 5 (PulseBridge) ve Eski Kafa Takip Kodlarının Sıfırlanması
* **Önceki Durum:** Projede Challenge 5 için yazılmış nabız/ekg kodları ve Challenge 6'nın eski prototipi olan yüz/kafa hareketiyle synth çalma denemeleri (`useFaceTracking.ts`, `CameraPanel.tsx`, `headPose.ts`) mevcuttu.
* **Gerekçe:** Kafa takip mekanizması, bir müze tablosunu iki boyutlu olarak uzamsal keşfetmek için ergonomik değildi; ziyaretçiyi yoruyor ve dokunsal teması engelliyordu.
* **Uygulama:** Eski yüz takip, kafa açısı ve eski harmoni kütüphaneleri tamamen silindi; temiz bir dokunsal müze mimarisi (`artwork/`, `interaction/`, `audio/`) sıfırdan inşa edildi.

---

### Karar 2: "Atari Bip Sesleri" Yerine Çok Sesli (Polyphonic) Sinematik Akor Motoru
* **Önceki Durum:** İlk prototipte osilatörlerin ürettiği beyaz/kahverengi gürültü ve kare dalga bip sesleri kullanılmıştı.
* **Gerekçe:** Michelangelo'nun *Adem'in Yaratılışı* veya Caspar David Friedrich'in *Sisler Üzerinde Avare* tablolarına dokunulduğunda çıkan mekanik bip sesleri, sanat eserinin ağırlığını yok edip sistemi ucuz bir çocuk oyuncağı seviyesine indiriyordu.
* **Uygulama:**
  1. Oyun müziklerinde kullanılan **"Stem-Based Adaptive Audio"** yapısına geçildi.
  2. Tablo tek bir senfonik parça olarak kurgulandı; her bölge bu senfoninin bir enstrümanına (`Track 1` - `Track 8`) dönüştürüldü.
  3. Web Audio API üzerinde karmaşık armoni basabilen çok sesli (`Dm9`, `Fmaj9`, `Bbmaj7#11`) **Polifonik Sentezleyici Motoru** yazıldı.

---

### Karar 3: Canlı AI Vision API Çağrılarının Kaldırılması & %100 Yerel Kürasyon (Zero-Latency)
* **Önceki Durum:** Arayüze dışarıdan resim yükleyip OpenRouter Multimodal Vision API (`inclusionai/ling-3.0-flash-vl:free`) ile canlı koordinat ve ses çıkarma akışı kurulmuştu.
* **Karşılaşılan Riskler:**
  * Vision LLM çağrıları 10–15 saniye sürüyordu.
  * Hackathon otelindeki WiFi dalgalanmaları veya sağlayıcı rate-limit (429) durumunda canlı demo tamamen çökebilirdi.
  * Ziyaretçi tablonun başında saniyelerce bekleyemezdi.
* **Uygulama:**
  1. Canlı yükleme arayüzü ve API anahtarları repodan tamamen temizlendi.
  2. Klasördeki **9 dünya başyapıtının tamamı**, görsel koordinatları ve ChordCat partisyonlarıyla **%100 yerel JSON modellerine** dönüştürüldü.
  3. **Kazanım:** Açılır menüden tablo seçildiğinde **0 milisaniye gecikmeyle**, tamamen çevrimdışı (offline) ve sıfır riskle çalışan deterministik bir sistem elde edildi.

---

### Karar 4: AlphaTheta CHORDCAT'in Rolü — Donanım Groovebox Entegrasyonu
* **Önemli Ayrım:** ChordCat bir hoparlör değildir; bilgisayardan cihaza ses dosyası akışı yapılamaz.
* **Uygulanan Mimari:**
  * Bilgisayar, USB MIDI üzerinden ChordCat'in 1–8 numaralı kanallarına NoteOn/NoteOff ve CC mesajları gönderir.
  * Sesi üreten bizzat **ChordCat'in kendi dahili synthesizer motorudur**.
  * Cihazdaki 8 kanal tablonun 8 bölgesine atanmıştır.
  * Tarayıcıdaki dahili ses motoru ise masada fiziksel ChordCat bağlı olmadığı anlarda donanımı birebir taklit eden yüksek kaliteli bir yedektir (hardware emulator).

---

### Karar 5: Doğal İngilizce Sesli Rehber (Text-to-Speech) Entegrasyonu
* **Gerekçe:** Görme engelli bir ziyaretçi ekrandaki metinleri göremez. Yalnızca müzik dinletmek ise objelerin ne olduğunu anlatmakta yetersiz kalır.
* **Uygulama:**
  * `speechNarration.ts` servisi geliştirildi.
  * Tarayıcının yerel **Web Speech API** (`window.speechSynthesis`) motoru kullanılarak, doğal tonlamalı İngilizce (`en-US` / `en-GB`) sesli rehber entegre edildi.
  * Ziyaretçi bir bölgeye girdiğinde müzikal akor yükselirken, sesli rehber o bölgenin betimlemesini kulağına okur.
  * Yeni bir bölgeye geçildiği an `speechSynthesis.cancel()` ile önceki cümle bıçak gibi kesilir; kuyruk birikmesi engellenir.

---

### Karar 6: Histerezis ve Duraklama (Dwell Time) Durum Makinesi
* **Sorun:** Ziyaretçinin parmağı iki görsel bölgenin sınır çizgisinde titrediğinde (jitter), iki bölgenin seslerinin milisaniyeler içinde üst üste tetiklenip patlaması (audio glitching).
* **Uygulama:** `RegionStateMachine` sınıfı geliştirildi:
  * **Entry Dwell (140 ms):** Bir bölgeye anlık çarpıp geçildiğinde ses tetiklenmez. Parmağın kasten 140ms orada durması gerekir.
  * **Exit Dwell (200 ms):** Bölgeden anlık çıkıldığında ses kesilmez; parmağın 200ms boyunca dışarıda kalması beklenir.
  * **Retrigger Cooldown (400 ms):** Aynı bölgenin peş peşe çalınmasını engelleyen soğuma süresi.

---

## 3. Matematiksel ve Algoritmik Temeller

### 3.1 Ray-Casting Çokgen Tespiti (Jordan Curve Theorem)
Ziyaretçinin normalize koordinatındaki $(x, y) \in [0, 1]^2$ noktasının, tablodaki bir bölge çokgeninin (polygon) içinde olup olmadığı `regionLookup.ts` içindeki ray-casting algoritmasıyla hesaplanır:

Noktadan sonsuza doğru yatay bir ışın $(x, y) \to (+\infty, y)$ çizilir. Bu ışının çokgenin kenarlarıyla yaptığı kesişim sayısı tek ise nokta çokgenin içindedir; çift ise dışındadır:

$$\text{intersect} = \left( (y_i > y) \neq (y_j > y) \right) \land \left( x < \frac{(x_j - x_i)(y - y_i)}{y_j - y_i} + x_i \right)$$

Çakışan (overlap) bölgelerde, Shoelace formülüyle çokgen alanı hesaplanır ve öncelik katsayısı (`priority`, 1–5) yüksek olan foreground bölge kazanır.

---

### 3.2 ITU-R BT.601 Algısal Parlaklık (Perceptual Luminance)
İmlecin altındaki 3x3 piksellik pencerenin ortalaması alınarak gürültü filtrelenir. İnsan gözünün yeşil dalga boyuna olan yüksek hassasiyetini modelleyen ITU-R BT.601 standardıyla normalize parlaklık ($L \in [0, 1]$) hesaplanır:

$$L = \frac{0.299 \cdot R + 0.587 \cdot G + 0.114 \cdot B}{255}$$

Renk Sıcaklığı (Warmth $W \in [-1, 1]$):

$$W = \frac{R - B}{255}$$

---

### 3.3 Logaritmik Filtre Frekansı Modülasyonu (Timbre Modulation)
İnsan kulağı ses frekanslarını lineer değil, logaritmik (oktavlar halinde) algılar. Bu nedenle parlaklık değeri $L$, ana Biquad Lowpass filtresinin kesme frekansına ($f_{cutoff}$) logaritmik olarak haritalanır:

$$f_{cutoff}(L) = f_{min} \cdot \left(\frac{f_{max}}{f_{min}}\right)^L, \quad \text{burada } f_{min} = 350\text{ Hz}, \ f_{max} = 6800\text{ Hz}$$

* **Karanlık Bölgeler ($L \approx 0.1$):** $f_{cutoff} \approx 470\text{ Hz}$. Ses boğuk, derinden gelen, koyu ve ağır bas ağırlıklıdır.
* **Aydınlık Bölgeler ($L \approx 0.9$):** $f_{cutoff} \approx 5000+\text{ Hz}$. Filtre sonuna kadar açılır, akorların üst harmonikleri parıldar.
* **Yumuşatma (Anti-Clicking):** Ani fare sıçramalarında seste çıtlama olmaması için Web Audio `setTargetAtTime` ile $\tau = 40\text{ms}$ zaman sabitiyle eksponansiyel geçiş sağlanır.
* **MIDI Aktarımı:** Bu değer aynı zamanda normalize edilerek donanıma **MIDI CC 74 (Brightness / Filter Cutoff)** olarak iletilir:

$$\text{CC74} = \text{round}(L \times 127)$$

---

### 3.4 Çok Sesli (Polyphonic) Akor Tını Dizilimi
Web Audio sentezleyicisinde her akor notası için MIDI numarası ($n$) frekansa ($f$) dönüştürülür:

$$f(n) = 440 \cdot 2^{\frac{n - 69}{12}}$$

Yüksek notaların kulağı tırmalamasını önlemek ve doğal bir orkestral balans yakalamak için ses kazancı ters karekök fonksiyonuyla sönümlenir:

$$G_{voice}(i) = \frac{0.25}{\sqrt{i + 1}}, \quad i: \text{akordaki nota indeksi (0: bas, 4: en tiz)}$$

Her ses için ana frekansa ek olarak hafifçe detune edilmiş ($\times 0.998$) bir alt sinüs osilatörü eklenerek analog koro zenginliği elde edilir.

---

## 4. AlphaTheta CHORDCAT MIDI İletişim Protokolü

Sistem, Web MIDI API (`navigator.requestMIDIAccess`) üzerinden bilgisayara bağlı AlphaTheta / CHORDCAT donanımını otomatik keşfeder.

### 4.1 Kanal ve Mesaj Haritası

| CHORDCAT Kanalı | MIDI Komutu | Hex / Byte Dizilimi | Açıklama |
|---|---|---|---|
| **Track 1** | Note On / Off | `0x90`, Note, Velocity / `0x80`, Note, 0 | 1. Görsel Bölge (Genelde Kök Bas / Cello) |
| **Track 2** | Note On / Off | `0x91`, Note, Velocity / `0x81`, Note, 0 | 2. Görsel Bölge (Genelde Pad / Koro) |
| **Track 3** | Note On / Off | `0x92`, Note, Velocity / `0x82`, Note, 0 | 3. Görsel Bölge (Melodi / Arpej / Lead) |
| **Track 4** | Note On / Off | `0x93`, Note, Velocity / `0x83`, Note, 0 | 4. Görsel Bölge (Yaylılar / Dokusal Akor) |
| **Track 5** | Note On / Off | `0x94`, Note, Velocity / `0x84`, Note, 0 | 5. Görsel Bölge (Atmosferik Drone) |
| **Tüm Kanallar (1–8)** | Continuous Controller | `0xB0 + ch`, `74`, `0..127` | Gerçek Zamanlı Filtre Cutoff (Piksel Parlaklığı) |
| **Tüm Kanallar (1–8)** | All Sound Off (Panic) | `0xB0 + ch`, `120`, `0` | Acil Durumda Tüm Sesleri Anında Susturma |
| **Tüm Kanallar (1–8)** | All Notes Off | `0xB0 + ch`, `123`, `0` | Askıda Kalan Notaları Bırakma |

### 4.2 Yığılma Önleme (Pile-up Prevention)
Yeni bir bölgeye girildiğinde, o kanalda önceki akordan kalan notaların asılı kalmaması için önce kanala `0xB0 + ch, 123, 0` (All Notes Off) gönderilir; ardından yeni akorun notaları milisaniye hassasiyetiyle basılır.

---

## 5. Kürate Edilen 9 Başyapıtın Müzikal Analizi

Sistemde bulunan 9 dünya klasiğinin her biri, sanat tarihi analizi yapılarak özgün bir müzikal tonaliteye ve ChordCat partisyonuna bağlanmıştır:

---

### 1. Michelangelo — *The Creation of Adam (Adem'in Yaratılışı)*
* **Tonalite & Hız:** D Dorian · 74 BPM
* **Felsefi Tema:** Rönesans hümanizmi; dünyevi bekleyiş ile ilahi kudret arasındaki kozmik gerilim.
* **Kanallar:**
  * **Track 1 (Adam):** `Dm9` $[50, 57, 62, 65, 69]$ — Toprak, insanlık, bekleyiş. *Tını: Sıcak solo çello ve akustik kontrbas.*
  * **Track 2 (God the Father):** `Fmaj9` $[53, 60, 64, 67, 72]$ — İlahi azamet. *Tını: Katedral korosu ve kilise orgu.*
  * **Track 3 (The Near Touch):** `A7sus4` $[57, 62, 64, 69, 74, 76]$ — Yaratılış kıvılcımı. *Tını: Kristal arp ve çan arpejleri.*
  * **Track 4 (Crimson Cloak):** `Bbmaj7#11` $[58, 62, 65, 70, 76]$ — Beyin biçimli kozmik örtü ve melekler. *Tını: Yaylı orkestrası.*
  * **Track 5 (Sky & Landscape):** `Csus2` $[48, 55, 60, 62, 67]$ — Aden bahçesi ufku. *Tını: Açık hava esintisi.*

---

### 2. Gustav Klimt — *The Kiss (Öpücük)*
* **Tonalite & Hız:** Eb Major · 76 BPM
* **Felsefi Tema:** Viyana Secession; erotik teslimiyet, altın yaprakların yarattığı sonsuzluk hissi.
* **Kanallar:**
  * **Track 1 (Man's Cloak):** `Ebmaj9` $[51, 58, 62, 65, 70]$ — Eril köşeli motifler. *Tını: Sıcak analog korno.*
  * **Track 2 (Woman's Gown):** `Cm11` $[48, 55, 63, 67, 70, 74]$ — Dairesel çiçek motifleri. *Tını: Arp ve yumuşak yaylılar.*
  * **Track 3 (The Faces):** `Abmaj7#11` $[56, 60, 67, 72, 74]$ — Şefkatli temas. *Tını: Solo keman ve celesta pırıltısı.*
  * **Track 4 (Flower Meadow):** `Fm9` $[53, 60, 65, 68, 72]$ — Uçurum kenarındaki çiçekler. *Tını: Akustik gitar pizzicato.*
  * **Track 5 (Golden Void):** `Bb7sus4` $[46, 53, 58, 63, 68]$ — Altın arka plan. *Tını: Ethereal çan ve koro pedi.*

---

### 3. Caspar David Friedrich — *Wanderer above the Sea of Fog*
* **Tonalite & Hız:** B Minor · 68 BPM
* **Felsefi Tema:** Alman Romantizmi ve "Yüce" (Sublime) kavramı; sonsuz doğa karşısında insanın yalnızlığı.
* **Kanallar:**
  * **Track 1 (The Wanderer):** `Bm9` $[47, 54, 59, 62, 66, 70]$ — Sırtı dönük gezgin. *Tını: Yalnız koranglo ve melankolik çello.*
  * **Track 2 (Rocky Crag):** `F#m7` $[42, 49, 54, 57, 61]$ — Volkanik sarp kayalık. *Tını: Granit rezonanslı kontrbas.*
  * **Track 3 (Sea of Fog):** `Em11` $[40, 47, 55, 59, 62, 66]$ — Dalgalanan sis denizi. *Tını: Bant ekolu ambient sis korosu.*
  * **Track 4 (Distant Peaks):** `Gmaj7` $[55, 59, 62, 66, 71]$ — Sisten yükselen doruklar. *Tını: Alpin kornolar.*
  * **Track 5 (Vast Sky):** `A6/9` $[45, 52, 57, 61, 64, 69]$ — Uçsuz bucaksız soluk gök. *Tını: Cam orgu ve yaylı harmonikleri.*

---

### 4. Claude Monet — *Woman with a Parasol*
* **Tonalite & Hız:** G Lydian · 90 BPM
* **Felsefi Tema:** Açık hava empresyonizmi; anlık ışık oyunları, yaz rüzgarı ve kumaşın salınımı.
* **Kanallar:**
  * **Track 1 (Parasol):** `Gmaj7#11` $[55, 59, 62, 66, 70, 74]$ — Güneş şemsiyesi. *Tını: Rüzgarlı tahta flütler ve glockenspiel.*
  * **Track 2 (Madame Monet):** `Dmaj9` $[50, 57, 62, 66, 69, 73]$ — Uçuşan beyaz elbise. *Tını: Oda yaylıları ve zarif arp.*
  * **Track 3 (Child Jean):** `Bm7` $[47, 54, 59, 62, 66]$ — Çimler arasındaki çocuk. *Tını: Müzik kutusu ve pizzicato.*
  * **Track 4 (Meadow):** `E9` $[40, 47, 52, 56, 62, 66]$ — Yabani çayır ve sarı çiçekler. *Tını: Sıcak kontrbas ve akustik gitar.*
  * **Track 5 (Sky & Clouds):** `A7sus4` $[45, 52, 57, 62, 67, 71]$ — Dinamik yaz göğü. *Tını: Havadar nefesli pad.*

---

### 5. Edvard Munch — *The Scream (Çığlık)*
* **Tonalite & Hız:** D Minor · 88 BPM
* **Felsefi Tema:** Dışavurumculuk; doğanın içinden geçen sonsuz varoluşsal çığlık ve anksiyete.
* **Kanallar:**
  * **Track 1 (Screaming Figure):** `Ddim7` $[50, 56, 59, 62, 68]$ — Çığlık atan figür. *Tını: Bozulmuş (distorted) ekspresif çello.*
  * **Track 2 (Fiery Sky):** `Bb7#9` $[58, 62, 68, 73, 77]$ — Kan kırmızısı alevli gökyüzü. *Tını: Tehditkar yüksek pirinç harmonikleri.*
  * **Track 3 (Bridge):** `Gm6` $[55, 58, 62, 64, 67]$ — Sonsuza uzanan ahşap köprü. *Tını: Ritmik ahşap vuruşlar.*
  * **Track 4 (Fjord Waters):** `Dm(maj7)` $[50, 57, 61, 65, 69]$ — Karanlık girdaplı sular. *Tını: Arpejli karanlık piyano.*
  * **Track 5 (Swirling Shore):** `A7b9` $[57, 61, 64, 67, 70]$ — Kıvrılan kıyı şeridi. *Tını: Dissonant rüzgar drone'u.*

---

### 6. Théodore Géricault — *The Raft of the Medusa*
* **Tonalite & Hız:** C Minor · 72 BPM
* **Felsefi Tema:** Fransız Romantizmi; ölüm kalım savaşı, batan bir toplum alegorisi ve ufuktaki umut.
* **Kanallar:**
  * **Track 1 (Signaling Survivors):** `Cm(maj7)` $[48, 55, 60, 63, 67, 71]$ — Ufka el sallayan kazazedeler. *Tını: Dramatik solo trompet.*
  * **Track 2 (Mourning Father):** `Abmaj7#11` $[44, 51, 56, 60, 67, 70]$ — Ölü oğlunu tutan baba. *Tını: Yas çellosu ve kontrfagot.*
  * **Track 3 (Mast & Sail):** `Fm9` $[41, 48, 53, 56, 60, 65]$ — Rüzgarda parçalanan yelken. *Tını: Gıcırdayan kalaslar ve fırtına.*
  * **Track 4 (Surging Waves):** `Ebdim7` $[39, 46, 51, 54, 60, 63]$ — Yıkıcı kara dalgalar. *Tını: Okyanus alt bası.*
  * **Track 5 (The Raft):** `G7alt` $[43, 50, 56, 59, 64, 68]$ — Yarı batık tahta sal. *Tını: Tıkırdayan ahşap marimba.*

---

### 7. Jan van Eyck — *The Arnolfini Portrait*
* **Tonalite & Hız:** D Dorian · 78 BPM
* **Felsefi Tema:** Erken Flaman Rönesansı; kutsal evlilik yemini, iç mekan dinginliği ve mikroskobik detaylar.
* **Kanallar:**
  * **Track 1 (Giovanni Arnolfini):** `Dm11` $[50, 57, 60, 65, 69, 72]$ — Ağırbaşlı tüccar. *Tını: Viola da gamba ve ahşap kilise orgu.*
  * **Track 2 (Giovanna Cenami):** `Fmaj7#11` $[53, 57, 60, 64, 71]$ — Yeşil kuyruklu elbise. *Tını: Flaman klavseni ve yaylılar.*
  * **Track 3 (Joined Hands):** `Am9` $[57, 60, 64, 67, 71]$ — Birleşen eller (kutsal yemin). *Tını: Rönesans lavtası ve gümüş çan.*
  * **Track 4 (Convex Mirror):** `Csus2` $[48, 55, 60, 62, 67]$ — Her şeyi gören dairesel ayna. *Tını: Yüksek flüt orgu ve katedral yankısı.*
  * **Track 5 (Loyal Dog & Pattens):** `Em7` $[40, 47, 52, 55, 59]$ — Sadakat köpeği ve takunyalar. *Tını: Klavikord ve sıcak pizzicato.*

---

### 8. Maurice de Vlaminck — *Landscape with Red Trees*
* **Tonalite & Hız:** A Mixolydian · 102 BPM
* **Felsefi Tema:** Fovizm (Vahşi Hayvanlar); saf tüpten sıkılmış çiğ renkler, dizginlenemez içgüdüsel enerji.
* **Kanallar:**
  * **Track 1 (Cobalt Sky):** `A7` $[45, 52, 57, 61, 64, 67]$ — Çalkantılı mavi gök. *Tını: Dinamik rüzgar kornoları ve analog synth.*
  * **Track 2 (Vermilion Fields):** `D9` $[50, 54, 57, 62, 64, 69]$ — Alev kırmızısı tarlalar. *Tını: 12 telli akustik gitar ve pirinç patlamaları.*
  * **Track 3 (Verdant Foliage):** `Gmaj7` $[43, 50, 55, 59, 62, 66]$ — Kalın boyalı yeşil çalılar. *Tını: Ağır kontrbas ve çello sürüşü.*
  * **Track 4 (Red Bare Tree):** `F#m7` $[54, 57, 61, 66, 69]$ — Alev gibi yükselen kırmızı ağaç. *Tını: Keskin obua ve ksilofon.*
  * **Track 5 (Distant Village):** `Bm7` $[47, 54, 59, 62, 66]$ — Tepedeki kiremit çatılı köy. *Tını: Fransız akordeonu ve halk kemanı.*

---

### 9. Pastoral Water Lily Pond & Meadow
* **Tonalite & Hız:** G Major · 80 BPM
* **Felsefi Tema:** Pastoral lirik huzur; su üzerindeki yansımalar ve rüzgarda salınan nilüferler.
* **Kanallar:**
  * **Track 1 (Open Sky):** `Gmaj7` $[55, 59, 62, 66, 71]$ — Berrak gökyüzü. *Tını: Yüksek yaylı hava pedi.*
  * **Track 2 (Lush Trees):** `Em9` $[52, 59, 62, 66, 71]$ — İki ulu ağaç. *Tını: Sıcak akustik gitar ve yaprak hışırtısı.*
  * **Track 3 (Wildflowers):** `Cadd9` $[60, 64, 67, 74, 76]$ — Kıyıdaki rengarenk kır çiçekleri. *Tını: Glockenspiel ve arp.*
  * **Track 4 (Reflective Stream):** `Am7` $[45, 52, 57, 60, 64, 67]$ — Gökyüzünü yansıtan dingin dere. *Tını: Fender Rhodes elektrik piyano.*

---

## 6. Donanım ve Sistem Doğrulama Prosedürü

### 6.1 AlphaTheta CHORDCAT Menü Ayarları
Cihaz bilgisayara bağlandığında deterministik çalışması için şu 3 ayarın yapılması zorunludur:

1. **MIDI IN Senkronizasyonu:**
   `Menu > MIDI IN Settings > Sync Source = USB MIDI`  
   *(Bu ayar yapılmazsa cihaz bilgisayardan gelen akor emirlerini dinlemez).*
2. **Kapanma Engelleyici (Auto Power Off):**
   `Menu > System / Power Settings > Auto Power Off = OFF`  
   *(Varsayılan 20 dakikalık otomatik kapanma iptal edilir).*
3. **Ses Çıkışı Yönlendirmesi:**
   Kulaklık veya ana ses kablosu **bilgisayara değil, ChordCat'in arkasındaki Phone/Line-Out jakına** takılır.

### 6.2 Tanısal Test Prosedürü (T1 - T8 Pads)
Arayüzün sağ panelindeki `Test ChordCat Tracks` bölümünde bulunan 8 test pedine tıklandığında:
1. `testTrack(trackNumber)` metodu çağrılır.
2. USB MIDI üzerinden ilgili kanala `0x90 + ch` akor mesajı ve 550ms sonra `0x80 + ch` bırakma mesajı iletilir.
3. Eş zamanlı olarak dahili emülatörde akor çalınır.
4. Böylece donanım bağlantısı ve ses çıkışı fiziksel tabloya ihtiyaç duyulmadan 5 saniye içinde doğrulanır.
