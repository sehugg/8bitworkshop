/**
 * T'SoundSystem for J2SE (Java Sound API)
 */
package org.twintail.j2se.tss;

import java.util.logging.Logger;
import java.util.logging.Level;
import org.twintail.Log;

/**
 * class J2SELog
 *
 * This class provide log interfaces for J2SE.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public class J2SELog extends Log {
    private Logger logger = Logger.getAnonymousLogger();

    /**
     * @see Log
     * @param message fatal message
     */
    public final void fatal(final String message) {
        logger.log(Level.SEVERE, message);
    }

    /**
     * @see Log
     * @param message error message
     */
    public final void error(final String message) {
        logger.log(Level.WARNING, message);
    }

    /**
     * @see Log
     * @param message warning message
     */
    public final void warn(final String message) {
        logger.log(Level.WARNING, message);
    }

    /**
     * @see Log
     * @param message information message
     */
    public final void info(final String message) {
        logger.log(Level.INFO, message);
    }
}
