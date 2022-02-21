/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

import java.io.InputStream;

/**
 * interface Player
 *
 * This interface provides periodical device control interfaces
 * to Channel object.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public interface Player {
    /**
     * Set master channel to write output stream.
     * @param channel master channel
     */
    void setMasterChannel(MasterChannel channel);

    /**
     * Channel reach to periodical call back point.
     */
    void updateDevice();

    /**
     *  Decode and play.
     * @param input InputStream to play
     * @return success or not
     */
    boolean play(InputStream input);
}
