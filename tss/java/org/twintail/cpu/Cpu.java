/**
 * CPU Emulation Suites for Java
 */
package org.twintail.cpu;

/**
 * interface Cpu
 *
 * This interface provides a processor interfaces.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public interface Cpu {
    /**
     * Set memory access object.
     * @param memory Memory object to set
     */
    void setMemory(Memory memory);

    /**
     * Initialize the processor.
     */
    void init();

    /**
     * Read internal register values.
     * @param index register index
     * @return register value
     */
    int readRegister(int index);

    /**
     * Execute one step.
     */
    void runStep();
}
