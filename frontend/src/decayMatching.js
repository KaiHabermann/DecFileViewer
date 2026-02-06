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
  
  if (structureMother.replace(/sig$/, "") !== searchMother.replace(/sig$/, "")) {
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
        return decayStructure.replace(/sig$/, "");
    }
    return decayStructure[0].replace(/sig$/, "");
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

