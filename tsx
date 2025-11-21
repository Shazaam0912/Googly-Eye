import React, { useRef, useEffect, useState } from 'react';

// --- Interfaces ---

interface GooglyEyesProps {
  /**
   * The width of the component in pixels.
   * @default 120
   */
  size?: number;
  /**
   * Optional class name for the root container.
   */
  className?: string;
}

const GooglyEyes: React.FC<GooglyEyesProps> = ({ size = 120, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // SVG Elements
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const leftScleraRef = useRef<SVGEllipseElement>(null);
  const rightScleraRef = useRef<SVGEllipseElement>(null);

  // --- State ---
  const mouseRef = useRef({ x: 0, y: 0, isInside: false, lastMoveTime: Date.now() });
  const [isBlinking, setIsBlinking] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Physics State
  // We track position AND velocity for each eye for smoother dampening
  const physicsRef = useRef({
    left: { x: 0, y: 0, pupilRadius: 18 },
    right: { x: 0, y: 0, pupilRadius: 18 },
  });

  // --- Design Constants ---
  // ViewBox: Optimized for tighter packing of the eyes
  const VIEWBOX_W = 200;
  const VIEWBOX_H = 120;
  
  // Geometry: Solid Pillars (Vertical Capsules)
  const EYE_RX = 42; 
  const EYE_RY_OPEN = 58;
  const EYE_RY_BLINK = 2;
  const EYE_RY_SQUINT = 24;
  
  // Pupil Size Dynamics
  const PUPIL_MIN = 15; // Contracted (Focus/Fast movement)
  const PUPIL_MAX = 24; // Dilated (Relaxed/Still)

  // Positions (Centered)
  const LEFT_EYE_CENTER = { x: 55, y: 60 };
  const RIGHT_EYE_CENTER = { x: 145, y: 60 };
  
  // Maximum distance pupil can travel from center
  const MAX_MOVEMENT = 20;

  // --- 1. Global Mouse Tracking ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { 
        x: e.clientX, 
        y: e.clientY, 
        isInside: true,
        lastMoveTime: Date.now()
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { ...mouseRef.current, isInside: false };
    };

    // Attach to window to track mouse even outside the component
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // --- 2. Blinking Engine ---
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const triggerBlink = () => {
      if (isPressed) return; // Don't blink if user is clicking
      
      setIsBlinking(true);
      
      // Open eyes after 180ms
      setTimeout(() => {
        setIsBlinking(false);
        // Schedule next blink randomly between 2s and 6s
        timeout = setTimeout(triggerBlink, Math.random() * 4000 + 2000);
      }, 180);
    };
    
    // Initial start delay
    timeout = setTimeout(triggerBlink, 3000);
    
    return () => clearTimeout(timeout);
  }, [isPressed]);

  // --- 3. Animation & Physics Loop ---
  useEffect(() => {
    let rAF: number;

    const animate = () => {
      // Safety check: ensure refs are mounted
      if (!containerRef.current || !leftPupilRef.current || !rightPupilRef.current) {
        rAF = requestAnimationFrame(animate);
        return;
      }

      // 1. Measure Scale (converts screen pixels to SVG units)
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0) return; // Element hidden
      const scaleX = rect.width / VIEWBOX_W;
      const scaleY = rect.height / VIEWBOX_H;

      // 2. Determine Target Position
      const { x: mouseX, y: mouseY, isInside, lastMoveTime } = mouseRef.current;
      const now = Date.now();
      
      // "Bored" logic: If idle for 1.5s, eyes drift slightly down
      const isIdle = isInside && (now - lastMoveTime > 1500);
      
      const getTarget = (eyeCenterX: number, eyeCenterY: number) => {
        let tx = 0, ty = 0;
        if (isInside) {
          const screenEyeX = rect.left + eyeCenterX * scaleX;
          const screenEyeY = rect.top + eyeCenterY * scaleY;
          
          // Raw vector from eye center to mouse
          const rawDx = (mouseX - screenEyeX) / scaleX;
          const rawDy = (mouseY - screenEyeY) / scaleY;
          
          // Clamp movement to stay within the eye
          const dist = Math.sqrt(rawDx*rawDx + rawDy*rawDy);
          const limit = dist > MAX_MOVEMENT ? MAX_MOVEMENT / dist : 1;
          
          tx = rawDx * limit;
          ty = rawDy * limit;

          if (isIdle) {
            ty += 6; // Drift down
            tx *= 0.5; // Center slightly
          }
        }
        return { x: tx, y: ty };
      };

      const targetL = getTarget(LEFT_EYE_CENTER.x, LEFT_EYE_CENTER.y);
      const targetR = getTarget(RIGHT_EYE_CENTER.x, RIGHT_EYE_CENTER.y);

      // 3. Interpolate Position (LERP) for smoothness
      const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
      
      const left = physicsRef.current.left;
      const right = physicsRef.current.right;

      // Apply different friction to each eye for organic feel (Left is slightly faster)
      left.x = lerp(left.x, targetL.x, 0.16);
      left.y = lerp(left.y, targetL.y, 0.16);
      right.x = lerp(right.x, targetR.x, 0.12);
      right.y = lerp(right.y, targetR.y, 0.12);

      // 4. Dynamic Pupil Dilation
      // Calculate velocity based on distance moved this frame
      const velL = Math.sqrt((targetL.x - left.x)**2 + (targetL.y - left.y)**2);
      
      // Fast movement = Constrict pupil (Focus)
      // Still = Dilate pupil (Relax)
      const targetRadius = Math.max(PUPIL_MIN, Math.min(PUPIL_MAX, PUPIL_MAX - velL * 2));
      
      left.pupilRadius = lerp(left.pupilRadius, targetRadius, 0.1);
      right.pupilRadius = lerp(right.pupilRadius, targetRadius, 0.1);

      // 5. Apply Transforms to DOM
      const visibility = isBlinking ? 'hidden' : 'visible';
      
      leftPupilRef.current.setAttribute('transform', `translate(${left.x}, ${left.y})`);
      leftPupilRef.current.setAttribute('r', left.pupilRadius.toFixed(2));
      leftPupilRef.current.style.visibility = visibility;

      rightPupilRef.current.setAttribute('transform', `translate(${right.x}, ${right.y})`);
      rightPupilRef.current.setAttribute('r', right.pupilRadius.toFixed(2));
      rightPupilRef.current.style.visibility = visibility;

      rAF = requestAnimationFrame(animate);
    };
    
    rAF = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rAF);
  }, [isBlinking, isPressed]);

  // Determine vertical radius based on state (Open vs Blink vs Squint)
  const currentRy = isBlinking ? EYE_RY_BLINK : (isPressed ? EYE_RY_SQUINT : EYE_RY_OPEN);

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        width: size,
        height: size * (VIEWBOX_H / VIEWBOX_W),
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        // Interaction Feedback: Slight shrink on click
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        // Neumorphic Depth: Soft drop shadow
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))',
      }}
      role="img"
      aria-label="Interactive Eyes"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Inline styles for high-performance CSS transitions on the Sclera shape */}
        <style>{`
          .sclera { 
            transition: ry 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94); 
          }
        `}</style>

        {/* --- Left Eye --- */}
        <ellipse
          ref={leftScleraRef}
          className="sclera"
          cx={LEFT_EYE_CENTER.x}
          cy={LEFT_EYE_CENTER.y}
          rx={EYE_RX}
          ry={currentRy}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="4"
        />
        <circle
          ref={leftPupilRef}
          cx={LEFT_EYE_CENTER.x}
          cy={LEFT_EYE_CENTER.y}
          r={18}
          fill="#F1F5F9"
        />

        {/* --- Right Eye --- */}
        <ellipse
          ref={rightScleraRef}
          className="sclera"
          cx={RIGHT_EYE_CENTER.x}
          cy={RIGHT_EYE_CENTER.y}
          rx={EYE_RX}
          ry={currentRy}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="4"
        />
        <circle
          ref={rightPupilRef}
          cx={RIGHT_EYE_CENTER.x}
          cy={RIGHT_EYE_CENTER.y}
          r={18}
          fill="#F1F5F9"
        />
      </svg>
    </div>
  );
};

