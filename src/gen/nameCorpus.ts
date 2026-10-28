// Example names the name generator learns from, one list per "culture".
// All invented for this project. Add or change names to change how a culture sounds.

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
