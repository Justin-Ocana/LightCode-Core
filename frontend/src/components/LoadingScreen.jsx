/**
 * LoadingScreen - Pantalla de carga lightcode
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoIcono from '../assets/loader.svg';

export default function LoadingScreen({ message, isSlowLoading = false }) {
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [dots, setDots] = useState('');
  const [cubes, setCubes] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const newCubes = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 30 + 20,
      delay: Math.random() * 2,
      duration: Math.random() * 3 + 2,
    }));
    setCubes(newCubes);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Píxeles de cristal flotantes */}
      <div className="crystal-pixel" style={{ top: '10%', left: '5%', animationDelay: '0s' }}></div>
      <div className="crystal-pixel" style={{ top: '15%', right: '8%', animationDelay: '1s' }}></div>
      <div className="crystal-pixel" style={{ top: '25%', left: '15%', animationDelay: '2s' }}></div>
      <div className="crystal-pixel" style={{ top: '35%', right: '12%', animationDelay: '3s' }}></div>
      <div className="crystal-pixel" style={{ top: '45%', left: '10%', animationDelay: '4s' }}></div>
      <div className="crystal-pixel" style={{ top: '55%', right: '15%', animationDelay: '5s' }}></div>
      <div className="crystal-pixel" style={{ top: '65%', left: '8%', animationDelay: '1.5s' }}></div>
      <div className="crystal-pixel" style={{ top: '75%', right: '10%', animationDelay: '2.5s' }}></div>
      <div className="crystal-pixel" style={{ top: '20%', left: '25%', animationDelay: '3.5s' }}></div>
      <div className="crystal-pixel" style={{ top: '40%', right: '20%', animationDelay: '4.5s' }}></div>
      <div className="crystal-pixel" style={{ top: '60%', left: '20%', animationDelay: '0.5s' }}></div>
      <div className="crystal-pixel" style={{ top: '80%', right: '25%', animationDelay: '1.8s' }}></div>

      <div className="crystal-pixel-small" style={{ top: '12%', left: '30%', animationDelay: '0s' }}></div>
      <div className="crystal-pixel-small" style={{ top: '28%', right: '28%', animationDelay: '2s' }}></div>
      <div className="crystal-pixel-small" style={{ top: '48%', left: '35%', animationDelay: '4s' }}></div>
      <div className="crystal-pixel-small" style={{ top: '68%', right: '32%', animationDelay: '3s' }}></div>
      <div className="crystal-pixel-small" style={{ top: '38%', left: '18%', animationDelay: '5s' }}></div>
      <div className="crystal-pixel-small" style={{ top: '58%', right: '22%', animationDelay: '1s' }}></div>

      {/* Cubos flotantes estilo Minecraft */}
      {cubes.map((cube) => (
        <motion.div
          key={cube.id}
          initial={{
            x: `${cube.x}vw`,
            y: `${cube.y}vh`,
            opacity: 0,
            scale: 0
          }}
          animate={{
            y: [`${cube.y}vh`, `${cube.y - 20}vh`, `${cube.y}vh`],
            opacity: [0, 0.3, 0],
            scale: [0, 1, 0],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: cube.duration,
            delay: cube.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{
            position: 'absolute',
            width: `${cube.size}px`,
            height: `${cube.size}px`,
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(0, 212, 170, 0.3))',
            border: '2px solid rgba(124, 58, 237, 0.5)',
            borderRadius: '4px',
            pointerEvents: 'none'
          }}
        />
      ))}

      {/* Contenido principal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          zIndex: 10,
          position: 'relative'
        }}
      >
        {/* Logo con pulso suave */}
        <motion.img
          src={logoIcono}
          alt="lightcode"
          width="100"
          height="100"
          animate={{
            scale: [1, 1.07, 1],
            filter: [
              'drop-shadow(0 0 16px rgba(124, 58, 237, 0.4))',
              'drop-shadow(0 0 32px rgba(124, 58, 237, 0.75))',
              'drop-shadow(0 0 16px rgba(124, 58, 237, 0.4))',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Texto lightcode */}
        <h1
          style={{
            fontSize: '3rem',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #7C3AED, #00D4AA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          lightcode
        </h1>

        {/* Mensaje de carga */}
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-secondary)',
            fontWeight: '500',
            marginTop: '-1.2rem',
          }}
        >
          {message || 'Conectando con lightcode'}{dots}
        </motion.p>

        {/* Spinner original — grande */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '72px',
            height: '72px',
            border: '6px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
          }}
        />

        {/* Tarjeta de servidor dormido */}
        <AnimatePresence>
          {(showSlowMessage || isSlowLoading) && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1.25rem',
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(124, 58, 237, 0.2)',
                  borderTopColor: '#7C3AED',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />
              <div>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: 0,
                  marginBottom: '0.2rem'
                }}>
                  Despertando servidor...
                </p>
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: 0
                }}>
                  Esto puede tomar unos segundos ☕
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}