// --- Main App Component with Expert UI Background ---

const Background = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
    {/* Dark Base */}
    <div className="absolute inset-0 bg-neutral-950" />
    
    {/* Grid Pattern */}
    <div 
      className="absolute inset-0 opacity-[0.15]"
      style={{
        backgroundImage: `
          linear-gradient(to right, #4f4f4f 1px, transparent 1px),
          linear-gradient(to bottom, #4f4f4f 1px, transparent 1px)
        `,
        backgroundSize: '4rem 4rem',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000 70%, transparent 100%)'
      }}
    />

    {/* Ambient Animated Glows */}
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-[pulse_8s_ease-in-out_infinite_2s]" />
    
    {/* Central Spotlight */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[100px] rounded-full" />
  </div>
);

export default function App() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8 text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      <Background />

      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">
        
        {/* Text Content */}
        <div className="mb-16 text-center space-y-6">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs font-medium tracking-wider uppercase mb-4 backdrop-blur-sm">
            Interactive Experiment 01
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
            Observation
          </h1>
          <p className="text-lg text-slate-400 max-w-md mx-auto leading-relaxed">
            A physics-based interaction study using SVG geometry and dampening forces.
          </p>
        </div>

        {/* Glass Card Container */}
        <div className="group relative">
            {/* Animated Gradient Border Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] opacity-20 blur-2xl group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
            
            {/* Main Card */}
            <div className="relative p-20 bg-neutral-900/50 border border-white/5 rounded-[2rem] backdrop-blur-xl shadow-2xl flex items-center justify-center overflow-hidden">
                
                {/* Card Inner Texture/Noise */}
                <div 
                  className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                  }}
                />
                
                {/* Inner decorative grid lines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

                <GooglyEyes size={260} />
            </div>
        </div>
        
        {/* Footer/Controls */}
        <div className="mt-16 flex items-center gap-8 text-sm font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Active</span>
          </div>
          <div className="w-px h-4 bg-slate-800" />
          <p className="hover:text-slate-300 transition-colors cursor-default">
            Drag . Click . Wait
          </p>
        </div>

      </div>
    </div>
  );
}
