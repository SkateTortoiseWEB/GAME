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
  { id: "foods", noun: "Foods", letters: "abcdefghlmnoprst", answers: list("Apple,Apricot,Avocado,Banana,Blackberry,Blueberry,Cantaloupe,Cherry,Clementine,Coconut,Cranberry,Currant,Date,Dragon Fruit|Pitaya,Durian,Elderberry,Fig,Gooseberry,Grape,Grapefruit,Guava,Honeydew,Jackfruit,Kiwi|Kiwifruit,Kumquat,Lemon,Lime,Lychee,Mandarin,Mango,Mulberry,Nectarine,Olive,Orange,Papaya|Pawpaw,Passion Fruit,Peach,Pear,Persimmon,Pineapple,Plantain,Plum,Pomegranate,Pomelo,Quince,Raspberry,Starfruit|Carambola,Strawberry,Tangerine,Tomato,Watermelon,Rambutan,Mangosteen,Tamarind,Boysenberry,Cherimoya,Lingonberry,Soursop,Ugli Fruit,Yuzu,Ackee,Acai,Bilberry,Bergamot,Breadfruit,Blood Orange,Cloudberry,Custard Apple,Damson,Dewberry,Feijoa,Greengage,Huckleberry,Jujube,Loganberry,Loquat,Longan,Medlar,Physalis|Cape Gooseberry,Prickly Pear,Salak,Sapodilla,Satsuma,Santol,Sloe,Sugar Apple,Tangelo,Tayberry,Salmonberry,Sea Buckthorn,Mirabelle,Marionberry,Naranjilla,Jabuticaba,Kiwano,Langsat,Surinam Cherry,Star Apple,Sapote,Saskatoon,Sultana,Tangor,Honeycrisp,Granny Smith,Gala,Fuji,Artichoke,Arugula|Rocket,Asparagus,Beetroot|Beet,Bell Pepper|Pepper,Bok Choy,Broccoli,Brussels Sprouts,Cabbage,Carrot,Cauliflower,Celery,Chard|Swiss Chard,Chickpea,Chili|Chilli,Collard Greens,Corn|Sweetcorn,Courgette|Zucchini,Cucumber,Daikon,Eggplant|Aubergine,Endive,Fennel,Garlic,Ginger,Horseradish,Jicama,Kale,Kohlrabi,Leek,Lettuce,Mushroom,Okra,Onion,Parsnip,Pea,Potato,Pumpkin,Radicchio,Radish,Rhubarb,Rutabaga|Swede,Scallion|Spring Onion|Green Onion,Shallot,Spinach,Squash,Sweet Potato,Taro,Turnip,Watercress,Yam,Butternut Squash,Cassava,Edamame,Green Bean|String Bean,Lima Bean,Kidney Bean,Napa Cabbage,Romaine,Tomatillo,Celeriac,Salsify,Samphire,Bean Sprouts,Brussels Sprout,Appenzeller,Asiago,Blue Cheese,Boursin,Brie,Brunost,Burrata,Camembert,Cantal,Cheddar,Colby,Comte,Cotija,Cottage Cheese,Cream Cheese,Danish Blue,Edam,Emmental|Emmentaler,Epoisses,Feta,Fontina,Gjetost,Gorgonzola,Gouda,Gruyere,Halloumi,Havarti,Jarlsberg,Labneh,Leerdammer,Limburger,Maasdam,Manchego,Mascarpone,Monterey Jack,Morbier,Mozzarella,Munster,Neufchatel,Oaxaca,Paneer,Parmesan|Parmigiano Reggiano,Pecorino,Pepper Jack,Port Salut,Provolone,Quark,Queso Fresco,Raclette,Red Leicester,Reblochon,Ricotta,Roquefort,Stilton,Swiss,Taleggio,Tilsit,Wensleydale,Double Gloucester,Cambozola,Burrata,Mimolette,Chevre|Goat Cheese,Gruyère,Pizza,Pasta,Burger|Hamburger,Sandwich,Taco,Burrito,Sushi,Ramen,Curry,Steak,Salad,Soup,Bread,Rice,Noodles,Pancake,Waffle,Omelette|Omelet,Bacon,Sausage,Ham,Chicken,Beef,Pork,Lamb,Salmon,Tuna,Shrimp,Chocolate,Cake,Cookie,Brownie,Donut|Doughnut,Ice Cream,Pie,Muffin,Bagel,Croissant,Pretzel,Popcorn,French Fries|Fries,Nachos,Lasagna,Spaghetti,Dumpling,Falafel,Hummus,Kebab,Paella,Risotto,Gnocchi,Pho,Pad Thai,Bibimbap,Tempura,Tofu,Yogurt,Butter,Egg,Honey,Peanut Butter,Oatmeal,Cereal,Granola,Lentils,Quinoa,Couscous,Hot Dog,Meatball,Pastrami,Quiche,Ravioli,Tiramisu,Cheesecake,Gelato,Churro,Empanada,Enchilada,Quesadilla,Guacamole,Salsa,Ketchup,Mustard,Mayonnaise") },
  { id: "cities", noun: "Cities", letters: "abcdfghklmnprstvw", answers: list("Abu Dhabi,Abuja,Accra,Addis Ababa,Algiers,Amman,Amsterdam,Ankara,Antananarivo,Apia,Ashgabat,Asuncion,Athens,Baghdad,Baku,Bamako,Bangkok,Beijing,Beirut,Belgrade,Berlin,Bern|Berne,Bishkek,Bogota,Brasilia,Bratislava,Brazzaville,Brussels,Bucharest,Budapest,Buenos Aires,Cairo,Canberra,Caracas,Colombo,Conakry,Copenhagen,Dakar,Damascus,Dhaka,Dublin,Doha,Edinburgh,Freetown,Gaborone,Georgetown,Hanoi,Harare,Havana,Helsinki,Islamabad,Jakarta,Jerusalem,Kabul,Kampala,Kathmandu,Khartoum,Kyiv|Kiev,Kigali,Kingston,Kinshasa,Kuala Lumpur,Kuwait City,La Paz,Lilongwe,Lima,Lisbon,Ljubljana,Lome,London,Luanda,Lusaka,Luxembourg,Madrid,Managua,Manama,Manila,Maputo,Mexico City,Minsk,Mogadishu,Monaco,Monrovia,Montevideo,Moscow,Muscat,Nairobi,Nassau,New Delhi|Delhi,Niamey,Nicosia,Nouakchott,Nuku'alofa,Oslo,Ottawa,Ouagadougou,Panama City,Paris,Phnom Penh,Podgorica,Port Moresby,Port-au-Prince,Prague,Pretoria,Pyongyang,Quito,Rabat,Reykjavik,Riga,Riyadh,Rome,San Jose,San Juan,San Salvador,Sanaa,Santiago,Santo Domingo,Sarajevo,Seoul,Singapore,Skopje,Sofia,Stockholm,Suva,Taipei,Tallinn,Tashkent,Tbilisi,Tegucigalpa,Tehran,Thimphu,Tirana,Tokyo,Tripoli,Tunis,Ulaanbaatar,Vaduz,Valletta,Victoria,Vienna,Vientiane,Vilnius,Warsaw,Washington D.C.|Washington|Washington DC,Wellington,Windhoek,Yaounde,Yerevan,Zagreb,New York,Los Angeles,Chicago,Houston,Phoenix,Philadelphia,San Antonio,San Diego,Dallas,San Francisco,Seattle,Boston,Miami,Atlanta,Denver,Las Vegas,Detroit,Portland,Austin,Nashville,New Orleans,Toronto,Montreal,Vancouver,Calgary,Sydney,Melbourne,Brisbane,Perth,Auckland,Mumbai,Bangalore,Kolkata,Chennai,Hyderabad,Shanghai,Shenzhen,Guangzhou,Chengdu,Hong Kong,Osaka,Kyoto,Nagoya,Sapporo,Busan,Istanbul,Dubai,Lagos,Casablanca,Cape Town,Johannesburg,Durban,Alexandria,Barcelona,Valencia,Seville,Milan,Naples,Turin,Florence,Venice,Munich,Hamburg,Frankfurt,Cologne,Lyon,Marseille,Nice,Manchester,Birmingham,Liverpool,Glasgow,Leeds,Rio de Janeiro,Sao Paulo,Salvador,Medellin,Cartagena,Guadalajara,Monterrey,Cancun,St Petersburg|Saint Petersburg,Krakow,Gdansk,Porto,Gothenburg,Bergen,Rotterdam,Antwerp,Geneva,Zurich,Salzburg,Dubrovnik,Split,Marrakech,Mombasa,Kyoto") },
  { id: "brands", noun: "Brands", letters: "abcdefghklmnoprstv", answers: list("Abarth,Acura,Alfa Romeo,Alpine,Aston Martin,Audi,Bentley,BMW,Bugatti,Buick,BYD,Cadillac,Chevrolet|Chevy,Chrysler,Citroen,Cupra,Dacia,Daewoo,Daihatsu,Dodge,DS,Ferrari,Fiat,Fisker,Ford,Genesis,GMC,Great Wall,Holden,Honda,Hummer,Hyundai,Infiniti,Isuzu,Jaguar,Jeep,Kia,Koenigsegg,Lamborghini,Lancia,Land Rover,Lexus,Lincoln,Lotus,Lucid,Mahindra,Maserati,Maybach,Mazda,McLaren,Mercedes-Benz|Mercedes,MG,Mini,Mitsubishi,Nissan,Opel,Pagani,Peugeot,Polestar,Pontiac,Porsche,Ram,Renault,Rimac,Rivian,Rolls-Royce,Rover,Saab,Saturn,Scion,Seat,Skoda,Smart,SsangYong,Subaru,Suzuki,Tata,Tesla,Toyota,Triumph,Vauxhall,Volkswagen|VW,Volvo,Wiesmann,Zenvo,Apple,Google,Microsoft,Amazon,Nike,Adidas,Puma,Samsung,Sony,Coca-Cola,Pepsi,McDonald's,Starbucks,Disney,Netflix,IKEA,Lego,Nintendo,Intel,Nvidia,Facebook,Meta,Instagram,Twitter,Spotify,Uber,Airbnb,Walmart,Target,Costco,Nestle,Kellogg's,Heinz,Cadbury,Hershey's,Oreo,Pringles,Doritos,Gucci,Prada,Chanel,Rolex,Levi's,Zara,H&M,Reebok,Under Armour,The North Face,Patagonia,Canon,Nikon,Panasonic,Philips,Siemens,Bosch,Dell,HP,Lenovo,Asus,Acer,IBM,Oracle,Adobe,Shell,BP,Visa,Mastercard,PayPal") },
  { id: "movies", noun: "Movies", letters: "abcdefghijlmnoprstw", answers: [] },
  { id: "songs", noun: "Songs", letters: "abcdefghilmnoprstwy", answers: [] },
  { id: "bands", noun: "Bands and music artists", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "tv-shows", noun: "TV shows", letters: "abcdefghilmnoprstw", answers: [] },
  { id: "video-games", noun: "Video games", letters: "abcdefghlmnoprstw", answers: [] },
  { id: "fictional-characters", noun: "Fictional characters", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "plants", noun: "Plants, flowers and trees", letters: "abcdfghlmoprst", answers: [] },
  { id: "boys-names", noun: "Boys' names", letters: "abcdefghjklmnoprstw", answers: [] },
  { id: "girls-names", noun: "Girls' names", letters: "abcdefghjklmnoprstv", answers: [] },
  { id: "verbs", noun: "Verbs", letters: "abcdefghilmnoprstw", answers: [] },
  { id: "jobs", noun: "Jobs", letters: "abcdefghlmnoprst", answers: [] },
  { id: "surnames", noun: "Surnames", letters: "abcdefghjklmnoprstw", answers: [] },
];

