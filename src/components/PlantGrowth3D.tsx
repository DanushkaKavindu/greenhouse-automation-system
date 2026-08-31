import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Heart, Info, Eye } from 'lucide-react';

interface PlantGrowth3DProps {
  growthStage: 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruiting';
  healthScore: number; // 0 to 100
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Branch {
  start: Point3D;
  end: Point3D;
  thickness: number;
  type: 'trunk' | 'branch' | 'stem';
}

interface Leaf {
  position: Point3D;
  angleY: number;
  angleX: number;
  scale: number;
  color: string;
}

interface Fruit {
  position: Point3D;
  type: 'flower' | 'green_chilli' | 'red_chilli';
  scale: number;
}

export default function PlantGrowth3D({ growthStage, healthScore }: PlantGrowth3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationYRef = useRef(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartRotationY = useRef(0);

  // Growth stage multiplier controls how tall/complex the branches are
  const stageMultipliers = {
    Seedling: 0.25,
    Vegetative: 0.6,
    Flowering: 0.9,
    Fruiting: 1.0,
  };

  // Get leaf color based on health score
  const getLeafColor = (health: number) => {
    if (health >= 80) {
      // Lush healthy dark green
      return 'rgb(34, 197, 94)'; 
    } else if (health >= 50) {
      // Stressed/nutrient-deficient yellow-green
      const factor = (health - 50) / 30; // 0 to 1
      const r = Math.round(180 - factor * (180 - 34));
      const g = Math.round(197 - factor * (197 - 197));
      const b = Math.round(94 - factor * (94 - 94));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Diseased/dying brown-yellow
      const factor = health / 50; // 0 to 1
      const r = Math.round(139 + factor * (180 - 139));
      const g = Math.round(90 + factor * (197 - 90));
      const b = Math.round(43 + factor * (94 - 43));
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Procedural generation of plant skeleton points based on current stage and health
    const generatePlantData = () => {
      const scale = stageMultipliers[growthStage];
      const branches: Branch[] = [];
      const leaves: Leaf[] = [];
      const fruits: Fruit[] = [];

      // Ground/Base is at (0, 0, 0)
      // Trunk going straight up
      const trunkHeight = 110 * scale;
      const trunkEnd: Point3D = { x: 0, y: trunkHeight, z: 0 };
      branches.push({
        start: { x: 0, y: 0, z: 0 },
        end: trunkEnd,
        thickness: 7 * scale,
        type: 'trunk',
      });

      // Generate branches based on stage
      if (growthStage !== 'Seedling') {
        // Main Branch left
        const b1End: Point3D = { x: -45 * scale, y: trunkHeight + 50 * scale, z: 15 * scale };
        branches.push({
          start: trunkEnd,
          end: b1End,
          thickness: 4 * scale,
          type: 'branch',
        });

        // Main Branch right
        const b2End: Point3D = { x: 45 * scale, y: trunkHeight + 55 * scale, z: -15 * scale };
        branches.push({
          start: trunkEnd,
          end: b2End,
          thickness: 4 * scale,
          type: 'branch',
        });

        // Center apex branch
        const bApexEnd: Point3D = { x: 5 * scale, y: trunkHeight + 80 * scale, z: 0 };
        branches.push({
          start: trunkEnd,
          end: bApexEnd,
          thickness: 3 * scale,
          type: 'branch',
        });

        // Left tertiary branch
        const b1_1: Point3D = { x: -75 * scale, y: trunkHeight + 80 * scale, z: 25 * scale };
        branches.push({
          start: b1End,
          end: b1_1,
          thickness: 2 * scale,
          type: 'stem',
        });

        // Right tertiary branch
        const b2_1: Point3D = { x: 75 * scale, y: trunkHeight + 85 * scale, z: -25 * scale };
        branches.push({
          start: b2End,
          end: b2_1,
          thickness: 2 * scale,
          type: 'stem',
        });

        // Generate Leaves on branches
        const leafColor = getLeafColor(healthScore);
        const addLeavesAlongBranch = (start: Point3D, end: Point3D, numLeaves: number) => {
          for (let i = 1; i <= numLeaves; i++) {
            const t = i / (numLeaves + 1);
            const pos: Point3D = {
              x: start.x + (end.x - start.x) * t + (Math.random() - 0.5) * 5,
              y: start.y + (end.y - start.y) * t + (Math.random() - 0.5) * 5,
              z: start.z + (end.z - start.z) * t + (Math.random() - 0.5) * 5,
            };
            leaves.push({
              position: pos,
              angleY: Math.random() * Math.PI * 2,
              angleX: (Math.random() - 0.5) * 0.5,
              scale: (0.7 + Math.random() * 0.6) * scale,
              color: leafColor,
            });
          }
        };

        addLeavesAlongBranch(trunkEnd, b1End, 3);
        addLeavesAlongBranch(trunkEnd, b2End, 3);
        addLeavesAlongBranch(b1End, b1_1, 3);
        addLeavesAlongBranch(b2End, b2_1, 3);
        addLeavesAlongBranch(trunkEnd, bApexEnd, 4);

        // Add Flowers if stage is Flowering or Fruiting
        if (growthStage === 'Flowering' || growthStage === 'Fruiting') {
          fruits.push({ position: bApexEnd, type: 'flower', scale: 1.0 });
          fruits.push({ position: { x: b1End.x - 10, y: b1End.y + 15, z: b1End.z + 5 }, type: 'flower', scale: 0.8 });
          fruits.push({ position: { x: b2End.x + 10, y: b2End.y + 15, z: b2End.z - 5 }, type: 'flower', scale: 0.8 });
        }

        // Add Chilli Pods if stage is Fruiting
        if (growthStage === 'Fruiting') {
          // Green chilli growing downwards
          fruits.push({
            position: { x: b1_1.x - 5, y: b1_1.y - 10, z: b1_1.z + 5 },
            type: 'green_chilli',
            scale: 1.1,
          });
          // Red chilli growing downwards (mature)
          fruits.push({
            position: { x: b2_1.x + 5, y: b2_1.y - 12, z: b2_1.z - 5 },
            type: 'red_chilli',
            scale: 1.2,
          });
          // Little baby green chilli
          fruits.push({
            position: { x: bApexEnd.x - 8, y: bApexEnd.y - 15, z: bApexEnd.z - 5 },
            type: 'green_chilli',
            scale: 0.7,
          });
        }

      } else {
        // Seedling stage: Simple single trunk, a couple of small baby leaves
        const leafColor = getLeafColor(healthScore);
        leaves.push({
          position: trunkEnd,
          angleY: 0,
          angleX: -0.3,
          scale: 0.8,
          color: leafColor,
        });
        leaves.push({
          position: trunkEnd,
          angleY: Math.PI,
          angleX: -0.3,
          scale: 0.8,
          color: leafColor,
        });
      }

      return { branches, leaves, fruits };
    };

    const plant = generatePlantData();

    // 3D Point projection function
    // Horizontal rotation (angleY)
    const project = (pt: Point3D, angleY: number) => {
      // Translate to center/height offset
      const cx = canvas.width / 2;
      const cy = canvas.height - 40; // Ground line
      const d = 320; // Perspective distance

      // Y-axis rotation
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      const rx = pt.x * cosY - pt.z * sinY;
      const rz = pt.x * sinY + pt.z * cosY;
      const ry = pt.y; // Keep vertical Y axis untouched

      // Projection
      const fovScale = d / (d + rz);
      return {
        x: cx + rx * fovScale,
        y: cy - ry * fovScale, // Invert Y as canvas coordinates are top-down
        depth: rz, // For depth sorting
      };
    };

    // Main Draw Function
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stylized soil/pot
      const pOffset = project({ x: 0, y: 0, z: 0 }, rotationYRef.current);
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height - 40, 50, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0'; // Light grey soft ring
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height - 40, 42, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8'; // Darker grey soil base
      ctx.fill();

      // Project all branches
      const projectedBranches = plant.branches.map(b => {
        const startProj = project(b.start, rotationYRef.current);
        const endProj = project(b.end, rotationYRef.current);
        return {
          start: startProj,
          end: endProj,
          thickness: b.thickness,
          depth: (startProj.depth + endProj.depth) / 2,
          type: b.type,
        };
      });

      // Project all leaves
      const projectedLeaves = plant.leaves.map(l => {
        const proj = project(l.position, rotationYRef.current);
        return {
          ...l,
          proj,
          depth: proj.depth,
        };
      });

      // Project all fruits
      const projectedFruits = plant.fruits.map(f => {
        const proj = project(f.position, rotationYRef.current);
        return {
          ...f,
          proj,
          depth: proj.depth,
        };
      });

      // Combine and depth sort elements so elements closer (smaller depth value) render last/on-top
      // Notice depth represents z-offset. Lower z is closer to viewer in perspective projection.
      // We sort elements in descending order of depth (furthest depth drawn first).
      const drawables: any[] = [
        ...projectedBranches.map(b => ({ type: 'branch', data: b, depth: b.depth })),
        ...projectedLeaves.map(l => ({ type: 'leaf', data: l, depth: l.depth })),
        ...projectedFruits.map(f => ({ type: 'fruit', data: f, depth: f.depth })),
      ];

      drawables.sort((a, b) => b.depth - a.depth);

      // Render elements
      drawables.forEach((el) => {
        if (el.type === 'branch') {
          const b = el.data;
          ctx.beginPath();
          ctx.moveTo(b.start.x, b.start.y);
          ctx.lineTo(b.end.x, b.end.y);
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.5, b.thickness * (320 / (320 + b.depth)));
          
          if (b.type === 'trunk') {
            ctx.strokeStyle = '#475569'; // Slate dark grey-brown wood
          } else if (b.type === 'branch') {
            ctx.strokeStyle = '#64748b'; // Muted branch
          } else {
            ctx.strokeStyle = '#94a3b8'; // Stem green-grey
          }
          ctx.stroke();
        } 
        
        else if (el.type === 'leaf') {
          const l = el.data;
          const px = l.proj.x;
          const py = l.proj.y;
          const size = 14 * l.scale * (320 / (320 + l.depth));

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(l.angleY + rotationYRef.current);

          // Render almond-shaped Chilli leaf procedural path
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-size / 2, -size, 0, -size * 1.5);
          ctx.quadraticCurveTo(size / 2, -size, 0, 0);
          ctx.fillStyle = l.color;
          ctx.fill();

          // Leaf center line vein
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -size * 1.3);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
        } 
        
        else if (el.type === 'fruit') {
          const f = el.data;
          const px = f.proj.x;
          const py = f.proj.y;
          const dScale = 320 / (320 + f.depth);

          if (f.type === 'flower') {
            // Render beautiful small white star-shaped green chilli blossom
            const size = 8 * f.scale * dScale;
            ctx.save();
            ctx.translate(px, py);
            
            // Draw 5 white star petals
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 5; i++) {
              ctx.rotate((Math.PI * 2) / 5);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.ellipse(0, -size, size / 2.5, size, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }

            // Yellow pollen center
            ctx.beginPath();
            ctx.arc(0, 0, size / 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24'; // Amber center
            ctx.fill();
            ctx.restore();
          } 
          
          else {
            // Render elongated curved green or red hanging Chilli pod
            const size = 16 * f.scale * dScale;
            ctx.save();
            ctx.translate(px, py);
            
            // Stem
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-2, -5, -4, -8);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Pod path
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(size / 3, size / 2, 2, size * 1.4); // Curved tail
            ctx.quadraticCurveTo(-size / 3, size / 2, 0, 0);
            
            ctx.fillStyle = f.type === 'red_chilli' ? '#ef4444' : '#22c55e'; // Deep Chilli Red or Rich Green
            ctx.fill();

            // Shiny specular highlight
            ctx.beginPath();
            ctx.ellipse(size / 6, size / 3, size / 12, size / 3, Math.PI / 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fill();

            ctx.restore();
          }
        }
      });
    };

    // Animation Loop
    const tick = () => {
      if (isAutoRotating && !isDragging) {
        rotationYRef.current = (rotationYRef.current + 0.007) % (Math.PI * 2);
      }
      draw();
      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [growthStage, healthScore, isAutoRotating, isDragging]);

  // Handle manual interaction drag to spin the 3D model
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsAutoRotating(false);
    dragStartX.current = e.clientX;
    dragStartRotationY.current = rotationYRef.current;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX.current;
    // Set rotated angle proportional to drag
    rotationYRef.current = dragStartRotationY.current + deltaX * 0.012;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile swipe-to-rotate
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    setIsDragging(true);
    setIsAutoRotating(false);
    dragStartX.current = e.touches[0].clientX;
    dragStartRotationY.current = rotationYRef.current;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - dragStartX.current;
    rotationYRef.current = dragStartRotationY.current + deltaX * 0.015;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div id="plant-growth-3d-visualizer" className="flex flex-col items-center justify-between h-full py-2">
      {/* Visual canvas */}
      <div 
        className="relative w-full aspect-square max-h-[220px] bg-gradient-to-b from-transparent to-inner-bg/40 rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas 
          ref={canvasRef} 
          width={240} 
          height={240} 
          className="max-w-full drop-shadow-md z-10"
        />

        {/* Dynamic stage badge inside */}
        <div className="absolute top-2 right-2 bg-navy-active text-white text-[10px] font-semibold uppercase tracking-wider py-1 px-2.5 rounded-full z-20 shadow-sm flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          {growthStage}
        </div>

        {/* Interactive hint */}
        <span className="absolute bottom-1.5 text-[9px] text-text-secondary/80 flex items-center gap-1 select-none pointer-events-none">
          <RotateCw className="w-2.5 h-2.5 animate-spin-slow" />
          drag to rotate 3D plant
        </span>
      </div>

      {/* Control Details */}
      <div className="w-full mt-3 px-1 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Health Score</span>
          <div className="flex items-center gap-1">
            <Heart className={`w-3.5 h-3.5 ${healthScore >= 50 ? 'text-status-healthy fill-status-healthy' : 'text-status-critical fill-status-critical animate-pulse'}`} />
            <span className="font-semibold text-text-primary">{healthScore}%</span>
          </div>
        </div>

        {/* Health status description pill */}
        <div className="flex gap-2">
          <div className="flex-1 bg-inner-bg rounded-lg p-2 flex flex-col justify-center">
            <span className="text-[10px] uppercase text-text-secondary tracking-wider font-medium">Status</span>
            <span className={`text-xs font-semibold ${
              healthScore >= 80 ? 'text-status-healthy' :
              healthScore >= 50 ? 'text-status-warning' : 'text-status-critical'
            }`}>
              {healthScore >= 80 ? 'Perfect / Healthy' :
               healthScore >= 50 ? 'Moderate Stress' : 'Critical Disease Alert'}
            </span>
          </div>
          <div className="flex-1 bg-inner-bg rounded-lg p-2 flex flex-col justify-center">
            <span className="text-[10px] uppercase text-text-secondary tracking-wider font-medium">Yield Est.</span>
            <span className="text-xs font-semibold text-text-primary">
              {growthStage === 'Seedling' ? 'None' :
               growthStage === 'Vegetative' ? 'Low' :
               growthStage === 'Flowering' ? 'Medium' : '98% Cap. (Peak)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
