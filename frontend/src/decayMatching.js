// Decay matching functions
// This module provides functions to match decay structures at any level of the decay tree

// Helper function to normalize particle names (remove []cc, normalize case)
export function normalizeParticleName(name) {
  if (typeof name !== 'string') return name;
  return name.replace(/\[.*?\]cc/g, '').trim();
}

// Helper function to check if something is a decay (nested list) or particle (string)
export function isDecay(item) {
  return Array.isArray(item);
}

// Helper function to sort a decay structure
// First entry is mother (keep as is), rest are daughters (sort alphabetically)
export function sortDecay(decay) {
  if (!Array.isArray(decay) || decay.length === 0) return decay;
  
  const mother = decay[0];
  const daughters = decay.slice(1);
  
  // Sort daughters: strings alphabetically, lists by their first entry
  const sortedDaughters = [...daughters].sort((a, b) => {
    const aKey = typeof a === 'string' ? a : (Array.isArray(a) && a.length > 0 ? a[0] : '');
    const bKey = typeof b === 'string' ? b : (Array.isArray(b) && b.length > 0 ? b[0] : '');
    return aKey.localeCompare(bKey);
  });
  
  // Recursively sort nested decays
  const sortedDaughtersRecursive = sortedDaughters.map(d => 
    Array.isArray(d) ? sortDecay(d) : d
  );
  
  return [mother, ...sortedDaughtersRecursive];
}

// Helper function to normalize a decay for comparison (sort and normalize particle names)
export function normalizeDecay(decay) {
  if (!Array.isArray(decay)) return normalizeParticleName(decay);
  
  const sorted = sortDecay(decay);
  return sorted.map(item => 
    Array.isArray(item) ? normalizeDecay(item) : normalizeParticleName(item)
  );
}

// Helper function to compare two decays (order-independent)
export function decaysMatch(decay1, decay2) {
  const norm1 = normalizeDecay(decay1);
  const norm2 = normalizeDecay(decay2);
  
  // Deep comparison
  if (JSON.stringify(norm1) === JSON.stringify(norm2)) {
    return true;
  }
  return false;
}

// Helper function to extract all final state particles from a decay structure
// Returns a sorted array of particle names (strings only, no sub-decays)
export function extractFinalStates(decay) {
  if (!Array.isArray(decay) || decay.length === 0) return [];
  
  const finalStates = [];
  const daughters = decay.slice(1); // Skip mother
  
  for (const daughter of daughters) {
    if (typeof daughter === 'string') {
      // Direct particle - add it
      finalStates.push(normalizeParticleName(daughter));
    } else if (Array.isArray(daughter)) {
      // Sub-decay - recursively extract its final states
      finalStates.push(...extractFinalStates(daughter));
    }
  }
  
  return finalStates.sort();
}

// Helper function to extract all daughters (particles and sub-decay mothers) from a decay
// Returns an array of normalized particle names and sub-decay structures
export function extractDaughters(decay) {
  if (!Array.isArray(decay) || decay.length === 0) return [];
  return decay.slice(1); // Return all daughters (both particles and sub-decays)
}

// Helper function to get all matchable particles from a target daughter
// For a particle: returns [particle]
// For a sub-decay: returns [mother, ...finalStates]
export function getMatchableParticles(targetDaughter) {
  if (typeof targetDaughter === 'string') {
    return [normalizeParticleName(targetDaughter)];
  } else if (Array.isArray(targetDaughter) && targetDaughter.length > 0) {
    const mother = normalizeParticleName(targetDaughter[0]);
    const finalStates = extractFinalStates(targetDaughter);
    return [mother, ...finalStates];
  }
  return [];
}

