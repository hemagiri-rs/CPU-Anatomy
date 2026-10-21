# Inside Panther Lake

An interactive visualization of Intel's Panther Lake processor architecture, exploring the system from the laptop motherboard and cooling assembly down to the Foveros tiles, compute tile, and an individual Cougar Cove Performance Core (P-core).

The project combines detailed architectural visualization with a cycle-based out-of-order execution simulator. The simulator executes a loop and visualizes micro-operations (micro-ops) as colored tokens moving through execution ports, demonstrating instruction execution and the effects of branch misprediction.

## Demo



https://github.com/user-attachments/assets/a8eb51da-9c22-442e-b3cc-b2639d07fa9b



The visualization progressively reveals the processor's internal structure through a scroll-driven experience. Users can explore the processor package, examine the compute tile, and zoom into an individual P-core to observe the execution simulation.

The simulation demonstrates micro-operations moving across 18 execution ports and illustrates how a branch misprediction triggers a pipeline flush.

## Features

- **Interactive CPU Anatomy:** Explore the processor from the motherboard and cooling assembly to its internal tiles and Performance Core.
- **Foveros Tile Visualization:** Examine the organization of tiles within the processor package.
- **Core Architecture Visualization:** Explore the internal floorplan of a Cougar Cove P-core.
- **Out-of-Order Execution Simulation:** Observe instruction execution through a simplified processor model.
- **Micro-operation Visualization:** Track micro-operations as they move through execution ports.
- **Branch Misprediction Handling:** Visualize pipeline flushing and the effects of incorrect branch predictions.
- **Dual Theme Support:** Choose between dark and light themes.
- **Standalone Execution:** Run the prebuilt HTML files directly in a modern web browser without installing dependencies.

## Getting Started

### Prerequisites

To explore the visualization, you only need a modern web browser.

Node.js 18 or newer is required to rebuild the project or run the processor model tests.

### Running the Project

Clone the repository:

```bash
git clone https://github.com/hemagiri-rs/CPU-Anatomy.git
```

Open either of the following files in your browser:

- `index.html` — Dark theme
- `cpu-light.html` — Light theme

The prebuilt HTML files can be opened directly without installing additional dependencies or starting a development server.

### Running with a Local Server

Alternatively, start a local HTTP server:

```bash
python3 -m http.server 8000
```

Open the following URL in your browser:

```text
http://localhost:8000/index.html
```

## Building from Source

### Requirements

- Node.js 18 or newer
- The anatomy skill installed at `~/.claude/skills/anatomy`

The anatomy skill is required only for rebuilding the visualization. The existing standalone HTML files can be opened without it.

### Build Commands

Build the dark-theme version:

```bash
node build.mjs
```

Build the light-theme version:

```bash
node build.mjs --light
```

Run the processor model's self-check:

```bash
node model.test.mjs
```

Expected output:

```text
model ok · 31 cycles · 45 retired · IPC 1.45
```

## Processor Simulation

The project includes a simplified, cycle-based model of a Performance Core designed to demonstrate concepts associated with modern processor execution.

The model includes:

- 8-wide execution design
- 576-entry reorder buffer (ROB)
- Integer and vector execution ports
- Load and store execution ports
- Out-of-order instruction execution
- Micro-operation tracking
- Branch misprediction and pipeline flushing
- Instruction retirement and instructions-per-cycle (IPC) measurement

The simulator provides an educational representation of instruction scheduling and execution. It is not a complete implementation of Intel's commercial processor architecture.

## Project Structure

| File or Directory | Description |
|---|---|
| `index.html` | Standalone interactive visualization with a dark theme |
| `cpu-light.html` | Standalone interactive visualization with a light theme |
| `model.mjs` | Cycle-based P-core simulation model |
| `model.test.mjs` | Self-check for the processor simulation |
| `floor.mjs` | Renders the internal core floorplan |
| `build.mjs` | Generates the standalone HTML visualization |
| `live.js` | Runtime logic for the interactive experience |
| `page.css` | Styles for the visualization |
| `brag-output/` | Demo video and poster image |

## Technical References

The core dimensions used in the visualization are based on publicly available Lion Cove figures from [Chips and Cheese](https://chipsandcheese.com/).

The loop program used in the execution simulator was developed specifically for this project.

## Learning Objectives

This project aims to make processor architecture and instruction execution easier to understand through interactive visualization.

Key concepts demonstrated include:

- Processor package and tile organization
- Foveros packaging
- Performance Core architecture
- Instruction execution and micro-operations
- Out-of-order execution
- Execution ports and scheduling
- Reorder buffers
- Branch misprediction and pipeline flushing
- Instruction retirement and IPC

## Disclaimer

This project is an independent educational visualization based on publicly available information about Intel's Panther Lake processor architecture. The execution simulator is simplified and does not reproduce every detail of the actual processor.

Intel and Panther Lake are trademarks of Intel Corporation. This project is not affiliated with, endorsed by, or sponsored by Intel Corporation.
