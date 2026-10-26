// Street lore from Wikipedia's "Rats in New York City", paraphrased (text is
// CC BY-SA 4.0). Pinned to one revision so every link shows what was read.
// Each clipping links to the section it came from; where our own 311 data or
// the article's citation adds context, a tie-in says so.

export const LORE_REVISION = 1372823417;
export const LORE_URL = `https://en.wikipedia.org/w/index.php?title=Rats_in_New_York_City&oldid=${LORE_REVISION}`;

const yearTotal = (data, year) =>
  data.rows.reduce((sum, [month, , , count]) => (month.startsWith(year) ? sum + count : sum), 0);
const monthTotal = (data, month) =>
  data.rows.reduce((sum, [m, , , count]) => (m === month ? sum + count : sum), 0);
const fmt = (n) => new Intl.NumberFormat("en-US").format(n);

export const LORE = [
  {
    id: "brown-beat-black",
    era: "1944 →",
    headline: "Brown beat black.",
    body: "As recently as 1944 New York had two common rat species, the brown (Norway) rat and the black (roof) rat. Over the next decades the bigger, more aggressive brown rat pushed the black rat out, attacking it and outcompeting it for food and shelter. Today the city's rats are overwhelmingly brown.",
    section: "Species",
  },
  {
    id: "uptown-downtown",
    era: "2018",
    headline: "Uptown rats, downtown rats.",
    body: "A 2018 genetic study found two distinct clusters of Manhattan rats, one north of 59th Street and one south of 14th Street, with Midtown's buildings limiting how genes flow between them. Both groups most likely descend from rats that came over from Britain.",
    section: "Genetics",
  },
  {
    id: "quarter",
    era: "ANATOMY",
    headline: "A quarter is a door.",
    body: "A rat's skull isn't fused into one rigid plate, so it can squeeze through a gap about the size of a quarter. Rats also tend to stick to the same tight, well-worn paths to their food.",
    section: "Habits",
  },
  {
    id: "one-ounce",
    era: "DIET",
    headline: "An ounce a day keeps a rat in business.",
    body: "A rat gets by on roughly an ounce of food and an ounce of water a day. That is a few bites from a curbside bag, which is why overnight trash and littering keep the city's rats fed.",
    section: "Food_and_shelter",
    tie: { kind: "Fine print", text: () => "NYC Health's own Rat Academy training gives the same figure: about 1 ounce of food and 1 ounce of water per day." },
  },
  {
    id: "colonies",
    era: "FIELD NOTES",
    headline: "Thirty to fifty to a colony?",
    body: "The article puts New York colonies at 30 to 50 rats, living 100 to 400 feet from their food and rarely straying more than 600 feet from where they were born.",
    section: "Food_and_shelter",
    tie: {
      kind: "Fine print",
      text: () =>
        "All three numbers cite one 2014 DNAinfo how-to article, not a field count. Colony size is the least-measured number in any estimate of how many rats New York has.",
    },
  },
  {
    id: "fleas",
    era: "2015",
    headline: "Five fleas per rat.",
    body: "A 2015 Columbia–Cornell study found an average of five fleas per rat, including fleas that can carry disease-causing bacteria. A 1925 study had found that one in five rats carried no fleas at all.",
    section: "Public_health",
  },
  {
    id: "czars",
    era: "2000 / 2023",
    headline: "The rat czars.",
    body: "In July 2000 Mayor Rudy Giuliani's administration set up a rat task force led by a \"rat czar\", Joe Lhota. In April 2023 Mayor Eric Adams appointed the city's first director of rodent mitigation, Kathleen Corradi, a former elementary school teacher.",
    section: "Governmental_attempts_to_mitigate_infestations",
  },
  {
    id: "dry-ice",
    era: "2017",
    headline: "$32 million, and dry ice.",
    body: "In July 2017 the city announced a $32 million plan to cut rat infestations by 70% by the end of 2018 in the East Village, Chinatown, the Lower East Side, the Concourse, Bedford–Stuyvesant and Bushwick: rat-proof trash cans, covered basement dirt floors, and a proposal to suffocate rats by pouring dry ice into their burrows.",
    section: "Governmental_attempts_to_mitigate_infestations",
  },
  {
    id: "trash-time",
    era: "2023",
    headline: "Trash o'clock moved to 8 p.m.",
    body: "From April 2023, buildings could no longer put garbage on the curb at 4 p.m. on collection days; the new time is 8 p.m., so bags spend fewer hours as a buffet. Between August 2023 and March 2024, rules required businesses to put their trash out in sturdy bins.",
    section: "Governmental_attempts_to_mitigate_infestations",
  },
  {
    id: "seventy-one",
    era: "2020–23",
    headline: "Sightings up 71 percent.",
    body: "Wikipedia reports that rat sightings rose 71% from 2020 to 2023, part of the backdrop to the City Council's 2022 Rat Action Plan.",
    section: "Governmental_attempts_to_mitigate_infestations",
    tie: {
      kind: "Our data",
      text: (data) => {
        const a = yearTotal(data, "2020"),
          b = yearTotal(data, "2023");
        return `311 rat-sighting reports in this atlas went from ${fmt(a)} in 2020 to ${fmt(b)} in 2023, ${b >= a ? "+" : ""}${Math.round((b / a - 1) * 100)}%. The 71% likely counts a broader set of complaints.`;
      },
    },
  },
  {
    id: "pizza-rat",
    era: "2015",
    headline: "Pizza Rat goes global.",
    body: "In 2015 a video of a subway rat carrying a slice of pizza, \"Pizza Rat\", was trending worldwide within 15 hours of its upload and passed 5 million views in two days. It even spawned staged copycats with trained rats.",
    section: "Viral_videos",
  },
  {
    id: "ida",
    era: "2021",
    headline: "After Ida.",
    body: "When the remnants of Hurricane Ida flooded the sewers in 2021, dozens of dead rats washed up along the city's waterways. Nobody counts sewer rats, but experts suspected one of the biggest rat die-offs in decades.",
    section: "Hurricane_Ida_depopulation_event",
    tie: {
      kind: "Our data",
      text: (data) =>
        `311 reports didn't dip: ${fmt(monthTotal(data, "2021-08"))} in August 2021, ${fmt(monthTotal(data, "2021-09"))} in September and ${fmt(monthTotal(data, "2021-10"))} in October. Reports measure people noticing rats, and sewer rats are rarely seen.`,
    },
  },
  {
    id: "dogs",
    era: "NOW",
    headline: "Hunting with dogs.",
    body: "Private groups such as the Ryders Alley Trencher-fed Society hunt rats in New York with dogs.",
    section: "Control",
  },
  {
    id: "firehouse",
    era: "2003",
    headline: "The firehouse that fell to rats.",
    body: "In 2003 rats took over a fire station on Hillside Avenue in Queens. After exterminators visited 26 times between March and August, the building was condemned and gutted, and its 60 staff moved to nearby firehouses.",
    section: "Destruction_of_infrastructure",
  },
];

export function loreTie(fact, data) {
  return fact.tie ? { kind: fact.tie.kind, text: fact.tie.text(data) } : null;
}
