export function generateRandomName() {
  const adjectives = ["Sneaky", "Fierce", "Swift", "Sleepy", "Lazy", "Crazy", "Brave", "Clever", "Silly", "Mighty", "Phantom", "Cosmic", "Neon", "Cyber", "Rapid", "Golden", "Silent", "Savage"];
  const animals = ["Cobra", "Panda", "Platypus", "Falcon", "Tiger", "Shark", "Wolf", "Owl", "Rhino", "Dragon", "Gecko", "Koala", "Viper", "Panther", "Moose", "Badger", "Fox", "Bear"];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  
  return `${adj}-${animal}`;
}