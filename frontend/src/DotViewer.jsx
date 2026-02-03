import React, { useEffect, useRef, useState } from 'react';
import { instance } from '@viz-js/viz';

function DotViewer({ dotFile }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dotSource, setDotSource] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [svgInfo, setSvgInfo] = useState(null);
  const [renderedSvgHtml, setRenderedSvgHtml] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    async function renderDot() {
      if (!dotFile) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      // Set a timeout in case it hangs
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.error('[DotViewer] Rendering timeout - took longer than 30 seconds');
          setError('Rendering timeout - the graph is taking too long to render. Try a simpler file or check console for errors.');
          setLoading(false);
        }
      }, 30000); // 30 second timeout

      try {
        console.log('[DotViewer] Starting render process for:', dotFile);
        
        // Fetch the DOT file content
        // Handle both dev and production base paths
        const basePath = import.meta.env.BASE_URL || '/';
        const fullPath = `${basePath}${dotFile}`;
        console.log('[DotViewer] Fetching DOT file from:', fullPath);
        
        const response = await fetch(fullPath);
        console.log('[DotViewer] Fetch response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to load DOT file: ${response.status} ${response.statusText}`);
        }
        
        let source = await response.text();
        console.log('[DotViewer] DOT source loaded, length:', source.length, 'bytes');
        
        if (!mounted) {
          console.log('[DotViewer] Component unmounted, aborting');
          return;
        }
        
        setDotSource(source);

        // Clean the DOT source - remove format=png from graph attributes as it might confuse viz.js
        source = source.replace(/format=png/g, 'format=svg');
        console.log('[DotViewer] DOT source cleaned');
        
        console.log('[DotViewer] Getting viz.js instance...');
        let viz;
        try {
          viz = await instance();
          console.log('[DotViewer] viz.js instance obtained');
        } catch (vizErr) {
          console.error('[DotViewer] Failed to get viz.js instance:', vizErr);
          throw new Error(`Failed to initialize viz.js: ${vizErr.message}`);
        }

        if (!mounted) {
          console.log('[DotViewer] Component unmounted before rendering, aborting');
          return;
        }

        console.log('[DotViewer] Rendering DOT to SVG...');
        let svg;
        try {
          svg = viz.renderSVGElement(source, {
            engine: 'dot',
          });
          console.log('[DotViewer] SVG element created');
        } catch (renderErr) {
          console.error('[DotViewer] viz.js rendering error:', renderErr);
          console.error('[DotViewer] DOT source that failed:', source.substring(0, 500));
          throw new Error(`Rendering failed: ${renderErr.message}`);
        }

        console.log('[DotViewer] SVG rendered successfully');

        if (!mounted) {
          console.log('[DotViewer] Component unmounted, aborting');
          return;
        }

        // Get the original SVG dimensions
        const originalWidth = svg.getAttribute('width');
        const originalHeight = svg.getAttribute('height');
        const viewBox = svg.getAttribute('viewBox');
        
        console.log('[DotViewer] SVG original dimensions:', { originalWidth, originalHeight, viewBox });
        
        // Fix SVG sizing - preserve viewBox but make it responsive
        if (viewBox) {
          // If viewBox exists, use it and make SVG responsive
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxWidth = '100%';
        } else if (originalWidth && originalHeight) {
          // If no viewBox, create one from width/height
          const w = parseFloat(originalWidth);
          const h = parseFloat(originalHeight);
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxWidth = '100%';
        } else {
          // Fallback: just make it responsive
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.minHeight = '200px';
        }
        
        // Serialize SVG to string for React to render
        try {
          const svgString = new XMLSerializer().serializeToString(svg);
          console.log('[DotViewer] SVG serialized, length:', svgString.length, 'bytes');
          
          if (mounted) {
            setRenderedSvgHtml(svgString);
            
            // Get dimensions info
            const rect = svg.getBoundingClientRect();
            setSvgInfo({
              viewBox: svg.getAttribute('viewBox'),
              width: svg.style.width || svg.getAttribute('width'),
              height: svg.style.height || svg.getAttribute('height'),
              actualWidth: rect.width || 400,
              actualHeight: rect.height || 200
            });
            console.log('[DotViewer] SVG info set');
          }
        } catch (serializeErr) {
          console.error('[DotViewer] Error serializing SVG:', serializeErr);
          throw serializeErr;
        }

        if (mounted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      } catch (err) {
        console.error('[DotViewer] Error rendering DOT:', err);
        console.error('[DotViewer] Error stack:', err.stack);
        console.error('[DotViewer] DOT file:', dotFile);
        console.error('[DotViewer] DOT source length:', dotSource.length);
        if (mounted) {
          clearTimeout(timeoutId);
          setError(err.message || err.toString() || 'Unknown error');
          setLoading(false);
        }
      }
    }

    renderDot();

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [dotFile]);

  if (error) {
    return (
      <div className="error">
        <strong>Error rendering graph:</strong> {error}
        <div style={{ marginTop: '10px' }}>
          <p>The graph couldn't be rendered locally, but you can:</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <a 
              href={`https://dreampuf.github.io/GraphvizOnline/#${encodeURIComponent(dotSource)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 15px',
                background: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '0.9rem'
              }}
            >
              View in Graphviz Online
            </a>
            <a 
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(dotSource)}`}
              download={dotFile.split('/').pop()}
              style={{
                padding: '8px 15px',
                background: '#2196F3',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '0.9rem'
              }}
            >
              Download DOT File
            </a>
          </div>
        </div>
        <details style={{ marginTop: '15px', fontSize: '0.9em' }}>
          <summary style={{ cursor: 'pointer' }}>Show DOT source</summary>
          <pre style={{ 
            textAlign: 'left', 
            background: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '200px',
            marginTop: '10px'
          }}>
            {dotSource}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setShowSource(!showSource)}
          style={{
            padding: '5px 10px',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {showSource ? 'Hide' : 'Show'} DOT Source
        </button>
        {dotSource && (
          <a 
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(dotSource)}`}
            download={dotFile.split('/').pop()}
            style={{
              padding: '5px 10px',
              background: '#e8f4f8',
              border: '1px solid #b3d9e6',
              borderRadius: '4px',
              textDecoration: 'none',
              color: '#333',
              fontSize: '0.9rem'
            }}
          >
            Download DOT
          </a>
        )}
        {svgInfo && (
          <div style={{
            padding: '5px 10px',
            background: '#e8f5e9',
            border: '1px solid #a5d6a7',
            borderRadius: '4px',
            fontSize: '0.85rem',
            color: '#2e7d32'
          }}>
            ✓ SVG Rendered: {Math.round(svgInfo.actualWidth)}×{Math.round(svgInfo.actualHeight)}px
          </div>
        )}
      </div>
      
      {showSource && dotSource && (
        <pre style={{
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '4px',
          overflow: 'auto',
          marginBottom: '10px',
          fontSize: '0.85rem',
          border: '1px solid #ddd'
        }}>
          {dotSource}
        </pre>
      )}
      
      <div 
        className="dot-viewer"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          overflow: 'visible',
          minHeight: '200px',
          border: '2px solid #e0e0e0',
          borderRadius: '4px',
          background: 'white',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {loading && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
            zIndex: 10
          }}>
            <div style={{ marginBottom: '10px' }}>Rendering decay chain...</div>
            <div style={{ fontSize: '0.85rem', color: '#999' }}>
              Check browser console (F12) for progress
            </div>
          </div>
        )}
        {!loading && !renderedSvgHtml && !error && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            color: '#999',
            fontSize: '0.9rem'
          }}>
            Ready to render
          </div>
        )}
        {renderedSvgHtml && (
          <div 
            ref={containerRef}
            dangerouslySetInnerHTML={{ __html: renderedSvgHtml }}
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
          />
        )}
      </div>
    </div>
  );
}

export default DotViewer;

