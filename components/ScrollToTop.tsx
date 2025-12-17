import { useTranslation } from "react-i18next"
import { ChevronUp } from "tabler-icons-react"
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const ScrollToTop = () => {

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(currentScrollPosition > 0);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed right-4 p-2 bottom-12 bg-primary text-white cursor-pointer hover:bg-primary/80 rounded-full flex items-center justify-center z-50"
          onClick={scrollToTop}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <ChevronUp size={20} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}