/**
 * T'SoundSystem for J2SE (Java Sound API)
 */
package org.twintail.j2se.tss;

import java.util.logging.Logger;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.SourceDataLine;
import javax.sound.sampled.LineUnavailableException;
import org.twintail.tss.Channel;

/**
 * class AudioLooper
 *
 * This class provides an audio output stream for real time
 * sound rendering.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class AudioLooper extends Thread {
    private static final String TAG = "AudioLooper";
    private static final float SAMPLE_RATE_IN_HZ = 44100;
    private static final int BYTES_PER_CHANNEL = 2;
    private static final int BITS_PER_CHANNEL = 16;
    private static final int NUM_OF_CHANNELS = 2;
    private static final int BUFFER_SIZE_IN_BYTES = 8192;
    private static final int BUFFER_SIZE_IN_SHORTS =
        BUFFER_SIZE_IN_BYTES / BYTES_PER_CHANNEL;
    private static final int BITS_PER_BYTE = 8;
    private static final int SHORT_MASK = 0xffff;
    private static final AudioFormat AUDIO_FORMAT =
        new AudioFormat(SAMPLE_RATE_IN_HZ,
            BITS_PER_CHANNEL,
            NUM_OF_CHANNELS,
            true,
            true);

    private SourceDataLine line = null;
    private Channel channel = null;
    private byte[] buffer = new byte[BUFFER_SIZE_IN_BYTES];

    /**
     * Class constructor.
     * @throws LineUnavailableException Exception happened to get SoundDataLine
     * @see SoundDataLine
     */
    public AudioLooper() throws LineUnavailableException {
        Logger.getLogger(Logger.GLOBAL_LOGGER_NAME).info(TAG
                + "> J2SE Audio Looper");

        line = AudioSystem.getSourceDataLine(AUDIO_FORMAT);
        Logger.getLogger(Logger.GLOBAL_LOGGER_NAME).info(TAG
                + "> " + line.toString());
        Logger.getLogger(Logger.GLOBAL_LOGGER_NAME).info(TAG
                + "> DefaultBufferSize: " + line.getBufferSize());
        line.open(AUDIO_FORMAT, BUFFER_SIZE_IN_BYTES);
        Logger.getLogger(Logger.GLOBAL_LOGGER_NAME).info(TAG
                + "> ConfiguredBufferSize: " + line.getBufferSize());
    }

    /**
     * Register sound generator.
     * @param newChannel sound generator
     */
    public void setChannel(final Channel newChannel) {
        newChannel.setBufferLength(BUFFER_SIZE_IN_SHORTS);
        channel = newChannel;
    }

    /**
     * Run audio generation loop forever!
     * If you run audio loop in an individual thread, call start().
     * On running in your own thread, call run() directly.
     * It blocks and never be back.
     */
    public void run() {
        line.start();
        for (;;) {
            if (null != channel) {
                channel.generate(BUFFER_SIZE_IN_SHORTS);
                short[] channelBuffer = channel.getBuffer();
                for (int offset = 0; offset < BUFFER_SIZE_IN_SHORTS; offset++) {
                    int value = channelBuffer[offset] & SHORT_MASK;
                    buffer[offset * 2 + 0] = (byte) (value >> BITS_PER_BYTE);
                    buffer[offset * 2 + 1] = (byte) value;
                }
                line.write(buffer, 0, BUFFER_SIZE_IN_SHORTS * 2);
            }
        }
    }
}
