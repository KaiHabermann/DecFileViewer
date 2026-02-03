import React, { useState, useEffect, useRef } from 'react';
import DotViewer from './DotViewer';

function App() {
  const [data, setData] = useState([]);
  const [uniqueParticles, setUniqueParticles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState(''); // Global text search
  const [particleSearch, setParticleSearch] = useState(''); // Input for adding particles
  const [selectedParticles, setSelectedParticles] = useState([]); // List of particles to filter by
  
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    fetch('./data.json')
      .then(res => res.json())
      .then(responseData => {
        // Handle new data structure
        if (responseData.files) {
          setData(responseData.files);
          setUniqueParticles(responseData.uniqueParticles || []);
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

  // Filter logic
  const filteredData = data.filter(item => {
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
      
    return matchesText && matchesParticles;
  });

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

  const particleSuggestions = uniqueParticles.filter(p => 
    p.toLowerCase().includes(particleSearch.toLowerCase()) && 
    !selectedParticles.includes(p)
  ).slice(0, 10); // Limit to top 10 matches

  return (
    <div className="container">
      <div className="header">
        <h1>DecFile Viewer</h1>
        
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
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{width: '150px'}}>EventType</th>
              <th style={{width: '300px'}}>Filename</th>
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
                <td>{item.filename}</td>
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
              <h2>{selectedItem.filename}</h2>
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
