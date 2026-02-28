/** @file gb/hardware.h
    Defines that let the GB's hardware registers be accessed
    from C.

    See the @ref Pandocs for more details on each register.
*/
#ifndef _HARDWARE_H
#define _HARDWARE_H

#include "types.h"

/* Simplified macros for old SDCC syntax */
#define __REG volatile __sfr __at
#define __BYTE_REG volatile unsigned char __at

/** * Note: Memory regions like _VRAM and _RAM cannot use __sfr. 
 * They remain as extern pointers or arrays defined in the linker.
 */
#define __BYTES extern UBYTE

/** IO Registers - Defined with absolute addresses */

__REG(0xFF00) P1_REG;
#define rP1 P1_REG

__REG(0xFF01) SB_REG;
#define rSB SB_REG
__REG(0xFF02) SC_REG;
#define rSC SC_REG

__REG(0xFF04) DIV_REG;
#define rDIV DIV_REG
__REG(0xFF05) TIMA_REG;
#define rTIMA TIMA_REG
__REG(0xFF06) TMA_REG;
#define rTMA TMA_REG
__REG(0xFF07) TAC_REG;
#define rTAC TAC_REG

__REG(0xFF0F) IF_REG;
#define rIF IF_REG

/* Sound Registers */
__REG(0xFF10) NR10_REG;
#define rAUD1SWEEP NR10_REG
__REG(0xFF11) NR11_REG;
#define rAUD1LEN NR11_REG
__REG(0xFF12) NR12_REG;
#define rAUD1ENV NR12_REG
__REG(0xFF13) NR13_REG;
#define rAUD1LOW NR13_REG
__REG(0xFF14) NR14_REG;
#define rAUD1HIGH NR14_REG

__REG(0xFF16) NR21_REG;
#define rAUD2LEN NR21_REG
__REG(0xFF17) NR22_REG;
#define rAUD2ENV NR22_REG
__REG(0xFF18) NR23_REG;
#define rAUD2LOW NR23_REG
__REG(0xFF19) NR24_REG;
#define rAUD2HIGH NR24_REG

__REG(0xFF1A) NR30_REG;
#define rAUD3ENA NR30_REG
__REG(0xFF1B) NR31_REG;
#define rAUD3LEN NR31_REG
__REG(0xFF1C) NR32_REG;
#define rAUD3LEVEL NR32_REG
__REG(0xFF1D) NR33_REG;
#define rAUD3LOW NR33_REG
__REG(0xFF1E) NR34_REG;
#define rAUD3HIGH NR34_REG

__REG(0xFF20) NR41_REG;
#define rAUD4LEN NR41_REG
__REG(0xFF21) NR42_REG;
#define rAUD4ENV NR42_REG
__REG(0xFF22) NR43_REG;
#define rAUD4POLY NR43_REG
__REG(0xFF23) NR44_REG;
#define rAUD4GO NR44_REG

__REG(0xFF24) NR50_REG;
#define rAUDVOL NR50_REG
__REG(0xFF25) NR51_REG;
#define rAUDTERM NR51_REG
__REG(0xFF26) NR52_REG;
#define rAUDENA NR52_REG

/* LCD Registers */
__REG(0xFF40) LCDC_REG;
#define rLCDC LCDC_REG
__REG(0xFF41) STAT_REG;
#define rSTAT STAT_REG
__REG(0xFF42) SCY_REG;
#define rSCY SCY_REG
__REG(0xFF43) SCX_REG;
#define rSCX SCX_REG
__REG(0xFF44) LY_REG;
#define rLY LY_REG
__REG(0xFF45) LYC_REG;
#define rLYC LYC_REG
__REG(0xFF46) DMA_REG;
#define rDMA DMA_REG
__REG(0xFF47) BGP_REG;
#define rBGP BGP_REG
__REG(0xFF48) OBP0_REG;
#define rOBP0 OBP0_REG
__REG(0xFF49) OBP1_REG;
#define rOBP1 OBP1_REG
__REG(0xFF4A) WY_REG;
#define rWY WY_REG
__REG(0xFF4B) WX_REG;
#define rWX WX_REG

