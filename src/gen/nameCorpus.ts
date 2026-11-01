// Example names the name generator learns from, one list per "culture".
// All invented for this project. Add or change names to change how a culture sounds.
import type { RaceFamily } from "../core/types";

/** Names for non-human race families (SPEC §3.9). Humans use the regional NAME_CULTURES below. */
export const FAMILY_NAMES: Record<Exclude<RaceFamily, "human">, string[]> = {
  elf: [
    "Aelindor", "Sylvaris", "Elenwe", "Thalanor", "Lirael", "Caladrel", "Ithrenel", "Faelorn",
    "Aervanil", "Nimrael", "Silvathe", "Eloriel", "Valindra", "Mirethil", "Celevrin", "Aranwe",
    "Lothaniel", "Sereluin", "Galathor", "Ynnareth",
  ],
  dwarf: [
    "Kazdrun", "Durnhal", "Barazor", "Thrumgar", "Grondak", "Kharuk", "Dolgrin", "Bronzhal",
    "Ironvek", "Azkadur", "Mordhun", "Tharbek", "Gundrak", "Hammerdun", "Krogmar", "Dvalgrim",
    "Orzund", "Brokkhal", "Zhardum", "Felgrund",
  ],
  orc: [
    "Gorzug", "Urkhal", "Mogrash", "Skarnak", "Grubash", "Zugrot", "Thrakka", "Bolgruk",
    "Narzug", "Kragmok", "Ushnak", "Durgash", "Grimnar", "Morgruk", "Vrokka", "Gazhul",
    "Rukhar", "Zogmar", "Brakhul", "Uglok",
  ],
};

/** Example rulers' names by race family, for the same Markov chain. */
export const RULER_NAMES: Record<RaceFamily, { male: string[]; female: string[] }> = {
  human: {
    male: ["Aldric", "Bertrand", "Cedric", "Edmund", "Godfrey", "Harald", "Leofric", "Oswin", "Roland", "Theobald", "Wulfric", "Conrad"],
    female: ["Adela", "Beatrice", "Cecily", "Edith", "Helena", "Isolde", "Matilda", "Rosamund", "Sibyl", "Theodora", "Ysolde", "Eleanor"],
  },
  elf: {
    male: ["Aerandir", "Caladon", "Elrion", "Faelar", "Galion", "Ithilion", "Lorendil", "Mithrandel", "Saelon", "Thandor", "Valion", "Erevan"],
    female: ["Aerin", "Celeste", "Elanor", "Faeliel", "Galadwen", "Ithiliel", "Lorien", "Miriel", "Saelwen", "Thaliel", "Vanyel", "Arwen"],
  },
  dwarf: {
    male: ["Balgrim", "Dorin", "Durgan", "Gimrak", "Hargrim", "Kazgar", "Morgrin", "Thorgrim", "Ungrim", "Brokk", "Skorri", "Valdrin"],
    female: [],
  },
  orc: {
    male: ["Azgrim", "Bolgar", "Drogga", "Gorbash", "Grukk", "Krushak", "Morzog", "Narzug", "Ragnok", "Skarrok", "Urzog", "Zurgash"],
    female: [],
  },
};

export const NAME_CULTURES: { label: string; examples: string[] }[] = [
  {
    label: "northern",
    examples: [
      "Kethar", "Valdrun", "Skarheim", "Thorvik", "Grimsa", "Eldrak", "Hrothen", "Braskor",
      "Varnheld", "Skoldra", "Ulvgard", "Dreknor", "Halvik", "Torsund", "Ormsveld", "Kargath",
      "Jorvald", "Steinar", "Frosku", "Haldrek",
    ],
  },
  {
    label: "southern",
    examples: [
      "Velmora", "Saliren", "Imarea", "Lysandor", "Orvelia", "Calimar", "Seravin", "Aurelith",
      "Nasiria", "Tavelline", "Valessa", "Mirathel", "Solandra", "Carivel", "Elunare", "Thalvessa",
      "Ombrelle", "Seliora", "Amarine", "Pelloria",
    ],
  },
  {
    label: "eastern",
    examples: [
      "Zharuun", "Tazrah", "Imrakhan", "Sulvesh", "Qarandi", "Zhemir", "Arvashan", "Kharoum",
      "Nezrith", "Ushkara", "Tamarzi", "Vashtir", "Zerakhet", "Ashuran", "Mezrabad", "Khazir",
      "Sarnaq", "Ilzaran", "Barakhel", "Qushet",
    ],
  },
  {
    label: "western",
    examples: [
      "Brynmor", "Caeldun", "Llanveth", "Dunmorrow", "Aberwyn", "Carrowen", "Tirnagh", "Morvenna",
      "Eskendell", "Bryngal", "Lochmere", "Kilvaren", "Penvarrow", "Glennoch", "Rhoswen", "Cadwell",
      "Dunvegal", "Mairwen", "Tregaron", "Ardlan",
    ],
  },
];
