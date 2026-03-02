# STEP Viewer

A fast, client-side web application for loading and visualizing 3D `.step` and `.stp` CAD models directly in your browser. Built with **Next.js**, **React Three Fiber (Three.js)**, and **OpenCascade WASM** (`occt-import-js`).

## Features

- ⚡ **Client-Side Parsing**: Parses complex STEP geometries directly in the browser via WebAssembly without relying on slow server conversions.
- 🎨 **Visual Tweaks**: Change part colors, individual visibilities, global opacity, and wireframe modes on the fly.
- 💥 **Exploded Views**: Dynamically slide parts apart from the center of the model (or grouped centers) to inspect internal assemblies.
- 📏 **Measurements**: Click pairs of points on the mesh to calculate millimeter distances in true 3D space.
- 📦 **Grouping & Selection**: Box-select multiple parts or Ctrl-click to bundle components into unified groups that move/explode together.
- 💾 **Local Storage**: Uploaded files are cached locally for immediate reloading on subsequent visits.

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser.

## Known Limitations

- **Performance**: Extremely large assemblies (100MB+) or parts with millions of polygons may cause memory warnings or lag depending on your hardware's WebGL capabilities.
- **WASM Init Delay**: The very first parse takes an extra ~1-2 seconds as the browser downloads and initializes the `occt-import-js` WebAssembly engine block.

## Technologies Used

- [Next.js (App Router)](https://nextjs.org/)
- [Three.js](https://threejs.org/) & [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [occt-import-js](https://github.com/kovacsv/occt-import-js)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