// Helper function to check if a search daughter matches a target daughter
// Search daughter can be a particle (string) or sub-decay (array)
// Target daughter can be a particle (string) or sub-decay (array)
// This allows matching particles to sub-decay mothers or sub-decay final states
export function daughterMatches(searchDaughter, targetDaughter) {
  if (typeof searchDaughter === 'string' && typeof targetDaughter === 'string') {
    // Both are particles - direct match
    return normalizeParticleName(searchDaughter) === normalizeParticleName(targetDaughter);
  } else if (typeof searchDaughter === 'string' && Array.isArray(targetDaughter)) {
    // Search is particle, target is sub-decay
    // Check if search particle matches sub-decay mother or any final state
    const matchable = getMatchableParticles(targetDaughter);
    return matchable.includes(normalizeParticleName(searchDaughter));
  } else if (Array.isArray(searchDaughter) && Array.isArray(targetDaughter)) {
    // Both are sub-decays - recursive match
    return decayContains(targetDaughter, searchDaughter);
  } else if (Array.isArray(searchDaughter) && typeof targetDaughter === 'string') {
    // Search is sub-decay, target is particle - can't match
    return false;
  }
  return false;
}

// Helper function to check if a sub-decay's final states contain all of a set of particles
export function subDecayContainsParticles(subDecay, particles) {
  if (!Array.isArray(subDecay)) return false;
  const finalStates = extractFinalStates(subDecay);
  const particleSet = new Set(particles.map(p => normalizeParticleName(p)));
  return particles.every(p => finalStates.includes(normalizeParticleName(p)));
}

