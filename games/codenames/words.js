// Codenames Duet Word List
//https://www.darktwinge.com/codenames-word-list/
const DEFAULT_WORDS = [
  "Ace", "Africa", "Agent", "Air", "Alarm", "Alien", "Amazon", "Ambulance", "America", "Anchor", "Angel", "Ant", "Antarctica", "Anthem", "Apple", "Apron", "Arm", "Armor", "Army", "Art", "Ash", "Astronaut", "Atlantis", "Attic", "Australia", "Avalanche", "Axe",
  
  "Baby", "Back", "Bacon", "Bait", "Ball", "Balloon", "Banana", "Band", "Bank", "Bar", "Barbecue", "Bark", "Bass", "Bat", "Bath", "Battery", "Battle", "Battleship", "Bay", "Beach", "Bead", "Beam", "Bean", "Bear", "Beard", "Beat", "Bed", "Bee", "Beer", "Beetle", "Bell", "Belt", "Bench", "Berry", "Bicycle", "Big Bang", "Big Ben", "Bikini", "Bill", "Biscuit", "Black Hole", "Blade", "Blimp", "Blind", "Blizzard", "Block", "Blood", "Blues", "Board", "Boil", "Bolt", "Bomb", "Bond", "Bone", "Bonsai", "Book", "Boom", "Boot", "Booth", "Boss", "Bottle", "Bow", "Bowl", "Bowler", "Box", "Boxer", "Brain", "Brass", "Bread", "Break", "Brick", "Bridge", "Brother", "Brush", "Bubble", "Buck", "Bucket", "Buffalo", "Bug", "Bugle", "Bulb", "Bun", "Bunk", "Butter", "Butterfly", "Button",

  "Cable", "Caesar", "Cake", "Calculator", "Calendar", "Calf", "Camera", "Camp", "Can", "Candle", "Candy", "Cane", "Cap", "Cape", "Capital", "Capitalism", "Captain", "Car", "Card", "Carrot", "Cart", "Casino", "Cast", "Castle", "Cat", "Cave", "Cell", "Centaur", "Center", "Chain", "Chair", "Chalk", "Change", "Channel", "Charge", "Check", "Cheese", "Cherry", "Chest", "Chick", "Chip", "Chocolate", "Christmas", "Church", "Circle", "Circus", "Cliff", "Cloak", "Clock", "Cloud", "Clown", "Club", "Clue", "Coach", "Coal", "Coast", "Coat", "Code", "Coffee", "Coin", "Cold", "Collar", "Comb", "Comet", "Comic", "Communism", "Compound", "Computer", "Concert", "Conductor", "Cone", "Contract", "Cook", "Copper", "Copy", "Corn", "Cotton", "Country", "Court", "Cover", "Cow", "Cowboy", "Crab", "Crack", "Cracker", "Craft", "Crane", "Crash", "Crayon", "Cricket", "Cross", "Crow", "Crown", "Crumb", "Crunch", "Crusader", "Crystal", "Cuckoo", "Curry", "Cycle",

  "Dance", "Dart", "Dash", "Date", "Day", "Death", "Deck", "Degree", "Delta", "Dentist", "Desk", "Diamond", "Dice", "Dinosaur", "Dirt", "Disease", "Disk", "Disney", "Doctor", "Dog", "Doghouse", "Doll", "Dollar", "Dominoes", "Door", "Draft", "Dragon", "Drawing", "Dream", "Dress", "Dressing", "Drill", "Driver", "Drone", "Drop", "Drug", "Drum", "Dryer", "Duck", "Dust", "Dwarf",

  "Eagle", "Ear", "Earth", "Earthquake", "Easter", "Eden", "Egg", "Elephant", "Elf", "Engine", "Europe", "Evolution", "Eye",

  "Face", "Fair", "Fairy", "Fall", "Fan", "Farm", "Fast", "Fear", "Fence", "Fever", "Fiddle", "Field", "Figure", "File", "Film", "Fire", "Fish", "Flag", "Flat", "Flood", "Floor", "Flower", "Flute", "Fly", "Foam", "Fog", "Foil", "Foot", "Force", "Forest", "Fork", "Frame", "Frog", "Frost", "Fuel",

  "Game", "Gangster", "Garden", "Gas", "Gate", "Gear", "Gem", "Genie", "Genius", "Ghost", "Giant", "Ginger", "Glacier", "Glass", "Glasses", "Glove", "Goat", "Gold", "Golf", "Governor", "Grace", "Grain", "Grass", "Green", "Greenhouse", "Ground", "Guitar", "Gum", "Gun", "Gymnast",

  "Hair", "Halloween", "Hamburger", "Hammer", "Hand", "Hat", "Head", "Heart", "Helicopter", "Helmet", "Hide", "Hit", "Hole", "Honey", "Hood", "Hook", "Horn", "Horse", "Horseshoe", "Hose", "Hospital", "Hotel", "House", "Houseboat",

  "Ice", "Ice Age", "Ice Cream", "Igloo", "Ink", "Internet", "Iron", "Ivory",
  
  "Jack", "Jail", "Jam", "Jellyfish", "Jet", "Joker", "Judge", "Juice", "Jumper",

  "Kangaroo", "Ketchup", "Key", "Kick", "Kid", "Kilt", "King", "Kiss", "Kitchen", "Kite", "Kiwi", "Knife", "Knight", "Knot", "Kung Fu",
  
  "Lab", "Lace", "Ladder", "Lamp", "Lap", "Laser", "Laundry", "Lawn", "Lawyer", "Lead", "Leaf", "Leather", "Lemon", "Lemonade", "Leprechaun", "Letter", "Level", "Life", "Light", "Lightning", "Lightsaber", "Limousine", "Line", "Link", "Lion", "Lip", "List", "Litter", "Loch Ness", "Lock", "Log", "Love", "Luck", "Lumberjack", "Lunch",
  
  "Magazine", "Magician", "Mail", "Makeup", "Mammoth", "Manicure", "Map", "Maple", "Maracas", "Marathon", "Marble", "March", "Mark", "Mass", "Match", "Medic", "Memory", "Mercury", "Mess", "Metal", "Meter", "Microscope", "Microwave", "Mile", "Milk", "Mill", "Millionaire", "Mine", "Minotaur", "Mint", "Minute", "Mirror", "Miss", "Missile", "Model", "Mohawk", "Mold", "Mole", "Monkey", "Moon", "Mosquito", "Mother", "Mount", "Mouse", "Mouth", "Mud", "Mug", "Mummy", "Mustard",
  
  "Nail", "Needle", "Nerve", "Nest", "Net", "Newton", "Night", "Nightmare", "Ninja", "Nose", "Note", "Novel", "Nurse", "Nut",
  
  "Oasis", "Octopus", "Oil", "Olive", "Onion", "Opera", "Orange", "Organ",
  
  "Pad", "Paddle", "Page", "Paint", "Palm", "Pan", "Pants", "Paper", "Parachute", "Parade", "Park", "Parrot", "Part", "Party", "Pass", "Paste", "Patch", "Patient", "Pawn", "Pea", "Peach", "Peanut", "Pearl", "Pen", "Penguin", "Pentagon", "Pepper", "Pew", "Phoenix", "Phone", "Photo", "Piano", "Pie", "Pig", "Pill", "Pillow", "Pilot", "Pin", "Pine", "Pipe", "Pirate", "Pit", "Pitch", "Pitcher", "Pizza", "Plane", "Plant", "Plastic", "Plate", "Platypus", "Play", "Playground", "Plot", "Plow", "Point", "Poison", "Poker", "Pole", "Police", "Polo", "Pool", "Pop", "Popcorn", "Port", "Post", "Potato", "Potter", "Pound", "Powder", "Press", "Princess", "Pumpkin", "Pupil", "Puppet", "Purse", "Puzzle", "Pyramid",
  
  "Quack", "Quarter", "Quilt", "Quiver",
  
  "Rabbit", "Race", "Racket", "Radio", "Rail", "Rainbow", "Rake", "Ram", "Ranch", "Rat", "Ray", "Razor", "Record", "Reindeer", "Revolution", "Rice", "Ring", "Rip", "River", "Robin", "Robot", "Rock", "Rod", "Rodeo", "Roll", "Root", "Rope", "Rose", "Roulette", "Round", "Row", "Rubber", "Ruler", "Rust",
  
  "Sack", "Saddle", "Safe", "Sail", "Salad", "Saloon", "Salsa", "Salt", "Sand", "Sandbox", "Satellite", "Saturn", "Saw", "Scale", "Scarecrow", "School", "Scientist", "Scorpion", "Scratch", "Screen", "Scroll", "Scuba Diver", "Seal", "Second", "Seed", "Server", "Shade", "Shadow", "Shake", "Shakespeare", "Shampoo", "Shark", "Shed", "Sheep", "Sheet", "Shell", "Ship", "Shoe", "Shoot", "Shop", "Shorts", "Shot", "Shower", "Sign", "Silhouette", "Silk", "Sink", "Sister", "Skates", "Ski", "Skull", "Skyscraper", "Sled", "Sleep", "Sling", "Slip", "Sloth", "Slug", "Smell", "Smith", "Smoke", "Snake", "Snap", "Snow", "Snowman", "Soap", "Sock", "Soldier", "Song", "Soul", "Sound", "Soup", "Space", "Spade", "Spell", "Sphinx", "Spider", "Spike", "Spine", "Spirit", "Spit", "Sponge", "Spoon", "Spot", "Spray", "Spring", "Spy", "Square", "Squash", "Squirrel", "Stable", "Stadium", "Staff", "Stamp", "Star", "State", "Steam", "Steel", "Stem", "Step", "Stethoscope", "Stick", "Sticker", "Stock", "Stocking", "Stop", "Stoplight", "Storm", "Story", "Stove", "Straw", "Stream", "Street", "Strike", "String", "Sub", "Sugar", "Suit", "Sun", "Superhero", "Swamp", "Swarm", "Sweat", "Swing", "Switch", "Sword",
  
  "Table", "Tablet", "Tag", "Tail", "Tank", "Tap", "Taste", "Tattoo", "Tax", "Tea", "Teacher", "Team", "Tear", "Telescope", "Temple", "Theater", "Thief", "Thumb", "Thunder", "Tick", "Ticket", "Tie", "Tiger", "Time", "Tin", "Tip", "Tissue", "Title", "Toast", "Tooth", "Torch", "Tornado", "Tower", "Toy", "Track", "Train", "Trash", "Triangle", "Trick", "Trip", "Troll", "Trunk", "Tube", "Tunnel", "Turkey", "Turtle", "Tutu",
  
  "Undertaker", "Unicorn", "University",
  
  "Vacuum", "Valentine", "Vampire", "Van", "Venus", "Vet", "Viking", "Violet", "Virus", "Volcano", "Volume",
  
  "Wagon", "Waitress", "Wake", "Wall", "Walrus", "War", "Washer", "Washington", "Watch", "Water", "Wave", "Wax", "Web", "Wedding", "Weed", "Well", "Werewolf", "Whale", "Wheel", "Wheelchair", "Whip", "Whistle", "Wind", "Window", "Wing", "Wish", "Witch", "Wizard", "Wonderland", "Wood", "Wool", "Worm",
  
  "Yard",
  
  "Zipper", "Zombie", "Zone"];


  
