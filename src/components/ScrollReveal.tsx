import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  variant?: 'fade-up' | 'fade-in' | 'scale-in' | 'blur-reveal';
}

export default function ScrollReveal({
  children,
  delay = 0,
  duration = 0.8,
  variant = 'fade-up',
}: ScrollRevealProps) {
  const [revealed, setRevealed] = useState(false);

  // Diagnostic logging for the ScrollReveal lifecycle
  useEffect(() => {
    console.log(`[SCROLL REVEAL DEBUG] Mounted. Variant: ${variant}, Delay: ${delay}s, Duration: ${duration}s`);
  }, [variant, delay, duration]);

  useEffect(() => {
    console.log(`[SCROLL REVEAL DEBUG] Visibility state changed. revealed: ${revealed}`);
  }, [revealed]);

  useEffect(() => {
    // Safety valve: Unconditionally force reveal after a slight delay to ensure elements 
    // are never permanently hidden due to iframe, IntersectionObserver quirks, or tab switching.
    const safetyTimer = setTimeout(() => {
      console.log(`[SCROLL REVEAL DEBUG] Safety timer triggered. Forcing revealed to true.`);
      setRevealed(true);
    }, 800 + (delay * 1000));

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [delay]);

  const getVariants = () => {
    switch (variant) {
      case 'fade-up':
        return {
          hidden: { opacity: 0, y: 35 },
          visible: { opacity: 1, y: 0 },
        };
      case 'fade-in':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
      case 'scale-in':
        return {
          hidden: { opacity: 0, scale: 0.95 },
          visible: { opacity: 1, scale: 1 },
        };
      case 'blur-reveal':
        return {
          hidden: { opacity: 0, filter: 'blur(10px)', y: 25 },
          visible: { opacity: 1, filter: 'blur(0px)', y: 0 },
        };
      default:
        return {
          hidden: { opacity: 0, y: 35 },
          visible: { opacity: 1, y: 0 },
        };
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.01, margin: "100px" }}
      onViewportEnter={() => {
        console.log(`[SCROLL REVEAL DEBUG] onViewportEnter triggered. Setting revealed to true.`);
        setRevealed(true);
      }}
      animate={revealed ? "visible" : undefined}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1], // Custom premium ease-out bezier curve
      }}
      variants={getVariants()}
      style={{ 
        pointerEvents: revealed ? 'auto' : 'none',
        visibility: 'visible',
        display: 'block',
        width: '100%',
        opacity: revealed ? 1 : undefined,
        filter: revealed ? 'none' : undefined,
      }}
    >
      {children}
    </motion.div>
  );
}