/* CGB Specific */
__REG(0xFF4D) KEY1_REG;
#define rKEY1 KEY1_REG
__REG(0xFF4F) VBK_REG;
#define rVBK VBK_REG
__REG(0xFF51) HDMA1_REG;
#define rHDMA1 HDMA1_REG
__REG(0xFF52) HDMA2_REG;
#define rHDMA2 HDMA2_REG
__REG(0xFF53) HDMA3_REG;
#define rHDMA3 HDMA3_REG
__REG(0xFF54) HDMA4_REG;
#define rHDMA4 HDMA4_REG
__REG(0xFF55) HDMA5_REG;
#define rHDMA5 HDMA5_REG
__REG(0xFF68) BCPS_REG;
#define rBCPS BCPS_REG
__REG(0xFF69) BCPD_REG;
#define rBCPD BCPD_REG
__REG(0xFF6A) OCPS_REG;
#define rOCPS OCPS_REG
__REG(0xFF6B) OCPD_REG;
#define rOCPD OCPD_REG
__REG(0xFF70) SVBK_REG;
#define rSVBK SVBK_REG

__REG(0xFFFF) IE_REG;
#define rIE IE_REG

/** Memory map */

#define _VRAM        ((UBYTE *)0x8000)
#define _SRAM        ((UBYTE *)0xA000)
#define _RAM         ((UBYTE *)0xC000)
#define _OAMRAM      ((UBYTE *)0xFE00)
#define _AUD3WAVERAM ((UBYTE *)0xFF30)
#define _HRAM        ((UBYTE *)0xFF80)

#define TILE_DATA   ((volatile uint8_t *)0x8000)  /* 384 tiles × 16 bytes  */
#define BG_MAP      ((volatile uint8_t *)0x9800)  /* 32×32 tile map        */

#define P1F_5 0b00100000
#define P1F_4 0b00010000
#define P1F_3 0b00001000
#define P1F_2 0b00000100
#define P1F_1 0b00000010
#define P1F_0 0b00000001

#define P1F_GET_DPAD P1F_5
#define P1F_GET_BTN  P1F_4
#define P1F_GET_NONE (P1F_4 | P1F_5)

#define SIOF_XFER_START     0b10000000 /**< Serial IO: Start Transfer. Automatically cleared at the end of transfer */
#define SIOF_CLOCK_INT      0b00000001 /**< Serial IO: Use Internal clock */
#define SIOF_CLOCK_EXT      0b00000000 /**< Serial IO: Use External clock */
#define SIOF_SPEED_1X       0b00000000 /**< Serial IO: If internal clock then 8KHz mode, 1KB/s (16Khz in CGB high-speed mode, 2KB/s) */
#define SIOF_SPEED_32X      0b00000010 /**< Serial IO: **CGB-Mode ONLY** If internal clock then 256KHz mode, 32KB/s (512KHz in CGB high-speed mode, 64KB/s) */
#define SIOF_B_CLOCK        0
#define SIOF_B_SPEED        1
#define SIOF_B_XFER_START   7
#define SCF_START           SIOF_XFER_START
#define SCF_SOURCE          SIOF_CLOCK_INT
#define SCF_SPEED           SIOF_SPEED_32X

#define TACF_START  0b00000100
#define TACF_STOP   0b00000000
#define TACF_4KHZ   0b00000000
#define TACF_16KHZ  0b00000011
#define TACF_65KHZ  0b00000010
#define TACF_262KHZ 0b00000001

#define AUDVOL_VOL_LEFT(x)  ((x) << 4)     /**< For Sound Master Volume, NR50: Left Volume, Range: 0-7 */
#define AUDVOL_VOL_RIGHT(x) ((x))          /**< For Sound Master Volume, NR50: Right Volume, Range: 0-7 */
#define AUDVOL_VIN_LEFT         0b10000000 /**< For Sound Master Volume, NR50: Cart external sound input (VIN) Left bit, 1 = ON, 0 = OFF */
#define AUDVOL_VIN_RIGHT        0b00001000 /**< For Sound Master Volume, NR50: Cart external sound input (VIN) Right bit, 1 = ON, 0 = OFF */

