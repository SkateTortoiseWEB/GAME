export interface PromptDef {
  id: string;
  text: string;
  /** Short note shown under the prompt. */
  hint?: string;
  /** Seed answers (fast path only). Use "Canonical|alias|alias". Anything not here is judged by the LLM. */
  answers: string[];
  /** Set on generated "starts with" prompts; every accepted answer must begin with this letter. */
  letter?: string;
}

/**
 * A broad category that spawns "X that start with Y" prompts. Every category must have hundreds of real
 * members for each letter in `letters` (the LLM judges the long tail); `answers` is only a seed list
 * that skips the LLM for common answers and powers typo suggestions.
 */
export interface Category {
  id: string;
  /** Plural noun used in the prompt, e.g. "Animals" -> "Animals that start with B". */
  noun: string;
  /** Letters with hundreds of valid answers. */
  letters: string;
  answers: string[];
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export const CATEGORIES: Category[] = [
  { id: "animals", noun: "Animals", letters: "abcdefghklmnoprstw", answers: list("Aardvark,Albatross,Alligator,Alpaca,Anaconda,Ant,Anteater,Antelope,Armadillo,Baboon,Badger,Bat,Bear,Beaver,Bee,Beetle,Bison,Boar,Bobcat,Buffalo,Butterfly,Camel,Capybara,Caribou,Cat,Caterpillar,Chameleon,Cheetah,Chicken,Chimpanzee,Chinchilla,Chipmunk,Cobra,Cockroach,Cougar,Cow,Coyote,Crab,Crane,Crocodile,Crow,Deer,Dingo,Dog,Dolphin,Donkey,Dragonfly,Duck,Eagle,Eel,Elephant,Elk,Emu,Falcon,Ferret,Finch,Flamingo,Fox,Frog,Gazelle,Gecko,Gerbil,Giraffe,Goat,Goose,Gorilla,Grasshopper,Hamster,Hare,Hawk,Hedgehog,Heron,Hippopotamus|Hippo,Horse,Hummingbird,Hyena,Ibex,Iguana,Impala,Jackal,Jaguar,Jellyfish,Kangaroo,Kingfisher,Kiwi,Koala,Komodo Dragon,Kookaburra,Ladybug|Ladybird,Lemming,Lemur,Leopard,Lion,Lizard,Llama,Lobster,Lynx,Macaw,Manatee,Meerkat,Mongoose,Monkey,Moose,Mosquito,Moth,Mouse,Mule,Narwhal,Newt,Nightingale,Ocelot,Octopus,Okapi,Opossum|Possum,Orangutan,Orca|Killer Whale,Ostrich,Otter,Owl,Ox,Oyster,Panda,Panther,Parrot,Peacock,Pelican,Penguin,Pheasant,Pig,Pigeon,Platypus,Polar Bear,Porcupine,Puma,Quail,Rabbit,Raccoon,Rat,Raven,Reindeer,Rhinoceros|Rhino,Robin,Salamander,Salmon,Scorpion,Seahorse,Seal,Shark,Sheep,Skunk,Sloth,Snail,Snake,Sparrow,Spider,Squid,Squirrel,Starfish,Stingray,Stork,Swan,Tapir,Tarantula,Tiger,Toad,Tortoise,Toucan,Trout,Turkey,Turtle,Vulture,Wallaby,Walrus,Warthog,Wasp,Weasel,Whale,Wolf,Wolverine,Wombat,Woodpecker,Yak,Zebra") },
  { id: "cities", noun: "Cities", letters: "abcdfghklmnprstvw", answers: list("Abu Dhabi,Abuja,Accra,Addis Ababa,Algiers,Amman,Amsterdam,Ankara,Antananarivo,Apia,Ashgabat,Asuncion,Athens,Baghdad,Baku,Bamako,Bangkok,Beijing,Beirut,Belgrade,Berlin,Bern|Berne,Bishkek,Bogota,Brasilia,Bratislava,Brazzaville,Brussels,Bucharest,Budapest,Buenos Aires,Cairo,Canberra,Caracas,Colombo,Conakry,Copenhagen,Dakar,Damascus,Dhaka,Dublin,Doha,Edinburgh,Freetown,Gaborone,Georgetown,Hanoi,Harare,Havana,Helsinki,Islamabad,Jakarta,Jerusalem,Kabul,Kampala,Kathmandu,Khartoum,Kyiv|Kiev,Kigali,Kingston,Kinshasa,Kuala Lumpur,Kuwait City,La Paz,Lilongwe,Lima,Lisbon,Ljubljana,Lome,London,Luanda,Lusaka,Luxembourg,Madrid,Managua,Manama,Manila,Maputo,Mexico City,Minsk,Mogadishu,Monaco,Monrovia,Montevideo,Moscow,Muscat,Nairobi,Nassau,New Delhi|Delhi,Niamey,Nicosia,Nouakchott,Nuku'alofa,Oslo,Ottawa,Ouagadougou,Panama City,Paris,Phnom Penh,Podgorica,Port Moresby,Port-au-Prince,Prague,Pretoria,Pyongyang,Quito,Rabat,Reykjavik,Riga,Riyadh,Rome,San Jose,San Juan,San Salvador,Sanaa,Santiago,Santo Domingo,Sarajevo,Seoul,Singapore,Skopje,Sofia,Stockholm,Suva,Taipei,Tallinn,Tashkent,Tbilisi,Tegucigalpa,Tehran,Thimphu,Tirana,Tokyo,Tripoli,Tunis,Ulaanbaatar,Vaduz,Valletta,Victoria,Vienna,Vientiane,Vilnius,Warsaw,Washington D.C.|Washington|Washington DC,Wellington,Windhoek,Yaounde,Yerevan,Zagreb,New York,Los Angeles,Chicago,Houston,Phoenix,Philadelphia,San Antonio,San Diego,Dallas,San Francisco,Seattle,Boston,Miami,Atlanta,Denver,Las Vegas,Detroit,Portland,Austin,Nashville,New Orleans,Toronto,Montreal,Vancouver,Calgary,Sydney,Melbourne,Brisbane,Perth,Auckland,Mumbai,Bangalore,Kolkata,Chennai,Hyderabad,Shanghai,Shenzhen,Guangzhou,Chengdu,Hong Kong,Osaka,Kyoto,Nagoya,Sapporo,Busan,Istanbul,Dubai,Lagos,Casablanca,Cape Town,Johannesburg,Durban,Alexandria,Barcelona,Valencia,Seville,Milan,Naples,Turin,Florence,Venice,Munich,Hamburg,Frankfurt,Cologne,Lyon,Marseille,Nice,Manchester,Birmingham,Liverpool,Glasgow,Leeds,Rio de Janeiro,Sao Paulo,Salvador,Medellin,Cartagena,Guadalajara,Monterrey,Cancun,St Petersburg|Saint Petersburg,Krakow,Gdansk,Porto,Gothenburg,Bergen,Rotterdam,Antwerp,Geneva,Zurich,Salzburg,Dubrovnik,Split,Marrakech,Mombasa,Kyoto") },
  { id: "brands", noun: "Brands", letters: "abcdefghklmnoprstv", answers: list("Abarth,Acura,Alfa Romeo,Alpine,Aston Martin,Audi,Bentley,BMW,Bugatti,Buick,BYD,Cadillac,Chevrolet|Chevy,Chrysler,Citroen,Cupra,Dacia,Daewoo,Daihatsu,Dodge,DS,Ferrari,Fiat,Fisker,Ford,Genesis,GMC,Great Wall,Holden,Honda,Hummer,Hyundai,Infiniti,Isuzu,Jaguar,Jeep,Kia,Koenigsegg,Lamborghini,Lancia,Land Rover,Lexus,Lincoln,Lotus,Lucid,Mahindra,Maserati,Maybach,Mazda,McLaren,Mercedes-Benz|Mercedes,MG,Mini,Mitsubishi,Nissan,Opel,Pagani,Peugeot,Polestar,Pontiac,Porsche,Ram,Renault,Rimac,Rivian,Rolls-Royce,Rover,Saab,Saturn,Scion,Seat,Skoda,Smart,SsangYong,Subaru,Suzuki,Tata,Tesla,Toyota,Triumph,Vauxhall,Volkswagen|VW,Volvo,Wiesmann,Zenvo,Apple,Google,Microsoft,Amazon,Nike,Adidas,Puma,Samsung,Sony,Coca-Cola,Pepsi,McDonald's,Starbucks,Disney,Netflix,IKEA,Lego,Nintendo,Intel,Nvidia,Facebook,Meta,Instagram,Twitter,Spotify,Uber,Airbnb,Walmart,Target,Costco,Nestle,Kellogg's,Heinz,Cadbury,Hershey's,Oreo,Pringles,Doritos,Gucci,Prada,Chanel,Rolex,Levi's,Zara,H&M,Reebok,Under Armour,The North Face,Patagonia,Canon,Nikon,Panasonic,Philips,Siemens,Bosch,Dell,HP,Lenovo,Asus,Acer,IBM,Oracle,Adobe,Shell,BP,Visa,Mastercard,PayPal") },
  { id: "movies", noun: "Movies", letters: "abcdefghijlmnoprstw", answers: [] },
  { id: "songs", noun: "Songs", letters: "abcdefghilmnoprstwy", answers: [] },
  { id: "bands", noun: "Bands and music artists", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "tv-shows", noun: "TV shows", letters: "abcdefghilmnoprstw", answers: [] },
  { id: "fictional-characters", noun: "Fictional characters", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "plants", noun: "Plants, flowers and trees", letters: "abcdfghlmoprst", answers: [] },
  { id: "boys-names", noun: "Boys' names", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "girls-names", noun: "Girls' names", letters: "abcdefghjklmnoprstv", answers: [] },
  { id: "verbs", noun: "Verbs", letters: "abcdefghilmnoprstw", answers: [] },
  { id: "jobs", noun: "Jobs", letters: "abcdefghlmnoprst", answers: [] },
  { id: "surnames", noun: "Surnames", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "adjectives", noun: "Adjectives", letters: "abcdefghilmnoprstw", answers: [] },
];

/**
 * Hand-picked quirky prompts: odd constraints, specific angles, "X but not Y". They are narrower than the
 * categories above, so some have dozens rather than hundreds of valid answers. That is fine: the LLM
 * judges every answer against the exact wording, and the pre-generated list only seeds the fast path.
 */
export const NICHE_PROMPTS: PromptDef[] = [
  // Animals & nature
  { id: "red-things", text: "Things that are red", answers: [] },
  { id: "animals-stripes", text: "Animals with stripes", answers: [] },
  { id: "animals-no-legs", text: "Animals with no legs", answers: [] },
  { id: "nocturnal", text: "Animals that are awake at night", answers: [] },
  { id: "pink-animals", text: "Animals that can be pink", answers: [] },
  { id: "flowers-edible", text: "Flowers you can eat", answers: [] },
  { id: "trees-fruit", text: "Trees that grow something you can eat", answers: [] },
  { id: "insects-fly", text: "Insects that can fly", answers: [] },
  { id: "animals-one-word-two-meanings", text: "Animals that are also a word for something else", hint: "Like \"bat\", \"seal\" or \"crane\"", answers: [] },
  { id: "things-in-pond", text: "Things you might find in a pond", answers: [] },
  // Places
  { id: "landlocked", text: "Landlocked countries", answers: [] },
  { id: "rivers-flow-north", text: "Rivers longer than 300 miles", answers: [] },
  { id: "islands-people", text: "Islands people actually live on", answers: [] },
  { id: "mountain-ranges", text: "Mountain ranges and volcanoes", answers: [] },
  { id: "us-states-cities", text: "US cities that are also a first name", answers: [] },
  { id: "countries-flag-red", text: "Countries with red in their flag", answers: [] },
  { id: "things-airport", text: "Things you only see at an airport", answers: [] },
  { id: "things-beach", text: "Things you'd find on a beach", answers: [] },
  { id: "places-quiet", text: "Places where you have to be quiet", answers: [] },
  // Movies & TV
  { id: "number-movies", text: "Movies with a number in the title", answers: [] },
  { id: "animated-characters", text: "Animated characters who don't speak much", answers: [] },
  { id: "sidekicks", text: "Sidekicks and best friends in stories", answers: [] },
  { id: "villains", text: "Villains with a catchphrase or famous laugh", answers: [] },
  { id: "movie-one-word", text: "Movies with a one word title", answers: [] },
  { id: "sitcom-characters", text: "Sitcom characters", answers: [] },
  { id: "films-animals-title", text: "Movies with an animal in the title", answers: [] },
  { id: "tv-shows-set-school", text: "TV shows or movies set in a school", answers: [] },
  { id: "superheroes", text: "Superheroes and supervillains", answers: [] },
  // Music
  { id: "color-songs", text: "Songs with a color in the title", answers: [] },
  { id: "number-songs", text: "Songs with a number in the title", answers: [] },
  { id: "the-bands", text: "Bands with \"The\" in their name", answers: [] },
  { id: "instruments-blow", text: "Instruments you blow into", answers: [] },
  { id: "instruments-strike", text: "Instruments you hit", answers: [] },
  { id: "songs-weather", text: "Songs with weather in the title", answers: [] },
  { id: "songs-names-title", text: "Songs with a person's name in the title", answers: [] },
  { id: "one-word-bands", text: "Bands with a single word name", answers: [] },
  { id: "musical-terms", text: "Words used in sheet music", answers: [] },
  // Words & names
  { id: "noun-verbs", text: "Words that are both a noun and a verb", hint: "Like \"run\", \"book\" or \"light\"", answers: [] },
  { id: "words-double-letters", text: "Words with a double letter", answers: [] },
  { id: "words-one-syllable-animals", text: "Words that rhyme with \"at\"", answers: [] },
  { id: "names-also-things", text: "First names that are also ordinary words", hint: "Like \"Rose\" or \"Hunter\"", answers: [] },
  { id: "words-ending-ing", text: "Words that end in \"ing\" but aren't verbs", answers: [] },
  { id: "compound-words", text: "Compound words made from two smaller words", answers: [] },
  { id: "words-five-letters-q", text: "Words that contain the letter Z", answers: [] },
  { id: "palindromes", text: "Words that read the same backwards", answers: [] },
  // Everything else
  { id: "wheels-not-transport", text: "Things with wheels that aren't transportation", answers: [] },
  { id: "phone-touch", text: "Parts of a phone you can touch", answers: [] },
  { id: "things-in-pocket", text: "Things people keep in their pockets", answers: [] },
  { id: "things-with-keys", text: "Things with keys that aren't a keyboard or a lock", answers: [] },
  { id: "things-with-teeth", text: "Things with teeth that aren't animals", answers: [] },
  { id: "things-with-eyes", text: "Things with eyes that can't see", answers: [] },
  { id: "things-with-handles", text: "Things with a handle", answers: [] },
  { id: "things-with-buttons", text: "Things with buttons that aren't clothes", answers: [] },
  { id: "things-in-bathroom", text: "Things you'd find in a bathroom cupboard", answers: [] },
  { id: "things-with-wings", text: "Things with wings that can't fly", answers: [] },
  { id: "things-squeeze", text: "Things you can squeeze", answers: [] },
  { id: "things-that-melt", text: "Things that melt", answers: [] },
  { id: "things-bounce", text: "Things that bounce", answers: [] },
  { id: "things-made-glass", text: "Things made of glass", answers: [] },
  { id: "things-in-garage", text: "Things you'd find in a garage or toolbox", answers: [] },
  { id: "things-sticky", text: "Things that are sticky", answers: [] },
  { id: "sports-ball", text: "Sports that don't use a ball", answers: [] },
  { id: "things-you-wear-feet", text: "Things you can wear on your feet", answers: [] },
  { id: "things-in-school-bag", text: "Things in a school bag", answers: [] },
];
