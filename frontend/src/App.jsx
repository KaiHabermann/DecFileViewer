import React, { useState, useEffect, useRef } from 'react';
import DotViewer from './DotViewer';

// Helper function to normalize particle names (remove []cc, normalize case)
function normalizeParticleName(name) {
  if (typeof name !== 'string') return name;
  return name.replace(/\[.*?\]cc/g, '').trim();
}

// Helper function to check if something is a decay (nested list) or particle (string)
function isDecay(item) {
  return Array.isArray(item);
}

// Helper function to sort a decay structure
// First entry is mother (keep as is), rest are daughters (sort alphabetically)
function sortDecay(decay) {
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
function normalizeDecay(decay) {
  if (!Array.isArray(decay)) return normalizeParticleName(decay);
  
  const sorted = sortDecay(decay);
  return sorted.map(item => 
    Array.isArray(item) ? normalizeDecay(item) : normalizeParticleName(item)
  );
}

// Helper function to compare two decays (order-independent)
function decaysMatch(decay1, decay2) {
  const norm1 = normalizeDecay(decay1);
  const norm2 = normalizeDecay(decay2);
  
  // Deep comparison
  if (JSON.stringify(norm1) === JSON.stringify(norm2)) {
    return true;
  }
  return false;
}

// Helper function to parse a decay string into nested list format
// Example: "B0sig -> (Lambda(1520)0 -> K- p+) (anti-Lambda(1520)0 -> K+ anti-p-)"
// Result: [B0sig, [Lambda(1520)0, K-, p+], [anti-Lambda(1520)0, K+, anti-p-]]
function parseDecayString(decayStr) {
  if (!decayStr || typeof decayStr !== 'string') return null;
  
  // Remove []cc markers
  let cleaned = decayStr.replace(/\[.*?\]cc/g, '').trim();
  if (!cleaned) return null;
  
  // Remove outer brackets if present
  cleaned = cleaned.replace(/^\[|\]$/g, '');
  
  // Find the first -> that's not inside parentheses
  let firstArrow = -1;
  let parenDepth = 0;
  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i] === '(') parenDepth++;
    else if (cleaned[i] === ')') parenDepth--;
    else if (cleaned[i] === '-' && cleaned[i + 1] === '>' && parenDepth === 0) {
      firstArrow = i;
      break;
    }
  }
  
  if (firstArrow === -1) return null;
  
  const mother = normalizeParticleName(cleaned.substring(0, firstArrow).trim());
  const daughtersStr = cleaned.substring(firstArrow + 2).trim();
  
  if (!mother || !daughtersStr) return null;
  
  // Parse daughters - they can be particles or sub-decays in parentheses
  const daughters = [];
  let current = '';
  parenDepth = 0;
  
  for (let i = 0; i < daughtersStr.length; i++) {
    const char = daughtersStr[i];
    
    if (char === '(') {
      if (parenDepth === 0 && current.trim()) {
        // Save current particle before starting sub-decay
        const particle = normalizeParticleName(current.trim());
        if (particle) daughters.push(particle);
        current = '';
      }
      parenDepth++;
      current += char;
    } else if (char === ')') {
      current += char;
      parenDepth--;
      if (parenDepth === 0) {
        // End of sub-decay, parse it
        const subDecayStr = current.slice(1, -1); // Remove outer parentheses
        const subDecay = parseDecayString(subDecayStr);
        if (subDecay) {
          daughters.push(subDecay);
        } else {
          // If parsing failed, try to extract as a simple particle name
          const particle = normalizeParticleName(subDecayStr.trim());
          if (particle) daughters.push(particle);
        }
        current = '';
      }
    } else if (char === ' ' && parenDepth === 0) {
      // Space outside parentheses - separator between daughters
      if (current.trim()) {
        const particle = normalizeParticleName(current.trim());
        if (particle) daughters.push(particle);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  // Add remaining particle
  if (current.trim() && parenDepth === 0) {
    const particle = normalizeParticleName(current.trim());
    if (particle) daughters.push(particle);
  }
  
  if (daughters.length === 0) return null;
  
  return sortDecay([mother, ...daughters]);
}

// Helper function to extract all final state particles from a decay structure
// Returns a sorted array of particle names (strings only, no sub-decays)
function extractFinalStates(decay) {
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
function extractDaughters(decay) {
  if (!Array.isArray(decay) || decay.length === 0) return [];
  return decay.slice(1); // Return all daughters (both particles and sub-decays)
}

// Helper function to check if a search daughter matches a target daughter
// Search daughter can be a particle (string) or sub-decay (array)
// Target daughter can be a particle (string) or sub-decay (array)
function daughterMatches(searchDaughter, targetDaughter) {
  if (typeof searchDaughter === 'string' && typeof targetDaughter === 'string') {
    // Both are particles - direct match
    return normalizeParticleName(searchDaughter) === normalizeParticleName(targetDaughter);
  } else if (typeof searchDaughter === 'string' && Array.isArray(targetDaughter)) {
    // Search is particle, target is sub-decay - check if search particle matches sub-decay mother
    if (targetDaughter.length > 0) {
      const targetMother = normalizeParticleName(targetDaughter[0]);
      return normalizeParticleName(searchDaughter) === targetMother;
    }
    return false;
  } else if (Array.isArray(searchDaughter) && Array.isArray(targetDaughter)) {
    // Both are sub-decays - recursive match
    return decayContains(targetDaughter, searchDaughter);
  } else if (Array.isArray(searchDaughter) && typeof targetDaughter === 'string') {
    // Search is sub-decay, target is particle - can't match
    return false;
  }
  return false;
}

// Helper function to check if all search daughters can be matched to target daughters
// This handles order-independent matching
function daughtersMatch(searchDaughters, targetDaughters) {
  // Normalize and sort both for comparison
  const searchNorm = searchDaughters.map(d => 
    typeof d === 'string' ? normalizeParticleName(d) : d
  );
  const targetNorm = targetDaughters.map(d => 
    typeof d === 'string' ? normalizeParticleName(d) : d
  );
  
  // Try to match each search daughter to a target daughter
  const usedTargetIndices = new Set();
  
  for (const searchDaughter of searchNorm) {
    let foundMatch = false;
    
    for (let i = 0; i < targetNorm.length; i++) {
      if (usedTargetIndices.has(i)) continue;
      
      if (daughterMatches(searchDaughter, targetNorm[i])) {
        usedTargetIndices.add(i);
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      return false;
    }
  }
  
  return true;
}

// Helper function to check if a decay structure contains a search decay
function decayContains(decayStructure, searchDecay) {
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
  const structureDaughters = extractDaughters(decayStructure);
  const searchDaughters = extractDaughters(searchDecay);
  
  // Check if all search daughters can be matched to target daughters
  // This handles:
  // - Direct particle matches: search "a -> b c" matches "a -> b c"
  // - Sub-decay mother matches: search "a -> b c" matches "a -> (b -> x y) c"
  // - Final state matches: search "a -> x y" matches "a -> (b -> x y)"
  if (daughtersMatch(searchDaughters, structureDaughters)) {
    return true;
  }
  
  // Also check if search final states are all present in structure final states
  // This handles the case: search "a -> x y" matches "a -> (b -> x y) z" (subset)
  const structureFinalStates = extractFinalStates(decayStructure);
  const searchFinalStates = extractFinalStates(searchDecay);
  
  if (searchFinalStates.length > 0) {
    const structureFinalStatesSet = new Set(structureFinalStates);
    const allSearchStatesPresent = searchFinalStates.every(state => 
      structureFinalStatesSet.has(state)
    );
    
    if (allSearchStatesPresent) {
      return true;
    }
  }
  
  // Check sub-decays recursively
  for (const item of decayStructure.slice(1)) {
    if (Array.isArray(item)) {
      if (decayContains(item, searchDecay)) {
        return true;
      }
    }
  }
  
  return false;
}

function App() {
  const [data, setData] = useState([]);
  const [uniqueParticles, setUniqueParticles] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState(''); // Global text search
  const [particleSearch, setParticleSearch] = useState(''); // Input for adding particles/decays
  const [selectedFilters, setSelectedFilters] = useState([]); // List of particles (strings) or decays (arrays) to filter by
  const [selectedPhysicsWG, setSelectedPhysicsWG] = useState(''); // PhysicsWG filter
  
  // Decay input mode states
  const [decayMode, setDecayMode] = useState(false); // Whether we're in decay input mode
  const [decayMother, setDecayMother] = useState(''); // The mother particle in decay mode
  const [decayDaughters, setDecayDaughters] = useState([]); // Current daughters being built
  
  // Sorting states
  const [sortField, setSortField] = useState(null); // 'eventType' or 'date'
  const [sortOrder, setSortOrder] = useState(null); // 'asc', 'desc', or null
  
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const [uniquePhysicsWGs, setUniquePhysicsWGs] = useState([]);

  useEffect(() => {
    fetch('./data.json')
      .then(res => res.json())
      .then(responseData => {
        // Handle new data structure
        if (responseData.files) {
          setData(responseData.files);
          setUniqueParticles(responseData.uniqueParticles || []);
          setMetadata(responseData.metadata || null);
          
          // Extract unique PhysicsWG values
          const wgs = new Set();
          responseData.files.forEach(file => {
            if (file.physicsWG) {
              wgs.add(file.physicsWG);
            }
          });
          setUniquePhysicsWGs(Array.from(wgs).sort());
        } else {
          // Fallback for old format if needed
          setData(responseData);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load data:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    // Click outside to close suggestions
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    if (selectedItem) {
      setLoadingFile(true);
      fetch(`./dkfiles/${selectedItem.filename}`)
        .then(res => {
          if (!res.ok) throw new Error("File not found");
          return res.text();
        })
        .then(text => {
          setFileContent(text);
          setLoadingFile(false);
        })
        .catch(err => {
          console.error("Failed to load file:", err);
          setFileContent("Error loading file content.");
          setLoadingFile(false);
        });
    } else {
      setFileContent('');
    }
  }, [selectedItem]);

  // Filter and sort logic
  let filteredData = data.filter(item => {
    // 1. Text Search (Global)
    // Handle both single descriptor (string) and multiple descriptors (array)
    const descriptors = Array.isArray(item.descriptor) ? item.descriptor : 
                       (item.descriptors || [item.descriptor || '']);
    const descriptorText = descriptors.join(' ').toLowerCase();
    
    const matchesText = 
      searchTerm === '' ||
      item.eventType.includes(searchTerm) || 
      descriptorText.includes(searchTerm.toLowerCase()) ||
      item.filename.toLowerCase().includes(searchTerm.toLowerCase());
      
    // 2. Particle/Decay Filter (AND logic: must contain ALL selected filters)
    const matchesFilters = selectedFilters.length === 0 || 
      selectedFilters.every(filter => {
        // If filter is a string (particle)
        if (typeof filter === 'string') {
          const itemParticles = item.particles || [];
          const itemParticlesLower = itemParticles.map(p => p.toLowerCase());
          return itemParticlesLower.includes(filter.toLowerCase());
        }
        // If filter is an array (decay)
        else if (Array.isArray(filter)) {
          const decayStructures = item.decay_structures || [];
          if (decayStructures.length === 0) return false;
          
          // decay_structures is always a list of lists (each inner list is one mode)
          // Structure: [[decay1_mode1, decay2_mode1], [decay1_mode2, ...]]
          // Even single mode: [[decay1, decay2, ...]]
          // Check if any mode contains the search decay
          return decayStructures.some(modeDecays => {
            // modeDecays is a list of decay structures for one mode
            if (!Array.isArray(modeDecays)) return false;
            return modeDecays.some(decay => decayContains(decay, filter));
          });
        }
        return false;
      });
    
    // 3. PhysicsWG Filter
    const matchesPhysicsWG = selectedPhysicsWG === '' || 
      item.physicsWG === selectedPhysicsWG;
      
    return matchesText && matchesFilters && matchesPhysicsWG;
  });

  // Apply sorting
  if (sortField && sortOrder) {
    filteredData = [...filteredData].sort((a, b) => {
      let aVal, bVal;
      
      if (sortField === 'eventType') {
        aVal = a.eventType || '';
        bVal = b.eventType || '';
      } else if (sortField === 'date') {
        // Date is in YYYYMMDD format, so string comparison works
        aVal = a.date || '';
        bVal = b.date || '';
      }
      
      if (sortOrder === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }

  const displayedData = filteredData.slice(0, displayLimit);

  const handleScroll = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
       setDisplayLimit(prev => prev + 50);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openModal = (item) => {
    setSelectedItem(item);
  };

  const closeModal = () => {
    setSelectedItem(null);
  };

  const getGitLabLink = (filename) => {
    // URL encode the filename for GitLab
    const encodedFilename = encodeURIComponent(filename)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
    return `https://gitlab.cern.ch/lhcb-datapkg/Gen/DecFiles/-/blob/master/dkfiles/${encodedFilename}`;
  };

  const addFilter = (filter) => {
    // Check if filter already exists (for particles, simple comparison; for decays, use decay matching)
    const exists = selectedFilters.some(f => {
      if (typeof f === 'string' && typeof filter === 'string') {
        return f.toLowerCase() === filter.toLowerCase();
      } else if (Array.isArray(f) && Array.isArray(filter)) {
        return decaysMatch(f, filter);
      }
      return false;
    });
    
    if (!exists) {
      setSelectedFilters([...selectedFilters, filter]);
    }
    setParticleSearch('');
    setShowSuggestions(false);
    setDisplayLimit(100);
  };

  const removeFilter = (filterToRemove) => {
    setSelectedFilters(selectedFilters.filter(f => {
      if (typeof f === 'string' && typeof filterToRemove === 'string') {
        return f !== filterToRemove;
      } else if (Array.isArray(f) && Array.isArray(filterToRemove)) {
        return !decaysMatch(f, filterToRemove);
      }
      return true;
    }));
    setDisplayLimit(100);
  };

  // Handle input changes and detect decay mode triggers
  const handleParticleSearchChange = (value) => {
    setShowSuggestions(true);
    
    // Check if user typed -> or => (only if not already in decay mode)
    if (!decayMode) {
      const arrowMatch = value.match(/(.*?)\s*(->|=>)\s*(.*)$/);
      
      if (arrowMatch) {
        const [, beforeArrow, arrow, afterArrow] = arrowMatch;
        const motherCandidate = normalizeParticleName(beforeArrow.trim());
        
        if (motherCandidate) {
          // Enter decay mode: particle before arrow becomes mother
          setDecayMode(true);
          setDecayMother(motherCandidate);
          setDecayDaughters([]);
          // Set the input to what comes after the arrow
          setParticleSearch(afterArrow.trim());
          return;
        } else {
          // No particle before arrow - check if we have recent particles
          if (selectedFilters.length > 0) {
            // Take the most recently added filter
            const lastFilter = selectedFilters[selectedFilters.length - 1];
            
            // If it's a particle (string), use it as mother
            if (typeof lastFilter === 'string') {
              setDecayMode(true);
              setDecayMother(lastFilter);
              setDecayDaughters([]);
              // Set the input to what comes after the arrow
              setParticleSearch(afterArrow.trim());
              return;
            } else {
              // Last filter is a decay, can't use it - don't enter decay mode
              // Just don't update the input (prevent adding ->)
              return;
            }
          } else {
            // No particles in list and no particle before arrow - don't do anything
            // Don't update the input (prevent adding ->)
            return;
          }
        }
      }
    }
    
    // Normal update (either not in decay mode, or in decay mode without arrow)
    setParticleSearch(value);
  };

  const handleAddFromInput = () => {
    const input = particleSearch.trim();
    
    if (decayMode) {
      // We're in decay mode, complete the decay
      let allDaughters = [...decayDaughters];
      
      if (input) {
        // Parse the input as daughters (split by spaces)
        const newDaughters = input.split(/\s+/)
          .map(d => normalizeParticleName(d.trim()))
          .filter(d => d);
        allDaughters = [...allDaughters, ...newDaughters];
      }
      
      if (decayMother && allDaughters.length > 0) {
        const decay = sortDecay([decayMother, ...allDaughters]);
        addFilter(decay);
        exitDecayMode();
      } else if (decayMother && allDaughters.length === 0) {
        // Mother but no daughters yet - wait for input
        // Don't exit decay mode, just clear input
        setParticleSearch('');
      }
    } else {
      // Normal mode
      if (!input) return;
      
      // Try to parse as decay first
      const parsedDecay = parseDecayString(input);
      if (parsedDecay) {
        addFilter(parsedDecay);
      } else {
        // If not a decay, treat as particle
        const normalized = normalizeParticleName(input);
        if (normalized) {
          addFilter(normalized);
        }
      }
    }
  };

  const exitDecayMode = () => {
    setDecayMode(false);
    setDecayMother('');
    setDecayDaughters([]);
    setParticleSearch('');
  };

  // Handle adding a particle in decay mode (when clicking suggestion)
  const handleAddParticleInDecayMode = (particle) => {
    if (decayMode) {
      const normalized = normalizeParticleName(particle);
      if (normalized) {
        // Add to daughters list
        setDecayDaughters([...decayDaughters, normalized]);
        setParticleSearch('');
        setShowSuggestions(false);
      }
    } else {
      addFilter(particle);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortField(null);
        setSortOrder(null);
      }
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortOrder('asc');
    }
    setDisplayLimit(100);
  };

  const particleSuggestions = uniqueParticles.filter(p => 
    p.toLowerCase().includes(particleSearch.toLowerCase())
  ).slice(0, 10); // Limit to top 10 matches
  
  // Helper function to format a filter for display
  const formatFilter = (filter) => {
    if (typeof filter === 'string') {
      return filter;
    } else if (Array.isArray(filter) && filter.length > 0) {
      const mother = filter[0];
      const daughters = filter.slice(1).map(d => 
        Array.isArray(d) ? `(${formatFilter(d)})` : d
      ).join(' ');
      return `${mother} -> ${daughters}`;
    }
    return String(filter);
  };

  return (
    <div className="container">
      <div className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>DecFile Viewer</h1>
          <a 
            href="https://lbeventtype.web.cern.ch/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              background: '#2196F3',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.target.style.background = '#1976D2'}
            onMouseOut={e => e.target.style.background = '#2196F3'}
          >
            LHCb EventType Picker
          </a>
        </div>
        
        {metadata && (
          <div className="metadata-info">
            <span style={{ marginRight: '20px' }}>
              📊 Processed: <strong>{new Date(metadata.processedAt).toLocaleString()}</strong>
            </span>
            {metadata.gitCommitShortHash && (
              <span>
                📦 DecFiles commit: <a 
                  href={`https://gitlab.cern.ch/lhcb-datapkg/Gen/DecFiles/-/commit/${metadata.gitCommitHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2196F3', textDecoration: 'none', fontFamily: 'monospace' }}
                  onMouseOver={e => e.target.style.textDecoration = 'underline'}
                  onMouseOut={e => e.target.style.textDecoration = 'none'}
                >
                  {metadata.gitCommitShortHash}
                </a>
              </span>
            )}
          </div>
        )}
        
        <div className="search-section">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search EventType, Descriptor or Filename..." 
              value={searchTerm}
              onChange={e => {
                  setSearchTerm(e.target.value);
                  setDisplayLimit(100);
              }}
            />
          </div>

          <div className="filter-row">
            <div className="physics-wg-filter">
              <label htmlFor="physicsWG" style={{ marginRight: '8px', fontWeight: '500' }}>
                PhysicsWG:
              </label>
              <select 
                id="physicsWG"
                value={selectedPhysicsWG}
                onChange={e => {
                  setSelectedPhysicsWG(e.target.value);
                  setDisplayLimit(100);
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px',
                  minWidth: '200px',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Working Groups</option>
                {uniquePhysicsWGs.map(wg => (
                  <option key={wg} value={wg}>{wg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="particle-filter-container" ref={wrapperRef}>
            <div className="selected-particles">
              {selectedFilters.map((filter, idx) => (
                <span key={idx} className="particle-tag" style={{ 
                  fontFamily: Array.isArray(filter) ? 'monospace' : 'inherit',
                  fontSize: Array.isArray(filter) ? '0.85em' : 'inherit'
                }}>
                  {formatFilter(filter)}
                  <button onClick={() => removeFilter(filter)}>&times;</button>
                </span>
              ))}
              
              {/* Show decay mode indicator */}
              {decayMode && (
                <span className="particle-tag" style={{
                  background: '#FF9800',
                  color: 'white',
                  fontFamily: 'monospace',
                  fontSize: '0.9em'
                }}>
                  {decayMother} → {decayDaughters.length > 0 ? decayDaughters.join(' ') + ' ' : ''}
                  <button onClick={exitDecayMode} style={{ marginLeft: '4px' }}>×</button>
                </span>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                {decayMode && (
                  <div style={{
                    fontSize: '0.75em',
                    color: '#FF9800',
                    fontWeight: '500',
                    padding: '2px 4px'
                  }}>
                    Decay Mode: Adding daughters to <strong>{decayMother}</strong> (Press Enter to finish, Esc to cancel)
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ 
                    flex: 1, 
                    border: decayMode ? '2px solid #FF9800' : '1px solid #ccc',
                    borderRadius: '4px',
                    padding: decayMode ? '3px' : '4px',
                    background: decayMode ? '#FFF3E0' : 'white',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="text"
                      placeholder={decayMode 
                        ? `Add daughters (e.g. K+ K-)... Press Enter to finish` 
                        : "Filter by particles (e.g. J/psi) or type '->' after a particle for decay mode..."}
                      value={particleSearch}
                      onChange={e => handleParticleSearchChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFromInput();
                        } else if (e.key === 'Escape' && decayMode) {
                          e.preventDefault();
                          exitDecayMode();
                        }
                      }}
                      className="particle-input"
                      style={{ 
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddFromInput}
                    style={{
                      padding: '8px 16px',
                      background: decayMode ? '#FF9800' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s'
                    }}
                  >
                    {decayMode ? 'Finish' : 'Add'}
                  </button>
                  {decayMode && (
                    <button
                      onClick={exitDecayMode}
                      style={{
                        padding: '8px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      title="Cancel decay mode"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
            {showSuggestions && particleSearch && (
              <ul className="suggestions-list">
                {particleSuggestions.map(p => (
                  <li key={p} onClick={() => handleAddParticleInDecayMode(p)}>
                    {p}
                  </li>
                ))}
                {particleSuggestions.length === 0 && (
                  <li className="no-suggestions">
                    {decayMode 
                      ? 'No particle matches. Type particle names separated by spaces, then press Enter to finish.'
                      : "No particle matches. Press Enter or click Add to add as decay/particle. Type '->' after a particle to enter decay mode."}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="results-count">
          Showing {displayedData.length} of {filteredData.length} results
          {selectedPhysicsWG && (
            <span style={{ marginLeft: '10px', color: '#2196F3' }}>
              (PhysicsWG: {selectedPhysicsWG})
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th 
                style={{width: '120px', cursor: 'pointer', userSelect: 'none'}}
                onClick={() => handleSort('eventType')}
                title="Click to sort"
              >
                EventType {sortField === 'eventType' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                style={{width: '100px', cursor: 'pointer', userSelect: 'none'}}
                onClick={() => handleSort('date')}
                title="Click to sort"
              >
                Date {sortField === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
              <th style={{width: '240px'}}>Filename</th>
              <th style={{width: '120px'}}>PhysicsWG</th>
              <th>Descriptor</th>
            </tr>
          </thead>
          <tbody>
            {displayedData.map((item, index) => (
              <tr 
                key={item.filename + index} 
                onClick={() => openModal(item)}
                className="clickable-row"
              >
                <td>{item.eventType}</td>
                <td>{item.date ? `${item.date.substring(0,4)}-${item.date.substring(4,6)}-${item.date.substring(6,8)}` : '-'}</td>
                <td>{item.filename}</td>
                <td>{item.physicsWG || '-'}</td>
                <td style={{fontFamily: 'monospace', fontSize: '0.9em'}}>
                  {(() => {
                    const descriptors = item.descriptors || (Array.isArray(item.descriptor) ? item.descriptor : [item.descriptor]);
                    const firstDesc = descriptors[0] || '';
                    return firstDesc && firstDesc.length > 20 ? firstDesc.substring(0, 20) + '...' : firstDesc;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, marginBottom: '8px' }}>{selectedItem.filename}</h2>
                <a 
                  href={getGitLabLink(selectedItem.filename)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    fontSize: '0.9rem', 
                    color: '#2196F3',
                    textDecoration: 'none'
                  }}
                  onMouseOver={e => e.target.style.textDecoration = 'underline'}
                  onMouseOut={e => e.target.style.textDecoration = 'none'}
                >
                  View on GitLab →
                </a>
              </div>
              <button className="close-button" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="info-row">
                <strong>EventType:</strong> {selectedItem.eventType}
              </div>
              <div className="info-row">
                <strong>Descriptor:</strong> 
                <div className="descriptor-box">
                  {(selectedItem.descriptors || (Array.isArray(selectedItem.descriptor) ? selectedItem.descriptor : [selectedItem.descriptor])).map((desc, idx, arr) => (
                    <React.Fragment key={idx}>
                      {desc}
                      {idx < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {selectedItem.physicsWG && (
                <div className="info-row">
                  <strong>PhysicsWG:</strong> {selectedItem.physicsWG}
                </div>
              )}
              {selectedItem.responsible && (
                <div className="info-row">
                  <strong>Responsible:</strong> {selectedItem.responsible}
                </div>
              )}
              {selectedItem.email && (
                <div className="info-row">
                  <strong>Email:</strong> <a href={`mailto:${selectedItem.email}`} style={{color: '#2196F3'}}>{selectedItem.email}</a>
                </div>
              )}
              
              {selectedItem.dotFiles && selectedItem.dotFiles.length > 0 && (
                <div className="decay-section">
                  <h3>Decay Chain Visualization ({selectedItem.dotFiles.length} {selectedItem.dotFiles.length === 1 ? 'chain' : 'chains'})</h3>
                  <div className="decay-container">
                    {selectedItem.dotFiles.map((dotFile, idx) => (
                      <div key={idx} className="decay-wrapper">
                         <DotViewer dotFile={dotFile} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="file-content-section">
                <h3>File Content</h3>
                {loadingFile ? (
                  <div className="loading">Loading file...</div>
                ) : (
                  <pre className="file-content">{fileContent}</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
