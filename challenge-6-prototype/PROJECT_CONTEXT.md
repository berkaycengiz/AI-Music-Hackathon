# Museum Sonic Explorer — Proje Bağlamı, Mimari Kararlar ve Sunum Rehberi

> **AI Music Hackathon 2026** (Berghotel Rudolfshütte)  
> **Challenge 6:** Multimodal & Accessible Music Installation  
> **Donanım:** AlphaTheta CHORDCAT (8-Track Groovebox) + Web Tabanlı Dokunsal Arayüz  
> **Tarih:** 12–13 Eylül 2026  

---

## 1. Yönetici Özeti ve Vizyon

### Problem
Görme engelli bireyler için müzeler ve sanat galerileri genellikle erişilemezdir. Geleneksel sesli rehberler eseri yalnızca kuru kelimelerle betimler; tablonun kompozisyonunu, renk kontrastını, duygusal gerilimini ve felsefesini aktarmakta yetersiz kalır.

### Çözümümüz: Museum Sonic Explorer
Ziyaretçinin tablo üzerindeki dokunsal keşfini (rölyef/kabartmalı baskı üzerinde parmak hareketini) **canlı bir müzikal performansa ve sesli hikaye anlatımına** dönüştüren erişilebilir bir sistem.

* Ziyaretçi sadece bir ses efekti tetiklemez; eserin içinde gezinerek **tablonun bestesini canlı olarak icra eder**.
* Her tablo, **AlphaTheta CHORDCAT** groovebox'ının 8 kanalına dağıtılmış dinamik bir partisyona sahiptir.
* Tablonun aydınlık ve karanlık bölgeleri, müziğin tınısını (filtre açıklığını) gerçek zamanlı olarak modüle eder.
* Müzikle eş zamanlı olarak sakin bir İngilizce sesli rehber (docent), görme engelli ziyaretçiye dokunduğu bölgenin zengin sanatsal betimlemesini kulağına fısıldar.

```
                  ┌──────────────────────────────────────────────┐
                  │          Fiziksel Tablo Keşfi                 │
                  │  (Dokunsal Rölyef Üzerinde Gezinen Parmak)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [ Gerçek Zamanlı Piksel ]                      [ Bölge Durum Makinesi ]
     - ITU-R BT.601 Parlaklık                       - Ray-casting Polygon Tespiti
     - Renk Sıcaklığı Örnekleme                     - 140ms Giriş / 200ms Çıkış Dwell
                 │                                               │
                 ▼                                               ▼
     [ Tını Modülasyonu ]                          [ İki Katmanlı Ses & Anlatı ]
     - Lowpass Cutoff (350–6800 Hz)                 ├─ Katman 1: Sıcak Ambient Drone
     - MIDI CC 74 (Filtre Açıklığı)                ├─ Katman 2: CHORDCAT 8-Track Akorlar
                                                   └─ Katman 3: İngilizce Sesli Rehber (TTS)
```

---

## 2. Alınan Temel Kararlar ve Gerekçeleri

### Karar 1: Challenge 5'ten Challenge 6'ya Geçiş ve Eski Kodların Temizlenmesi
* **Bağlam:** Başlangıçta Challenge 5 (PulseBridge) ve eski kafa/yüz takibi ile müzik yapma prototipleri mevcuttu.
* **Karar:** Ekip kararıyla Challenge 5 tamamen bırakıldı; Challenge 6 kapsamındaki dokunsal müze prototipine odaklanıldı. Eski yüz takip (`useFaceTracking.ts`, `CameraPanel.tsx`, `headPose.ts`) dosyaları projeyi kirletmemesi için tamamen silindi.

---

### Karar 2: İlkel Osilatör Seslerinin Çöpe Atılması & "Adaptive Stem Audio" Geçişi
* **Sorun:** İlk aşamada tarayıcının ilkel osilatörleriyle üretilen beyaz gürültü ve bip sesleri, Michelangelo'nun *Adem'in Yaratılışı* gibi bir eserin üzerinde 80'ler atari oyunu gibi durdu ve sanatsal ciddiyeti zedeledi.
* **Karar:** 
  1. Oyun müziklerindeki **"Stem-Based Adaptive Audio"** yaklaşımına geçildi.
  2. Tablo tek bir bütünsel beste olarak düşünüldü; her bölge bu bestenin bir enstrüman kanalı (bas, koro, arpej, yaylılar) haline getirildi.
  3. Kod seviyesinde zengin akor dizilimlerini (`Dm9`, `Fmaj9`, `Bbmaj7#11`) yumuşak zarflarla (soft attack/release) ve stereo rezonansla çalan **Polifonik Sinematik Müzik Motoru** (`ObjectSoundEngine.ts`) yazıldı.

---

