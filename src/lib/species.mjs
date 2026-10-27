// Know your neighbour: facts about Rattus norvegicus, paraphrased from two
// sources and tagged with the one each comes from.
export const SOURCES = {
  wiki: {
    label: "Wikipedia, “Brown rat”",
    url: "https://en.wikipedia.org/w/index.php?title=Brown_rat&oldid=1382038797",
    license: "CC BY-SA 4.0",
  },
  paper: {
    label: "Hulme-Beaman, Orton & Cucchi (2021), Animal Frontiers 11(3)",
    url: "https://doi.org/10.1093/af/vfab020",
    license: "CC BY 4.0",
  },
};

// Hotspots sit on the atlas's rat illustration (viewBox 240 x 140).
export const ANATOMY = [
  {
    id: "nose",
    label: "Nose",
    x: 214,
    y: 97,
    title: "A nose for it.",
    text: "The brown rat has a very highly developed sense of smell, and some of it may be borrowed: after splitting from the Himalayan field rat, the two species kept interbreeding, and genes for smell receptors flowed into brown rats.",
    source: "wiki",
    section: "Evolution",
  },
  {
    id: "eye",
    label: "Eye",
    x: 175,
    y: 80,
    title: "Blurry, but ultraviolet.",
    text: "Eyesight is poor, around 20/600 for a pigmented rat. Rats see colour roughly like a person with red-green colour blindness, but their blue-sensitive cones also pick up ultraviolet light that humans can't see.",
    source: "wiki",
    section: "Description",
  },
  {
    id: "ear",
    label: "Ear",
    x: 141,
    y: 42,
    title: "They laugh in ultrasound.",
    text: "Hearing is acute and reaches into ultrasound. Rats chirp at ultrasonic pitch during rough-and-tumble play and when tickled, a sound researchers liken to laughter. It is too high for humans to hear without a bat detector.",
    source: "wiki",
    section: "Communication",
  },
  {
    id: "heart",
    label: "Heart",
    x: 118,
    y: 74,
    title: "Living in the fast lane.",
    text: "A resting heart beats 300 to 400 times a minute, with about 100 breaths a minute. The maximum lifespan is three years, but most wild rats barely make one: yearly mortality is estimated at 95%.",
    source: "wiki",
    section: "Description",
  },
  {
    id: "belly",
    label: "Litter",
    x: 96,
    y: 98,
    title: "The arithmetic of a litter.",
    text: "Pregnancy lasts just 21 days. Litters run up to 14 pups, with 7 common; pups mature in about five weeks, and a female can conceive again right after giving birth. Under ideal conditions, two rats could become 15,000 in a year.",
    source: "wiki",
    section: "Reproduction_and_life_cycle",
  },
  {
    id: "feet",
    label: "Feet",
    x: 79,
    y: 120,
    title: "Diggers and swimmers.",
    text: "Brown rats swim well, on the surface and underwater, and dig well. A new burrow usually starts against an object or structure that serves as a sturdy roof, then grows into tunnels on several levels with a second exit. Older males mostly stop digging.",
    source: "wiki",
    section: "Burrowing",
  },
  {
    id: "tail",
    label: "Tail",
    x: 26,
    y: 92,
    title: "Not as big as the stories.",
    text: "Head and body run 15 to 28 cm, and the tail, 10.5 to 24 cm, is shorter than both together. Adults weigh 140 to 500 g. Rats as big as cats are exaggerations, or misidentified larger rodents.",
    source: "wiki",
    section: "Description",
  },
  {
    id: "mouth",
    label: "Diet",
    x: 196,
    y: 117,
    title: "An omnivore with opinions.",
    text: "It eats almost anything, with cereals a big part of the diet. Its reported favourites are scrambled eggs, raw carrots and cooked corn; its least favourite, raw beets, peaches and raw celery. City rats live mainly on discarded human food.",
    source: "wiki",
    section: "Diet",
  },
];

export const STATS = [
  { value: "15–28 cm", label: "head and body" },
  { value: "140–500 g", label: "adult weight" },
  { value: "21 days", label: "pregnancy" },
  { value: "7", label: "pups in a typical litter (up to 14)" },
  { value: "~5 wks", label: "to maturity" },
  { value: "~1 yr", label: "typical life (3 at most)" },
];

export const TIMELINE = [
  {
    when: "0.9–2.9 million years ago",
    title: "A species apart",
    text: "Genetic evidence puts the brown rat's split from the other major Eurasian rats in the early to middle Pleistocene.",
    source: "paper",
  },
  {
    when: "7,000–9,000 years ago",
    title: "First neighbours",
    text: "The earliest finds confirmed by detailed shape analysis come from central or northern China, in people's refuse heaps as farming began. Its native range is usually given as northern China, Mongolia or south-eastern Siberia.",
    source: "paper",
  },
  {
    when: "1600s–1700s",
    title: "Pets in Edo Japan",
    text: "Japan kept fancy rats, most likely brown rats, during the Edo period; breeding guides from 1775 and 1787 describe their colour varieties.",
    source: "paper",
  },
  {
    when: "1700s",
    title: "Stowaways",
    text: "Ships carried it around the world. Accounts from France, England, Ireland and Denmark describe a new, larger rat driving out the rats already there; the earliest secure European find is an 18th-century shipwreck off Corsica.",
    source: "paper",
  },
  {
    when: "1769",
    title: "The wrong name",
    text: "John Berkenhout popularised Mus norvegicus, believing the rat had reached England on Norwegian ships in 1728. It isn't from Norway, and it isn't always brown.",
    source: "wiki",
    section: "Naming_and_etymology",
  },
  {
    when: "Early 1800s",
    title: "Bred for the pit",
    text: "In Europe, rats were bred for rat-baiting blood sports and as food for captive carnivores, the start of European domestication.",
    source: "paper",
  },
  {
    when: "Early 1900s",
    title: "Into the lab",
    text: "Laboratory strains were bred at the Wistar Institute in Philadelphia. Today the rat is one of the two great mammal models in biology, rivalled only by the mouse.",
    source: "paper",
  },
  {
    when: "Today",
    title: "New York neighbourhoods",
    text: "Studies of New York's wild rats find that populations in different neighbourhoods slowly develop distinct genetic profiles.",
    source: "wiki",
    section: "",
  },
];

export function sourceLink(fact) {
  const source = SOURCES[fact.source];
  return fact.source === "wiki" && fact.section ? `${source.url}#${fact.section}` : source.url;
}

// The species can breed year-round; NYC's reports still follow the seasons.
// Average complete months by calendar month, from the snapshot.
export function seasonalSwing(data) {
  const latest = data.coverage.to.slice(0, 7);
  const months = new Map();
  for (const [month, , , count] of data.rows)
    if (month < latest) months.set(month, (months.get(month) || 0) + count);
  const buckets = Array.from({ length: 12 }, () => []);
  for (const [month, count] of months) buckets[Number(month.slice(5)) - 1].push(count);
  const means = buckets.map((b) => b.reduce((a, c) => a + c, 0) / (b.length || 1));
  const high = means.indexOf(Math.max(...means)),
    low = means.indexOf(Math.min(...means));
  return { high, low, highMean: means[high], lowMean: means[low], ratio: means[high] / means[low] };
}
