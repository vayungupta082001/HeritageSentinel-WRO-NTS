const SEARCH_ALIASES = {
  old: ['ancient', 'historic', 'history', 'artifact'],
  history: ['historic', 'ancient', 'old'],
  weapon: ['sword', 'shield', 'armor', 'battle'],
  painting: ['art', 'portrait', 'canvas'],
  pottery: ['pot', 'vase', 'ceramic'],
  sculpture: ['statue', 'stone', 'carving'],
  robot: ['technology', 'innovation', 'engineering'],
  gold: ['golden', 'metal', 'treasure'],
  ancient: ['old', 'historic', 'history']
};

export function filterArtifacts({ artifacts, search, category }) {
  const normalizedSearch = String(search ?? '').trim().toLowerCase();

  return artifacts.filter(a => {
    const matchesCategory = category === 'all' || a.category === category;
    if (!matchesCategory) return false;

    if (!normalizedSearch) return true;

    const searchableText = [
      a.name,
      a.category,
      a.era,
      a.description
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const directMatch = searchableText.includes(normalizedSearch);

    const aliasTerms = SEARCH_ALIASES[normalizedSearch] || [];
    const aliasMatch = aliasTerms.some(term => searchableText.includes(term));

    const fuzzyMatch = normalizedSearch
      .split(' ')
      .filter(Boolean)
      .some(word => searchableText.includes(word));

    return directMatch || aliasMatch || fuzzyMatch;
  });
}