/** Hand-picked niche prompts. Each must still have hundreds of valid answers; the LLM judges them. */
export const NICHE_PROMPTS: PromptDef[] = [
  { id: "red-things", text: "Things that are red", answers: [] },
  { id: "yellow-things", text: "Things that are yellow", answers: [] },
  { id: "green-things", text: "Things that are green", answers: [] },
  { id: "kitchen", text: "Things you'd find in a kitchen", answers: [] },
  { id: "fly", text: "Things that fly", hint: "Animals, vehicles, anything", answers: [] },
  { id: "wheels", text: "Things with wheels", answers: [] },
  { id: "wear", text: "Things you can wear", hint: "Clothes and accessories", answers: [] },
  { id: "round", text: "Things that are round", answers: [] },
  { id: "garage", text: "Things you'd find in a garage or toolbox", answers: [] },
  { id: "school", text: "Things you'd find at a school", answers: [] },
  { id: "african-animals", text: "Animals that live in Africa", answers: [] },
  { id: "european-cities", text: "Cities in Europe", answers: [] },
  { id: "us-cities", text: "Cities and towns in the United States", answers: [] },
  { id: "number-movies", text: "Movies with a number in the title", answers: [] },
  { id: "color-songs", text: "Songs with a color in the title", answers: [] },
  { id: "noun-verbs", text: "Words that are both a noun and a verb", hint: "Like \"run\", \"book\" or \"light\"", answers: [] },
  { id: "savory", text: "Savory foods", hint: "Not desserts", answers: [] },
];
