import React, { useEffect, useRef } from 'react';
import {
  getSoundNotificationPreference,
  playFireworkBurstSound,
  playGenerationSuccessSound,
} from '../lib/soundNotification';

interface FireworksCelebrationProps {
  soundEnabled?: boolean;
  onComplete?: () => void;
}

export const FireworksCelebration: React.FC<FireworksCelebrationProps> = ({
  soundEnabled,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const isSoundEnabled =
      typeof soundEnabled === 'boolean'
        ? soundEnabled
        : getSoundNotificationPreference();

    // Memutar notifikasi bunyi perayaan utama saat animasi kembang api dimulai
    playGenerationSuccessSound(isSoundEnabled);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    const colors = ['#fbbf24', '#f59e0b', '#fb7185', '#38bdf8', '#34d399', '#a78bfa'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleGlobalClick = () => {
      if (onComplete) onComplete();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('click', handleGlobalClick, { capture: true });
    resize();

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      gravity: number;
      friction: number;
      life: number;

      constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 6 + 2;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.alpha = 1;
        this.color = color;
        this.gravity = 0.05;
        this.friction = 0.98;
        this.life = Math.random() * 0.02 + 0.005;
      }

      update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.life;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    const createFirework = (x: number, y: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 40; i++) {
        particles.push(new Particle(x, y, color));
      }
      playFireworkBurstSound(isSoundEnabled);
    };

    let startTime = Date.now();
    let fireworkCount = 0;
    const maxFireworks = 20;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (fireworkCount < maxFireworks && Math.random() < 0.12 && elapsed < 7500) {
        createFirework(
          Math.random() * canvas.width,
          Math.random() * (canvas.height * 0.6) + canvas.height * 0.1
        );
        fireworkCount++;
      }

      particles = particles.filter((p) => p.alpha > 0);
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      if (elapsed >= 10000 || (elapsed > 7500 && particles.length === 0)) {
        if (onComplete) onComplete();
        return;
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleGlobalClick, { capture: true });
      cancelAnimationFrame(animationId);
    };
  }, [soundEnabled, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};
