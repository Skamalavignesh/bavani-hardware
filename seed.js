// Initial data. Every product starts at ₹1 (placeholder) – change it in the admin panel.
// Items marked "confirmed: false" are typical hardware-shop items not yet verified with the
// owner; they start hidden and can be switched on in the admin panel.
module.exports = function (uid) {
  const C = (name, icon, items) => ({ id: uid(), name, icon, description: "", visible: true, items });
  const cats = [
    C("Paints & Primers", "🎨", [
      ["Enamel Paint", "Rubilux", true], ["Primer", "", true],
      ["Rockfort Paints", "Rockfort", true], ["Goodluck Paints", "Goodluck", true], ["Akshaya Paints", "Akshaya", true],
      ["Emulsion Paint", "", false], ["Distemper", "", false], ["Wood Polish & Varnish", "", false],
      ["Thinner", "", false], ["Wall Putty", "", false], ["Paint Brushes", "", false], ["Paint Rollers", "", false], ["Sandpaper", "", false],
    ]),
    C("Adhesives & Waterproofing", "🧪", [
      ["Pidilite Products", "Pidilite", true], ["Dr. Fixit Products", "Dr. Fixit", true],
      ["Fevicol", "Pidilite", false], ["M-Seal", "Pidilite", false], ["Tile Adhesive", "", false],
      ["Waterproofing Chemical", "Dr. Fixit", false], ["Silicone Sealant", "", false],
    ]),
    C("Cement", "🧱", [["Cement", "", true], ["White Cement", "", true]]),
    C("Sheets & Meshes", "🔩", [
      ["GI Roll", "", true], ["GI Sheet", "", true], ["PVC Coated Mesh", "", true], ["Nylon Mesh", "", true],
      ["Weld Mesh", "", true], ["Chicken Mesh", "", true],
      ["Roofing Sheet", "", false], ["Barbed Wire", "", false], ["Binding Wire", "", false],
    ]),
    C("Covers & Nets", "⛺", [["Tarpaulin", "", true], ["Green Sand Net", "", true]]),
    C("Rural & Agri Items", "🌾", [
      ["Perundurai Manvetti", "", true], ["Perundurai Kotthu", "", true], ["Rat Trap", "", true], ["Love Bird Cage", "", true],
      ["Sprayer", "", false], ["Garden Hose Pipe", "", false],
    ]),
    C("Iron & Fasteners", "⚙️", [
      ["Iron", "", true], ["PVC", "", true], ["MS", "", true], ["Polish Bonds (Satti)", "", true],
      ["Nails", "", false], ["Screws", "", false], ["Nuts & Bolts", "", false], ["Hinges", "", false],
      ["Door Bolts", "", false], ["Locks & Padlocks", "", false],
    ]),
    C("Tools", "🛠️", [
      ["Shovel", "", true], ["General Tools", "", true], ["Construction Tools", "", true], ["Agri Tools", "", true],
      ["Hammer", "", false], ["Spanner", "", false], ["Pliers", "", false], ["Screwdriver", "", false],
      ["Drill Bits", "", false], ["Measuring Tape", "", false], ["Spirit Level", "", false], ["Trowel", "", false], ["Pickaxe", "", false],
    ]),
    C("Cleaning Items", "🧴", [
      ["Hero Bathroom & Tile Cleaner", "Hero", true],
      ["Phenyl", "", false], ["Broom", "", false], ["Mop", "", false],
    ]),
    { ...C("Plumbing, Electrical & Safety", "🔌", [
      ["PVC Pipes & Fittings", "", false], ["Electrical Wires", "", false], ["Switches", "", false], ["Bulbs", "", false], ["Safety Gear", "", false],
    ]), visible: false },
  ];

  const products = [];
  for (const c of cats) {
    for (const [name, brand, confirmed] of c.items)
      products.push({ id: uid(), categoryId: c.id, name, brand, price: 1, unit: "", description: "", image: "", inStock: true, visible: confirmed });
    delete c.items;
  }

  return {
    settings: {
      shopName: "Bhavani Hardware & Paints",
      tagline: "Pollachi",
      heroTitle: "Everything for your building & hardware needs",
      heroText: "Paints, cement, meshes, tools and more – quality materials at fair prices, from a trusted Pollachi shop with over 20 years of experience.",
      address: "35/313, Market Road, Vinayagar Kovil, Pollachi, Tamil Nadu 642001",
      phone1: "95973 65105",
      phone2: "97156 90425",
      whatsapp: "919597365105",
      instagram: "https://www.instagram.com/hardwareshoppollachi/",
      hours: "Daily, closes 10:30 pm",
      mapQuery: "10.6557091,77.0058061",
      about: "We are a hardware and paint shop that stocks everything builders, farmers and households need – from paints, cement and meshes to tools and agri items. Our customers value our fair prices, good quality and flexible timing.",
      currency: "₹",
      showPrices: true,
      brands: ["Rubilux Paints", "Rockfort Paints", "Goodluck Paints", "Pidilite", "Dr. Fixit", "Akshaya"],
      reviews: [
        "They offer a wide range of quality tools and materials at fair prices.",
        "Good service and flexible timing.",
        "Good quality products at the best price.",
      ],
    },
    categories: cats,
    products,
  };
};
