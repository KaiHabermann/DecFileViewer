# DecFile Viewer

**A Searchable Interface for LHCb DecFiles**

---

## The Problem

GitLab search only searches filenames, not file contents. DecFiles contain complex physics information that isn't always reflected in filenames:
- Decay chains (B⁰ → K⁺ K⁻)
- Event types and descriptors
- Physics Working Groups

Finding specific decay files like *B⁰ → J/ψ Kₛ⁰ π⁺ π⁻* is not straightforward in GitLab.

**Solution:** A searchable interface that indexes file contents, not just filenames.

---

## 🚀 Try It Online

- **CERN GitLab Pages:** [https://lhcb-decfiles.docs.cern.ch/](https://lhcb-decfiles.docs.cern.ch/)
- **GitHub Pages:** [https://kaihabermann.github.io/DecFileViewer/](https://kaihabermann.github.io/DecFileViewer/)

---

## ✨ Key Features

### Search Capabilities
- **EventType, Descriptor, Filename** - Full-text search across all metadata
- **Particle names** - Filter by particles (J/ψ, B⁰, etc.) with autocomplete
- **Decay chains** - Search for specific decays (B⁰ → K⁺ K⁻)
- **Physics Working Group** - Filter by working group

### Visual Decay Graphs
- Interactive decay chain visualizations
- Easy to understand complex decay topologies
- Multiple decay chains displayed per file

---

## 🛠️ Quick Start

### Prerequisites
- Python 3.x
- Node.js 20+
- DecFiles repository

### Setup
```bash
# Clone the repository
git clone https://gitlab.cern.ch/lhcb-datapkg/Gen/DecFileViewer.git
cd DecFileViewer

# Install Python dependencies
pip install -r requirements.txt

# Generate data files (requires DecFiles repository)
python handle_release.py <release-tag> --repo-path DecFiles

# Install and run frontend
cd frontend
npm install
npm run dev
```

---

## 📦 Technology Stack

- **Frontend:** React, Vite
- **Visualization:** @viz-js/viz (Graphviz renderer)
- **Parsing:** Python + decaylanguage
- **Deployment:** GitLab Pages

---

## 📝 License

[Add your license here]
