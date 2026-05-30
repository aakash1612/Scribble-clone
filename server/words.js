const words = {
  animals: [
    'cat', 'dog', 'elephant', 'giraffe', 'penguin', 'dolphin', 'lion', 'tiger',
    'rabbit', 'parrot', 'crocodile', 'kangaroo', 'octopus', 'flamingo', 'panda',
    'zebra', 'gorilla', 'koala', 'chameleon', 'hamster', 'cheetah', 'wolf',
    'polar bear', 'sea turtle', 'bald eagle',
  ],
  objects: [
    'chair', 'lamp', 'bicycle', 'umbrella', 'telescope', 'suitcase', 'hourglass',
    'compass', 'thermometer', 'anchor', 'magnifying glass', 'camera', 'guitar',
    'trophy', 'binoculars', 'clock', 'cactus', 'lantern', 'key', 'crown',
    'hammer', 'scissors', 'envelope', 'phone', 'calculator',
  ],
  food: [
    'pizza', 'sushi', 'hamburger', 'taco', 'ice cream', 'cupcake', 'spaghetti',
    'pancake', 'sandwich', 'burrito', 'donut', 'pretzel', 'watermelon', 'broccoli',
    'avocado', 'popcorn', 'hot dog', 'strawberry', 'pineapple', 'croissant',
  ],
  actions: [
    'jumping', 'swimming', 'sleeping', 'laughing', 'cooking', 'dancing', 'climbing',
    'fishing', 'painting', 'running', 'reading', 'singing', 'flying', 'surfing',
    'skiing', 'boxing', 'gardening', 'hiking', 'cycling', 'juggling',
  ],
  places: [
    'beach', 'library', 'volcano', 'lighthouse', 'castle', 'igloo', 'pyramid',
    'spaceship', 'treehouse', 'submarine', 'windmill', 'skyscraper', 'jungle',
    'cave', 'island', 'bridge', 'stadium', 'airport', 'museum', 'restaurant',
  ],
  misc: [
    'rainbow', 'tornado', 'thunder', 'snowflake', 'sunset', 'galaxy', 'wave',
    'shadow', 'echo', 'dream', 'magic', 'ghost', 'robot', 'alien', 'ninja',
    'pirate', 'wizard', 'superhero', 'dragon', 'mermaid',
  ],
};

function getRandomWords(count = 3, customPool = null) {
  const pool = customPool && customPool.length >= count
    ? customPool
    : Object.values(words).flat();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = { words, getRandomWords };
