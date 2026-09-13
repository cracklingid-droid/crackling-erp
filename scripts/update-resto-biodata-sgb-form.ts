// Lengkapi biodata tim RESTO dari form Google "Data Karyawan Baru SGB"
// (link Kevin 2026-09-13, "update data tim resto terbaru"). SENGAJA
// hanya mengisi field yang MASIH KOSONG di database (tidak menimpa data
// yang sudah ada) - kecuali 2 koreksi NIK yang eksplisit dikonfirmasi
// Kevin (lihat FORCE_KTP_FIX di bawah, terbukti konsisten dgn tanggal
// lahir yang sama-sama tertulis di form, NIK lama di database jadi
// bulan tidak valid).
//
// TIDAK DIIMPOR (di luar cakupan skema/permintaan):
// - Kontak darurat (nama/no/hubungan) - tidak ada kolom di skema Employee.
// - Foto KTP (link Google Drive di form) - beda mekanisme dari upload
//   dokumen yang sudah ada (EmployeeDocument perlu file asli, bukan link).
// - Sabrina Nurhaliza: NIK di form rusak jadi notasi ilmiah ("1.67104E+15",
//   Sheets otomatis membulatkan angka panjang) - TIDAK dipakai, NIK yang
//   sudah ada di database (sudah benar formatnya) dibiarkan.
// - Calvin Natadihardja, Harry Amos Orlando Sitohang, Muhammad Sulthan
//   Zuhdi muncul di form ini juga TAPI mereka karyawan KANTOR (bukan
//   resto) - dilewati sesuai cakupan "tim resto" permintaan Kevin.
// - Raihan Said mengisi form 2x (18:31 & 18:34, cuma beda link foto KTP)
//   - dipakai submission KEDUA (lebih baru).
//
// Karyawan BARU (belum ada di database sama sekali): Banyu Putra Firdaus,
// Zidane Eldio Pratama, Riki Maulana (dikonfirmasi Kevin: orang BEDA dari
// "Rizky Maulana" yang sudah ada, bukan orang sama pindah outlet).
import { prisma } from "../lib/db";

function parseDMY(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
}
function gender(s: string): string {
  return s.trim() === "Perempuan" ? "P" : "L";
}

type FormRow = {
  name: string; // dipakai HANYA utk cari employee, bukan utk ubah field `name`
  gender: string;
  birthDate: string;
  ktp: string | null; // null = jangan sentuh field ktpNumber sama sekali (data rusak/tidak ada)
  address: string;
  phone: string;
  email: string;
  outlet: string;
  position: string;
  joinDate: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
};

const OUTLET_MAP: Record<string, string> = {
  "Central Kitchen - Joglo": "Joglo (Central Kitchen)",
  "Crackling Gading Serpong": "Gading Serpong",
  "Crackling Kelapa Gading": "Kelapa Gading",
  "Fatgai Gading Serpong": "Fatgai",
};