### Karar 3: Canlı AI Vision API'sinden Vazgeçilip 9 Eserin Yerel Olarak Kürate Edilmesi (Zero Latency)
* **Bağlam:** Başlangıçta kullanıcı yeni bir tablo yüklediğinde OpenRouter multimodal vision LLM (`inclusionai/ling-3.0-flash-vl:free`) API'si ile canlı bölge çıkarma denendi.
* **Karşılaşılan Risk:** Dış API çağrıları 10–15 saniye sürüyordu; ağ kopması, kota aşımı veya sağlayıcı gecikmesi (rate limit) durumunda jüri önünde canlı demonun çökme riski çok yüksekti.
* **Karar:** 
  1. Canlı yükleme arayüzü ve API anahtarları temizlendi; güvenlik ve gizlilik sağlandı.
  2. Klasördeki **9 dünya başyapıtının tamamı** önceden analiz edilerek koordinatları, ChordCat partisyonları ve sesli betimlemeleriyle **%100 yerel JSON dosyalarına** dönüştürüldü.
  3. **Sonuç:** Açılır menüden tablo değiştirildiğinde **0 milisaniye gecikmeyle**, tamamen çevrimdışı (offline) ve sıfır çökme riskiyle çalışan bir sistem elde edildi.

---

### Karar 4: CHORDCAT'in 8-Track Groovebox Olarak Konumlandırılması
* **Yanlış Anlama:** ChordCat'in bir bilgisayar hoparlörü gibi tarayıcıdaki rüzgar/su seslerini çalacağı sanılıyordu.
* **Doğru Mimari:**
  * Bilgisayardan ChordCat'e giden şey **ses değil, MIDI komutlarıdır** (USB MIDI Kanalları 1–8).
  * Sesi üreten şey **ChordCat'in kendi dahili synthesizer motorudur**.
  * Her görsel bölge, ChordCat'in bir kanalına bağlanmıştır (Örn: Adem = Track 1 Cello, Tanrı = Track 2 Koro, Kıvılcım = Track 3 Arp).
  * Tablo üzerinde gezinmek, bir DJ/prodüktörün mikser fader'larını canlı olarak açıp kapatması hissiyatını verir.
  * Tarayıcıdaki ses motoru, ChordCat masada bağlı değilken bile aynı akorları kusursuz simüle eden bir yedektir (fallback).

---

### Karar 5: İngilizce Sesli Rehber (Text-to-Speech — TTS)
* **Sorun:** Görme engelli bireyler için ekrandaki sesli betimleme metinlerinin hiçbir pratik değeri yoktur.
* **Karar:** 
  * Tarayıcının yerel **Web Speech API** motoru (`speechNarration.ts`) sisteme entegre edildi.
  * Ziyaretçi bir bölgeye girdiğinde, müzikle çatışmayan sakin bir İngilizce müze anlatıcısı (`en-US`/`en-GB`) devreye girer.
  * Ziyaretçi parmağını çektiğinde konuşma anında kesilir; kuyrukta bekleme veya seslerin birbirine girmesi önlenir.
  * Üst barda ve panelde tek tıkla sesli rehberi susturma (`Mute`) butonu eklendi.

---

### Karar 6: Histerezis ve Duraklama (Dwell Time) Durum Makinesi
* **Sorun:** Ziyaretçinin parmağı iki bölgenin sınırında titrediğinde, seslerin çıt-pıt kesilip sürekli yeniden başlaması (audio glitch / boundary flicker).
* **Karar:** `RegionStateMachine` sınıfı geliştirildi:
  * **Entry Dwell (140 ms):** Bir bölgeye sadece anlık değip geçildiğinde ses tetiklenmez; parmağın orada 140ms durması gerekir.
  * **Exit Dwell (200 ms):** Bölgeden çıkıldığında ses hemen bıçak gibi kesilmez; parmak geri dönerse akış bozulmaz.
  * **Retrigger Cooldown (400 ms):** Aynı bölgenin ardışık olarak hızlıca tetiklenip ses patlaması yapması engellenir.

---

## 3. Sistem Mimarisi ve Dosya Haritası

