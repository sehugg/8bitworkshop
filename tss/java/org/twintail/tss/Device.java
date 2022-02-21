/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

/**
 * interface Device
 *
 * This interface provides read/write method for audio device.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public interface Device {
    /**
     * Write device register.
     * @param address register address to write
     * @param value register value to write
     */
    void writeRegister(int address, int value);

    /**
     * Read device register.
     * @param address register address to read
     * @return read register value
     */
    int readRegister(int address);
}
