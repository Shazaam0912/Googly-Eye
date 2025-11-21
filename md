👁️ Interactive Physics Eyes - Installation Guide

A high-performance, physics-based interactive eye component for React. Features smooth cursor tracking, "bored" idle states, and organic blinking/squinting animations using standard SVG and requestAnimationFrame.

---

🚀 QUICK START

1. PREREQUISITES
Ensure your project is set up with:
- React (v16.8+ for Hooks support)
- Tailwind CSS (This component uses Tailwind classes for styling)

2. INSTALLATION
This is a drop-in component. You don't need to install a heavy npm package.
- Create a new file named "GooglyEyes.tsx" in your components folder.
- Copy the source code (excluding the "App" and "Background" components if you just want the eyes).
- Paste the code into your file.

3. USAGE
Import the component and place it wherever you want a pair of watching eyes.

// Example Usage:
import { GooglyEyes } from './components/GooglyEyes';

export default function MyHeader() {
  return (
    <header className="relative h-64 bg-slate-900">
      {/* Default size is 120px */}
      <GooglyEyes />
    </header>
  );
}

---

🎮 FEATURES & BEHAVIORS

- Physics Dampening: The pupils don't just snap to the cursor; they accelerate and decelerate smoothly.
- Idle State: If the user stops moving the mouse for 1.5 seconds, the eyes get "bored" and drift slightly downward.
- Reactive Pupils: Fast movement causes the pupils to constrict (focus), while staying still causes them to dilate (relax).
- Interaction: Click or tap the eyes to make them squint.

---

⚙️ PROPS API

- size (number): Default 120. Width of the eye container in pixels. Height is calculated automatically.
- className (string): Additional CSS classes to apply to the wrapper div.

---

🎨 CUSTOMIZATION TIPS

The component uses SVG for rendering. If you want to change colors (e.g., for a light mode theme), look for the SVG elements inside the component:
- Sclera (Eye White): Modify stroke="#F1F5F9" in the <ellipse> tags.
- Pupil: Modify fill="#F1F5F9" in the <circle> tags.