#define AUDTERM_4_LEFT  0b10000000 /**< For Sound Panning, NR51: Channel 4 Left bit, 1 = ON, 0 = OFF */
#define AUDTERM_3_LEFT  0b01000000 /**< For Sound Panning, NR51: Channel 3 Left bit, 1 = ON, 0 = OFF */
#define AUDTERM_2_LEFT  0b00100000 /**< For Sound Panning, NR51: Channel 2 Left bit, 1 = ON, 0 = OFF */
#define AUDTERM_1_LEFT  0b00010000 /**< For Sound Panning, NR51: Channel 1 Left bit, 1 = ON, 0 = OFF */
#define AUDTERM_4_RIGHT 0b00001000 /**< For Sound Panning, NR51: Channel 4 Right bit, 1 = ON, 0 = OFF */
#define AUDTERM_3_RIGHT 0b00000100 /**< For Sound Panning, NR51: Channel 4 Right bit, 1 = ON, 0 = OFF */
#define AUDTERM_2_RIGHT 0b00000010 /**< For Sound Panning, NR51: Channel 4 Right bit, 1 = ON, 0 = OFF */
#define AUDTERM_1_RIGHT 0b00000001 /**< For Sound Panning, NR51: Channel 4 Right bit, 1 = ON, 0 = OFF */

#define AUDENA_ON    0b10000000 /**< For Sound Master Control, NR52: Sound ON */
#define AUDENA_OFF   0b00000000 /**< For Sound Master Control, NR52: Sound OFF */

