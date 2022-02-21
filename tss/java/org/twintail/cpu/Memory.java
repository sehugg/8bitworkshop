/**
 * CPU Emulation Suites for Java
 */
package org.twintail.cpu;

/**
 * interface Memory
 *
 * This interface provides a memory access interfaces.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public interface Memory {
    /**
     * Write 8-bit data to addressed memory.
     * @param address memory address to write
     * @param data data to write
     */
    void writeChar(int address, char data);

    /**
     * Read 8-bit data from addressed memory.
     * @param address memory address to read
     * @return read data
     */
    char readChar(int address);
}