// (employeeId, data) - karyawan yang SUDAH ADA, cari by id supaya presisi
// (bukan by nama, menghindari salah cocok krn typo/singkatan).
const EXISTING: { id: number; row: FormRow }[] = [
  { id: 14, row: { name: "Kevin Ano Ariyanto", gender: "Laki - Laki", birthDate: "19/05/2006", ktp: "3172021905060012", address: "JL. Enim 2 No.157 Rt.004/010 Kelurahan Sungai Bambu, Kecamatan Tj. Priok, Kota Jakarta Utara, Provinsi DKI Jakarta.", phone: "085923080340", email: "kevinanoo19@gmail.com", outlet: "Central Kitchen - Joglo", position: "Kitchen Crew", joinDate: "03/07/2026", bankName: "BCA", bankAccountNumber: "6900918834", bankAccountHolder: "Kevin Ano Ariyanto" } },
  { id: 15, row: { name: "Raihan Said", gender: "Laki - Laki", birthDate: "26/09/2003", ktp: "3671062609030002", address: "JLN TANAH SERATUS RT001/RW001 NO 26 SUDIMARA JAYA KOTA TANGERANG", phone: "088289482413", email: "raihansaid68@gmail.com", outlet: "Central Kitchen - Joglo", position: "Central Kitchen", joinDate: "07/07/2026", bankName: "BCA", bankAccountNumber: "3452693981", bankAccountHolder: "Raihan said" } },
  { id: 16, row: { name: "Teguh Samudra", gender: "Laki - Laki", birthDate: "16/07/2005", ktp: "3173081606050001", address: "Jl.hj.gudig RT003/RW006 Kel.Meruya Selatan Kec.Kembangan Jakarta Barat No.56A", phone: "0895600791686", email: "samudrat310@gmail.com", outlet: "Central Kitchen - Joglo", position: "Kitchen Crew", joinDate: "06/07/2026", bankName: "BCA", bankAccountNumber: "2870467837", bankAccountHolder: "Teguh Samudra" } },
  { id: 32, row: { name: "Sanusi", gender: "Laki - Laki", birthDate: "02/11/2001", ktp: "3601080411900001", address: "Jl.Pdam Kp.Cicentang RT/RW 002/005 Rawa Buntu Serpong Tangerang Selatan Banten", phone: "081315528578", email: "sanusialbantaiig@gmail.com", outlet: "Fatgai Gading Serpong", position: "Kitchen Crew", joinDate: "12/06/2026", bankName: "BRI", bankAccountNumber: "039901050925504", bankAccountHolder: "SANUSI" } },
  { id: 17, row: { name: "Muhammad Rifai", gender: "Laki - Laki", birthDate: "25/10/2004", ktp: "1801162510040002", address: "Gg ,h.idi RT 01 RW 06 , gondrong kec.cipondoh kota Tangerang", phone: "089692561822", email: "muhammadrifai251004@gmail.com", outlet: "Crackling Gading Serpong", position: "Kitchen Crew", joinDate: "15/07/2026", bankName: "Dana", bankAccountNumber: "089692561822", bankAccountHolder: "Muhammad Rifa'i" } },
  { id: 28, row: { name: "Rifki Fariz Anwar", gender: "Laki - Laki", birthDate: "21/05/2004", ktp: "3203012105040005", address: "Jl. Sabilillah No.33, RT.004/RW.002, Medan Satria, Kecamatan Medan Satria, Kota Bks, Jawa Barat 17132", phone: "085717745194", email: "rifkioficial14@gmail.com", outlet: "Crackling Kelapa Gading", position: "Kitchen Crew", joinDate: "18/07/2026", bankName: "BCA", bankAccountNumber: "5681791346", bankAccountHolder: "RIFKI FARIZ ANWAR" } },
  { id: 29, row: { name: "Revan Somanatta", gender: "Laki - Laki", birthDate: "07/08/2004", ktp: "3171040708040002", address: "JL.KRAMAT PULO GG XXI", phone: "087835314580", email: "azferbussines@gmail.com", outlet: "Crackling Kelapa Gading", position: "Kitchen Crew", joinDate: "06/08/2026", bankName: "BCA", bankAccountNumber: "8770782318", bankAccountHolder: "Revan Somanatta" } },
  { id: 18, row: { name: "Audy Nur Azizah", gender: "Perempuan", birthDate: "03/04/2006", ktp: "3208084304060001", address: "Dusun Pahing RT 002/ RW 001 Desa Mancagar, Kecamatan Garawangi, Kabupaten Kuningan, Jawa Batat", phone: "083834907564", email: "audinurazizah@gmail.com", outlet: "Crackling Gading Serpong", position: "Waiter/Waitress", joinDate: "17/07/2026", bankName: "BNI", bankAccountNumber: "1916199655", bankAccountHolder: "Audy Nur Azizah" } },
  { id: 33, row: { name: "Fanny S Siburian", gender: "Perempuan", birthDate: "22/12/2000", ktp: "1216041212000001", address: "Kampung Rawa Buaya, gang jami Nurul medang nmr 2", phone: "085262883597", email: "fannysiburian22@gmail.com", outlet: "Fatgai Gading Serpong", position: "Waiter/Waitress", joinDate: "13/08/2026", bankName: "BCA", bankAccountNumber: "8832207071", bankAccountHolder: "Fanny s Siburian" } },
  { id: 31, row: { name: "Alce Forneta Bulan", gender: "Perempuan", birthDate: "15/03/2001", ktp: "5314065503010001", address: "Kos Namino Putri, Jln bidar 1D, No.22, Klp. Dua, kec. Klp. Dua, Kab, Tangerang", phone: "085810346665", email: "alceforneta@gmail.com", outlet: "Fatgai Gading Serpong", position: "Waiter/Waitress", joinDate: "14/12/2024", bankName: "BCA", bankAccountNumber: "6331371758", bankAccountHolder: "Alce Forneta Bulan" } },
  { id: 9, row: { name: "Ferdyansah agus saputra", gender: "Laki - Laki", birthDate: "25/08/2004", ktp: "3518082508040002", address: "Cengkareng jakarta barat", phone: "0895420271030", email: "syah00046@gmail.com", outlet: "Crackling Kelapa Gading", position: "Waiter/Waitress", joinDate: "17/06/2025", bankName: "BCA", bankAccountNumber: "4610662485", bankAccountHolder: "Ferdyansah" } },
  { id: 6, row: { name: "Ahmad Yani", gender: "Laki - Laki", birthDate: "08/10/2005", ktp: "3212020810050003", address: "Jln raya hj.abdullah Gang Rafi Udin Pakulonan Barat Rt05 Rw03 kec.kelapa dua, kab. Tangerang", phone: "083148138073", email: "ahmmadyanni10@gmail.com", outlet: "Crackling Gading Serpong", position: "Waiter/Waitress", joinDate: "04/11/2024", bankName: "BCA", bankAccountNumber: "5205037915", bankAccountHolder: "Ahmad Yani" } },
  { id: 2, row: { name: "Renaldi Leo Tarigan", gender: "Laki - Laki", birthDate: "16/08/1997", ktp: "3201331608970007", address: "jln hj kasam rt 03 rw 08 no 29 kec. meruya selatan keluruhan: kembangan kota jakarta barat", phone: "081292875512", email: "renalleo96@gmail.com", outlet: "Central Kitchen - Joglo", position: "Kitchen Crew", joinDate: "11/08/2025", bankName: "BCA", bankAccountNumber: "2880127091", bankAccountHolder: "RENALDI LEO TARIGAN" } },
  { id: 27, row: { name: "Ridho ananta", gender: "Laki - Laki", birthDate: "19/08/2007", ktp: "3171031908070002", address: "Cempaka putih", phone: "085219477822", email: "anantaridho19@gmail.com", outlet: "Crackling Kelapa Gading", position: "Runner", joinDate: "01/05/2026", bankName: "Seabank", bankAccountNumber: "901941347552", bankAccountHolder: "Ridho Ananta" } },
  { id: 8, row: { name: "Sabrina nurhaliza", gender: "Perempuan", birthDate: "16/09/2004", ktp: null, address: "Jl kutilang raya no 11 a MJI 2 Rt.004 Rw. 014 Kel. Mekarsari Kec. Tambun Selatan", phone: "089654693918", email: "Sabrinanurhaliza1609@gmail.com", outlet: "Crackling Kelapa Gading", position: "Waiter/Waitress", joinDate: "07/12/2024", bankName: "BCA", bankAccountNumber: "0070991691", bankAccountHolder: "Sabrina nurhaliza" } },
  { id: 5, row: { name: "Sekar Mayang Febri Rahayu", gender: "Perempuan", birthDate: "15/02/1999", ktp: "3671115502990003", address: "H sikam 2 rt 02 RW 13Kunciran Indah, Kec. Pinang, Kota Tangerang", phone: "085161661599", email: "sekarmayangfeb15@gmail.com", outlet: "Crackling Gading Serpong", position: "Waiter/Waitress", joinDate: "26/02/2023", bankName: "BNI", bankAccountNumber: "6041421310", bankAccountHolder: "Sekar Mayang Febri Rahayu" } },
  // Valentino & Titus: NIK di bawah SENGAJA ditimpa (FORCE_KTP_FIX, dikonfirmasi Kevin)
  { id: 4, row: { name: "Valentino kurniawan", gender: "Laki - Laki", birthDate: "14/02/2001", ktp: "3671081402010007", address: "Griya sangiang mas jalan bungga raya blok d.3 no.3 kota tangerang", phone: "081284086141", email: "Valentinokurniawan46@gmail.com", outlet: "Crackling Gading Serpong", position: "Kitchen Crew", joinDate: "01/09/2022", bankName: "BCA", bankAccountNumber: "1082457989", bankAccountHolder: "Valentino kurniawan" } },
  { id: 3, row: { name: "Titus Wegi Ziraluo", gender: "Laki - Laki", birthDate: "22/07/2003", ktp: "1214102207030002", address: "Jl.cibogo wetan.provinsi Banten.kab.kota Tangerang Selatan Kec.kelapa dua.", phone: "085135412493", email: "tituszl2203@gmail.com", outlet: "Crackling Gading Serpong", position: "Kitchen Crew", joinDate: "02/12/2023", bankName: "BCA", bankAccountNumber: "7485351451", bankAccountHolder: "Titus Wegi Ziraluo" } },
  { id: 22, row: { name: "made putra wijaya", gender: "Laki - Laki", birthDate: "29/03/2005", ktp: "1801142903050001", address: "Jl. Asem No.108, RT.4/RW.1, Klp. Dua, Kecamatan Kelapa Dua, Kabupaten Tangerang, Banten 15810", phone: "082182048140", email: "madeputrawijaya2@gmail.com", outlet: "Crackling Gading Serpong", position: "Kitchen Crew", joinDate: "30/07/2026", bankName: "BCA", bankAccountNumber: "5798016088", bankAccountHolder: "MADE PUTRA WIJAYA" } },
  { id: 10, row: { name: "m rovi hakiki samsi", gender: "Laki - Laki", birthDate: "09/07/2006", ktp: "3173040907061001", address: "jl.sawahlio v gg kiara dlm no 152 13/05 kel.jembatan lima kec.tambora jakarta barat dki jakarta", phone: "08979568024", email: "mrovihakikisamsi@gmail.com", outlet: "Crackling Kelapa Gading", position: "Waiter/Waitress", joinDate: "14/04/2025", bankName: "BCA", bankAccountNumber: "1790386872", bankAccountHolder: "m rovi hakiki samsi" } },
  { id: 21, row: { name: "jerrel iphin tan darmawang", gender: "Laki - Laki", birthDate: "12/01/2006", ktp: "7172051201062002", address: "curug sangerang", phone: "087865938026", email: "jerreltan12@gmail.com", outlet: "Crackling Gading Serpong", position: "Kitchen Crew", joinDate: "01/08/2026", bankName: "BCA", bankAccountNumber: "0530523632", bankAccountHolder: "jerrel iphin tan darmawang" } },
];