#if defined(__TARGET_ap)
#define LCDCF_OFF       0b00000000
#define LCDCF_ON        0b00000001
#define LCDCF_WIN9800   0b00000000
#define LCDCF_WIN9C00   0b00000010
#define LCDCF_WINOFF    0b00000000
#define LCDCF_WINON     0b00000100
#define LCDCF_BG8800    0b00000000
#define LCDCF_BG8000    0b00001000
#define LCDCF_BG9800    0b00000000
#define LCDCF_BG9C00    0b00010000
#define LCDCF_OBJ8      0b00000000
#define LCDCF_OBJ16     0b00100000
#define LCDCF_OBJOFF    0b00000000
#define LCDCF_OBJON     0b01000000
#define LCDCF_BGOFF     0b00000000
#define LCDCF_BGON      0b10000000
#define LCDCF_B_ON      0
#define LCDCF_B_WIN9C00 1
#define LCDCF_B_WINON   2
#define LCDCF_B_BG8000  3
#define LCDCF_B_BG9C00  4
#define LCDCF_B_OBJ16   5
#define LCDCF_B_OBJON   6
#define LCDCF_B_BGON    7
#elif defined(__TARGET_duck)
#define LCDCF_OFF       0b00000000
#define LCDCF_ON        0b10000000
#define LCDCF_WIN9800   0b00000000
#define LCDCF_WIN9C00   0b00001000
#define LCDCF_WINOFF    0b00000000
#define LCDCF_WINON     0b00100000
#define LCDCF_BG8800    0b00000000
#define LCDCF_BG8000    0b00010000
#define LCDCF_BG9800    0b00000000
#define LCDCF_BG9C00    0b00000100
#define LCDCF_OBJ8      0b00000000
#define LCDCF_OBJ16     0b00000010
#define LCDCF_OBJOFF    0b00000000
#define LCDCF_OBJON     0b00000001
#define LCDCF_BGOFF     0b00000000
#define LCDCF_BGON      0b01000000
#define LCDCF_B_ON      7
#define LCDCF_B_WIN9C00 3
#define LCDCF_B_WINON   5
#define LCDCF_B_BG8000  4
#define LCDCF_B_BG9C00  2
#define LCDCF_B_OBJ16   1
#define LCDCF_B_OBJON   0
#define LCDCF_B_BGON    6
#else
#define LCDCF_OFF       0b00000000 /**< LCD Control: Off */
#define LCDCF_ON        0b10000000 /**< LCD Control: On */
#define LCDCF_WIN9800   0b00000000 /**< Window Tile Map: Use 9800 Region */
#define LCDCF_WIN9C00   0b01000000 /**< Window Tile Map: Use 9C00 Region */
#define LCDCF_WINOFF    0b00000000 /**< Window Display: Hidden */
#define LCDCF_WINON     0b00100000 /**< Window Display: Visible */
#define LCDCF_BG8800    0b00000000 /**< BG & Window Tile Data: Use 8800 Region */
#define LCDCF_BG8000    0b00010000 /**< BG & Window Tile Data: Use 8000 Region */
#define LCDCF_BG9800    0b00000000 /**< BG Tile Map: use 9800 Region */
#define LCDCF_BG9C00    0b00001000 /**< BG Tile Map: use 9C00 Region */
#define LCDCF_OBJ8      0b00000000 /**< Sprites Size: 8x8 pixels */
#define LCDCF_OBJ16     0b00000100 /**< Sprites Size: 8x16 pixels */
#define LCDCF_OBJOFF    0b00000000 /**< Sprites Display: Hidden */
#define LCDCF_OBJON     0b00000010 /**< Sprites Display: Visible */
#define LCDCF_BGOFF     0b00000000 /**< Background Display: Hidden */
#define LCDCF_BGON      0b00000001 /**< Background Display: Visible */
#define LCDCF_B_ON      7          /**< Bit for LCD On/Off Select */
#define LCDCF_B_WIN9C00 6          /**< Bit for Window Tile Map Region Select */
#define LCDCF_B_WINON   5          /**< Bit for Window Display On/Off Control */
#define LCDCF_B_BG8000  4          /**< Bit for BG & Window Tile Data Region Select */
#define LCDCF_B_BG9C00  3          /**< Bit for BG Tile Map Region Select */
#define LCDCF_B_OBJ16   2          /**< Bit for Sprites Size Select */
#define LCDCF_B_OBJON   1          /**< Bit for Sprites Display Visible/Hidden Select */
#define LCDCF_B_BGON    0          /**< Bit for Background Display Visible/Hidden Select */
#endif

#if defined(__TARGET_ap)
#define STATF_LYC       0b00000010
#define STATF_MODE10    0b00000100
#define STATF_MODE01    0b00001000
#define STATF_MODE00    0b00010000
#define STATF_LYCF      0b00100000
#define STATF_HBL       0b00000000
#define STATF_VBL       0b10000000
#define STATF_OAM       0b01000000
#define STATF_LCD       0b11000000
#define STATF_BUSY      0b01000000
#define STATF_B_LYC     1
#define STATF_B_MODE10  2
#define STATF_B_MODE01  3
#define STATF_B_MODE00  4
#define STATF_B_LYCF    5
#define STATF_B_VBL     7
#define STATF_B_OAM     6
#define STATF_B_BUSY    6
#else
#define STATF_LYC     0b01000000  /**< STAT Interrupt: LYC=LY Coincidence Source Enable */
#define STATF_MODE10  0b00100000  /**< STAT Interrupt: Mode 2 OAM Source Enable */
#define STATF_MODE01  0b00010000  /**< STAT Interrupt: Mode 1 VBlank Source Enable */
#define STATF_MODE00  0b00001000  /**< STAT Interrupt: Mode 0 HBlank Source Enable  */
#define STATF_LYCF    0b00000100  /**< LYC=LY Coincidence Status Flag, Set when LY contains the same value as LYC */
#define STATF_HBL     0b00000000  /**< Current LCD Mode is: 0, in H-Blank */
#define STATF_VBL     0b00000001  /**< Current LCD Mode is: 1, in V-Blank */
#define STATF_OAM     0b00000010  /**< Current LCD Mode is: 2, in OAM-RAM is used by system (Searching OAM) */
#define STATF_LCD     0b00000011  /**< Current LCD Mode is: 3, both OAM and VRAM used by system (Transferring Data to LCD Controller) */
#define STATF_BUSY    0b00000010  /**< When set, VRAM access is unsafe */
#define STATF_B_LYC     6         /**< Bit for STAT Interrupt: LYC=LY Coincidence Source Enable */
#define STATF_B_MODE10  5         /**< Bit for STAT Interrupt: Mode 2 OAM Source Enable */
#define STATF_B_MODE01  4         /**< Bit for STAT Interrupt: Mode 1 VBlank Source Enable */
#define STATF_B_MODE00  3         /**< Bit for STAT Interrupt: Mode 0 HBlank Source Enable  */
#define STATF_B_LYCF    2         /**< Bit for LYC=LY Coincidence Status Flag */
#define STATF_B_VBL     0         /**< */
#define STATF_B_OAM     1         /**< */
#define STATF_B_BUSY    1         /**< Bit for when VRAM access is unsafe */
#endif

