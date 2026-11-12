import { useState, useEffect } from 'react';

export const useContainerDimensions = (divRef) => {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!divRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(divRef.current);
    return () => resizeObserver.disconnect();
  }, [divRef]);

  return dimensions;
};