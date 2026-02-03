import React, { useEffect, useRef, useState } from 'react';
import { instance } from '@viz-js/viz';

// Simple test component to verify viz.js works
function TestDot() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    async function test() {
      try {
        // Very simple DOT graph
        const simpleDot = `
          digraph G {
            A -> B;
            B -> C;
            C -> A;
          }
        `;

        setStatus('Getting viz instance...');
        const viz = await instance();
        
        setStatus('Rendering...');
        const svg = viz.renderSVGElement(simpleDot);
        
        setStatus('Appending to DOM...');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(svg);
          setStatus('Success!');
        }
      } catch (err) {
        setStatus(`Error: ${err.message}`);
        console.error(err);
      }
    }
    
    test();
  }, []);

  return (
    <div style={{ padding: '20px', border: '2px solid blue' }}>
      <h3>Viz.js Test</h3>
      <p>Status: {status}</p>
      <div ref={containerRef} style={{ border: '1px solid red', minHeight: '200px' }} />
    </div>
  );
}

export default TestDot;