#define rKEY1 KEY1_REG
#define rSPD  KEY1_REG

#define KEY1F_DBLSPEED 0b10000000
#define KEY1F_PREPARE  0b00000001

#define VBK_BANK_0      0        /**< Select Regular Map and Normal Tiles (CGB Mode Only) */
#define VBK_TILES       0        /**< Select Regular Map and Normal Tiles (CGB Mode Only) */
#define VBK_BANK_1      1        /**< Select Map Attributes and Extra Tile Bank (CGB Mode Only)*/
#define VBK_ATTRIBUTES  1        /**< Select Map Attributes and Extra Tile Bank (CGB Mode Only) */

#define BKGF_PRI      0b10000000  /**< Background CGB BG and Window over Sprite priority Enabled */
#define BKGF_YFLIP    0b01000000  /**< Background CGB Y axis flip: Vertically mirrored */
#define BKGF_XFLIP    0b00100000  /**< Background CGB X axis flip: Horizontally mirrored */
#define BKGF_BANK0    0b00000000  /**< Background CGB Tile VRAM-Bank: Use Bank 0 (CGB Mode Only) */
#define BKGF_BANK1    0b00001000  /**< Background CGB Tile VRAM-Bank: Use Bank 1 (CGB Mode Only) */

#define BKGF_CGB_PAL0 0b00000000  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL1 0b00000001  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL2 0b00000010  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL3 0b00000011  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL4 0b00000100  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL5 0b00000101  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL6 0b00000110  /**< Background CGB Palette number (CGB Mode Only) */
#define BKGF_CGB_PAL7 0b00000111  /**< Background CGB Palette number (CGB Mode Only) */

#define HDMA5F_MODE_GP  0b00000000
#define HDMA5F_MODE_HBL 0b10000000

#define HDMA5F_BUSY 0b10000000

#define RPF_ENREAD   0b11000000
#define RPF_DATAIN   0b00000010
#define RPF_WRITE_HI 0b00000001
#define RPF_WRITE_LO 0b00000000

#define OCPSF_AUTOINC 0b10000000

#define IEF_HILO   0b00010000  /**< Joypad interrupt enable flag */
#define IEF_SERIAL 0b00001000  /**< Serial interrupt enable flag */
#define IEF_TIMER  0b00000100  /**< Timer  interrupt enable flag */
#define IEF_STAT   0b00000010  /**< Stat   interrupt enable flag */
#define IEF_VBLANK 0b00000001  /**< VBlank interrupt enable flag */


/* Square wave duty cycle */
#define AUDLEN_DUTY_12_5 0b00000000
#define AUDLEN_DUTY_25   0b01000000
#define AUDLEN_DUTY_50   0b10000000
#define AUDLEN_DUTY_75   0b11000000
#define AUDLEN_LENGTH(x) (x)

/* Audio envelope flags */
#define AUDENV_VOL(x)    ((x) << 4)
#define AUDENV_UP        0b00001000
#define AUDENV_DOWN      0b00000000
#define AUDENV_LENGTH(x) (x)

