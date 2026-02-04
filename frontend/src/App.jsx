import React, { useState, useEffect, useRef } from 'react';
import DotViewer from './DotViewer';

function App() {
  const [data, setData] = useState([]);
  const [uniqueParticles, setUniqueParticles] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState(''); // Global text search
  const [particleSearch, setParticleSearch] = useState(''); // Input for adding particles
  const [selectedParticles, setSelectedParticles] = useState([]); // List of particles to filter by
  const [selectedPhysicsWG, setSelectedPhysicsWG] = useState(''); // PhysicsWG filter
  
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
    const matchesText = 
      searchTerm === '' ||
      item.eventType.includes(searchTerm) || 
      item.descriptor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.filename.toLowerCase().includes(searchTerm.toLowerCase());
      
    // 2. Particle Filter (AND logic: must contain ALL selected particles)
    const itemParticles = item.particles || [];
    // Normalize item particles to lower case just in case (though backend does it now)
    const itemParticlesLower = itemParticles.map(p => p.toLowerCase());
    
    const matchesParticles = selectedParticles.length === 0 || 
      selectedParticles.every(p => itemParticlesLower.includes(p.toLowerCase()));
    
    // 3. PhysicsWG Filter
    const matchesPhysicsWG = selectedPhysicsWG === '' || 
      item.physicsWG === selectedPhysicsWG;
      
    return matchesText && matchesParticles && matchesPhysicsWG;
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

  const addParticle = (particle) => {
    if (!selectedParticles.includes(particle)) {
      setSelectedParticles([...selectedParticles, particle]);
    }
    setParticleSearch('');
    setShowSuggestions(false);
    setDisplayLimit(100);
  };

  const removeParticle = (particle) => {
    setSelectedParticles(selectedParticles.filter(p => p !== particle));
    setDisplayLimit(100);
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
    p.toLowerCase().includes(particleSearch.toLowerCase()) && 
    !selectedParticles.includes(p)
  ).slice(0, 10); // Limit to top 10 matches

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
              {selectedParticles.map(p => (
                <span key={p} className="particle-tag">
                  {p}
                  <button onClick={() => removeParticle(p)}>&times;</button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Filter by particles (e.g. J/psi)..."
                value={particleSearch}
                onChange={e => {
                  setParticleSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="particle-input"
              />
            </div>
            {showSuggestions && particleSearch && (
              <ul className="suggestions-list">
                {particleSuggestions.map(p => (
                  <li key={p} onClick={() => addParticle(p)}>
                    {p}
                  </li>
                ))}
                {particleSuggestions.length === 0 && (
                  <li className="no-suggestions">No matches</li>
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
                <td style={{fontFamily: 'monospace', fontSize: '0.9em'}}>{item.descriptor}</td>
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
                <div className="descriptor-box">{selectedItem.descriptor}</div>
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