// Karyawan BARU - belum ada sama sekali di database.
const NEW_EMPLOYEES: FormRow[] = [
  { name: "Banyu Putra Firdaus", gender: "Laki - Laki", birthDate: "31/08/2003", ktp: "3174053108031001", address: "Jl. Muchtar3 rt 03/10, Kreo, Kec Larangan, Kota Tanggerang", phone: "089509873591", email: "bnyuptraa@gmail.com", outlet: "Crackling Gading Serpong", position: "Waiter/Waitress", joinDate: "14/07/2026", bankName: "BCA", bankAccountNumber: "7105302118", bankAccountHolder: "Banyu Putra Firdaus" },
  { name: "Riki Maulana", gender: "Laki - Laki", birthDate: "11/08/2001", ktp: "3201181108010003", address: "Kp,Rali RT 005/007 Desa Sukasari Kec.Rumpin Kab.Bogor", phone: "083834691279", email: "rikimaulana110801@gmail.com", outlet: "Fatgai Gading Serpong", position: "Waiter/Waitress", joinDate: "04/09/2026", bankName: "SEABANK", bankAccountNumber: "901188067025", bankAccountHolder: "Riki Maulana" },
  { name: "Zidane Eldio Pratama", gender: "Laki - Laki", birthDate: "07/01/2006", ktp: "3216050701060003", address: "Sentra Gading Serpong, Jl. Boulevard Raya Gading Serpong, Klp. Dua, Kecamatan Kelapa Dua, Kabupaten Tangerang, Banten 15810 RT 008.RW.001", phone: "085693556413", email: "eldiozidane@gmail.com", outlet: "Fatgai Gading Serpong", position: "Kitchen Crew", joinDate: "31/08/2026", bankName: "SEABANK", bankAccountNumber: "901863463407", bankAccountHolder: "ZIDANE ELDIO PRATAMA" },
];