/* Audio trigger flags */
#define AUDHIGH_RESTART    0b10000000
#define AUDHIGH_LENGTH_ON  0b01000000
#define AUDHIGH_LENGTH_OFF 0b00000000

/* OAM attributes flags */
#define OAMF_PRI      0b10000000  /**< BG and Window over Sprite Enabled */
#define OAMF_YFLIP    0b01000000  /**< Sprite Y axis flip: Vertically mirrored */
#define OAMF_XFLIP    0b00100000  /**< Sprite X axis flip: Horizontally mirrored */
#define OAMF_PAL0     0b00000000  /**< Sprite Palette number: use OBP0 (Non-CGB Mode Only) */
#define OAMF_PAL1     0b00010000  /**< Sprite Palette number: use OBP1 (Non-CGB Mode Only) */
#define OAMF_BANK0    0b00000000  /**< Sprite Tile VRAM-Bank: Use Bank 0 (CGB Mode Only) */
#define OAMF_BANK1    0b00001000  /**< Sprite Tile VRAM-Bank: Use Bank 1 (CGB Mode Only) */

#define OAMF_CGB_PAL0 0b00000000  /**< Sprite CGB Palette number: use OCP0 (CGB Mode Only) */
#define OAMF_CGB_PAL1 0b00000001  /**< Sprite CGB Palette number: use OCP1 (CGB Mode Only) */
#define OAMF_CGB_PAL2 0b00000010  /**< Sprite CGB Palette number: use OCP2 (CGB Mode Only) */
#define OAMF_CGB_PAL3 0b00000011  /**< Sprite CGB Palette number: use OCP3 (CGB Mode Only) */
#define OAMF_CGB_PAL4 0b00000100  /**< Sprite CGB Palette number: use OCP4 (CGB Mode Only) */
#define OAMF_CGB_PAL5 0b00000101  /**< Sprite CGB Palette number: use OCP5 (CGB Mode Only) */
#define OAMF_CGB_PAL6 0b00000110  /**< Sprite CGB Palette number: use OCP6 (CGB Mode Only) */
#define OAMF_CGB_PAL7 0b00000111  /**< Sprite CGB Palette number: use OCP7 (CGB Mode Only) */

#define OAMF_PALMASK 0b00000111   /**< Mask for Sprite CGB Palette number (CGB Mode Only) */

#define DEVICE_SCREEN_X_OFFSET 0        /**< Offset of visible screen (in tile units) from left edge of hardware map */
#define DEVICE_SCREEN_Y_OFFSET 0        /**< Offset of visible screen (in tile units) from top edge of hardware map */
#define DEVICE_SCREEN_WIDTH 20          /**< Width of visible screen in tile units */
#define DEVICE_SCREEN_HEIGHT 18         /**< Height of visible screen in tile units */
#define DEVICE_SCREEN_BUFFER_WIDTH 32   /**< Width of hardware map buffer in tile units */
#define DEVICE_SCREEN_BUFFER_HEIGHT 32  /**< Height of hardware map buffer in tile units */
#define DEVICE_SCREEN_MAP_ENTRY_SIZE 1  /**< Number of bytes per hardware map entry */
#define DEVICE_SPRITE_PX_OFFSET_X 8     /**< Offset of sprite X coordinate origin (in pixels) from left edge of visible screen */
#define DEVICE_SPRITE_PX_OFFSET_Y 16    /**< Offset of sprite Y coordinate origin (in pixels) from top edge of visible screen */
#define DEVICE_WINDOW_PX_OFFSET_X 7     /**< Minimal X coordinate of the window layer */
#define DEVICE_WINDOW_PX_OFFSET_Y 0     /**< Minimal Y coordinate of the window layer */
#define DEVICE_SCREEN_PX_WIDTH (DEVICE_SCREEN_WIDTH * 8)   /**< Width of visible screen in pixels */
#define DEVICE_SCREEN_PX_HEIGHT (DEVICE_SCREEN_HEIGHT * 8) /**< Height of visible screen in pixels */

#endif
