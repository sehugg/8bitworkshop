/**
 * T'SoundSystem for J2SE (Java Sound API)
 */
package org.twintail.j2se.tss;

import java.io.FileInputStream;
import java.io.InputStream;
import java.io.BufferedInputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.util.logging.Logger;
import org.twintail.Log;
import org.twintail.tss.MasterChannel;
import org.twintail.tss.PsglogPlayer;
import org.twintail.tss.VgmPlayer;

/**
 * class UnitTest
 *
 * This class tests tss classes.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class UnitTest {
    /**
     * Test PSGLOG/AY-3-8910.
     */
    public void test00() {
        try {
            // prepare sound related objects
            AudioLooper loop = new AudioLooper();
            MasterChannel master = new MasterChannel();

            // prepare input audio data
            URL url = new URL("http://chiyo.twintail.org/psglog.1");
            HttpURLConnection urlConnection =
                (HttpURLConnection) url.openConnection();
            InputStream in =
                new BufferedInputStream(urlConnection.getInputStream());

            // play it!
            PsglogPlayer play = new PsglogPlayer();
            play.setMasterChannel(master);
            play.play(in);

            loop.setChannel(master);
            loop.run();
        } catch (Exception e) {
            Log.getLog().warn("TEST00" + "> Exception: " + e.toString());
        }
    }

    /**
     * Test VGM/SN76489.
     */
    public void test01() {
        try {
            // prepare sound related objects
            AudioLooper loop = new AudioLooper();
            MasterChannel master = new MasterChannel();

            // prepare input audio data
            InputStream in = new BufferedInputStream(
                    new FileInputStream("../data/test.vgm"));

            // play it!
            VgmPlayer play = new VgmPlayer();
            play.setMasterChannel(master);
            play.play(in);

            loop.setChannel(master);
            loop.run();
        } catch (Exception e) {
            Log.getLog().warn("TEST01" + "> Exception: " + e.toString());
            e.printStackTrace();
        }
    }

    /**
     * Main to run simple test.
     * @param args arguments (not used)
     */
    public static void main(final String[] args) {
        Log.setLog(new J2SELog());
        UnitTest test = new UnitTest();
        //test.test00();
        test.test01();
    }
}
