export interface PromptDef {
  id: string;
  text: string;
  /** Short note shown under the prompt. */
  hint?: string;
  /** Canonical answers. Use "Canonical|alias|alias" to add accepted variants. */
  answers: string[];
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export const PROMPTS: PromptDef[] = [
  {
    id: "african-countries",
    text: "Countries in Africa",
    answers: list(
      "Algeria,Angola,Benin,Botswana,Burkina Faso,Burundi,Cameroon,Cape Verde,Central African Republic,Chad,Comoros,Congo|Republic of the Congo,DR Congo|Democratic Republic of the Congo|DRC,Djibouti,Egypt,Equatorial Guinea,Eritrea,Eswatini|Swaziland,Ethiopia,Gabon,Gambia|The Gambia,Ghana,Guinea,Guinea-Bissau,Ivory Coast|Cote d'Ivoire,Kenya,Lesotho,Liberia,Libya,Madagascar,Malawi,Mali,Mauritania,Mauritius,Morocco,Mozambique,Namibia,Niger,Nigeria,Rwanda,Sao Tome and Principe,Senegal,Seychelles,Sierra Leone,Somalia,South Africa,South Sudan,Sudan,Tanzania,Togo,Tunisia,Uganda,Zambia,Zimbabwe"
    ),
  },
  {
    id: "fruits",
    text: "Fruits",
    hint: "Botanical or culinary, both count",
    answers: list(
      "Apple,Apricot,Avocado,Banana,Blackberry,Blueberry,Cantaloupe,Cherry,Clementine,Coconut,Cranberry,Currant,Date,Dragon Fruit|Pitaya,Durian,Elderberry,Fig,Gooseberry,Grape,Grapefruit,Guava,Honeydew,Jackfruit,Kiwi|Kiwifruit,Kumquat,Lemon,Lime,Lychee,Mandarin,Mango,Mulberry,Nectarine,Olive,Orange,Papaya|Pawpaw,Passion Fruit,Peach,Pear,Persimmon,Pineapple,Plantain,Plum,Pomegranate,Pomelo,Quince,Raspberry,Starfruit|Carambola,Strawberry,Tangerine,Tomato,Watermelon,Rambutan,Mangosteen,Tamarind,Boysenberry,Cherimoya,Lingonberry,Soursop,Ugli Fruit,Yuzu"
    ),
  },
  {
    id: "dog-breeds",
    text: "Dog breeds",
    answers: list(
      "Labrador Retriever|Labrador|Lab,Golden Retriever,German Shepherd|Alsatian,Bulldog|English Bulldog,French Bulldog|Frenchie,Poodle,Beagle,Rottweiler,Dachshund,Boxer,Siberian Husky|Husky,Great Dane,Doberman|Doberman Pinscher,Shih Tzu,Chihuahua,Pug,Pomeranian,Border Collie,Australian Shepherd,Corgi|Pembroke Welsh Corgi,Cocker Spaniel,Springer Spaniel,Boston Terrier,Yorkshire Terrier|Yorkie,Bernese Mountain Dog,Saint Bernard|St Bernard,Maltese,Akita,Shiba Inu,Samoyed,Weimaraner,Vizsla,Bloodhound,Basset Hound,Greyhound,Whippet,Mastiff,Newfoundland,Bichon Frise,Jack Russell Terrier,Pit Bull|American Pit Bull Terrier,Collie,Papillon,Australian Cattle Dog|Blue Heeler,Alaskan Malamute|Malamute,Afghan Hound,Saluki,Irish Setter,English Setter,Pointer,Scottish Terrier|Scottie,West Highland Terrier|Westie,Airedale Terrier,Basenji,Chow Chow,Shar Pei,Havanese,Cavalier King Charles Spaniel"
    ),
  },
  {
    id: "programming-languages",
    text: "Programming languages",
    answers: list(
      "Python,JavaScript|JS,TypeScript|TS,Java,C,C++|Cpp,C#|C Sharp,Go|Golang,Rust,Ruby,PHP,Swift,Kotlin,Scala,Perl,Haskell,Lua,R,MATLAB,Dart,Elixir,Erlang,Clojure,Lisp,Scheme,Racket,OCaml,F#,Fortran,COBOL,Pascal,Delphi,Ada,Assembly,Objective-C,Julia,Groovy,Bash,Shell,PowerShell,SQL,Prolog,Smalltalk,Zig,Nim,Crystal,Visual Basic|VB,BASIC,Scratch,Haxe,Solidity,Brainfuck,APL,Forth,Tcl,Awk,Elm,PureScript,Racket,D,V,Vala,Eiffel,Hack,Apex,ABAP,Logo,Simula,ALGOL"
    ),
  },
  {
    id: "us-states",
    text: "U.S. states",
    answers: list(
      "Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming"
    ),
  },
  {
    id: "musical-instruments",
    text: "Musical instruments",
    answers: list(
      "Piano,Guitar,Electric Guitar,Bass Guitar|Bass,Violin|Fiddle,Viola,Cello,Double Bass|Upright Bass,Harp,Flute,Piccolo,Clarinet,Oboe,Bassoon,Saxophone|Sax,Trumpet,Trombone,French Horn|Horn,Tuba,Cornet,Euphonium,Drums|Drum Kit,Snare Drum,Bass Drum,Timpani,Cymbals,Triangle,Tambourine,Xylophone,Marimba,Vibraphone,Glockenspiel,Cowbell,Maracas,Bongos,Congas,Djembe,Tabla,Organ,Accordion,Harmonica,Banjo,Mandolin,Ukulele,Sitar,Lute,Harpsichord,Synthesizer|Synth,Keyboard,Recorder,Bagpipes,Didgeridoo,Kazoo,Theremin,Ocarina,Pan Flute,Piano Accordion,Zither,Dulcimer,Balalaika,Bugle,Celesta,Tin Whistle,Steel Drum,Gong,Castanets,Washboard,Oud,Koto,Erhu,Shamisen"
    ),
  },
  {
    id: "board-games",
    text: "Board games",
    hint: "Tabletop games with a board, cards, or tiles",
    answers: list(
      "Chess,Checkers|Draughts,Monopoly,Scrabble,Risk,Clue|Cluedo,Catan|Settlers of Catan,Ticket to Ride,Carcassonne,Pandemic,Backgammon,Go,Othello|Reversi,Battleship,Connect Four|Connect 4,Candy Land,Chutes and Ladders|Snakes and Ladders,Sorry!|Sorry,Trivial Pursuit,Pictionary,Yahtzee,Operation,Mouse Trap,Stratego,Mancala,Dominion,Azul,Splendor,Codenames,Dixit,Agricola,Terraforming Mars,Gloomhaven,Twilight Imperium,Scythe,Wingspan,Cranium,Life|The Game of Life,Uno,Jenga,Sequence,Rummikub,Dominoes,Boggle,Trouble,Parcheesi,Ludo,Diplomacy,Axis & Allies,Betrayal at House on the Hill,Dungeons & Dragons,Forbidden Island,Sushi Go,7 Wonders,Small World,Love Letter,Cluedo,Taboo,Guess Who?,Hungry Hungry Hippos,Perfection,Kerplunk,Twister,Mahjong"
    ),
  },
  {
    id: "chemical-elements",
    text: "Chemical elements",
    answers: list(
      "Hydrogen,Helium,Lithium,Beryllium,Boron,Carbon,Nitrogen,Oxygen,Fluorine,Neon,Sodium,Magnesium,Aluminum|Aluminium,Silicon,Phosphorus,Sulfur|Sulphur,Chlorine,Argon,Potassium,Calcium,Scandium,Titanium,Vanadium,Chromium,Manganese,Iron,Cobalt,Nickel,Copper,Zinc,Gallium,Germanium,Arsenic,Selenium,Bromine,Krypton,Rubidium,Strontium,Yttrium,Zirconium,Niobium,Molybdenum,Technetium,Ruthenium,Rhodium,Palladium,Silver,Cadmium,Indium,Tin,Antimony,Tellurium,Iodine,Xenon,Cesium|Caesium,Barium,Lanthanum,Cerium,Tungsten,Platinum,Gold,Mercury,Lead,Bismuth,Polonium,Radon,Uranium,Plutonium,Radium,Thorium,Neodymium,Europium,Osmium,Iridium,Rhenium,Tantalum,Hafnium,Francium,Astatine,Neptunium,Americium,Curium,Einsteinium,Fermium,Nobelium,Oganesson"
    ),
  },
];
