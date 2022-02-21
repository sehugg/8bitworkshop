/**
 * T'SoundSystem for Android
 */
package org.twintail.android.tss;

import android.media.AudioManager;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.AudioTrack.OnPlaybackPositionUpdateListener;
import android.util.Log;
import org.twintail.tss.Channel;


/**
 * class AudioLooper (required API Level: 3)
 *
 * This class provides an audio output stream for real time
 * sound rendering.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class AudioLooper implements OnPlaybackPositionUpdateListener {
    private static final String TAG = "AudioLooper";
    private static final int SAMPLE_RATE_IN_HZ = 44100;
    private static final int BYTES_PER_CHANNEL = 2;
    private static final int NUM_OF_CHANNELS = 2;
    private static final int FRAME_SIZE_IN_BYTES =
        BYTES_PER_CHANNEL * NUM_OF_CHANNELS;
    private static final int DEFAULT_BUFFER_SIZE_IN_BYTES = 8192;
    private int bufferSizeInBytes = DEFAULT_BUFFER_SIZE_IN_BYTES;
    private int bufferSizeInShorts;	// bufferSizeInBytes / BYTES_PER_CHANNEL;
    private int bufferSizeInFrames;	// bufferSizeInBytes / FRAME_SIZE_IN_BYTES;

    private AudioTrack track = null;
    private Channel channel = null;
    private short[] nullBuffer = null;

    /**
     * Class constructor.
     */
    public AudioLooper() {
        int minBufferSizeInBytes = AudioTrack.getMinBufferSize(
                SAMPLE_RATE_IN_HZ,
                AudioFormat.CHANNEL_CONFIGURATION_STEREO,
                AudioFormat.ENCODING_PCM_16BIT);
        Log.i(TAG, "MinBufferSize: " + minBufferSizeInBytes);
        Log.i(TAG, "NativeSampleRate: "
                + AudioTrack.getNativeOutputSampleRate(
                        AudioManager.STREAM_MUSIC));

        if (bufferSizeInBytes < minBufferSizeInBytes) {
            bufferSizeInBytes = minBufferSizeInBytes;
        }
        Log.i(TAG, "bufferSizeInBytes: " + bufferSizeInBytes);
        bufferSizeInShorts = bufferSizeInBytes / BYTES_PER_CHANNEL;
        bufferSizeInFrames = bufferSizeInBytes / FRAME_SIZE_IN_BYTES;
        nullBuffer = new short[bufferSizeInShorts];

        track = new AudioTrack(AudioManager.STREAM_MUSIC,
                SAMPLE_RATE_IN_HZ,
                AudioFormat.CHANNEL_CONFIGURATION_STEREO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSizeInBytes,
                AudioTrack.MODE_STREAM);
        track.setPlaybackPositionUpdateListener(this);
        int rc = track.setPositionNotificationPeriod(bufferSizeInFrames);
        Log.i(TAG, "setPositionNotificationPeriod(): " + rc);

        track.play();
        track.write(nullBuffer, 0, nullBuffer.length);
        track.write(nullBuffer, 0, nullBuffer.length);
    }

    /**
     * Register sound generator.
     * @param newChannel sound generator
     */
    public void setChannel(final Channel newChannel) {
        newChannel.setBufferLength(bufferSizeInShorts);
        channel = newChannel;
    }

    /**
     * @see AudioTrack.OnPlaybackPositionUpdateListener
     * @param audioTrack caller AudioTrack object
     */
    public void onMarkerReached(final AudioTrack audioTrack) {
        Log.e(TAG, "onMarkerReached(): should not be reached");
    }

    /**
     * @see AudioTrack.OnPlaybackPositionUpdateListener
     * @param audioTrack caller AudioTrack object
     */
    public void onPeriodicNotification(final AudioTrack audioTrack) {
        Log.v(TAG, "onPeriodicNotification()");
        if (null != channel) {
            channel.generate(bufferSizeInShorts);
            audioTrack.write(channel.getBuffer(), 0, bufferSizeInShorts);
        } else {
            audioTrack.write(nullBuffer, 0, bufferSizeInShorts);
        }
    }
}