```
challenge-6-prototype/
├── public/
│   └── artworks/                      # 9 Tablonun optimize yüksek çözünürlüklü görselleri
│       ├── creation-of-adam.jpg
│       ├── the-scream.jpg
│       ├── the-kiss.jpg
│       ├── wanderer-fog.jpg
│       ├── woman-with-parasol.jpg
│       ├── raft-of-medusa.jpg
│       ├── arnolfini-portrait.jpg
│       ├── landscape-fields.jpg
│       └── pond-landscape.jpg
├── src/
│   ├── artwork/
│   │   ├── artworkTypes.ts           # ChordCat Track, Akor, Bölge ve Tablo tip tanımları
│   │   ├── regionLookup.ts           # Ray-casting (nokta çokgenin içinde mi?) & Alan hesabı
│   │   ├── pixelAnalysis.ts          # ITU-R BT.601 Parlaklık & Renk Sıcaklığı örnekleme
│   │   └── fixtures/                 # 9 Eserin önceden hazırlanmış müzikal partisyonları
│   │       ├── the-creation-of-adam.json
│   │       ├── the-scream.json
│   │       ├── the-kiss.json
│   │       ├── wanderer-fog.json
│   │       ├── woman-with-parasol.json
│   │       ├── raft-of-medusa.json
│   │       ├── arnolfini-portrait.json
│   │       ├── landscape-fields.json
│   │       ├── pond-landscape.json
│   │       ├── demo-artwork.json
│   │       └── index.ts              # Tüm eserleri dışa aktaran merkezi kayıt kütüğü
│   ├── interaction/
│   │   └── regionStateMachine.ts     # Dwell time, histerezis ve yaşam döngüsü yönetimi
│   ├── audio/
│   │   ├── ObjectSoundEngine.ts      # Polifonik akor synth, master filtre & USB MIDI köprüsü
│   │   └── speechNarration.ts        # Web Speech API İngilizce sesli rehber servisi
│   ├── components/
│   │   ├── ArtworkCanvas.tsx         # Görsel render, polygon çizimi ve parmak imleci
│   │   └── DebugPanel.tsx            # MIDI Manager, T1-T8 Test butonları, Metrikler, Rehber
│   ├── App.tsx                       # Ana orkestrasyon bileşeni
│   └── styles.css                    # Müze kiosk teması (yüksek kontrast, erişilebilir renkler)
```

---

## 4. Kürate Edilen 9 Başyapıtın Müzikal Haritası

| Tablo | Tonalite / BPM | Tematik Karakter | Öne Çıkan CHORDCAT Kanalları |
|---|---|---|---|
| **Michelangelo — *The Creation of Adam*** | D Dorian · 74 BPM | Rönesans ilahi ihtişamı vs. dünyevi yalnızlık | **T1:** Adam (`Dm9` Çello)<br>**T2:** God (`Fmaj9` Koro)<br>**T3:** Near Touch (`A7sus4` Kristal Arp)<br>**T4:** Cloak (`Bbmaj7#11` Yaylılar) |
| **Gustav Klimt — *The Kiss*** | Eb Major · 76 BPM | Art Nouveau altın ışıltısı, romantik kucaklaşma | **T1:** Man (`Ebmaj9` Korna)<br>**T2:** Woman (`Cm11` Arp/Yaylı)<br>**T3:** Faces (`Abmaj7#11` Keman/Celesta)<br>**T4:** Meadow (`Fm9` Gitar) |
| **Caspar David Friedrich — *Wanderer above the Sea of Fog*** | B Minor · 68 BPM | Alman Romantizmi, sisler denizi ve varoluşsal tefekkür | **T1:** Wanderer (`Bm9` Koranglo/Çello)<br>**T2:** Crag (`F#m7` Alt Bas)<br>**T3:** Fog (`Em11` Sis Korosu)<br>**T4:** Peaks (`Gmaj7` Alpin Korna) |
| **Claude Monet — *Woman with a Parasol*** | G Lydian · 90 BPM | Empresyonist gün ışığı, yaz esintisi ve beyaz elbise | **T1:** Parasol (`Gmaj7#11` Tahta Flüt)<br>**T2:** Madame Monet (`Dmaj9` Oda Yaylıları)<br>**T3:** Jean (`Bm7` Müzik Kutusu)<br>**T4:** Meadow (`E9` Bas) |
| **Edvard Munch — *The Scream*** | D Minor · 88 BPM | Dışavurumcu varoluşsal çığlık ve kan kırmızısı gökyüzü | **T1:** Figure (`Ddim7` Dissonant Çello)<br>**T2:** Sky (`Bb7#9` Gerilimli Pirinç)<br>**T3:** Bridge (`Gm6` Ahşap Ritim)<br>**T4:** Fjord (`Dm(maj7)` Piyano) |
| **Théodore Géricault — *The Raft of the Medusa*** | C Minor · 72 BPM | Romantik çaresizlik, fırtına dalgaları ve kurtuluş umudu | **T1:** Survivors (`Cm(maj7)` Trompet)<br>**T2:** Father (`Abmaj7#11` Ağıt Çellosu)<br>**T3:** Mast (`Fm9` Rüzgar Uğultusu)<br>**T4:** Waves (`Ebdim7` Dalga Bası) |
| **Jan van Eyck — *The Arnolfini Portrait*** | D Dorian · 78 BPM | Erken Flaman Rönesansı, kutsal evlilik yemini ve sessizlik | **T1:** Giovanni (`Dm11` Viola da Gamba)<br>**T2:** Bride (`Fmaj7#11` Klavsen)<br>**T3:** Hands (`Am9` Rönesans Lavtası)<br>**T4:** Mirror (`Csus2` Org) |
| **Maurice de Vlaminck — *Landscape with Red Trees*** | A Mixolydian · 102 BPM | Fovist çılgın enerji, saf vermilyon tarlalar ve kobalt gök | **T1:** Sky (`A7` Rüzgar Korno)<br>**T2:** Fields (`D9` Akustik Tıngırtı)<br>**T3:** Foliage (`Gmaj7` Ağır Bas)<br>**T4:** Red Tree (`F#m7` Obua) |
| **Pastoral Water Lily Pond & Meadow** | G Major · 80 BPM | Pastoral huzur, nilüfer göleti ve su pırıltıları | **T1:** Sky (`Gmaj7` Hava Pedi)<br>**T2:** Trees (`Em9` Gitar)<br>**T3:** Flowers (`Cadd9` Glockenspiel)<br>**T4:** Stream (`Am7` Elektrik Piyano) |

