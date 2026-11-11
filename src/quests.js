const STORAGE_KEY = "byw:progress";

export const QUESTS = [
  {
    id: "kerang",
    title: "Surat dalam Kerang",
    giver: "hambali",
    target: "durasid",
    item: "Surat kuno",
    offer: [
      "Nak, lihat ini... kerang yang kutebar tadi pagi buka sendiri, isinya surat kuno.",
      "Tulisannya masih jelas: alamatnya Kampung Panggung, nama Pak Durasid. Tapi siapa pengirimnya, entah.",
    ],
    accept: "Tolong antar ke Pak Durasid ya. Sepertinya dia harus membaca ini.",
    deliver: [
      "Surat ini... ini surat yang kutulis sendiri waktu muda, lalu kubuang ke laut karena takut dibaca orang.",
      "Ternyata ia sampai juga. Terima kasih, Nak. Kusimpan baik-baik selamanya.",
    ],
    done: "Setiap sore Pak Hambali menengok kerang-kerangannya sambil tersenyum.",
  },
  {
    id: "apam",
    title: "Apam untuk Pendaki",
    giver: "rosa",
    target: "jambri",
    item: "Tumpuk apam",
    offer: [
      "Teh, bantu Bu Rosa sebentar ya. Ada tumpuk apam hangat, titipan untuk Om Jambri.",
      "Sudah dua hari dia mendaki Bukit Meratus dan belum turun-turun. Nanti kelaparan di puncak.",
    ],
    accept: "Bawa pelan-pelan ya, jangan sampai remuk. Lewat taman ke arah barat, jalannya naik.",
    deliver: [
      "Oooh... baunya sudah kucium dari bawah. Apam Bu Rosa!",
      "Terima kasih, Teh. Dengan perut ini penuh, saya bisa lanjut mengukur puncak yang satu ini.",
    ],
    done: "Om Jambri turun dari bukit dengan perut kenyang dan cerita panjang.",
  },
  {
    id: "surat-kesal",
    title: "Surat Kesal",
    giver: "andi",
    target: "ketua",
    item: "Surat panas",
    offer: [
      "Kakak, ini surat buat Pak Ketua RT. Kutulis tadi siang, masih panas kesalkan...",
      "Tapi kalau kakak sudah sampai alun-alun... tolong bacanya pelan-pelan ya.",
    ],
    accept: "Dititip ya, Kak. Aku malu sendiri kalau yang mengantar aku.",
    deliver: [
      "Surat dari Andi? Bunyinya... 'Saya mundur dari jadi penjaga gerbang.'",
      "Hahaha, mau mundur kok ditegur 'Kamu memang cocok jadi penjaga gerbang, terus saja bertugas'. Suratnya jadi hiburan sore ini.",
      "Bilang ke Andi: besok dia jadi kepala regu. Yang kesal kok malah saya yang senang.",
    ],
    done: "Andi berdiri tegak di gerbang, kini dengan banjur kepala regu.",
  },
  {
    id: "bingkisan",
    title: "Bingkisan Buku",
    giver: "laila",
    target: "rina",
    item: "Bingkisan buku",
    offer: [
      "Ini bingkisan pensil dan buku tulis untuk siswa saya yang pindah ke samping masjid.",
      "Sudah seminggu saya tidak sempat menyusul. Bantu antar ya, pasti dia sudah merindukan pelajaran.",
    ],
    accept: "Sampaikan juga: besok pagi kelas dimulai lagi, dia boleh menulis di bangku mana saja.",
    deliver: [
      "Dari Bu Laila? Untuk saya?",
      "Terima kasih... besok saya datang. Saya memang merindukan menulis pelajaran hari itu.",
    ],
    done: "Sore itu, pelajaran di dekat masjid terdengar lagi suara membacanya.",
  },
  {
    id: "sarung",
    title: "Sarung Lama",
    giver: "rakim",
    target: "saribi",
    item: "Sarung diperbaiki",
    offer: [
      "Nak, sarung almarhumah istri saya sudah selesai kuperbaiki sendiri.",
      "Mbah Saribi yang menjahit ulang dulu, tapi sudah dua minggu belum ke taman. Kira-kira masih ingat jalannya?",
    ],
    accept: "Antar ke Mbah Saribi yang duduk di taman. Katakan... kainnya sudah selesai.",
    deliver: [
      "Sarung itu... si Rakim masih memegang janji kita waktu muda.",
      "Bilang padanya: sabar sedikit, saya segera datang mencicipi tape buatannya.",
    ],
    done: "Dua orang tua itu kembali menikup tawa di tepi taman.",
  },
];

const IDLE_LINES = {
  hambali: "Sungai hari ini tenang sekali ya.",
  rosa: "Apamnya baru digoreng, wangi kan?",
  andi: "Gerbang ini tetap ramai ya pengunjungnya.",
  laila: "Anak-anak suka belajar di taman.",
  rakim: "Rebana sore ini belum bunyi.",
  durasid: "Kampung ini dahulu tidak seperti ini.",
  jambri: "Puncaknya masih jauh tapi indah.",
  ketua: "Lingkungan rukun, kerja jadi ringan.",
  rina: "Ngaji sore dimulai sebentar lagi.",
  saribi: "Angin taman membuat ingatan segar.",
};

export function idleLine(npcId) {
  return IDLE_LINES[npcId] ?? "Hari yang indah, ya?";
}

export class QuestState {
  constructor() {
    this.status = {};
    this.outfit = null;
    this.sound = true;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        this.status = data.quests ?? {};
        this.outfit = data.outfit ?? null;
        this.sound = data.sound ?? true;
      }
    } catch {
      this.status = {};
    }
  }

  save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ quests: this.status, outfit: this.outfit, sound: this.sound }),
      );
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }

  of(id) {
    return this.status[id] ?? "offered";
  }

  accept(id) {
    this.status[id] = "active";
    this.save();
  }

  deliver(id) {
    this.status[id] = "done";
    this.save();
  }

  activeQuest() {
    return QUESTS.find((quest) => this.of(quest.id) === "active") ?? null;
  }

  nextQuest() {
    return QUESTS.find((quest) => this.of(quest.id) === "offered") ?? null;
  }

  allDone() {
    return QUESTS.every((quest) => this.of(quest.id) === "done");
  }

  reset() {
    this.status = {};
    this.save();
  }
}