// const DEFAULT_WORDS = [
//   "AFRICA", "AGENT", "AIR", "ALIEN", "ALPS", "AMAZON", "AMBULANCE", "AMERICA", "ANGEL", "ANTARCTICA", "APPLE", "ARM", "ATLANTIS",
//   "AUSTRALIA", "AZTEC", "BACK", "BALL", "BAND", "BANK", "BAR", "BARK", "BAT", "BATTERY", "BEACH", "BEAR", "BEAT", "BED", "BEIJING",
//   "BELL", "BERLIN", "BERMUDA", "BERRY", "BILL", "BLOCK", "BOARD", "BOLT", "BOMB", "BOND", "BOOM", "BOOT", "BOTTLE", "BOW", "BOX",
//   "BRIDGE", "BRUSH", "BUCK", "BUFFALO", "BUG", "BUGLE", "BUTTON", "CALF", "CANADA", "CAP", "CAPITAL", "CAR", "CARD", "CARROT", "CASINO",
//   "CAST", "CAT", "CELL", "CENTAUR", "CENTER", "CHAIR", "CHANGE", "CHARGE", "CHECK", "CHEST", "CHICK", "CHINA", "CHOCOLATE", "CHURCH",
//   "CIRCLE", "CLIFF", "CLOAK", "CLUB", "CODE", "COLD", "COMIC", "COMPOUND", "CONCERT", "CONDUCTOR", "CONTRACT", "COOK", "COPPER", "COTTON",
//   "COURT", "COVER", "CRANE", "CRASH", "CRICKET", "CROSS", "CROWN", "CYCLE", "CZECH", "DANCE", "DATE", "DAY", "DEATH", "DECK", "DEGREE",
//   "DIAMOND", "DICE", "DINOSAUR", "DISEASE", "DOCTOR", "DOG", "DRAFT", "DRAGON", "DRESS", "DRILL", "DROP", "DUCK", "DWARF", "EAGLE",
//   "EGYPT", "EMBASSY", "ENGINE", "ENGLAND", "EUROPE", "EYE", "FACE", "FAIR", "FALL", "FAN", "FENCE", "FIELD", "FIGHTER", "FIGURE", "FILE",
//   "FILM", "FIRE", "FISH", "FLIGHT", "FLUTE", "FORCE", "FOREST", "FORK", "FRANCE", "GAME", "GAS", "GENIUS", "GERMANY", "GHOST", "GIANT",
//   "GLASS", "GLOVE", "GOLD", "GRACE", "GRASS", "GREECE", "GREEN", "GROUND", "HAM", "HAND", "HAWK", "HEAD", "HEART", "HELICOPTER", "HIMALAYAS",
//   "HOLE", "HOLLYWOOD", "HONEY", "HOOD", "HOOK", "HORN", "HORSE", "HORSESHOE", "HOSPITAL", "HOTEL", "ICE", "ICE CREAM", "INDIA", "IRON",
//   "IVORY", "JACK", "JAM", "JET", "JUPITER", "KANGAROO", "KETCHUP", "KEY", "KID", "KING", "KIWI", "KNIFE", "KNIGHT", "LAB", "LAP", "LASER",
//   "LAWYER", "LEAD", "LEMON", "LEPRECHAUN", "LIFE", "LIGHT", "LIMOUSINE", "LINE", "LINK", "LION", "LITTER", "LOCH NESS", "LOCK", "LOG",
//   "LONDON", "LUCK", "MAIL", "MAMMOTH", "MAPLE", "MARBLE", "MARCH", "MASS", "MATCH", "MERCURY", "MEXICO", "MICROSCOPE", "MILLIONAIRE", "MINE",
//   "MINT", "MISSILE", "MODEL", "MOLE", "MOON", "MOSCOW", "MOUNT", "MOUSE", "MOUTH", "MUG", "NAIL", "NEEDLE", "NET", "NEW YORK", "NIGHT",
//   "NINJA", "NOTE", "NOVEL", "NURSE", "NUT", "OCTOPUS", "OIL", "OLIVE", "OLYMPUS", "OPERA", "ORANGE", "ORCHARD", "ORGAN", "PAN", "PANTS",
//   "PAPER", "PARACHUTE", "PARK", "PART", "PASTE", "PENGUIN", "PIANO", "PIE", "PILOT", "PIN", "PIPE", "PIRATE", "PISTOL", "PIT", "PITCH",
//   "PLANE", "PLASTIC", "PLATE", "PLATYPUS", "PLAY", "PLUGIN", "POISON", "POLE", "POLICE", "POOL", "PORT", "POST", "POUND", "PRESS", "PRINCESS",
//   "PUMPKIN", "PUPIL", "PYRAMID", "QUEEN", "RABBIT", "RACKET", "RAY", "REVOLUTION", "RING", "ROBIN", "ROBOT", "ROCK", "ROME", "ROOT", "ROSE",
//   "ROULETTE", "ROUND", "ROW", "RULER", "SATELLITE", "SATURN", "SCALE", "SCHOOL", "SCIENTIST", "SCORPION", "SCREEN", "SCUBA DIVER", "SEAL",
//   "SERVER", "SHADOW", "SHAKESPEARE", "SHARK", "SHIP", "SHOE", "SHOP", "SHOT", "SINK", "SKYSCRAPER", "SLIP", "SMUGGLER", "SNOW", "SNOWMAN"
// ];