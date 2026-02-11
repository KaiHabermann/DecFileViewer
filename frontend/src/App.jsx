import React, { useState, useEffect, useRef } from 'react';
import DotViewer from './DotViewer';
import { 
  normalizeParticleName, 
  sortDecay, 
  decaysMatch,
  decayContains 
} from './decayMatching';

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


function App() {
  const [releases, setReleases] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [loadingReleases, setLoadingReleases] = useState(true);
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
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const particleInputRef = useRef(null);

  const [uniquePhysicsWGs, setUniquePhysicsWGs] = useState([]);

  // Load releases list first
  useEffect(() => {
    fetch('./releases.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to load releases');
        }
        return res.json();
      })
      .then(releasesList => {
        if (Array.isArray(releasesList) && releasesList.length > 0) {
          setReleases(releasesList);
          // Use the last element (newest release) as default
          setSelectedRelease(releasesList[releasesList.length - 1]);
        } else {
          // Fallback: try to load from root data.json if releases.json is empty or invalid
          console.warn('No releases found, falling back to root data.json');
          setSelectedRelease(null);
        }
        setLoadingReleases(false);
      })
      .catch(err => {
        console.error("Failed to load releases:", err);
        // Fallback: try to load from root data.json
        setSelectedRelease(null);
        setLoadingReleases(false);
      });
  }, []);

  // Load data when release is selected
  useEffect(() => {
    if (loadingReleases) {
      return; // Wait for releases to load first
    }

    setLoading(true);
    const dataPath = selectedRelease 
      ? `./${selectedRelease}/data.json`
      : './data.json';
    
    fetch(dataPath)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to load data for release: ${selectedRelease || 'default'}`);
        }
        return res.json();
      })
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
  }, [selectedRelease, loadingReleases]);

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
      const filePath = selectedRelease
        ? `./${selectedRelease}/dkfiles/${selectedItem.filename}`
        : `./dkfiles/${selectedItem.filename}`;
      
      fetch(filePath)
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
  }, [selectedItem, selectedRelease]);

  // Filter and sort logic
  let filteredData = data.filter(item => {
    // 1. Text Search (Global)
    // Descriptors are always a list
    const descriptors = item.descriptors || [];
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
      } else if (sortField === 'descriptor') {
        // Count the number of descriptors
        const aDescriptors = a.descriptors || [];
        const bDescriptors = b.descriptors || [];
        aVal = aDescriptors.length;
        bVal = bDescriptors.length;
      }
      
      if (sortField === 'descriptor') {
        // Numeric comparison for descriptor count
        if (sortOrder === 'asc') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      } else {
        // String comparison for other fields
        if (sortOrder === 'asc') {
          return aVal.localeCompare(bVal);
        } else {
          return bVal.localeCompare(aVal);
        }
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
    setSelectedSuggestionIndex(-1);
    setDisplayLimit(100);
    // Keep focus on input after adding
    setTimeout(() => {
      if (particleInputRef.current) {
        particleInputRef.current.focus();
      }
    }, 0);
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
    setSelectedSuggestionIndex(-1); // Reset selection when typing
    
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
      let allDaughters = [];
      
      // Process existing daughters (they might be formatted decay strings or simple particles)
      for (const d of decayDaughters) {
        if (typeof d === 'string') {
          // Check if it's a formatted decay string (contains ->)
          const parsedDecay = parseDecayString(d);
          if (parsedDecay) {
            allDaughters.push(parsedDecay);
          } else {
            // It's a simple particle
            const normalized = normalizeParticleName(d);
            if (normalized) {
              allDaughters.push(normalized);
            }
          }
        } else if (Array.isArray(d)) {
          // It's already a decay structure
          allDaughters.push(d);
        }
      }
      
      if (input) {
        // Try to parse the entire input as a decay first
        const parsedDecay = parseDecayString(input);
        if (parsedDecay) {
          allDaughters.push(parsedDecay);
        } else {
          // Parse the input as daughters (split by spaces)
          const newDaughters = input.split(/\s+/)
            .map(d => {
              // Try parsing each part as a decay
              const parsed = parseDecayString(d.trim());
              return parsed || normalizeParticleName(d.trim());
            })
            .filter(d => d);
          allDaughters = [...allDaughters, ...newDaughters];
        }
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
    setSelectedSuggestionIndex(-1);
  };

  // Handle double-click on a filter to edit it
  const handleFilterDoubleClick = (filter) => {
    if (Array.isArray(filter) && filter.length > 0) {
      // It's a decay - enter decay mode with the existing decay
      setDecayMode(true);
      setDecayMother(filter[0]);
      // Extract all direct daughters (flatten sub-decays)
      const daughters = filter.slice(1).map(d => {
        if (Array.isArray(d)) {
          // For sub-decays, we'll just use the mother particle for now
          // Or we could format it as a string representation
          return formatFilter(d);
        }
        return d;
      });
      setDecayDaughters(daughters);
      setParticleSearch('');
      // Remove the filter so user can re-add it after editing
      removeFilter(filter);
      // Focus the input
      setTimeout(() => {
        if (particleInputRef.current) {
          particleInputRef.current.focus();
        }
      }, 0);
    } else if (typeof filter === 'string') {
      // It's a particle - put it in the search input
      setParticleSearch(filter);
      removeFilter(filter);
      // Focus the input
      setTimeout(() => {
        if (particleInputRef.current) {
          particleInputRef.current.focus();
        }
      }, 0);
    }
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
        setSelectedSuggestionIndex(-1);
        // Keep focus on input
        setTimeout(() => {
          if (particleInputRef.current) {
            particleInputRef.current.focus();
          }
        }, 0);
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

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e) => {
    if (!showSuggestions || particleSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddFromInput();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < particleSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < particleSuggestions.length) {
        // Select the highlighted suggestion
        handleAddParticleInDecayMode(particleSuggestions[selectedSuggestionIndex]);
      } else {
        // No suggestion selected, use current input
        handleAddFromInput();
      }
    } else if (e.key === 'Escape') {
      if (decayMode) {
        e.preventDefault();
        exitDecayMode();
      } else {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    }
  };
  
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ margin: 0 }}>DecFile Viewer</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!loadingReleases && releases.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="release-select" style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                  Release:
                </label>
                <select 
                  id="release-select"
                  value={selectedRelease || ''}
                  onChange={e => {
                    setSelectedRelease(e.target.value);
                    setSelectedItem(null); // Clear selected item when changing release
                    setDisplayLimit(100); // Reset display limit
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '16px',
                    minWidth: '150px',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                >
                  {releases.map((release, index) => {
                    const isLatest = index === releases.length - 1;
                    return (
                      <option key={release} value={release}>
                        {release}{isLatest ? ' (Latest)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
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
                <span 
                  key={idx} 
                  className="particle-tag" 
                  style={{ 
                    fontFamily: Array.isArray(filter) ? 'monospace' : 'inherit',
                    fontSize: Array.isArray(filter) ? '0.85em' : 'inherit',
                    cursor: 'pointer'
                  }}
                  onDoubleClick={() => handleFilterDoubleClick(filter)}
                  title="Double-click to edit"
                >
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
                      ref={particleInputRef}
                      type="text"
                      placeholder={decayMode 
                        ? `Add daughters (e.g. K+ K-)... Press Enter to finish` 
                        : "Filter by particles (e.g. J/psi) or type '->' after a particle for decay mode..."}
                      value={particleSearch}
                      onChange={e => handleParticleSearchChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={handleSuggestionKeyDown}
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
                {particleSuggestions.map((p, idx) => (
                  <li 
                    key={p} 
                    onClick={() => handleAddParticleInDecayMode(p)}
                    style={{
                      backgroundColor: idx === selectedSuggestionIndex ? '#e3f2fd' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                  >
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

      {(loadingReleases || loading) ? (
        <div className="loading">
          {loadingReleases ? 'Loading releases...' : 'Loading data...'}
        </div>
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
              <th 
                style={{cursor: 'pointer', userSelect: 'none'}}
                onClick={() => handleSort('descriptor')}
                title="Click to sort by number of descriptors"
              >
                Descriptor {sortField === 'descriptor' && (sortOrder === 'asc' ? '▲' : '▼')}
              </th>
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
                    const descriptors = item.descriptors || [];
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
                  {(selectedItem.descriptors || []).map((desc, idx, arr) => (
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
                    {selectedItem.dotFiles.map((dotFile, idx) => {
                      // Prepend release path to dotfile if we have a selected release
                      const dotFilePath = selectedRelease
                        ? `./${selectedRelease}/${dotFile}`
                        : `./${dotFile}`;
                      return (
                        <div key={idx} className="decay-wrapper">
                          <DotViewer dotFile={dotFilePath} />
                        </div>
                      );
                    })}
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
