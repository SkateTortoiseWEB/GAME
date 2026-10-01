export interface PromptDef {
  id: string;
  text: string;
  /** Short note shown under the prompt. */
  hint?: string;
  /** Canonical answers. Use "Canonical|alias|alias" to add accepted variants. */
  answers: string[];
  /** Set on generated "starts with" prompts; every accepted answer must begin with this letter. */
  letter?: string;
}

/** A broad list that spawns "X that start with Y" prompts for every letter with enough answers. */
export interface Category {
  id: string;
  /** Plural noun used in the prompt, e.g. "Countries" -> "Countries that start with B". */
  noun: string;
  answers: string[];
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export const CATEGORIES: Category[] = [
  {
    id: "countries",
    noun: "Countries",
    answers: list(
      "Afghanistan,Albania,Algeria,Andorra,Angola,Antigua and Barbuda,Argentina,Armenia,Australia,Austria,Azerbaijan,Bahamas|The Bahamas,Bahrain,Bangladesh,Barbados,Belarus,Belgium,Belize,Benin,Bhutan,Bolivia,Bosnia and Herzegovina|Bosnia,Botswana,Brazil,Brunei,Bulgaria,Burkina Faso,Burundi,Cambodia,Cameroon,Canada,Cape Verde,Central African Republic,Chad,Chile,China,Colombia,Comoros,Congo|Republic of the Congo,DR Congo|Democratic Republic of the Congo|DRC,Costa Rica,Croatia,Cuba,Cyprus,Czech Republic|Czechia,Denmark,Djibouti,Dominica,Dominican Republic,Ecuador,Egypt,El Salvador,Equatorial Guinea,Eritrea,Estonia,Eswatini|Swaziland,Ethiopia,Fiji,Finland,France,Gabon,Gambia|The Gambia,Georgia,Germany,Ghana,Greece,Grenada,Guatemala,Guinea,Guinea-Bissau,Guyana,Haiti,Honduras,Hungary,Iceland,India,Indonesia,Iran,Iraq,Ireland,Israel,Italy,Ivory Coast|Cote d'Ivoire,Jamaica,Japan,Jordan,Kazakhstan,Kenya,Kiribati,Kosovo,Kuwait,Kyrgyzstan,Laos,Latvia,Lebanon,Lesotho,Liberia,Libya,Liechtenstein,Lithuania,Luxembourg,Madagascar,Malawi,Malaysia,Maldives,Mali,Malta,Marshall Islands,Mauritania,Mauritius,Mexico,Micronesia,Moldova,Monaco,Mongolia,Montenegro,Morocco,Mozambique,Myanmar|Burma,Namibia,Nauru,Nepal,Netherlands|Holland,New Zealand,Nicaragua,Niger,Nigeria,North Korea,North Macedonia|Macedonia,Norway,Oman,Pakistan,Palau,Palestine,Panama,Papua New Guinea,Paraguay,Peru,Philippines,Poland,Portugal,Qatar,Romania,Russia,Rwanda,Saint Lucia|St Lucia,Samoa,San Marino,Saudi Arabia,Senegal,Serbia,Seychelles,Sierra Leone,Singapore,Slovakia,Slovenia,Solomon Islands,Somalia,South Africa,South Korea,South Sudan,Spain,Sri Lanka,Sudan,Suriname,Sweden,Switzerland,Syria,Taiwan,Tajikistan,Tanzania,Thailand,Togo,Tonga,Trinidad and Tobago,Tunisia,Turkey|Turkiye,Turkmenistan,Tuvalu,Uganda,Ukraine,United Arab Emirates|UAE,United Kingdom|UK|Britain|Great Britain,United States|USA|United States of America|US,Uruguay,Uzbekistan,Vanuatu,Vatican City,Venezuela,Vietnam,Yemen,Zambia,Zimbabwe"
    ),
  },
  {
    id: "african-countries",
    noun: "African countries",
    answers: list(
      "Algeria,Angola,Benin,Botswana,Burkina Faso,Burundi,Cameroon,Cape Verde,Central African Republic,Chad,Comoros,Congo|Republic of the Congo,DR Congo|Democratic Republic of the Congo|DRC,Djibouti,Egypt,Equatorial Guinea,Eritrea,Eswatini|Swaziland,Ethiopia,Gabon,Gambia|The Gambia,Ghana,Guinea,Guinea-Bissau,Ivory Coast|Cote d'Ivoire,Kenya,Lesotho,Liberia,Libya,Madagascar,Malawi,Mali,Mauritania,Mauritius,Morocco,Mozambique,Namibia,Niger,Nigeria,Rwanda,Sao Tome and Principe,Senegal,Seychelles,Sierra Leone,Somalia,South Africa,South Sudan,Sudan,Tanzania,Togo,Tunisia,Uganda,Zambia,Zimbabwe"
    ),
  },
  {
    id: "capitals",
    noun: "Capital cities",
    answers: list(
      "Abu Dhabi,Abuja,Accra,Addis Ababa,Algiers,Amman,Amsterdam,Ankara,Antananarivo,Apia,Ashgabat,Asuncion,Athens,Baghdad,Baku,Bamako,Bangkok,Beijing,Beirut,Belgrade,Berlin,Bern|Berne,Bishkek,Bogota,Brasilia,Bratislava,Brazzaville,Brussels,Bucharest,Budapest,Buenos Aires,Cairo,Canberra,Caracas,Colombo,Conakry,Copenhagen,Dakar,Damascus,Dhaka,Dublin,Doha,Edinburgh,Freetown,Gaborone,Georgetown,Hanoi,Harare,Havana,Helsinki,Islamabad,Jakarta,Jerusalem,Kabul,Kampala,Kathmandu,Khartoum,Kyiv|Kiev,Kigali,Kingston,Kinshasa,Kuala Lumpur,Kuwait City,La Paz,Lilongwe,Lima,Lisbon,Ljubljana,Lome,London,Luanda,Lusaka,Luxembourg,Madrid,Managua,Manama,Manila,Maputo,Mexico City,Minsk,Mogadishu,Monaco,Monrovia,Montevideo,Moscow,Muscat,Nairobi,Nassau,New Delhi|Delhi,Niamey,Nicosia,Nouakchott,Nuku'alofa,Oslo,Ottawa,Ouagadougou,Panama City,Paris,Phnom Penh,Podgorica,Port Moresby,Port-au-Prince,Prague,Pretoria,Pyongyang,Quito,Rabat,Reykjavik,Riga,Riyadh,Rome,San Jose,San Juan,San Salvador,Sanaa,Santiago,Santo Domingo,Sarajevo,Seoul,Singapore,Skopje,Sofia,Stockholm,Suva,Taipei,Tallinn,Tashkent,Tbilisi,Tegucigalpa,Tehran,Thimphu,Tirana,Tokyo,Tripoli,Tunis,Ulaanbaatar,Vaduz,Valletta,Victoria,Vienna,Vientiane,Vilnius,Warsaw,Washington D.C.|Washington|Washington DC,Wellington,Windhoek,Yaounde,Yerevan,Zagreb"
    ),
  },
  {
    id: "animals",
    noun: "Animals",
    answers: list(
      "Aardvark,Albatross,Alligator,Alpaca,Anaconda,Ant,Anteater,Antelope,Armadillo,Baboon,Badger,Bat,Bear,Beaver,Bee,Beetle,Bison,Boar,Bobcat,Buffalo,Butterfly,Camel,Capybara,Caribou,Cat,Caterpillar,Chameleon,Cheetah,Chicken,Chimpanzee,Chinchilla,Chipmunk,Cobra,Cockroach,Cougar,Cow,Coyote,Crab,Crane,Crocodile,Crow,Deer,Dingo,Dog,Dolphin,Donkey,Dragonfly,Duck,Eagle,Eel,Elephant,Elk,Emu,Falcon,Ferret,Finch,Flamingo,Fox,Frog,Gazelle,Gecko,Gerbil,Giraffe,Goat,Goose,Gorilla,Grasshopper,Hamster,Hare,Hawk,Hedgehog,Heron,Hippopotamus|Hippo,Horse,Hummingbird,Hyena,Ibex,Iguana,Impala,Jackal,Jaguar,Jellyfish,Kangaroo,Kingfisher,Kiwi,Koala,Komodo Dragon,Kookaburra,Ladybug|Ladybird,Lemming,Lemur,Leopard,Lion,Lizard,Llama,Lobster,Lynx,Macaw,Manatee,Meerkat,Mongoose,Monkey,Moose,Mosquito,Moth,Mouse,Mule,Narwhal,Newt,Nightingale,Ocelot,Octopus,Okapi,Opossum|Possum,Orangutan,Orca|Killer Whale,Ostrich,Otter,Owl,Ox,Oyster,Panda,Panther,Parrot,Peacock,Pelican,Penguin,Pheasant,Pig,Pigeon,Platypus,Polar Bear,Porcupine,Puma,Quail,Rabbit,Raccoon,Rat,Raven,Reindeer,Rhinoceros|Rhino,Robin,Salamander,Salmon,Scorpion,Seahorse,Seal,Shark,Sheep,Skunk,Sloth,Snail,Snake,Sparrow,Spider,Squid,Squirrel,Starfish,Stingray,Stork,Swan,Tapir,Tarantula,Tiger,Toad,Tortoise,Toucan,Trout,Turkey,Turtle,Vulture,Wallaby,Walrus,Warthog,Wasp,Weasel,Whale,Wolf,Wolverine,Wombat,Woodpecker,Yak,Zebra"
    ),
  },
  {
    id: "vegetables",
    noun: "Vegetables",
    answers: list(
      "Artichoke,Arugula|Rocket,Asparagus,Beetroot|Beet,Bell Pepper|Pepper,Bok Choy,Broccoli,Brussels Sprouts,Cabbage,Carrot,Cauliflower,Celery,Chard|Swiss Chard,Chickpea,Chili|Chilli,Collard Greens,Corn|Sweetcorn,Courgette|Zucchini,Cucumber,Daikon,Eggplant|Aubergine,Endive,Fennel,Garlic,Ginger,Horseradish,Jicama,Kale,Kohlrabi,Leek,Lettuce,Mushroom,Okra,Onion,Parsnip,Pea,Potato,Pumpkin,Radicchio,Radish,Rhubarb,Rutabaga|Swede,Scallion|Spring Onion|Green Onion,Shallot,Spinach,Squash,Sweet Potato,Taro,Turnip,Watercress,Yam,Butternut Squash,Cassava,Edamame,Green Bean|String Bean,Lima Bean,Kidney Bean,Napa Cabbage,Romaine,Tomatillo,Celeriac,Salsify,Samphire,Bean Sprouts,Brussels Sprout"
    ),
  },
  {
    id: "car-brands",
    noun: "Car brands",
    answers: list(
      "Abarth,Acura,Alfa Romeo,Alpine,Aston Martin,Audi,Bentley,BMW,Bugatti,Buick,BYD,Cadillac,Chevrolet|Chevy,Chrysler,Citroen,Cupra,Dacia,Daewoo,Daihatsu,Dodge,DS,Ferrari,Fiat,Fisker,Ford,Genesis,GMC,Great Wall,Holden,Honda,Hummer,Hyundai,Infiniti,Isuzu,Jaguar,Jeep,Kia,Koenigsegg,Lamborghini,Lancia,Land Rover,Lexus,Lincoln,Lotus,Lucid,Mahindra,Maserati,Maybach,Mazda,McLaren,Mercedes-Benz|Mercedes,MG,Mini,Mitsubishi,Nissan,Opel,Pagani,Peugeot,Polestar,Pontiac,Porsche,Ram,Renault,Rimac,Rivian,Rolls-Royce,Rover,Saab,Saturn,Scion,Seat,Skoda,Smart,SsangYong,Subaru,Suzuki,Tata,Tesla,Toyota,Triumph,Vauxhall,Volkswagen|VW,Volvo,Wiesmann,Zenvo"
    ),
  },
  {
    id: "cheeses",
    noun: "Cheeses",
    answers: list(
      "Appenzeller,Asiago,Blue Cheese,Boursin,Brie,Brunost,Burrata,Camembert,Cantal,Cheddar,Colby,Comte,Cotija,Cottage Cheese,Cream Cheese,Danish Blue,Edam,Emmental|Emmentaler,Epoisses,Feta,Fontina,Gjetost,Gorgonzola,Gouda,Gruyere,Halloumi,Havarti,Jarlsberg,Labneh,Leerdammer,Limburger,Maasdam,Manchego,Mascarpone,Monterey Jack,Morbier,Mozzarella,Munster,Neufchatel,Oaxaca,Paneer,Parmesan|Parmigiano Reggiano,Pecorino,Pepper Jack,Port Salut,Provolone,Quark,Queso Fresco,Raclette,Red Leicester,Reblochon,Ricotta,Roquefort,Stilton,Swiss,Taleggio,Tilsit,Wensleydale,Double Gloucester,Cambozola,Burrata,Mimolette,Chevre|Goat Cheese,Gruyère"
    ),
  },
  {
    id: "shakespeare-plays",
    noun: "Shakespeare plays",
    answers: list(
      "Hamlet,Macbeth,Othello,King Lear|Lear,Romeo and Juliet,Julius Caesar,Antony and Cleopatra,Coriolanus,Titus Andronicus,Timon of Athens,Troilus and Cressida,A Midsummer Night's Dream|Midsummer Night's Dream,The Tempest|Tempest,Twelfth Night,As You Like It,Much Ado About Nothing,The Merchant of Venice|Merchant of Venice,The Taming of the Shrew|Taming of the Shrew,The Comedy of Errors|Comedy of Errors,Love's Labour's Lost,The Merry Wives of Windsor|Merry Wives of Windsor,Measure for Measure,All's Well That Ends Well,The Winter's Tale|Winter's Tale,Cymbeline,Pericles,The Two Gentlemen of Verona|Two Gentlemen of Verona,The Two Noble Kinsmen|Two Noble Kinsmen,Richard II,Richard III,Henry IV,Henry V,Henry VI,Henry VIII,King John,Edward III"
    ),
  },
  {
    id: "currencies",
    noun: "Currencies",
    answers: list(
      "Baht,Birr,Boliviano,Cedi,Colon,Cordoba,Dalasi,Denar,Dinar,Dirham,Dollar,Dong,Dram,Euro,Forint,Franc,Gourde,Guarani,Hryvnia,Kina,Kip,Koruna,Krona,Krone,Kuna,Kwacha,Kwanza,Kyat,Lari,Lek,Lempira,Leone,Leu,Lev,Lira,Loti,Manat,Metical,Naira,Nakfa,Ngultrum,Pataca,Peso,Pound,Pula,Quetzal,Rand,Real,Rial,Riel,Ringgit,Riyal,Ruble,Rufiyaa,Rupee,Rupiah,Shekel,Shilling,Som,Somoni,Sol,Taka,Tala,Tenge,Togrog|Tugrik,Vatu,Won,Yen,Yuan|Renminbi,Zloty,Bolivar,Balboa,Lilangeni,Ouguiya,Ariary,Afghani,Bitcoin,Lat,Mark,Escudo,Drachma,Peseta,Guilder,Lire,Schilling"
    ),
  },
  {
    id: "fruits",
    noun: "Fruits",
    answers: list(
      "Apple,Apricot,Avocado,Banana,Blackberry,Blueberry,Cantaloupe,Cherry,Clementine,Coconut,Cranberry,Currant,Date,Dragon Fruit|Pitaya,Durian,Elderberry,Fig,Gooseberry,Grape,Grapefruit,Guava,Honeydew,Jackfruit,Kiwi|Kiwifruit,Kumquat,Lemon,Lime,Lychee,Mandarin,Mango,Mulberry,Nectarine,Olive,Orange,Papaya|Pawpaw,Passion Fruit,Peach,Pear,Persimmon,Pineapple,Plantain,Plum,Pomegranate,Pomelo,Quince,Raspberry,Starfruit|Carambola,Strawberry,Tangerine,Tomato,Watermelon,Rambutan,Mangosteen,Tamarind,Boysenberry,Cherimoya,Lingonberry,Soursop,Ugli Fruit,Yuzu,Ackee,Acai,Bilberry,Bergamot,Breadfruit,Blood Orange,Cloudberry,Custard Apple,Damson,Dewberry,Feijoa,Greengage,Huckleberry,Jujube,Loganberry,Loquat,Longan,Medlar,Physalis|Cape Gooseberry,Prickly Pear,Salak,Sapodilla,Satsuma,Santol,Sloe,Sugar Apple,Tangelo,Tayberry,Salmonberry,Sea Buckthorn,Mirabelle,Marionberry,Naranjilla,Jabuticaba,Kiwano,Langsat,Surinam Cherry,Star Apple,Sapote,Saskatoon,Sultana,Tangor,Honeycrisp,Granny Smith,Gala,Fuji"
    ),
  },
  {
    id: "dog-breeds",
    noun: "Dog breeds",
    answers: list(
      "Labrador Retriever|Labrador|Lab,Golden Retriever,German Shepherd|Alsatian,Bulldog|English Bulldog,French Bulldog|Frenchie,Poodle,Beagle,Rottweiler,Dachshund,Boxer,Siberian Husky|Husky,Great Dane,Doberman|Doberman Pinscher,Shih Tzu,Chihuahua,Pug,Pomeranian,Border Collie,Australian Shepherd,Corgi|Pembroke Welsh Corgi,Cocker Spaniel,Springer Spaniel,Boston Terrier,Yorkshire Terrier|Yorkie,Bernese Mountain Dog,Saint Bernard|St Bernard,Maltese,Akita,Shiba Inu,Samoyed,Weimaraner,Vizsla,Bloodhound,Basset Hound,Greyhound,Whippet,Mastiff,Newfoundland,Bichon Frise,Jack Russell Terrier,Pit Bull|American Pit Bull Terrier,Collie,Papillon,Australian Cattle Dog|Blue Heeler,Alaskan Malamute|Malamute,Afghan Hound,Saluki,Irish Setter,English Setter,Pointer,Scottish Terrier|Scottie,West Highland Terrier|Westie,Airedale Terrier,Basenji,Chow Chow,Shar Pei,Havanese,Cavalier King Charles Spaniel"
    ),
  },
  {
    id: "programming-languages",
    noun: "Programming languages",
    answers: list(
      "Python,JavaScript|JS,TypeScript|TS,Java,C,C++|Cpp,C#|C Sharp,Go|Golang,Rust,Ruby,PHP,Swift,Kotlin,Scala,Perl,Haskell,Lua,R,MATLAB,Dart,Elixir,Erlang,Clojure,Lisp,Scheme,Racket,OCaml,F#,Fortran,COBOL,Pascal,Delphi,Ada,Assembly,Objective-C,Julia,Groovy,Bash,Shell,PowerShell,SQL,Prolog,Smalltalk,Zig,Nim,Crystal,Visual Basic|VB,BASIC,Scratch,Haxe,Solidity,Brainfuck,APL,Forth,Tcl,Awk,Elm,PureScript,D,V,Vala,Eiffel,Hack,Apex,ABAP,Logo,Simula,ALGOL"
    ),
  },
  {
    id: "us-states",
    noun: "U.S. states",
    answers: list(
      "Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming"
    ),
  },
  {
    id: "musical-instruments",
    noun: "Musical instruments",
    answers: list(
      "Piano,Guitar,Electric Guitar,Bass Guitar|Bass,Violin|Fiddle,Viola,Cello,Double Bass|Upright Bass,Harp,Flute,Piccolo,Clarinet,Oboe,Bassoon,Saxophone|Sax,Trumpet,Trombone,French Horn|Horn,Tuba,Cornet,Euphonium,Drums|Drum Kit,Snare Drum,Bass Drum,Timpani,Cymbals,Triangle,Tambourine,Xylophone,Marimba,Vibraphone,Glockenspiel,Cowbell,Maracas,Bongos,Congas,Djembe,Tabla,Organ,Accordion,Harmonica,Banjo,Mandolin,Ukulele,Sitar,Lute,Harpsichord,Synthesizer|Synth,Keyboard,Recorder,Bagpipes,Didgeridoo,Kazoo,Theremin,Ocarina,Pan Flute,Zither,Dulcimer,Balalaika,Bugle,Celesta,Tin Whistle,Steel Drum,Gong,Castanets,Washboard,Oud,Koto,Erhu,Shamisen"
    ),
  },
  {
    id: "board-games",
    noun: "Board games",
    answers: list(
      "Chess,Checkers|Draughts,Monopoly,Scrabble,Risk,Clue|Cluedo,Catan|Settlers of Catan,Ticket to Ride,Carcassonne,Pandemic,Backgammon,Go,Othello|Reversi,Battleship,Connect Four|Connect 4,Candy Land,Chutes and Ladders|Snakes and Ladders,Sorry!|Sorry,Trivial Pursuit,Pictionary,Yahtzee,Operation,Mouse Trap,Stratego,Mancala,Dominion,Azul,Splendor,Codenames,Dixit,Agricola,Terraforming Mars,Gloomhaven,Twilight Imperium,Scythe,Wingspan,Cranium,Life|The Game of Life,Uno,Jenga,Sequence,Rummikub,Dominoes,Boggle,Trouble,Parcheesi,Ludo,Diplomacy,Axis & Allies,Betrayal at House on the Hill,Dungeons & Dragons,Forbidden Island,Sushi Go,7 Wonders,Small World,Love Letter,Taboo,Guess Who?,Hungry Hungry Hippos,Perfection,Kerplunk,Twister,Mahjong"
    ),
  },
  {
    id: "chemical-elements",
    noun: "Chemical elements",
    answers: list(
      "Hydrogen,Helium,Lithium,Beryllium,Boron,Carbon,Nitrogen,Oxygen,Fluorine,Neon,Sodium,Magnesium,Aluminum|Aluminium,Silicon,Phosphorus,Sulfur|Sulphur,Chlorine,Argon,Potassium,Calcium,Scandium,Titanium,Vanadium,Chromium,Manganese,Iron,Cobalt,Nickel,Copper,Zinc,Gallium,Germanium,Arsenic,Selenium,Bromine,Krypton,Rubidium,Strontium,Yttrium,Zirconium,Niobium,Molybdenum,Technetium,Ruthenium,Rhodium,Palladium,Silver,Cadmium,Indium,Tin,Antimony,Tellurium,Iodine,Xenon,Cesium|Caesium,Barium,Lanthanum,Cerium,Tungsten,Platinum,Gold,Mercury,Lead,Bismuth,Polonium,Radon,Uranium,Plutonium,Radium,Thorium,Neodymium,Europium,Osmium,Iridium,Rhenium,Tantalum,Hafnium,Francium,Astatine,Neptunium,Americium,Curium,Einsteinium,Fermium,Nobelium,Oganesson"
    ),
  },
];

/** Hand-picked niche prompts with fixed answer sets. */
export const NICHE_PROMPTS: PromptDef[] = [
  {
    id: "one-letter-elements",
    text: "Elements whose chemical symbol is a single letter",
    hint: "H, C, O… name the element",
    answers: list("Hydrogen,Boron,Carbon,Nitrogen,Oxygen,Fluorine,Phosphorus,Sulfur|Sulphur,Potassium,Vanadium,Yttrium,Iodine,Tungsten,Uranium"),
  },
  {
    id: "landlocked-countries",
    text: "Landlocked countries",
    hint: "No coastline at all",
    answers: list("Afghanistan,Andorra,Armenia,Austria,Azerbaijan,Belarus,Bhutan,Bolivia,Botswana,Burkina Faso,Burundi,Central African Republic,Chad,Czech Republic|Czechia,Eswatini|Swaziland,Ethiopia,Hungary,Kazakhstan,Kosovo,Kyrgyzstan,Laos,Lesotho,Liechtenstein,Luxembourg,Malawi,Mali,Moldova,Mongolia,Nepal,Niger,North Macedonia|Macedonia,Paraguay,Rwanda,San Marino,Serbia,Slovakia,South Sudan,Switzerland,Tajikistan,Turkmenistan,Uganda,Uzbekistan,Vatican City,Zambia,Zimbabwe"),
  },
  {
    id: "moons",
    text: "Moons in our solar system",
    answers: list("Moon|The Moon|Luna,Phobos,Deimos,Io,Europa,Ganymede,Callisto,Amalthea,Himalia,Titan,Enceladus,Mimas,Tethys,Dione,Rhea,Iapetus,Hyperion,Phoebe,Janus,Epimetheus,Prometheus,Pandora,Atlas,Miranda,Ariel,Umbriel,Titania,Oberon,Puck,Triton,Nereid,Proteus,Charon,Nix,Hydra,Kerberos,Styx,Dysnomia,Himalia,Elara,Pan,Daphnis,Telesto,Calypso,Helene,Cordelia,Ophelia,Bianca,Cressida,Desdemona,Juliet,Portia,Rosalind,Belinda,Larissa,Galatea,Despina,Thalassa,Naiad"),
  },
  {
    id: "elements-named-after-people",
    text: "Elements named after a person",
    answers: list("Curium,Einsteinium,Fermium,Mendelevium,Nobelium,Lawrencium,Rutherfordium,Seaborgium,Bohrium,Meitnerium,Roentgenium,Copernicium,Flerovium,Oganesson,Gadolinium"),
  },
  {
    id: "land-countries",
    text: "Countries whose name ends in \"land\"",
    answers: list("Finland,Iceland,Ireland,Poland,Switzerland,Thailand,New Zealand"),
  },
  {
    id: "us-presidents",
    text: "U.S. presidents (by surname)",
    answers: list("Washington,Adams,Jefferson,Madison,Monroe,Jackson,Van Buren,Harrison,Tyler,Polk,Taylor,Fillmore,Pierce,Buchanan,Lincoln,Johnson,Grant,Hayes,Garfield,Arthur,Cleveland,McKinley,Roosevelt,Taft,Wilson,Harding,Coolidge,Hoover,Truman,Eisenhower,Kennedy,Nixon,Ford,Carter,Reagan,Bush,Clinton,Obama,Trump,Biden"),
  },
  {
    id: "greek-letters",
    text: "Letters of the Greek alphabet",
    answers: list("Alpha,Beta,Gamma,Delta,Epsilon,Zeta,Eta,Theta,Iota,Kappa,Lambda,Mu,Nu,Xi,Omicron,Pi,Rho,Sigma,Tau,Upsilon,Phi,Chi,Psi,Omega"),
  },
];
