/**
 * TOYOSHIMA-HOUSE Libraries for Java
 */
package org.twintail;

/**
 * class Log
 *
 * This class provide common log interfaces.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 */
public abstract class Log {
    private static Log log = null;

    /**
     * Set default log instance.
     * @param newLog Log instance to set
     */
    public static void setLog(final Log newLog) {
        log = newLog;
    }

    /**
     * Get default log instance.
     * @return default Log instance
     */
    public static Log getLog() {
        return log;
    }

    /**
     * Log fatal message.
     * @param message fatal message
     */
    public void fatal(final String message) {
    }

    /**
     * Log error message.
     * @param message error message
     */
    public void error(final String message) {
    }

    /**
     * Log warning message.
     * @param message warning message
     */
    public void warn(final String message) {
    }

    /**
     * Log information message.
     * @param message information message
     */
    public void info(final String message) {
    }
}
