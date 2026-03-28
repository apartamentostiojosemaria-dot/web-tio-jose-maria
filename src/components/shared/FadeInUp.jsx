import { motion } from 'framer-motion';

const FadeInUp = ({ children, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
        {children}
    </motion.div>
);

export default FadeInUp;
