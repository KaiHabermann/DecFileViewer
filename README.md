# LHCb DecFile Viewer

A web application for viewing and visualizing LHCb decay files (.dec) with interactive decay chain diagrams.

## Features

- 📋 Browse and search through thousands of decay files
- 🔍 Filter by particle types with autocomplete
- 🎨 Automatic rendering of decay chain visualizations using Graphviz
- 📥 Download DOT source files for further analysis
- 🚀 Fast client-side rendering with React + Vite
- 📱 Responsive design

## Live Demo

Visit: [https://kaihabermann.github.io/LHCbDecFileViewer/](https://kaihabermann.github.io/LHCbDecFileViewer/)

## Local Development

### Prerequisites

- Python 3.x
- Node.js 20+
- DecFiles repository (containing the .dec files)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kaihabermann/DecFileViewer.git
   cd DecFileViewer
   ```

2. **Install Python dependencies:**
   ```bash
   pip install decaylanguage
   ```

3. **Place DecFiles:**
   - Ensure `DecFiles/dkfiles/` directory exists with your .dec files
   - Or create a symlink: `ln -s /path/to/DecFiles DecFiles`

4. **Generate data files:**
   ```bash
   python parse_dkfiles.py
   ```
   This will:
   - Parse all .dec files in `DecFiles/dkfiles/`
   - Generate DOT files for decay chains
   - Create `frontend/public/data.json` with metadata

5. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

6. **Run development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173/LHCbDecFileViewer/](http://localhost:5173/LHCbDecFileViewer/)

## Deployment

### Automatic Deployment (GitHub Actions)

The repository is configured for automatic deployment to GitHub Pages:

1. **Enable GitHub Pages:**
   - Go to your repository settings
   - Navigate to **Pages** (under "Code and automation")
   - Under "Build and deployment":
     - Source: **GitHub Actions**

2. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

3. **Monitor deployment:**
   - Go to the **Actions** tab in your repository
   - Watch the "Deploy to GitHub Pages" workflow
   - Once complete, your site will be live!

### Manual Deployment

```bash
cd frontend
npm run build
npm run deploy
```

## Project Structure

```
DecFileViewer/
├── parse_dkfiles.py          # Python script to parse .dec files
├── DecFiles/                  # Source decay files (gitignored)
│   └── dkfiles/              # .dec files
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── DotViewer.jsx     # Decay chain visualization component
│   │   └── index.css         # Styles
│   ├── public/
│   │   ├── data.json         # Generated metadata (gitignored)
│   │   ├── dotfiles/         # Generated DOT files (gitignored)
│   │   └── dkfiles/          # Copied .dec files (gitignored)
│   └── package.json
└── .github/
    └── workflows/
        └── deploy.yml         # GitHub Actions workflow
```

## Technology Stack

- **Frontend:** React, Vite
- **Visualization:** @viz-js/viz (Graphviz renderer)
- **Parsing:** Python + decaylanguage
- **Deployment:** GitHub Pages + GitHub Actions

## How It Works

1. **Data Generation Phase:**
   - `parse_dkfiles.py` reads all .dec files
   - Extracts metadata (EventType, Descriptor, particles)
   - Generates DOT files for decay chains
   - Creates a JSON index

2. **Runtime Phase:**
   - User browses/filters decay files in the table
   - Clicks a file to open details modal
   - Decay chains render on-demand using viz.js
   - Interactive visualization in the browser

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[Add your license here]

## Acknowledgments

- LHCb Collaboration
- [decaylanguage](https://github.com/scikit-hep/decaylanguage) - Python package for particle decay chains
- [Graphviz](https://graphviz.org/) - Graph visualization software

