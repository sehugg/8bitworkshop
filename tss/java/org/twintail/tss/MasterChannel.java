/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

import java.util.Iterator;
import java.util.List;
import java.util.LinkedList;

/**
 * class MasterChannel (thread unsafe)
 *
 * This class provide main audio generation loop.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class MasterChannel implements Channel {
    public static final int SAMPLE_FREQUENCY = 44100;
    private static final int MAX_WAVE_VALUE = 32767;
    private static final int MIN_WAVE_VALUE = -32767;
    private static final int MSEC_PER_SEC = 1000;
    private static final int DEFAULT_VOLUME = 8;
    private final List<Channel> channels = new LinkedList<Channel>();
    private short[][] buffers = null;
    private short[] buffer = null;
    private int bufferLength = 0;
    private Player player = null;
    private int intervalLength = 0;
    private int intervalRestLength = 0;
    private int volume = DEFAULT_VOLUME;

    /**
     * Reconstruct slave buffer references.
     */
    private void reconstructBuffers() {
        Iterator<Channel> it = channels.iterator();
        short[][] newBuffers = new short[channels.size()][];
        for (int i = 0; it.hasNext(); i++) {
            Channel channel = it.next();
            newBuffers[i] = channel.getBuffer();
        }
        buffers = newBuffers;
    }

    /**
     * Set mixing volume.
     * Every device sets maximum volume of each sound channel
     * as one sixteenth to avoid sound saturation.
     * If you want to maximize sounds set sixteen as volume.
     * It is the default value.
     * @param newVolume volume
     */
    public void setVolume(final int newVolume) {
        volume = newVolume;
    }

    /**
     * Add channel to audio play back loop.
     * @param channel channel to add
     * @return result
     */
    public boolean addChannel(final Channel channel) {
        if (0 != bufferLength) {
            buffers = null;
            channel.setBufferLength(bufferLength);
            reconstructBuffers();
        }
        return channels.add(channel);
    }

    /**
     * Remove channel from audio play back loop.
     * @param channel channel to remove
     * @return result
     */
    public boolean removeChannel(final Channel channel) {
        buffers = null;
        boolean result = channels.remove(channel);
        reconstructBuffers();
        return result;
    }

    /**
     * Remove all channels from audio play back loop.
     */
    public void clearChannel() {
        buffers = null;
        channels.clear();
        reconstructBuffers();
    }

    /**
     * Set player object to control devices periodically.
     * @param newPlayer player to call back
     */
    public void setPlayer(final Player newPlayer) {
        player = newPlayer;
    }

    /**
     * Set time interval to call back player periodically.
     * @param msec time interval
     */
    public void setPlayerInterval(final int msec) {
        // TODO: intervalLength must be doubled value. See, 80551a7b51fa
        intervalLength = (int) ((long) SAMPLE_FREQUENCY * (long) msec
                / (long) MSEC_PER_SEC);
        intervalRestLength = intervalLength;
    }

    /**
     * Do partial slave channel audio mixing.
     * @param base base offset to generate
     * @param length buffer length to generate
     */
    private void generateInternal(final int base, final int length) {
        Iterator<Channel> it = channels.iterator();
        while (it.hasNext()) {
            Channel channel = it.next();
            channel.generate(length);
        }
        int size = channels.size();
        for (int offset = 0; offset < length; offset++) {
            int value = 0;
            for (int channel = 0; channel < size; channel++) {
                value += (int) buffers[channel][offset];
            }
            value *= volume;
            if (value > MAX_WAVE_VALUE) { value = MAX_WAVE_VALUE; }
            if (value < MIN_WAVE_VALUE) { value = MIN_WAVE_VALUE; }
            buffer[base + offset] = (short) value;
        }
    }

    /**
     * @see Channel
     * @param length buffer length or size in shorts
     */
    public void setBufferLength(final int length) {
        buffers = null;
        buffer = new short[length];
        bufferLength = length;
        Iterator<Channel> it = channels.iterator();
        while (it.hasNext()) {
            Channel channel = it.next();
            channel.setBufferLength(length);
        }
        reconstructBuffers();
    }

    /**
     * @see Channel
     * @return audio stream buffer
     */
    public short[] getBuffer() {
        return buffer;
    }

    /**
     * @see Channel
     * @param length buffer length or size in shorts to generate audio stream
     */
    public void generate(final int length) {
        if (null == buffers) {
            return;
        }
        if ((null == player) || (0 == intervalLength)) {
            generateInternal(0, length);
        } else {
            int restLength = length;
            int offset = 0;
            while (restLength > intervalRestLength) {
                generateInternal(offset, intervalRestLength);
                restLength -= intervalRestLength;
                offset += intervalRestLength;
                intervalRestLength = intervalLength;
                player.updateDevice();
            }
            if (0 != restLength) {
                generateInternal(offset, restLength);
                intervalRestLength -= restLength;
            }
        }
    }
}