const FORCE_KTP_FIX = new Set([4, 3]); // Valentino, Titus - dikonfirmasi Kevin

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let updatedCount = 0;
  let fieldsFilledTotal = 0;

  for (const { id, row } of EXISTING) {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) {
      console.log(`[LEWATI] id=${id} (${row.name}) tidak ditemukan di database`);
      continue;
    }
    const data: Record<string, unknown> = {};
    const fill = (field: string, value: unknown) => {
      if ((emp as Record<string, unknown>)[field] == null || (emp as Record<string, unknown>)[field] === "") {
        data[field] = value;
      }
    };

    fill("gender", gender(row.gender));
    fill("birthDate", parseDMY(row.birthDate));
    fill("address", row.address);
    fill("phone", row.phone);
    fill("email", row.email);
    fill("position", row.position);
    fill("joinDate", parseDMY(row.joinDate));
    fill("bankName", row.bankName);
    fill("bankAccountNumber", row.bankAccountNumber);
    fill("bankAccountHolder", row.bankAccountHolder);
    if (row.ktp) {
      if (FORCE_KTP_FIX.has(id)) data.ktpNumber = row.ktp; // timpa sengaja, dikonfirmasi Kevin
      else fill("ktpNumber", row.ktp);
    }
    // outlet: isi kalau kosong, TIDAK menimpa (mis. kalau sudah dipindah outlet lain)
    fill("outlet", OUTLET_MAP[row.outlet] ?? row.outlet);

    const fieldCount = Object.keys(data).length;
    if (fieldCount === 0) {
      console.log(`${emp.name} (id=${id}): tidak ada field kosong yang perlu diisi`);
      continue;
    }
    console.log(`${emp.name} (id=${id}): ${fieldCount} field diisi ->`, Object.keys(data).join(", "));
    fieldsFilledTotal += fieldCount;
    updatedCount++;
    if (!dryRun) await prisma.employee.update({ where: { id }, data });
  }

  console.log(`\n=== Karyawan diupdate: ${updatedCount}, total field diisi: ${fieldsFilledTotal} ===\n`);

  for (const row of NEW_EMPLOYEES) {
    const existing = await prisma.employee.findFirst({ where: { name: row.name } });
    if (existing) {
      console.log(`[LEWATI] "${row.name}" sudah ada (id=${existing.id}) - tidak dibuat dobel`);
      continue;
    }
    console.log(`Membuat karyawan baru: ${row.name} (${OUTLET_MAP[row.outlet] ?? row.outlet})`);
    if (!dryRun) {
      await prisma.employee.create({
        data: {
          name: row.name,
          gender: gender(row.gender),
          birthDate: parseDMY(row.birthDate),
          ktpNumber: row.ktp,
          address: row.address,
          phone: row.phone,
          email: row.email,
          outlet: OUTLET_MAP[row.outlet] ?? row.outlet,
          position: row.position,
          joinDate: parseDMY(row.joinDate),
          bankName: row.bankName,
          bankAccountNumber: row.bankAccountNumber,
          bankAccountHolder: row.bankAccountHolder,
          status: "active",
        },
      });
    }
  }

  if (dryRun) console.log("\n[DRY RUN] tidak ada perubahan ditulis ke database.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
