/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

/**
 * interface Channel
 *
 * This interface provides a call-back method for audio generation.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public interface Channel {
    /**
     * Set internal buffer length.
     * @param length buffer length or size in shorts
     */
    void setBufferLength(int length);

    /**
     * Get internal buffer.
     * @return audio stream buffer
     */
    short[] getBuffer();

    /**
     * Generate audio stream to internal buffer.
     * @param length buffer length or size in shorts to generate audio stream
     */
    void generate(int length);
}