// Helper function to check if all search daughters can be matched to target daughters
// This handles order-independent matching at any level of the decay tree
// Returns true only if ALL search daughters match AND all target daughters are fully consumed
// This allows matching:
// - Direct particles: "a -> b c" matches "a -> b c"
// - Intermediate mothers: "a -> m n" matches "a -> (m -> b c) (n -> d e)"
// - Final states: "a -> b c d e" matches "a -> (m -> b c) (n -> d e)"
// - Mixed: "a -> b c n" matches "a -> (m -> b c) (n -> d e)"
// But prevents supersets: "a -> b c d" does NOT match "a -> b c d e"
export function daughtersMatch(searchDaughters, targetDaughters) {
  // Normalize both for comparison
  const searchNorm = searchDaughters.map(d => 
    typeof d === 'string' ? normalizeParticleName(d) : d
  );
  const targetNorm = targetDaughters.map(d => 
    typeof d === 'string' ? normalizeParticleName(d) : d
  );
  
  // Track which search daughters and target daughters are matched
  const matchedSearchIndices = new Set();
  // For target daughters, we track how many "matchable particles" have been consumed
  // Each target daughter can contribute multiple matchable particles (mother + final states)
  const targetConsumption = targetNorm.map(() => new Set()); // Track which particles from each target are used
  
  // First, try to match sub-decays in search to sub-decays in target
  for (let i = 0; i < searchNorm.length; i++) {
    if (matchedSearchIndices.has(i)) continue;
    const searchDaughter = searchNorm[i];
    
    if (Array.isArray(searchDaughter)) {
      // Try to match to a target sub-decay
      for (let j = 0; j < targetNorm.length; j++) {
        if (Array.isArray(targetNorm[j]) && decayContains(targetNorm[j], searchDaughter)) {
          // Mark the entire target sub-decay as consumed
          const matchable = getMatchableParticles(targetNorm[j]);
          matchable.forEach(p => targetConsumption[j].add(p));
          matchedSearchIndices.add(i);
          break;
        }
      }
    }
  }
  
  // Now match remaining search particles to target matchable particles
  // Each target daughter can contribute: its particle (if direct) or mother + final states (if sub-decay)
  const remainingSearch = searchNorm.filter((_, i) => !matchedSearchIndices.has(i));
  
  for (let i = 0; i < searchNorm.length; i++) {
    if (matchedSearchIndices.has(i)) continue;
    const searchParticle = searchNorm[i];
    
    if (typeof searchParticle !== 'string') {
      // Non-string search daughter that wasn't matched - fail
      return false;
    }
    
    const normalizedSearch = normalizeParticleName(searchParticle);
    let foundMatch = false;
    
    // Try to match to any unused matchable particle from any target daughter
    for (let j = 0; j < targetNorm.length; j++) {
      const matchable = getMatchableParticles(targetNorm[j]);
      const unused = matchable.filter(p => !targetConsumption[j].has(p));
      
      if (unused.includes(normalizedSearch)) {
        targetConsumption[j].add(normalizedSearch);
        matchedSearchIndices.add(i);
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      return false; // Couldn't match this search particle
    }
  }
  
  // All search daughters must be matched
  if (matchedSearchIndices.size !== searchNorm.length) {
    return false;
  }
  
  // Each target daughter must contribute at least one match (no unused target daughters)
  // This prevents "a -> b c d" from matching "a -> b c d e" (e would be unused)
  // But allows "a -> m n" to match "a -> (m -> b c) (n -> d e)" (only m and n are used, not b,c,d,e)
  for (let j = 0; j < targetNorm.length; j++) {
    if (targetConsumption[j].size === 0) {
      return false; // This target daughter wasn't used at all
    }
  }
  
  return true;
}

// Main function to check if a decay structure contains a search decay
// This is the primary function used for matching decays in the search
export function decayContains(decayStructure, searchDecay) {
  if (!decayStructure || !searchDecay) return false;
  
  // Both must be arrays (decays)
  if (!Array.isArray(decayStructure) || !Array.isArray(searchDecay)) {
    return false;
  }
  
  // Check if mothers match
  const structureMother = normalizeParticleName(decayStructure[0]);
  const searchMother = normalizeParticleName(searchDecay[0]);
  
  if (structureMother !== searchMother) {
    // Mothers don't match, but check sub-decays
    for (const item of decayStructure.slice(1)) {
      if (Array.isArray(item)) {
        if (decayContains(item, searchDecay)) {
          return true;
        }
      }
    }
    return false;
  }
  
  // Mothers match - check if this exact decay matches
  if (decaysMatch(decayStructure, searchDecay)) {
    return true;
  }
  
  // Extract daughters from both
  const searchDaughters = extractDaughters(searchDecay);

  const filterObject = {
    searchDaughters: searchDaughters,
  }
  
  const weight = findMatches(decayStructure, filterObject);
  return weight === getWeight(decayStructure) && filterObject.searchDaughters.length === 0;



  
//   return false;
}


function getWeight(decayStructure) {
    if (typeof decayStructure === 'string') {
        return 1;
    }
    return decayStructure.reduce((acc, daughter) => acc + getWeight(daughter), -1); // -1 for the mother,which will be counted as 1 but this is incorrect
}

function nodeName(decayStructure) {
    if (typeof decayStructure === 'string') {
        return decayStructure;
    }
    return decayStructure[0];
}

// TODO: Add branching with reset
function findMatches(decayStructure, filterObject) {
    if (!(typeof decayStructure === 'string')){
        const mother = nodeName(decayStructure);
        const daughters = decayStructure.slice(1);
        if (filterObject.searchDaughters.includes(mother)) {
            filterObject.searchDaughters.splice(filterObject.searchDaughters.indexOf(mother), 1);
            return getWeight(decayStructure);
        }
        if (daughters.every(daughter => filterObject.searchDaughters.includes(nodeName(daughter)))) {
            // all daughters are found, so we can return the weight of the mother. Also it is only legal to find all or none of the daughters.
            // now we need to remove the daughters from the search daughters list. BUT names acan appear multiple times in both lists. We need to remove on a 1-1 basis.
            for (const daughter of daughters) {
                const daughterName = nodeName(daughter);
                const index = filterObject.searchDaughters.indexOf(daughterName);
                if (index !== -1) {
                    filterObject.searchDaughters.splice(index, 1);
                }
            }
            return getWeight(decayStructure);
        }
        else {
            return daughters.reduce((acc, daughter) => acc + findMatches(daughter, filterObject), 0);
        }

    }
    return 0;

}

