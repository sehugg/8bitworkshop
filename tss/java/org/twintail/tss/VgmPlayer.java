/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

import java.io.IOException;
import java.io.InputStream;
import java.io.BufferedInputStream;
import java.util.zip.GZIPInputStream;
import org.twintail.Log;

/**
 * class VgmPlayer
 *
 * Play VGM format files.
 * @see http://www.smspower.org/uploads/Music/vgmspec150.txt
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class VgmPlayer implements Player {
    private static final byte GZ_ID1 = (byte) 0x1f;
    private static final byte GZ_ID2 = (byte) 0x8b;
    private static final byte VGM_ID1 = (byte) 'V';
    private static final byte VGM_ID2 = (byte) 'g';
    private static final byte VGM_ID3 = (byte) 'm';
    private static final byte VGM_ID4 = (byte) ' ';
    private static final int VGM_IDENT_SIZE = 4;
    private static final int VGM_VERSION_SIZE = 4;
    private static final int VERSION_1_00 = 0x00;
    private static final int VERSION_1_01 = 0x01;
    private static final int VERSION_1_10 = 0x10;
    private static final int VERSION_1_50 = 0x50;
    private static final int UINT_SIZE = 4;
    private static final long BYTE_MASK = 0xff;
    private static final int OFFSET_0 = 0;
    private static final int OFFSET_1 = 1;
    private static final int OFFSET_2 = 2;
    private static final int OFFSET_3 = 3;
    private static final int LSHIFT_0_BYTE = 0;
    private static final int LSHIFT_1_BYTE = 8;
    private static final int LSHIFT_2_BYTE = 16;
    private static final int LSHIFT_3_BYTE = 24;
    private static final int PLAYER_INTERVAL_NTSC = 17;
    private static final int PLAYER_INTERVAL_PAL = 20;
    private static final int VGM_DEFAULT_DATA_OFFSET = 0x40;
    private static final int VGM_1_00_EOH = 0x24;
    private static final byte CMD_WRITE_GG = (byte) 0x4f;
    private static final byte CMD_WRITE_SN = (byte) 0x50;
    private static final byte CMD_WRITE_YM2413 = (byte) 0x51;
    private static final byte CMD_WRITE_YM2612A = (byte) 0x52;
    private static final byte CMD_WRITE_YM2612B = (byte) 0x53;
    private static final byte CMD_WRITE_YM2151 = (byte) 0x54;
    private static final byte CMD_WAIT_NNNN = (byte) 0x61;
    private static final byte CMD_WAIT_735 = (byte) 0x62;
    private static final byte CMD_WAIT_882 = (byte) 0x63;
    private static final byte CMD_EOD = (byte) 0x66;
    private static final int WAIT_735 = 735;
    private static final int WAIT_882 = 882;

    private MasterChannel masterChannel = null;
    private InputStream inputStream = null;
    private PsgDeviceChannel psg = null;
    private int minorVersion = 0;
    private long snClock = PsgDeviceChannel.CLOCK_3_58MHZ;
    private boolean error = false;
    private boolean loop = false;
    private long loopSkipOffset = 0;
    private int interval = PLAYER_INTERVAL_NTSC;
    private int wait = 0;
    private int writtenSamples = 0;

    /**
     * Read unsigned int value from InputStream.
     * @param input InputStream to read
     * @return read unsigned int value
     * @throws IOException exception on reading
     */
    private long readUInt(final InputStream input) throws IOException {
        byte[] buffer = new byte[UINT_SIZE];
        if (UINT_SIZE != input.read(buffer, 0, UINT_SIZE)) {
            throw new IOException();
        }
        long l = ((long) buffer[OFFSET_0] & BYTE_MASK) << LSHIFT_0_BYTE;
        long k = ((long) buffer[OFFSET_1] & BYTE_MASK) << LSHIFT_1_BYTE;
        long j = ((long) buffer[OFFSET_2] & BYTE_MASK) << LSHIFT_2_BYTE;
        long h = ((long) buffer[OFFSET_3] & BYTE_MASK) << LSHIFT_3_BYTE;
        return h | j | k | l;
    }

    /**
     * @see Player
     * @param channel master channel
     */
    public void setMasterChannel(final MasterChannel channel) {
        psg = new PsgDeviceChannel();
        psg.setMode(PsgDeviceChannel.MODE_SIGNED);
        psg.setDevice(PsgDeviceChannel.DEVICE_SN76489);
        channel.clearChannel();
        channel.addChannel(psg);
        channel.setPlayer(this);
        // TODO: msec is not sufficient for NTSC (16.6... is not 17!)
        channel.setPlayerInterval(PLAYER_INTERVAL_NTSC);
        interval = WAIT_735;
        Log.getLog().info("VGM: assume as NTSC");
        masterChannel = channel;
    }

    /**
     * @see Player
     */
    public void updateDevice() {
        if (error || (inputStream == null)) {
            return;
        }
        if (wait > 0) {
            wait -= interval;
            return;
        }
        try {
            while (true) {
                byte[] command = new byte[1];
                byte[] arguments = new byte[2];
                inputStream.read(command, 0, 1);
                switch (command[0]) {
                case CMD_WRITE_GG:
                    inputStream.read(command, 0, 1);
                    psg.writeRegister(0, (int) ((long) command[0] & BYTE_MASK));
                    writtenSamples++;
                    break;
                case CMD_WRITE_SN:
                    inputStream.read(command, 0, 1);
                    psg.writeRegister(0, (int) ((long) command[0] & BYTE_MASK));
                    writtenSamples++;
                    break;
                case CMD_WRITE_YM2413:
                case CMD_WRITE_YM2612A:
                case CMD_WRITE_YM2612B:
                case CMD_WRITE_YM2151:
                    error = true;
                    Log.getLog().warn("VGM: FM sound is not supported");
                    return;
                case CMD_WAIT_NNNN:
                    inputStream.read(arguments, 0, 2);
                    wait += (int) (((long) arguments[0] & BYTE_MASK)
                            | (((long) arguments[1] & BYTE_MASK)
                                    << LSHIFT_1_BYTE));
                    return;
                case CMD_WAIT_735:
                    wait += WAIT_735;
                    masterChannel.setPlayerInterval(PLAYER_INTERVAL_NTSC);
                    if (interval != WAIT_735) {
                        Log.getLog().info("VGM: detect as NTSC");
                        interval = WAIT_735;
                    }
                    return;
                case CMD_WAIT_882:
                    wait += WAIT_882;
                    masterChannel.setPlayerInterval(PLAYER_INTERVAL_PAL);
                    if (interval != WAIT_882) {
                        Log.getLog().info("VGM: detect as PAL");
                        interval = WAIT_882;
                    }
                    return;
                case CMD_EOD:
                    if (loop) {
                        inputStream.reset();
                        inputStream.skip(loopSkipOffset);
                        Log.getLog().info("VGM: loop");
                    } else {
                        // set error flag to stop music
                        error = true;
                        return;
                    }
                    break;
                default:
                    Log.getLog().warn("VGM: unknown command 0x"
                            + Integer.toHexString((int)
                                    ((long) command[0] & BYTE_MASK)));
                    Log.getLog().warn("written samples = " + writtenSamples);
                    return;
                }
            }
        } catch (Exception e) {
            Log.getLog().error("VGM: " + e.toString());
            error = true;
        }
    }

    /**
     * @see Player
     * @param input InputStream to play
     * @return success or not
     */
    public boolean play(final InputStream input) {
        try {
            // check gzip or not
            byte[] gzHeader = new byte[2];
            input.mark(2);
            if (2 != input.read(gzHeader, 0, 2)) {
                return false;
            }
            input.reset();
            InputStream in = input;
            if ((GZ_ID1 == gzHeader[0]) && (GZ_ID2 == gzHeader[1])) {
                Log.getLog().info("VGM: GZip compressed, aka VGZ");
                in = new BufferedInputStream(new GZIPInputStream(input));
            }

            // check vgm header
            byte[] vgmHeader = new byte[VGM_IDENT_SIZE];
            if ((VGM_IDENT_SIZE != in.read(vgmHeader, 0, VGM_IDENT_SIZE))
                    || (vgmHeader[OFFSET_0] != VGM_ID1)
                    || (vgmHeader[OFFSET_1] != VGM_ID2)
                    || (vgmHeader[OFFSET_2] != VGM_ID3)
                    || (vgmHeader[OFFSET_3] != VGM_ID4)) {
                Log.getLog().info("VGM: Invalid IDENT");
                return false;
            }
            Log.getLog().info("VGM: detect VGM indent");

            // EoF offset
            long vgmLength = readUInt(in) + UINT_SIZE;
            Log.getLog().info("VGM: file length = " + vgmLength);

            // Version
            byte[] vgmVersion = new byte[VGM_VERSION_SIZE];
            if ((VGM_VERSION_SIZE != in.read(vgmVersion, 0, VGM_VERSION_SIZE))
                    || (vgmVersion[OFFSET_3] != 0)
                    || (vgmVersion[OFFSET_2] != 0)
                    || (vgmVersion[OFFSET_1] != 1)) {
                Log.getLog().error("VGM: version is not 1.x ("
                        + vgmVersion[OFFSET_3] + "."
                        + vgmVersion[OFFSET_2] + "."
                        + vgmVersion[OFFSET_1] + "."
                        + vgmVersion[OFFSET_0] + ")");
                return false;
            }
            minorVersion = (int) ((long) vgmVersion[OFFSET_0] & BYTE_MASK);
            switch (minorVersion) {
            case VERSION_1_00:
                Log.getLog().info("VGM: version 1.00");
                break;
            case VERSION_1_01:
                Log.getLog().info("VGM: version 1.01");
                break;
            case VERSION_1_10:
                Log.getLog().info("VGM: version 1.10");
                break;
            case VERSION_1_50:
                Log.getLog().info("VGM: version 1.50");
                break;
            default:
                Log.getLog().info("VGM: unknown version 1.["
                        + minorVersion + "]");
                return false;
            }

            // clock settings
            long clock;
            clock = readUInt(in);
            if (0 == clock) {
                Log.getLog().warn("VGM: SN76489 is not used");
                return false;
            }
            Log.getLog().info("VGM: SN76489 clock is " + clock + " Hz");
            if (clock != snClock) {
                Log.getLog().info("VGM:   not " + snClock + " Hz");
                snClock = clock;
            }
            psg.setClock((int) snClock);
            clock = readUInt(in);
            if (0 != clock) {
                // TODO: support YM2413
                Log.getLog().info("VGM: YM2413 clock is " + clock + " Hz");
                return false;
            }

            // GD3 tag (TODO: support GD3 tag)
            long gd3Offset = readUInt(in);
            Log.getLog().info("VGM: GD3 offset = " + gd3Offset);

            // check offsets
            long totalSamples = readUInt(in);
            long loopOffset = readUInt(in);
            long loopSamples = readUInt(in);
            Log.getLog().info("VGM: Total # samples = " + totalSamples);
            Log.getLog().info("VGM: Loop offset = " + loopOffset);
            Log.getLog().info("VGM: Loop # samples = " + loopSamples);
            if (0 != loopOffset) {
                loop = true;
                loopSkipOffset = loopOffset - VGM_DEFAULT_DATA_OFFSET;
            }

            // 1.00 complete
            if (minorVersion == VERSION_1_00) {
                in.skip(VGM_DEFAULT_DATA_OFFSET - VGM_1_00_EOH);
                in.mark((int) (vgmLength - VGM_DEFAULT_DATA_OFFSET));
                inputStream = in;
                return true;
            }

            // 1.01 features
            // TODO

            // 1.10 features
            // TODO
            if (minorVersion <= VERSION_1_50) {
                in.skip(VGM_DEFAULT_DATA_OFFSET - VGM_1_00_EOH);
                in.mark((int) (vgmLength - VGM_DEFAULT_DATA_OFFSET));
                inputStream = in;
                return true;
            }

            // 1.50 features
            // TODO
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
