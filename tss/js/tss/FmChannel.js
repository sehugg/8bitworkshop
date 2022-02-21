/**
 * T'SoundSystem for JavaScript
 */

/**
 * FmChannel prototype
 *
 * This prototype implements FM sound channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */

var FmChannel = function () {
}

FmChannel._ENV_LENGTH = 1024;
FmChannel._ENV_STEP = 128 / FmChannel._ENV_LENGTH;
FmChannel._TL_RESOLUTION = 256;
FmChannel._SIN_DB_LENGTH = 1024;
FmChannel._SIN_DB_TABLE = new Int16Array(FmChannel._SIN_DB_LENGTH);  // 0~4275
FmChannel._SIN_DB_RESOLUTION = 13;  // log2(4275) < 13
FmChannel._DB_OUT_LENGTH = 2 * FmChannel._SIN_DB_RESOLUTION *
        FmChannel._TL_RESOLUTION;  // doubled for plus and minus values.
FmChannel._DB_OUT_TABLE = new Int16Array(FmChannel._DB_OUT_LENGTH);

// Calculate tables.
(function () {
    var i, j;
    for (i = 0; i < FmChannel._TL_RESOLUTION; i++) {
        var n = (2048 / Math.pow(2, (i + 1) / FmChannel._TL_RESOLUTION) +
                0.5) << 2;
        for (j = 0; j < FmChannel._SIN_DB_RESOLUTION; j++) {
            FmChannel._DB_OUT_TABLE[
                    i * 2 + 0 + j * 2 * FmChannel._TL_RESOLUTION] = n >> j;
            FmChannel._DB_OUT_TABLE[
                    i * 2 + 1 + j * 2 * FmChannel._TL_RESOLUTION] = -n >> j;
        }
    }
    for (i = 0; i < FmChannel._SIN_DB_LENGTH; i++) {
        var w = (2 * i + 1) * Math.PI / FmChannel._SIN_DB_LENGTH;
        var sin = Math.sin(w);
        // log = 32 / FmChannel._ENV_STEP * log2(1 / |sin|)
        var absSin = (sin > 0) ? sin : -sin;
        var log = -32 / FmChannel._ENV_STEP * Math.log(absSin) / Math.LN2;
        // Convert log value to offset at FmChannel._DB_OUT_TABLE.
        // LSB of the table offset means sign of the value.
        // The table will contain from 0 to 4275 values.
        FmChannel._SIN_DB_TABLE[i] = (log + 0.5) << 1;
        if (sin < 0)
            FmChannel._SIN_DB_TABLE[i] |= 1;
    }
})();
