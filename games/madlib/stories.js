/* games/madlib/stories.js */

export const STORIES = {
  pizza: {
    title: "The Ultimate Pizza Party",
    text: "Today, I am throwing a pizza party! I invited my best friend, the {Adjective} {Noun (Person/Job)}. First, we will prepare the dough by {Verb ending in 'ing'} it. Then, we will cover it with a layer of {Adjective} sauce and lots of shredded {Type of Food}. My friend wants to put some sliced {Noun (Object)} on top, but I think that sounds {Adjective (Opinion/Emotion)}. When it's cooked, we will eat it while listening to {Genre of Music} music!"
  },
  zoo: {
    title: "A Wild Trip to the Zoo",
    text: "Yesterday, my class took a field trip to the zoo. The first animal we saw was a {Adjective} {Noun (Animal)} that was {Verb ending in 'ing'} in its cage. Then, we walked over to see the {Noun (Animal)}s. They were eating a large bowl of {Type of Food} and making {Adjective} noises. Suddenly, one of them threw a {Noun (Object)} at our teacher, Mr. {Last Name}! We all laughed, but the teacher looked {Adjective}."
  },
  space: {
    title: "The Secret Space Mission",
    text: "Houston, we have a {Noun (Problem)}! Our spaceship, the USS {Proper Noun (Ship Name)}, is currently orbiting the planet {Name of a Planet}. The atmosphere here is very {Adjective} and smells like {Type of Food}. We are preparing to land and deploy our {Noun (Object)}. Our mission is to search for alien life and {Verb} back to Earth. If we succeed, the President will award us a shiny {Noun (Object)}!"
  },
  fantasy: {
    title: "The Knight's Quest",
    text: "Deep in the Whispering Woods, a brave knight named Sir {Proper Noun (Name)} set out to defeat the {Adjective} dragon. Armed with only a shield and a magical {Noun (Weapon)}, they marched toward the beast's lair, which smelled strongly of {Noun (Smell)}. Suddenly, the dragon emerged and let out a loud {Noun (Sound)}! Instead of fighting, Sir {Proper Noun (Name)} decided to {Verb} and offered the dragon a delicious {Type of Food}. The dragon smiled, and they became best friends forever."
  },
  cooking: {
    title: "The Cooking Disaster",
    text: "Welcome back to the Great British Baking {Noun (Event)}! Today, our contestants are making a classic {Adjective} pie. First, you must gently whip the {Noun (Plural)} until they are fluffy. Next, fold in a cup of finely chopped {Type of Food} and stir the mixture with a {Noun (Kitchen Tool)}. Be careful not to {Verb} the oven, or your kitchen will turn into a {Noun (Place)}! If you get it right, your pie will taste absolutely {Adjective}."
  },
  safari: {
    title: "Jungle Adventure",
    text: "I went on a safari in the deep jungles of {Name of a Country}. Our guide told us to look out for the rare, blue-striped {Animal}, which is known to {Verb} when it gets excited. Suddenly, we heard a rustling in the {Noun (Plural)}! I reached into my backpack and pulled out my {Noun (Object)} to protect myself. Out popped a tiny, {Adjective} monkey wearing a {Noun (Article of Clothing)}. It grabbed my camera and ran up a tree!"
  },
  school: {
    title: "The Best School Field Trip",
    text: "Today, our class took a yellow school bus to the National Museum of {Noun (Topic)}. Mr. {Proper Noun (Last Name)}, our teacher, warned us not to touch the giant, prehistoric {Noun (Object)}. But while we were walking by, Jamie tripped and accidentally fell right into the {Adjective} exhibit! The alarm started to {Verb} and security guards began running from every direction. We had to escape by hiding inside a large display of {Type of Food}."
  },
  firstDate: {
    title: "The Ultimate Icebreaker",
    text: "To break the ice, I need to confess something: I once got my head stuck in a {Noun (Object)} because I wanted to see if it would fit. The police had to use {Noun (Plural)} to get me out! My friends still call me 'The {Adjective} Wonder.' Anyway, now that you know my deepest, most {Adjective} secret, it's your turn. Tell me your worst habit, but you have to explain it using only {Animal} noises. If we both survive this conversation, we should totally go to the nearest {Noun (Place)} and {Verb} together!"
  },
    firstDateDisaster: {
    title: "The First Date Disaster",
    text: "My last first date was an absolute trainwreck. It started when I accidentally wore a {Noun (Article of Clothing)} inside out. To make matters worse, we went to a fancy restaurant and I ordered the {Type of Food}, which ended up splattering all over my date's {Adjective} face! I tried to clean it up, but I ended up knocked over a glass of water right into their {Noun (Object)}. In a panic, I decided to {Verb} out the bathroom window. I guess I won't be getting a second date!"
  },
  cuteFirstDate: {
    title: "The Picture-Perfect First Date",
    text: "Our first date was like something out of a movie. We met up at a cozy {Noun (Place)}, which was decorated with {Adjective} fairy lights. We decided to share a giant bowl of {Type of Food}, and they actually let me have the very last bite! While we were walking in the park afterward, it started to pour, so we had to huddle under a tiny {Noun (Object)}. We ended up completely soaked, but instead of running for cover, we decided to {Verb} in the puddles like a pair of happy {Animal (Plural)}. It was the absolute perfect start to something special."
  },
  superpower: {
    title: "The Superpower Mix-Up",
    text: "I woke up this morning to discover that I had gained a secret superpower: the ability to shoot {Noun (Plural)} out of my fingers! I was so excited that I immediately flew to {Proper Noun (Place)} to show off. But when I tried to save a falling {Noun (Person/Job)}, I accidentally shot {Adjective} {Type of Food} instead! Everyone stared at me, and I felt extremely {Adjective}. Now, instead of a hero, they call me the {Adjective} Menace."
  },
  hauntedHouse: {
    title: "The Haunted House Dare",
    text: "For Halloween, my friends dared me to spend the night in the haunted {Noun (Place)} down the street. As soon as I walked in, the door slammed shut and I heard a {Adjective} whisper that said, 'Give me your {Noun (Object)}!' I screamed and ran into the kitchen, where a ghost was busy {Verb ending in 'ing'} a bowl of {Type of Food}. It looked at me and yelled, 'Mr. {Proper Noun (Last Name)}! You are late for your {Noun (Event)}!' I ran home so fast I lost my {Noun (Article of Clothing)}."
  },
  heroInterview: {
    title: "The Superhero Job Interview",
    text: "Welcome to the Avenger's headquarters. Thank you for applying for the role of the next superhero, Captain {Proper Noun (Noun)}. Our HR department is looking for someone whose main weakness is {Adjective} {Noun (Plural)}. In your resume, you listed your signature gadget as a magical {Noun (Object)}, which you use to {Verb} the bad guys. That's very impressive! If hired, your partner will be a crime-fighting {Animal} that communicates only in {Genre of Music} lyrics. Welcome to the team!"
  }
};

export function parseStory(storyText) {
  const prompts = [];
  const regex = /\{([^{}]+)\}/g;
  let match;
  while ((match = regex.exec(storyText)) !== null) {
    prompts.push(match[1]);
  }
  return prompts;
}

export function compileStory(storyText, answers) {
  let index = 0;
  const regex = /\{([^{}]+)\}/g;
  return storyText.replace(regex, () => {
    const val = answers[index] || '___';
    index++;
    return `<span class="story-highlight">${val}</span>`;
  });
}