---

## 5. Donanım Kurulumu ve Sunum Öncesi Kontrol Listesi

### ChordCat Cihaz Ayarları (Hayati Önem Taşır)
1. **USB Bağlantısı:** USB-C kablosunu bilgisayara takın. Windows/Mac sürücü istemez (Class Compliant).
2. **MIDI Giriş Ayarı:** Cihaz üzerinde `Menu > MIDI IN Settings > Sync Source` ayarını mutlaka **`USB MIDI`** yapın.
3. **20 Dakika Kapanma Tuzağı:** Cihaz 20 dakika işlem yapılmazsa varsayılan olarak kapanır. `Menu > System / Power Settings > Auto Power Off = OFF` yapın.
4. **Ses Çıkışı:** Hoparlör veya kulaklığı **bilgisayara değil, ChordCat'in arkasındaki çıkışa** takın. Bilgisayardan yalnızca veri (MIDI) gider, gerçek müzik ChordCat'in içinden çıkar.
5. **Kapatırken:** Asla kabloyu çekmeyin; arkadaki Power tuşuna basılı tutarak kapatın.

### Arayüzden Doğrulama:
1. Tarayıcıyı açın (`http://localhost:5173/`).
2. Sağdaki **MIDI Hardware** kutusunda yeşil ışığı görün: `● Connected: ChordCat`.
3. Altındaki **T1, T2, T3...** butonlarına basarak ChordCat'in kanallarının ses verdiğini 5 saniyede test edin.

---

## 6. Jüri Karşısında Sunum Stratejisi (Pitch Guide)

### Sahne 1: Sorunu Tanımlayın (30 Saniye)
> *"Dünyanın en iyi müzelerine gidin; görme engelli bir ziyaretçiye verilen tek şey kuru, monoton bir sesli rehberdir. Ziyaretçi tablonun rengini, dokusunu, figürlerin birbirine olan mesafesini ve eserin ruhunu hissedemez."*

### Sahne 2: Çözümü Gösterin (1 Dakika)
> *"Biz tabloyu pasif bir nesne olmaktan çıkarıp, parmakla çalınan çok kanallı bir müzik aletine dönüştürdük. AlphaTheta CHORDCAT'in 8 kanalını tablonun anatomisine dağıttık."*
> 
> *(Adem'in Yaratılışı tablosunu açın ve mouse'u Adem'den Tanrı'ya doğru hareket ettirin)*
> 
> *"Bakın, parmağım Adem'in üzerindeyken yalnız bir çello ve toprak bası duyuyoruz. İngilizce rehberimiz Adem'in uzanışını anlatıyor. Parmağımı temas noktasına kaydırdığımda yaşam kıvılcımı parıldayan bir arple kreşendo yapıyor. Tanrı'nın üzerine geldiğimde ilahi koro odayı dolduruyor. Karanlık bir yere gittiğimde ses boğuklaşıyor, aydınlıkta parıldıyor."*

### Sahne 3: "Kör biri mouse'u nasıl kullanır?" Sorusuna Yanıt
> *"Harika bir soru. Bu standın nihai müze kurulumunda ziyaretçinin önünde eserin 3D kabartmalı (rölyef) bir kopyası bulunur. Tavandaki minik bir kamera ziyaretçinin işaret parmağını MediaPipe ile takip eder. Ziyaretçi tabloya dokunduğunu hissederken, sistem parmağın koordinatını okuyup bu sesleri üretir. Bilgisayar ekranı yalnızca küratörün ve kolaylaştırıcının gördüğü bir kontrol panelidir."*
