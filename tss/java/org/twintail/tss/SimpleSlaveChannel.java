/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

/**
 * class SlaveChannel
 *
 * This class implements simple fixed frequency slave channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class SimpleSlaveChannel implements Channel {
    private static final int DEFAULT_VOLUME = 1024;
    private short[] buffer = null;
    private int freq = 0;
    private int phase = 0;
    private short data = DEFAULT_VOLUME;

    /**
     * Class constructor.
     * @param frequency sound frequency
     */
    public SimpleSlaveChannel(final int frequency) {
        freq = frequency;
    }

    /**
     * @see Channel
     * @param length buffer length or size in shorts
     */
    public void setBufferLength(final int length) {
        buffer = new short[length];
    }

    /**
     * @see Channel
     * @return audio stream buffer
     */
    public short[] getBuffer() {
        return buffer;
    }

    /**
     * Generate specified length sound stream into internal buffer.
     * @see Channel
     * @param length sound length in short to generate
     */
    public void generate(final int length) {
        for (int i = 0; i < length; i += 2) {
            phase += freq * 2;
            if (phase > MasterChannel.SAMPLE_FREQUENCY) {
                phase -= MasterChannel.SAMPLE_FREQUENCY;
                data = (short) -data;
            }
            buffer[i + 0] = data;
            buffer[i + 1] = data;
        }
    }
}
