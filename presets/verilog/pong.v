/* verilator lint_off UNOPTFLAT */
// Listing 13.7
module bitmap_gen
   (
    input wire clk, reset,
    input wire video_on,
    input [1:0] btn,
    input [2:0] sw,
    input wire [9:0] pix_x, pix_y,
    output reg [2:0] bit_rgb
   );

   // constant and signal declaration
   wire refr_tick, load_tick;
   //--------------------------------------------
   // video sram
   //--------------------------------------------
   wire we;
   wire [13:0] addr_r, addr_w;
   wire [2:0] din, dout;
   //--------------------------------------------
   // dot location and velocity
   //--------------------------------------------
   localparam MAX_X = 128;
   localparam MAX_Y = 128;
   // dot velocity can be pos or neg
   localparam DOT_V_P = 1;
   localparam DOT_V_N = -1;
   // reg to keep track of dot location
   reg [6:0] dot_x_reg, dot_y_reg;
   wire [6:0] dot_x_next, dot_y_next;
   // reg to keep track of dot velocity
   reg [6:0] v_x_reg, v_y_reg;
   wire [6:0] v_x_next, v_y_next;
   //--------------------------------------------
   // object output signals
   //--------------------------------------------
   wire bitmap_on;
   wire [2:0] bitmap_rgb;

   // body
   // instantiate debounce circuit for a button
   debounce deb_unit
      (.clk(clk), .reset(reset), .sw(btn[0]),
       .db_level(), .db_tick(load_tick));
   // instantiate dual-port video RAM (2^12-by-7)
   xilinx_dual_port_ram_sync
      #(.ADDR_WIDTH(14), .DATA_WIDTH(3)) video_ram
      (.clk(clk), .we(we), .addr_a(addr_w), .addr_b(addr_r),
       .din_a(din), .dout_a(), .dout_b(dout));
   // video ram interface
   assign addr_w = {dot_y_reg, dot_x_reg};
   assign addr_r = {pix_y[6:0], pix_x[6:0]};
   assign we = 1'b1;
   assign din = sw;
   assign bitmap_rgb = dout;
   // registers
   always @(posedge clk, posedge reset)
      if (reset)
         begin
            dot_x_reg <= 0;
            dot_y_reg <= 0;
            v_x_reg <= DOT_V_P;
            v_y_reg <= DOT_V_P;
         end
      else
         begin
            dot_x_reg <= dot_x_next;
            dot_y_reg <= dot_y_next;
            v_x_reg <= v_x_next;
            v_y_reg <= v_y_next;
         end

   // refr_tick: 1-clock tick asserted at start of v-sync
   assign refr_tick = (pix_y==481) && (pix_x==0);

   // pixel within bit map area
   assign bitmap_on =(pix_x<=127) & (pix_y<=127);
   // dot position
   // "randomly" load dot location when btn[0] pressed
   assign dot_x_next = (load_tick) ? pix_x[6:0] :
                       (refr_tick) ? dot_x_reg + v_x_reg :
                       dot_x_reg ;
   assign dot_y_next = (load_tick) ? pix_y[6:0] :
                       (refr_tick) ? dot_y_reg + v_y_reg :
                       dot_y_reg ;
   // dot x velocity
   assign v_x_next =
        (dot_x_reg==1) ? DOT_V_P :         // reach left
        (dot_x_reg==(MAX_X-2)) ? DOT_V_N : // reach right
         v_x_reg;
   // dot y velocity
   assign v_y_next =
        (dot_y_reg==1) ? DOT_V_P :         // reach top
        (dot_y_reg==(MAX_Y-2)) ? DOT_V_N : // reach bottom
         v_y_reg;
   //--------------------------------------------
   // rgb multiplexing circuit
   //--------------------------------------------
   always @*
      if (~video_on)
         bit_rgb = 3'b000; // blank
      else
         if (bitmap_on)
            bit_rgb = bitmap_rgb;
         else
            bit_rgb = 3'b110; // yellow background

endmodule
// Listing 6.2
module debounce
   (
    input wire clk, reset,
    input wire sw,
    output reg db_level, db_tick
   );

   // symbolic state declaration
   localparam  [1:0]
               zero  = 2'b00,
               wait0 = 2'b01,
               one   = 2'b10,
               wait1 = 2'b11;

   // number of counter bits (2^N * 20ns = 40ms)
   localparam N=21;

   // signal declaration
   reg [N-1:0] q_reg, q_next;
   reg [1:0] state_reg, state_next;

   // body
   // fsmd state & data registers
    always @(posedge clk, posedge reset)
       if (reset)
          begin
             state_reg <= zero;
             q_reg <= 0;
          end
       else
          begin
             state_reg <= state_next;
             q_reg <= q_next;
          end

   // next-state logic & data path functional units/routing
   always @*
   begin
      state_next = state_reg;   // default state: the same
      q_next = q_reg;           // default q: unchnaged
      db_tick = 1'b0;           // default output: 0
      case (state_reg)
         zero:
            begin
               db_level = 1'b0;
               if (sw)
                  begin
                     state_next = wait1;
                     q_next = {N{1'b1}}; // load 1..1
                  end
            end
         wait1:
            begin
               db_level = 1'b0;
               if (sw)
                  begin
                     q_next = q_reg - 1;
                     if (q_next==0)
                        begin
                           state_next = one;
                           db_tick = 1'b1;
                        end
                  end
               else // sw==0
                  state_next = zero;
            end
         one:
            begin
               db_level = 1'b1;
               if (~sw)
                  begin
                     state_next = wait0;
                     q_next = {N{1'b1}}; // load 1..1
                  end
            end
         wait0:
            begin
               db_level = 1'b1;
               if (~sw)
                  begin
                     q_next = q_reg - 1;
                     if (q_next==0)
                        state_next = zero;
                  end
               else // sw==1
                  state_next = one;

            end
         default: state_next = zero;
      endcase
   end

endmodule
// Listing 13.8
module dot_top
   (
    input wire clk, reset,
    input wire [1:0] btn,
    input wire [2:0] sw,
    output wire hsync, vsync,
    output wire [2:0] rgb
   );

   // signal declaration
   wire [9:0] pixel_x, pixel_y;
   wire video_on, pixel_tick;
   reg [2:0] rgb_reg;
   wire [2:0] rgb_next;

   // body
   // instantiate VGA sync circuit
   vga_sync vsync_unit
      (.clk(clk), .reset(reset), .hsync(hsync), .vsync(vsync),
       .video_on(video_on), .p_tick(pixel_tick),
       .pixel_x(pixel_x), .pixel_y(pixel_y));

   // instantiate graphic generator
   bitmap_gen bitmap_unit
      (.clk(clk), .reset(reset), .btn(btn), .sw(sw),
       .video_on(video_on), .pix_x(pixel_x),
       .pix_y(pixel_y), .bit_rgb(rgb_next));

   // rgb buffer
   always @(posedge clk)
      if (pixel_tick)
         rgb_reg <= rgb_next;
   // output
   assign rgb = rgb_reg;

endmodule

// ROM with synchonous read (inferring Block RAM)
// character ROM
//  - 8-by-16 (8-by-2^4) font
//  - 128 (2^7) characters
//  - ROM size: 512-by-8 (2^11-by-8) bits
//              16K bits: 1 BRAM

module font_rom
   (
    input wire clk,
    input wire [10:0] addr,
    output reg [7:0] data
   );
   
   // signal declaration
   reg [10:0] addr_reg; 

   // body
   always @(posedge clk) 
      addr_reg <= addr;
      
   always @*
      case (addr_reg)
         //code x00
         11'h000: data = 8'b00000000; // 
         11'h001: data = 8'b00000000; // 
         11'h002: data = 8'b00000000; // 
         11'h003: data = 8'b00000000; // 
         11'h004: data = 8'b00000000; // 
         11'h005: data = 8'b00000000; // 
         11'h006: data = 8'b00000000; // 
         11'h007: data = 8'b00000000; // 
         11'h008: data = 8'b00000000; // 
         11'h009: data = 8'b00000000; // 
         11'h00a: data = 8'b00000000; // 
         11'h00b: data = 8'b00000000; // 
         11'h00c: data = 8'b00000000; // 
         11'h00d: data = 8'b00000000; // 
         11'h00e: data = 8'b00000000; // 
         11'h00f: data = 8'b00000000; // 
         //code x01
         11'h010: data = 8'b00000000; // 
         11'h011: data = 8'b00000000; // 
         11'h012: data = 8'b01111110; //  ******
         11'h013: data = 8'b10000001; // *      *
         11'h014: data = 8'b10100101; // * *  * *
         11'h015: data = 8'b10000001; // *      *
         11'h016: data = 8'b10000001; // *      *
         11'h017: data = 8'b10111101; // * **** *
         11'h018: data = 8'b10011001; // *  **  *
         11'h019: data = 8'b10000001; // *      *
         11'h01a: data = 8'b10000001; // *      *
         11'h01b: data = 8'b01111110; //  ******
         11'h01c: data = 8'b00000000; // 
         11'h01d: data = 8'b00000000; // 
         11'h01e: data = 8'b00000000; // 
         11'h01f: data = 8'b00000000; // 
         //code x02
         11'h020: data = 8'b00000000; // 
         11'h021: data = 8'b00000000; // 
         11'h022: data = 8'b01111110; //  ******
         11'h023: data = 8'b11111111; // ********
         11'h024: data = 8'b11011011; // ** ** **
         11'h025: data = 8'b11111111; // ********
         11'h026: data = 8'b11111111; // ********
         11'h027: data = 8'b11000011; // **    **
         11'h028: data = 8'b11100111; // ***  ***
         11'h029: data = 8'b11111111; // ********
         11'h02a: data = 8'b11111111; // ********
         11'h02b: data = 8'b01111110; //  ******
         11'h02c: data = 8'b00000000; // 
         11'h02d: data = 8'b00000000; // 
         11'h02e: data = 8'b00000000; // 
         11'h02f: data = 8'b00000000; // 
         //code x03
         11'h030: data = 8'b00000000; // 
         11'h031: data = 8'b00000000; // 
         11'h032: data = 8'b00000000; // 
         11'h033: data = 8'b00000000; // 
         11'h034: data = 8'b01101100; //  ** **
         11'h035: data = 8'b11111110; // *******
         11'h036: data = 8'b11111110; // *******
         11'h037: data = 8'b11111110; // *******
         11'h038: data = 8'b11111110; // *******
         11'h039: data = 8'b01111100; //  *****
         11'h03a: data = 8'b00111000; //   ***
         11'h03b: data = 8'b00010000; //    *
         11'h03c: data = 8'b00000000; // 
         11'h03d: data = 8'b00000000; // 
         11'h03e: data = 8'b00000000; // 
         11'h03f: data = 8'b00000000; // 
         //code x04
         11'h040: data = 8'b00000000; // 
         11'h041: data = 8'b00000000; // 
         11'h042: data = 8'b00000000; // 
         11'h043: data = 8'b00000000; // 
         11'h044: data = 8'b00010000; //    *
         11'h045: data = 8'b00111000; //   ***
         11'h046: data = 8'b01111100; //  *****
         11'h047: data = 8'b11111110; // *******
         11'h048: data = 8'b01111100; //  *****
         11'h049: data = 8'b00111000; //   ***
         11'h04a: data = 8'b00010000; //    *
         11'h04b: data = 8'b00000000; // 
         11'h04c: data = 8'b00000000; // 
         11'h04d: data = 8'b00000000; // 
         11'h04e: data = 8'b00000000; // 
         11'h04f: data = 8'b00000000; // 
         //code x05
         11'h050: data = 8'b00000000; // 
         11'h051: data = 8'b00000000; // 
         11'h052: data = 8'b00000000; // 
         11'h053: data = 8'b00011000; //    **
         11'h054: data = 8'b00111100; //   ****
         11'h055: data = 8'b00111100; //   ****
         11'h056: data = 8'b11100111; // ***  ***
         11'h057: data = 8'b11100111; // ***  ***
         11'h058: data = 8'b11100111; // ***  ***
         11'h059: data = 8'b00011000; //    **
         11'h05a: data = 8'b00011000; //    **
         11'h05b: data = 8'b00111100; //   ****
         11'h05c: data = 8'b00000000; // 
         11'h05d: data = 8'b00000000; // 
         11'h05e: data = 8'b00000000; // 
         11'h05f: data = 8'b00000000; // 
         //code x06
         11'h060: data = 8'b00000000; // 
         11'h061: data = 8'b00000000; // 
         11'h062: data = 8'b00000000; // 
         11'h063: data = 8'b00011000; //    **
         11'h064: data = 8'b00111100; //   ****
         11'h065: data = 8'b01111110; //  ******
         11'h066: data = 8'b11111111; // ********
         11'h067: data = 8'b11111111; // ********
         11'h068: data = 8'b01111110; //  ******
         11'h069: data = 8'b00011000; //    **
         11'h06a: data = 8'b00011000; //    **
         11'h06b: data = 8'b00111100; //   ****
         11'h06c: data = 8'b00000000; // 
         11'h06d: data = 8'b00000000; // 
         11'h06e: data = 8'b00000000; // 
         11'h06f: data = 8'b00000000; // 
         //code x07
         11'h070: data = 8'b00000000; // 
         11'h071: data = 8'b00000000; // 
         11'h072: data = 8'b00000000; // 
         11'h073: data = 8'b00000000; // 
         11'h074: data = 8'b00000000; // 
         11'h075: data = 8'b00000000; // 
         11'h076: data = 8'b00011000; //    **
         11'h077: data = 8'b00111100; //   ****
         11'h078: data = 8'b00111100; //   ****
         11'h079: data = 8'b00011000; //    **
         11'h07a: data = 8'b00000000; // 
         11'h07b: data = 8'b00000000; // 
         11'h07c: data = 8'b00000000; // 
         11'h07d: data = 8'b00000000; // 
         11'h07e: data = 8'b00000000; // 
         11'h07f: data = 8'b00000000; // 
         //code x08
         11'h080: data = 8'b11111111; // ********
         11'h081: data = 8'b11111111; // ********
         11'h082: data = 8'b11111111; // ********
         11'h083: data = 8'b11111111; // ********
         11'h084: data = 8'b11111111; // ********
         11'h085: data = 8'b11111111; // ********
         11'h086: data = 8'b11100111; // ***  ***
         11'h087: data = 8'b11000011; // **    **
         11'h088: data = 8'b11000011; // **    **
         11'h089: data = 8'b11100111; // ***  ***
         11'h08a: data = 8'b11111111; // ********
         11'h08b: data = 8'b11111111; // ********
         11'h08c: data = 8'b11111111; // ********
         11'h08d: data = 8'b11111111; // ********
         11'h08e: data = 8'b11111111; // ********
         11'h08f: data = 8'b11111111; // ********
         //code x09
         11'h090: data = 8'b00000000; // 
         11'h091: data = 8'b00000000; // 
         11'h092: data = 8'b00000000; // 
         11'h093: data = 8'b00000000; // 
         11'h094: data = 8'b00000000; // 
         11'h095: data = 8'b00111100; //   ****
         11'h096: data = 8'b01100110; //  **  **
         11'h097: data = 8'b01000010; //  *    *
         11'h098: data = 8'b01000010; //  *    *
         11'h099: data = 8'b01100110; //  **  **
         11'h09a: data = 8'b00111100; //   ****
         11'h09b: data = 8'b00000000; // 
         11'h09c: data = 8'b00000000; // 
         11'h09d: data = 8'b00000000; // 
         11'h09e: data = 8'b00000000; // 
         11'h09f: data = 8'b00000000; // 
         //code x0a
         11'h0a0: data = 8'b11111111; // ********
         11'h0a1: data = 8'b11111111; // ********
         11'h0a2: data = 8'b11111111; // ********
         11'h0a3: data = 8'b11111111; // ********
         11'h0a4: data = 8'b11111111; // ********
         11'h0a5: data = 8'b11000011; // **    **
         11'h0a6: data = 8'b10011001; // *  **  *
         11'h0a7: data = 8'b10111101; // * **** *
         11'h0a8: data = 8'b10111101; // * **** *
         11'h0a9: data = 8'b10011001; // *  **  *
         11'h0aa: data = 8'b11000011; // **    **
         11'h0ab: data = 8'b11111111; // ********
         11'h0ac: data = 8'b11111111; // ********
         11'h0ad: data = 8'b11111111; // ********
         11'h0ae: data = 8'b11111111; // ********
         11'h0af: data = 8'b11111111; // ********
         //code x0b
         11'h0b0: data = 8'b00000000; // 
         11'h0b1: data = 8'b00000000; // 
         11'h0b2: data = 8'b00011110; //    ****
         11'h0b3: data = 8'b00001110; //     ***
         11'h0b4: data = 8'b00011010; //    ** *
         11'h0b5: data = 8'b00110010; //   **  *
         11'h0b6: data = 8'b01111000; //  ****
         11'h0b7: data = 8'b11001100; // **  **
         11'h0b8: data = 8'b11001100; // **  **
         11'h0b9: data = 8'b11001100; // **  **
         11'h0ba: data = 8'b11001100; // **  **
         11'h0bb: data = 8'b01111000; //  ****
         11'h0bc: data = 8'b00000000; // 
         11'h0bd: data = 8'b00000000; // 
         11'h0be: data = 8'b00000000; // 
         11'h0bf: data = 8'b00000000; // 
         //code x0c
         11'h0c0: data = 8'b00000000; // 
         11'h0c1: data = 8'b00000000; // 
         11'h0c2: data = 8'b00111100; //   ****
         11'h0c3: data = 8'b01100110; //  **  **
         11'h0c4: data = 8'b01100110; //  **  **
         11'h0c5: data = 8'b01100110; //  **  **
         11'h0c6: data = 8'b01100110; //  **  **
         11'h0c7: data = 8'b00111100; //   ****
         11'h0c8: data = 8'b00011000; //    **
         11'h0c9: data = 8'b01111110; //  ******
         11'h0ca: data = 8'b00011000; //    **
         11'h0cb: data = 8'b00011000; //    **
         11'h0cc: data = 8'b00000000; // 
         11'h0cd: data = 8'b00000000; // 
         11'h0ce: data = 8'b00000000; // 
         11'h0cf: data = 8'b00000000; // 
         //code x0d
         11'h0d0: data = 8'b00000000; // 
         11'h0d1: data = 8'b00000000; // 
         11'h0d2: data = 8'b00111111; //   ******
         11'h0d3: data = 8'b00110011; //   **  **
         11'h0d4: data = 8'b00111111; //   ******
         11'h0d5: data = 8'b00110000; //   **
         11'h0d6: data = 8'b00110000; //   **
         11'h0d7: data = 8'b00110000; //   **
         11'h0d8: data = 8'b00110000; //   **
         11'h0d9: data = 8'b01110000; //  ***
         11'h0da: data = 8'b11110000; // ****
         11'h0db: data = 8'b11100000; // ***
         11'h0dc: data = 8'b00000000; // 
         11'h0dd: data = 8'b00000000; // 
         11'h0de: data = 8'b00000000; // 
         11'h0df: data = 8'b00000000; // 
         //code x0e
         11'h0e0: data = 8'b00000000; // 
         11'h0e1: data = 8'b00000000; // 
         11'h0e2: data = 8'b01111111; //  *******
         11'h0e3: data = 8'b01100011; //  **   **
         11'h0e4: data = 8'b01111111; //  *******
         11'h0e5: data = 8'b01100011; //  **   **
         11'h0e6: data = 8'b01100011; //  **   **
         11'h0e7: data = 8'b01100011; //  **   **
         11'h0e8: data = 8'b01100011; //  **   **
         11'h0e9: data = 8'b01100111; //  **  ***
         11'h0ea: data = 8'b11100111; // ***  ***
         11'h0eb: data = 8'b11100110; // ***  **
         11'h0ec: data = 8'b11000000; // **
         11'h0ed: data = 8'b00000000; // 
         11'h0ee: data = 8'b00000000; // 
         11'h0ef: data = 8'b00000000; // 
         //code x0f
         11'h0f0: data = 8'b00000000; // 
         11'h0f1: data = 8'b00000000; // 
         11'h0f2: data = 8'b00000000; // 
         11'h0f3: data = 8'b00011000; //    **
         11'h0f4: data = 8'b00011000; //    **
         11'h0f5: data = 8'b11011011; // ** ** **
         11'h0f6: data = 8'b00111100; //   ****
         11'h0f7: data = 8'b11100111; // ***  ***
         11'h0f8: data = 8'b00111100; //   ****
         11'h0f9: data = 8'b11011011; // ** ** **
         11'h0fa: data = 8'b00011000; //    **
         11'h0fb: data = 8'b00011000; //    **
         11'h0fc: data = 8'b00000000; // 
         11'h0fd: data = 8'b00000000; // 
         11'h0fe: data = 8'b00000000; // 
         11'h0ff: data = 8'b00000000; // 
         //code x10
         11'h100: data = 8'b00000000; // 
         11'h101: data = 8'b10000000; // *
         11'h102: data = 8'b11000000; // **
         11'h103: data = 8'b11100000; // ***
         11'h104: data = 8'b11110000; // ****
         11'h105: data = 8'b11111000; // *****
         11'h106: data = 8'b11111110; // *******
         11'h107: data = 8'b11111000; // *****
         11'h108: data = 8'b11110000; // ****
         11'h109: data = 8'b11100000; // ***
         11'h10a: data = 8'b11000000; // **
         11'h10b: data = 8'b10000000; // *
         11'h10c: data = 8'b00000000; // 
         11'h10d: data = 8'b00000000; // 
         11'h10e: data = 8'b00000000; // 
         11'h10f: data = 8'b00000000; // 
         //code x11
         11'h110: data = 8'b00000000; // 
         11'h111: data = 8'b00000010; //       *
         11'h112: data = 8'b00000110; //      **
         11'h113: data = 8'b00001110; //     ***
         11'h114: data = 8'b00011110; //    ****
         11'h115: data = 8'b00111110; //   *****
         11'h116: data = 8'b11111110; // *******
         11'h117: data = 8'b00111110; //   *****
         11'h118: data = 8'b00011110; //    ****
         11'h119: data = 8'b00001110; //     ***
         11'h11a: data = 8'b00000110; //      **
         11'h11b: data = 8'b00000010; //       *
         11'h11c: data = 8'b00000000; // 
         11'h11d: data = 8'b00000000; // 
         11'h11e: data = 8'b00000000; // 
         11'h11f: data = 8'b00000000; // 
         //code x12
         11'h120: data = 8'b00000000; // 
         11'h121: data = 8'b00000000; // 
         11'h122: data = 8'b00011000; //    **
         11'h123: data = 8'b00111100; //   ****
         11'h124: data = 8'b01111110; //  ******
         11'h125: data = 8'b00011000; //    **
         11'h126: data = 8'b00011000; //    **
         11'h127: data = 8'b00011000; //    **
         11'h128: data = 8'b01111110; //  ******
         11'h129: data = 8'b00111100; //   ****
         11'h12a: data = 8'b00011000; //    **
         11'h12b: data = 8'b00000000; // 
         11'h12c: data = 8'b00000000; // 
         11'h12d: data = 8'b00000000; // 
         11'h12e: data = 8'b00000000; // 
         11'h12f: data = 8'b00000000; // 
         //code x13
         11'h130: data = 8'b00000000; // 
         11'h131: data = 8'b00000000; // 
         11'h132: data = 8'b01100110; //  **  **
         11'h133: data = 8'b01100110; //  **  **
         11'h134: data = 8'b01100110; //  **  **
         11'h135: data = 8'b01100110; //  **  **
         11'h136: data = 8'b01100110; //  **  **
         11'h137: data = 8'b01100110; //  **  **
         11'h138: data = 8'b01100110; //  **  **
         11'h139: data = 8'b00000000; // 
         11'h13a: data = 8'b01100110; //  **  **
         11'h13b: data = 8'b01100110; //  **  **
         11'h13c: data = 8'b00000000; // 
         11'h13d: data = 8'b00000000; // 
         11'h13e: data = 8'b00000000; // 
         11'h13f: data = 8'b00000000; // 
         //code x14
         11'h140: data = 8'b00000000; // 
         11'h141: data = 8'b00000000; // 
         11'h142: data = 8'b01111111; //  *******
         11'h143: data = 8'b11011011; // ** ** **
         11'h144: data = 8'b11011011; // ** ** **
         11'h145: data = 8'b11011011; // ** ** **
         11'h146: data = 8'b01111011; //  **** **
         11'h147: data = 8'b00011011; //    ** **
         11'h148: data = 8'b00011011; //    ** **
         11'h149: data = 8'b00011011; //    ** **
         11'h14a: data = 8'b00011011; //    ** **
         11'h14b: data = 8'b00011011; //    ** **
         11'h14c: data = 8'b00000000; // 
         11'h14d: data = 8'b00000000; // 
         11'h14e: data = 8'b00000000; // 
         11'h14f: data = 8'b00000000; // 
         //code x15
         11'h150: data = 8'b00000000; // 
         11'h151: data = 8'b01111100; //  *****
         11'h152: data = 8'b11000110; // **   **
         11'h153: data = 8'b01100000; //  **
         11'h154: data = 8'b00111000; //   ***
         11'h155: data = 8'b01101100; //  ** **
         11'h156: data = 8'b11000110; // **   **
         11'h157: data = 8'b11000110; // **   **
         11'h158: data = 8'b01101100; //  ** **
         11'h159: data = 8'b00111000; //   ***
         11'h15a: data = 8'b00001100; //     **
         11'h15b: data = 8'b11000110; // **   **
         11'h15c: data = 8'b01111100; //  *****
         11'h15d: data = 8'b00000000; // 
         11'h15e: data = 8'b00000000; // 
         11'h15f: data = 8'b00000000; // 
         //code x16
         11'h160: data = 8'b00000000; // 
         11'h161: data = 8'b00000000; // 
         11'h162: data = 8'b00000000; // 
         11'h163: data = 8'b00000000; // 
         11'h164: data = 8'b00000000; // 
         11'h165: data = 8'b00000000; // 
         11'h166: data = 8'b00000000; // 
         11'h167: data = 8'b00000000; // 
         11'h168: data = 8'b11111110; // *******
         11'h169: data = 8'b11111110; // *******
         11'h16a: data = 8'b11111110; // *******
         11'h16b: data = 8'b11111110; // *******
         11'h16c: data = 8'b00000000; // 
         11'h16d: data = 8'b00000000; // 
         11'h16e: data = 8'b00000000; // 
         11'h16f: data = 8'b00000000; // 
         //code x17
         11'h170: data = 8'b00000000; // 
         11'h171: data = 8'b00000000; // 
         11'h172: data = 8'b00011000; //    **
         11'h173: data = 8'b00111100; //   ****
         11'h174: data = 8'b01111110; //  ******
         11'h175: data = 8'b00011000; //    **
         11'h176: data = 8'b00011000; //    **
         11'h177: data = 8'b00011000; //    **
         11'h178: data = 8'b01111110; //  ******
         11'h179: data = 8'b00111100; //   ****
         11'h17a: data = 8'b00011000; //    **
         11'h17b: data = 8'b01111110; //  ******
         11'h17c: data = 8'b00110000; // 
         11'h17d: data = 8'b00000000; // 
         11'h17e: data = 8'b00000000; // 
         11'h17f: data = 8'b00000000; // 
         //code x18
         11'h180: data = 8'b00000000; // 
         11'h181: data = 8'b00000000; // 
         11'h182: data = 8'b00011000; //    **
         11'h183: data = 8'b00111100; //   ****
         11'h184: data = 8'b01111110; //  ******
         11'h185: data = 8'b00011000; //    **
         11'h186: data = 8'b00011000; //    **
         11'h187: data = 8'b00011000; //    **
         11'h188: data = 8'b00011000; //    **
         11'h189: data = 8'b00011000; //    **
         11'h18a: data = 8'b00011000; //    **
         11'h18b: data = 8'b00011000; //    **
         11'h18c: data = 8'b00000000; // 
         11'h18d: data = 8'b00000000; // 
         11'h18e: data = 8'b00000000; // 
         11'h18f: data = 8'b00000000; // 
         //code x19
         11'h190: data = 8'b00000000; // 
         11'h191: data = 8'b00000000; // 
         11'h192: data = 8'b00011000; //    **
         11'h193: data = 8'b00011000; //    **
         11'h194: data = 8'b00011000; //    **
         11'h195: data = 8'b00011000; //    **
         11'h196: data = 8'b00011000; //    **
         11'h197: data = 8'b00011000; //    **
         11'h198: data = 8'b00011000; //    **
         11'h199: data = 8'b01111110; //  ******
         11'h19a: data = 8'b00111100; //   ****
         11'h19b: data = 8'b00011000; //    **
         11'h19c: data = 8'b00000000; // 
         11'h19d: data = 8'b00000000; // 
         11'h19e: data = 8'b00000000; // 
         11'h19f: data = 8'b00000000; // 
         //code x1a
         11'h1a0: data = 8'b00000000; // 
         11'h1a1: data = 8'b00000000; // 
         11'h1a2: data = 8'b00000000; // 
         11'h1a3: data = 8'b00000000; // 
         11'h1a4: data = 8'b00000000; // 
         11'h1a5: data = 8'b00011000; //    **
         11'h1a6: data = 8'b00001100; //     **
         11'h1a7: data = 8'b11111110; // *******
         11'h1a8: data = 8'b00001100; //     **
         11'h1a9: data = 8'b00011000; //    **
         11'h1aa: data = 8'b00000000; // 
         11'h1ab: data = 8'b00000000; // 
         11'h1ac: data = 8'b00000000; // 
         11'h1ad: data = 8'b00000000; // 
         11'h1ae: data = 8'b00000000; // 
         11'h1af: data = 8'b00000000; // 
         //code x1b
         11'h1b0: data = 8'b00000000; // 
         11'h1b1: data = 8'b00000000; // 
         11'h1b2: data = 8'b00000000; // 
         11'h1b3: data = 8'b00000000; // 
         11'h1b4: data = 8'b00000000; // 
         11'h1b5: data = 8'b00110000; //   **
         11'h1b6: data = 8'b01100000; //  **
         11'h1b7: data = 8'b11111110; // *******
         11'h1b8: data = 8'b01100000; //  **
         11'h1b9: data = 8'b00110000; //   **
         11'h1ba: data = 8'b00000000; // 
         11'h1bb: data = 8'b00000000; // 
         11'h1bc: data = 8'b00000000; // 
         11'h1bd: data = 8'b00000000; // 
         11'h1be: data = 8'b00000000; // 
         11'h1bf: data = 8'b00000000; // 
         //code x1c
         11'h1c0: data = 8'b00000000; // 
         11'h1c1: data = 8'b00000000; // 
         11'h1c2: data = 8'b00000000; // 
         11'h1c3: data = 8'b00000000; // 
         11'h1c4: data = 8'b00000000; // 
         11'h1c5: data = 8'b00000000; // 
         11'h1c6: data = 8'b11000000; // **
         11'h1c7: data = 8'b11000000; // **
         11'h1c8: data = 8'b11000000; // **
         11'h1c9: data = 8'b11111110; // *******
         11'h1ca: data = 8'b00000000; // 
         11'h1cb: data = 8'b00000000; // 
         11'h1cc: data = 8'b00000000; // 
         11'h1cd: data = 8'b00000000; // 
         11'h1ce: data = 8'b00000000; // 
         11'h1cf: data = 8'b00000000; // 
         //code x1d
         11'h1d0: data = 8'b00000000; // 
         11'h1d1: data = 8'b00000000; // 
         11'h1d2: data = 8'b00000000; // 
         11'h1d3: data = 8'b00000000; // 
         11'h1d4: data = 8'b00000000; // 
         11'h1d5: data = 8'b00100100; //   *  *
         11'h1d6: data = 8'b01100110; //  **  **
         11'h1d7: data = 8'b11111111; // ********
         11'h1d8: data = 8'b01100110; //  **  **
         11'h1d9: data = 8'b00100100; //   *  *
         11'h1da: data = 8'b00000000; // 
         11'h1db: data = 8'b00000000; // 
         11'h1dc: data = 8'b00000000; // 
         11'h1dd: data = 8'b00000000; // 
         11'h1de: data = 8'b00000000; // 
         11'h1df: data = 8'b00000000; // 
         //code x1e
         11'h1e0: data = 8'b00000000; // 
         11'h1e1: data = 8'b00000000; // 
         11'h1e2: data = 8'b00000000; // 
         11'h1e3: data = 8'b00000000; // 
         11'h1e4: data = 8'b00010000; //    *
         11'h1e5: data = 8'b00111000; //   ***
         11'h1e6: data = 8'b00111000; //   ***
         11'h1e7: data = 8'b01111100; //  *****
         11'h1e8: data = 8'b01111100; //  *****
         11'h1e9: data = 8'b11111110; // *******
         11'h1ea: data = 8'b11111110; // *******
         11'h1eb: data = 8'b00000000; // 
         11'h1ec: data = 8'b00000000; // 
         11'h1ed: data = 8'b00000000; // 
         11'h1ee: data = 8'b00000000; // 
         11'h1ef: data = 8'b00000000; // 
         //code x1f
         11'h1f0: data = 8'b00000000; // 
         11'h1f1: data = 8'b00000000; // 
         11'h1f2: data = 8'b00000000; // 
         11'h1f3: data = 8'b00000000; // 
         11'h1f4: data = 8'b11111110; // *******
         11'h1f5: data = 8'b11111110; // *******
         11'h1f6: data = 8'b01111100; //  *****
         11'h1f7: data = 8'b01111100; //  *****
         11'h1f8: data = 8'b00111000; //   ***
         11'h1f9: data = 8'b00111000; //   ***
         11'h1fa: data = 8'b00010000; //    *
         11'h1fb: data = 8'b00000000; // 
         11'h1fc: data = 8'b00000000; // 
         11'h1fd: data = 8'b00000000; // 
         11'h1fe: data = 8'b00000000; // 
         11'h1ff: data = 8'b00000000; // 
         //code x20
         11'h200: data = 8'b00000000; // 
         11'h201: data = 8'b00000000; // 
         11'h202: data = 8'b00000000; // 
         11'h203: data = 8'b00000000; // 
         11'h204: data = 8'b00000000; // 
         11'h205: data = 8'b00000000; // 
         11'h206: data = 8'b00000000; // 
         11'h207: data = 8'b00000000; // 
         11'h208: data = 8'b00000000; // 
         11'h209: data = 8'b00000000; // 
         11'h20a: data = 8'b00000000; // 
         11'h20b: data = 8'b00000000; // 
         11'h20c: data = 8'b00000000; // 
         11'h20d: data = 8'b00000000; // 
         11'h20e: data = 8'b00000000; // 
         11'h20f: data = 8'b00000000; // 
         //code x21
         11'h210: data = 8'b00000000; // 
         11'h211: data = 8'b00000000; // 
         11'h212: data = 8'b00011000; //    **
         11'h213: data = 8'b00111100; //   ****
         11'h214: data = 8'b00111100; //   ****
         11'h215: data = 8'b00111100; //   ****
         11'h216: data = 8'b00011000; //    **
         11'h217: data = 8'b00011000; //    **
         11'h218: data = 8'b00011000; //    **
         11'h219: data = 8'b00000000; // 
         11'h21a: data = 8'b00011000; //    **
         11'h21b: data = 8'b00011000; //    **
         11'h21c: data = 8'b00000000; // 
         11'h21d: data = 8'b00000000; // 
         11'h21e: data = 8'b00000000; // 
         11'h21f: data = 8'b00000000; // 
         //code x22
         11'h220: data = 8'b00000000; // 
         11'h221: data = 8'b01100110; //  **  **
         11'h222: data = 8'b01100110; //  **  **
         11'h223: data = 8'b01100110; //  **  **
         11'h224: data = 8'b00100100; //   *  *
         11'h225: data = 8'b00000000; // 
         11'h226: data = 8'b00000000; // 
         11'h227: data = 8'b00000000; // 
         11'h228: data = 8'b00000000; // 
         11'h229: data = 8'b00000000; // 
         11'h22a: data = 8'b00000000; // 
         11'h22b: data = 8'b00000000; // 
         11'h22c: data = 8'b00000000; // 
         11'h22d: data = 8'b00000000; // 
         11'h22e: data = 8'b00000000; // 
         11'h22f: data = 8'b00000000; // 
         //code x23
         11'h230: data = 8'b00000000; // 
         11'h231: data = 8'b00000000; // 
         11'h232: data = 8'b00000000; // 
         11'h233: data = 8'b01101100; //  ** **
         11'h234: data = 8'b01101100; //  ** **
         11'h235: data = 8'b11111110; // *******
         11'h236: data = 8'b01101100; //  ** **
         11'h237: data = 8'b01101100; //  ** **
         11'h238: data = 8'b01101100; //  ** **
         11'h239: data = 8'b11111110; // *******
         11'h23a: data = 8'b01101100; //  ** **
         11'h23b: data = 8'b01101100; //  ** **
         11'h23c: data = 8'b00000000; // 
         11'h23d: data = 8'b00000000; // 
         11'h23e: data = 8'b00000000; // 
         11'h23f: data = 8'b00000000; // 
         //code x24
         11'h240: data = 8'b00011000; //     **
         11'h241: data = 8'b00011000; //     **
         11'h242: data = 8'b01111100; //   *****
         11'h243: data = 8'b11000110; //  **   **
         11'h244: data = 8'b11000010; //  **    *
         11'h245: data = 8'b11000000; //  **
         11'h246: data = 8'b01111100; //   *****
         11'h247: data = 8'b00000110; //       **
         11'h248: data = 8'b00000110; //       **
         11'h249: data = 8'b10000110; //  *    **
         11'h24a: data = 8'b11000110; //  **   **
         11'h24b: data = 8'b01111100; //   *****
         11'h24c: data = 8'b00011000; //     **
         11'h24d: data = 8'b00011000; //     **
         11'h24e: data = 8'b00000000; // 
         11'h24f: data = 8'b00000000; // 
         //code x25
         11'h250: data = 8'b00000000; // 
         11'h251: data = 8'b00000000; // 
         11'h252: data = 8'b00000000; // 
         11'h253: data = 8'b00000000; // 
         11'h254: data = 8'b11000010; // **    *
         11'h255: data = 8'b11000110; // **   **
         11'h256: data = 8'b00001100; //     **
         11'h257: data = 8'b00011000; //    **
         11'h258: data = 8'b00110000; //   **
         11'h259: data = 8'b01100000; //  **
         11'h25a: data = 8'b11000110; // **   **
         11'h25b: data = 8'b10000110; // *    **
         11'h25c: data = 8'b00000000; // 
         11'h25d: data = 8'b00000000; // 
         11'h25e: data = 8'b00000000; // 
         11'h25f: data = 8'b00000000; // 
         //code x26
         11'h260: data = 8'b00000000; // 
         11'h261: data = 8'b00000000; // 
         11'h262: data = 8'b00111000; //   ***
         11'h263: data = 8'b01101100; //  ** **
         11'h264: data = 8'b01101100; //  ** **
         11'h265: data = 8'b00111000; //   ***
         11'h266: data = 8'b01110110; //  *** **
         11'h267: data = 8'b11011100; // ** ***
         11'h268: data = 8'b11001100; // **  **
         11'h269: data = 8'b11001100; // **  **
         11'h26a: data = 8'b11001100; // **  **
         11'h26b: data = 8'b01110110; //  *** **
         11'h26c: data = 8'b00000000; // 
         11'h26d: data = 8'b00000000; // 
         11'h26e: data = 8'b00000000; // 
         11'h26f: data = 8'b00000000; // 
         //code x27
         11'h270: data = 8'b00000000; // 
         11'h271: data = 8'b00110000; //   **
         11'h272: data = 8'b00110000; //   **
         11'h273: data = 8'b00110000; //   **
         11'h274: data = 8'b01100000; //  **
         11'h275: data = 8'b00000000; // 
         11'h276: data = 8'b00000000; // 
         11'h277: data = 8'b00000000; // 
         11'h278: data = 8'b00000000; // 
         11'h279: data = 8'b00000000; // 
         11'h27a: data = 8'b00000000; // 
         11'h27b: data = 8'b00000000; // 
         11'h27c: data = 8'b00000000; // 
         11'h27d: data = 8'b00000000; // 
         11'h27e: data = 8'b00000000; // 
         11'h27f: data = 8'b00000000; // 
         //code x28
         11'h280: data = 8'b00000000; // 
         11'h281: data = 8'b00000000; // 
         11'h282: data = 8'b00001100; //     **
         11'h283: data = 8'b00011000; //    **
         11'h284: data = 8'b00110000; //   **
         11'h285: data = 8'b00110000; //   **
         11'h286: data = 8'b00110000; //   **
         11'h287: data = 8'b00110000; //   **
         11'h288: data = 8'b00110000; //   **
         11'h289: data = 8'b00110000; //   **
         11'h28a: data = 8'b00011000; //    **
         11'h28b: data = 8'b00001100; //     **
         11'h28c: data = 8'b00000000; // 
         11'h28d: data = 8'b00000000; // 
         11'h28e: data = 8'b00000000; // 
         11'h28f: data = 8'b00000000; // 
         //code x29
         11'h290: data = 8'b00000000; // 
         11'h291: data = 8'b00000000; // 
         11'h292: data = 8'b00110000; //   **
         11'h293: data = 8'b00011000; //    **
         11'h294: data = 8'b00001100; //     **
         11'h295: data = 8'b00001100; //     **
         11'h296: data = 8'b00001100; //     **
         11'h297: data = 8'b00001100; //     **
         11'h298: data = 8'b00001100; //     **
         11'h299: data = 8'b00001100; //     **
         11'h29a: data = 8'b00011000; //    **
         11'h29b: data = 8'b00110000; //   **
         11'h29c: data = 8'b00000000; // 
         11'h29d: data = 8'b00000000; // 
         11'h29e: data = 8'b00000000; // 
         11'h29f: data = 8'b00000000; // 
         //code x2a
         11'h2a0: data = 8'b00000000; // 
         11'h2a1: data = 8'b00000000; // 
         11'h2a2: data = 8'b00000000; // 
         11'h2a3: data = 8'b00000000; // 
         11'h2a4: data = 8'b00000000; // 
         11'h2a5: data = 8'b01100110; //  **  **
         11'h2a6: data = 8'b00111100; //   ****
         11'h2a7: data = 8'b11111111; // ********
         11'h2a8: data = 8'b00111100; //   ****
         11'h2a9: data = 8'b01100110; //  **  **
         11'h2aa: data = 8'b00000000; // 
         11'h2ab: data = 8'b00000000; // 
         11'h2ac: data = 8'b00000000; // 
         11'h2ad: data = 8'b00000000; // 
         11'h2ae: data = 8'b00000000; // 
         11'h2af: data = 8'b00000000; // 
         //code x2b
         11'h2b0: data = 8'b00000000; // 
         11'h2b1: data = 8'b00000000; // 
         11'h2b2: data = 8'b00000000; // 
         11'h2b3: data = 8'b00000000; // 
         11'h2b4: data = 8'b00000000; // 
         11'h2b5: data = 8'b00011000; //    **
         11'h2b6: data = 8'b00011000; //    **
         11'h2b7: data = 8'b01111110; //  ******
         11'h2b8: data = 8'b00011000; //    **
         11'h2b9: data = 8'b00011000; //    **
         11'h2ba: data = 8'b00000000; // 
         11'h2bb: data = 8'b00000000; // 
         11'h2bc: data = 8'b00000000; // 
         11'h2bd: data = 8'b00000000; // 
         11'h2be: data = 8'b00000000; // 
         11'h2bf: data = 8'b00000000; // 
         //code x2c
         11'h2c0: data = 8'b00000000; // 
         11'h2c1: data = 8'b00000000; // 
         11'h2c2: data = 8'b00000000; // 
         11'h2c3: data = 8'b00000000; // 
         11'h2c4: data = 8'b00000000; // 
         11'h2c5: data = 8'b00000000; // 
         11'h2c6: data = 8'b00000000; // 
         11'h2c7: data = 8'b00000000; // 
         11'h2c8: data = 8'b00000000; // 
         11'h2c9: data = 8'b00011000; //    **
         11'h2ca: data = 8'b00011000; //    **
         11'h2cb: data = 8'b00011000; //    **
         11'h2cc: data = 8'b00110000; //   **
         11'h2cd: data = 8'b00000000; // 
         11'h2ce: data = 8'b00000000; // 
         11'h2cf: data = 8'b00000000; // 
         //code x2d
         11'h2d0: data = 8'b00000000; // 
         11'h2d1: data = 8'b00000000; // 
         11'h2d2: data = 8'b00000000; // 
         11'h2d3: data = 8'b00000000; // 
         11'h2d4: data = 8'b00000000; // 
         11'h2d5: data = 8'b00000000; // 
         11'h2d6: data = 8'b00000000; // 
         11'h2d7: data = 8'b01111110; //  ******
         11'h2d8: data = 8'b00000000; // 
         11'h2d9: data = 8'b00000000; // 
         11'h2da: data = 8'b00000000; // 
         11'h2db: data = 8'b00000000; // 
         11'h2dc: data = 8'b00000000; // 
         11'h2dd: data = 8'b00000000; // 
         11'h2de: data = 8'b00000000; // 
         11'h2df: data = 8'b00000000; // 
         //code x2e
         11'h2e0: data = 8'b00000000; // 
         11'h2e1: data = 8'b00000000; // 
         11'h2e2: data = 8'b00000000; // 
         11'h2e3: data = 8'b00000000; // 
         11'h2e4: data = 8'b00000000; // 
         11'h2e5: data = 8'b00000000; // 
         11'h2e6: data = 8'b00000000; // 
         11'h2e7: data = 8'b00000000; // 
         11'h2e8: data = 8'b00000000; // 
         11'h2e9: data = 8'b00000000; // 
         11'h2ea: data = 8'b00011000; //    **
         11'h2eb: data = 8'b00011000; //    **
         11'h2ec: data = 8'b00000000; // 
         11'h2ed: data = 8'b00000000; // 
         11'h2ee: data = 8'b00000000; // 
         11'h2ef: data = 8'b00000000; // 
         //code x2f
         11'h2f0: data = 8'b00000000; // 
         11'h2f1: data = 8'b00000000; // 
         11'h2f2: data = 8'b00000000; // 
         11'h2f3: data = 8'b00000000; // 
         11'h2f4: data = 8'b00000010; //       *
         11'h2f5: data = 8'b00000110; //      **
         11'h2f6: data = 8'b00001100; //     **
         11'h2f7: data = 8'b00011000; //    **
         11'h2f8: data = 8'b00110000; //   **
         11'h2f9: data = 8'b01100000; //  **
         11'h2fa: data = 8'b11000000; // **
         11'h2fb: data = 8'b10000000; // *
         11'h2fc: data = 8'b00000000; // 
         11'h2fd: data = 8'b00000000; // 
         11'h2fe: data = 8'b00000000; // 
         11'h2ff: data = 8'b00000000; // 
         //code x30
         11'h300: data = 8'b00000000; // 
         11'h301: data = 8'b00000000; // 
         11'h302: data = 8'b01111100; //  *****
         11'h303: data = 8'b11000110; // **   **
         11'h304: data = 8'b11000110; // **   **
         11'h305: data = 8'b11001110; // **  ***
         11'h306: data = 8'b11011110; // ** ****
         11'h307: data = 8'b11110110; // **** **
         11'h308: data = 8'b11100110; // ***  **
         11'h309: data = 8'b11000110; // **   **
         11'h30a: data = 8'b11000110; // **   **
         11'h30b: data = 8'b01111100; //  *****
         11'h30c: data = 8'b00000000; // 
         11'h30d: data = 8'b00000000; // 
         11'h30e: data = 8'b00000000; // 
         11'h30f: data = 8'b00000000; // 
         //code x31
         11'h310: data = 8'b00000000; // 
         11'h311: data = 8'b00000000; // 
         11'h312: data = 8'b00011000; // 
         11'h313: data = 8'b00111000; // 
         11'h314: data = 8'b01111000; //    **
         11'h315: data = 8'b00011000; //   ***
         11'h316: data = 8'b00011000; //  ****
         11'h317: data = 8'b00011000; //    **
         11'h318: data = 8'b00011000; //    **
         11'h319: data = 8'b00011000; //    **
         11'h31a: data = 8'b00011000; //    **
         11'h31b: data = 8'b01111110; //    **
         11'h31c: data = 8'b00000000; //    **
         11'h31d: data = 8'b00000000; //  ******
         11'h31e: data = 8'b00000000; // 
         11'h31f: data = 8'b00000000; // 
         //code x32
         11'h320: data = 8'b00000000; // 
         11'h321: data = 8'b00000000; // 
         11'h322: data = 8'b01111100; //  *****
         11'h323: data = 8'b11000110; // **   **
         11'h324: data = 8'b00000110; //      **
         11'h325: data = 8'b00001100; //     **
         11'h326: data = 8'b00011000; //    **
         11'h327: data = 8'b00110000; //   **
         11'h328: data = 8'b01100000; //  **
         11'h329: data = 8'b11000000; // **
         11'h32a: data = 8'b11000110; // **   **
         11'h32b: data = 8'b11111110; // *******
         11'h32c: data = 8'b00000000; // 
         11'h32d: data = 8'b00000000; // 
         11'h32e: data = 8'b00000000; // 
         11'h32f: data = 8'b00000000; // 
         //code x33
         11'h330: data = 8'b00000000; // 
         11'h331: data = 8'b00000000; // 
         11'h332: data = 8'b01111100; //  *****
         11'h333: data = 8'b11000110; // **   **
         11'h334: data = 8'b00000110; //      **
         11'h335: data = 8'b00000110; //      **
         11'h336: data = 8'b00111100; //   ****
         11'h337: data = 8'b00000110; //      **
         11'h338: data = 8'b00000110; //      **
         11'h339: data = 8'b00000110; //      **
         11'h33a: data = 8'b11000110; // **   **
         11'h33b: data = 8'b01111100; //  *****
         11'h33c: data = 8'b00000000; // 
         11'h33d: data = 8'b00000000; // 
         11'h33e: data = 8'b00000000; // 
         11'h33f: data = 8'b00000000; // 
         //code x34
         11'h340: data = 8'b00000000; // 
         11'h341: data = 8'b00000000; // 
         11'h342: data = 8'b00001100; //     **
         11'h343: data = 8'b00011100; //    ***
         11'h344: data = 8'b00111100; //   ****
         11'h345: data = 8'b01101100; //  ** **
         11'h346: data = 8'b11001100; // **  **
         11'h347: data = 8'b11111110; // *******
         11'h348: data = 8'b00001100; //     **
         11'h349: data = 8'b00001100; //     **
         11'h34a: data = 8'b00001100; //     **
         11'h34b: data = 8'b00011110; //    ****
         11'h34c: data = 8'b00000000; // 
         11'h34d: data = 8'b00000000; // 
         11'h34e: data = 8'b00000000; // 
         11'h34f: data = 8'b00000000; // 
         //code x35
         11'h350: data = 8'b00000000; // 
         11'h351: data = 8'b00000000; // 
         11'h352: data = 8'b11111110; // *******
         11'h353: data = 8'b11000000; // **
         11'h354: data = 8'b11000000; // **
         11'h355: data = 8'b11000000; // **
         11'h356: data = 8'b11111100; // ******
         11'h357: data = 8'b00000110; //      **
         11'h358: data = 8'b00000110; //      **
         11'h359: data = 8'b00000110; //      **
         11'h35a: data = 8'b11000110; // **   **
         11'h35b: data = 8'b01111100; //  *****
         11'h35c: data = 8'b00000000; // 
         11'h35d: data = 8'b00000000; // 
         11'h35e: data = 8'b00000000; // 
         11'h35f: data = 8'b00000000; // 
         //code x36
         11'h360: data = 8'b00000000; // 
         11'h361: data = 8'b00000000; // 
         11'h362: data = 8'b00111000; //   ***
         11'h363: data = 8'b01100000; //  **
         11'h364: data = 8'b11000000; // **
         11'h365: data = 8'b11000000; // **
         11'h366: data = 8'b11111100; // ******
         11'h367: data = 8'b11000110; // **   **
         11'h368: data = 8'b11000110; // **   **
         11'h369: data = 8'b11000110; // **   **
         11'h36a: data = 8'b11000110; // **   **
         11'h36b: data = 8'b01111100; //  *****
         11'h36c: data = 8'b00000000; // 
         11'h36d: data = 8'b00000000; // 
         11'h36e: data = 8'b00000000; // 
         11'h36f: data = 8'b00000000; // 
         //code x37
         11'h370: data = 8'b00000000; // 
         11'h371: data = 8'b00000000; // 
         11'h372: data = 8'b11111110; // *******
         11'h373: data = 8'b11000110; // **   **
         11'h374: data = 8'b00000110; //      **
         11'h375: data = 8'b00000110; //      **
         11'h376: data = 8'b00001100; //     **
         11'h377: data = 8'b00011000; //    **
         11'h378: data = 8'b00110000; //   **
         11'h379: data = 8'b00110000; //   **
         11'h37a: data = 8'b00110000; //   **
         11'h37b: data = 8'b00110000; //   **
         11'h37c: data = 8'b00000000; // 
         11'h37d: data = 8'b00000000; // 
         11'h37e: data = 8'b00000000; // 
         11'h37f: data = 8'b00000000; // 
         //code x38
         11'h380: data = 8'b00000000; // 
         11'h381: data = 8'b00000000; // 
         11'h382: data = 8'b01111100; //  *****
         11'h383: data = 8'b11000110; // **   **
         11'h384: data = 8'b11000110; // **   **
         11'h385: data = 8'b11000110; // **   **
         11'h386: data = 8'b01111100; //  *****
         11'h387: data = 8'b11000110; // **   **
         11'h388: data = 8'b11000110; // **   **
         11'h389: data = 8'b11000110; // **   **
         11'h38a: data = 8'b11000110; // **   **
         11'h38b: data = 8'b01111100; //  *****
         11'h38c: data = 8'b00000000; // 
         11'h38d: data = 8'b00000000; // 
         11'h38e: data = 8'b00000000; // 
         11'h38f: data = 8'b00000000; // 
         //code x39
         11'h390: data = 8'b00000000; // 
         11'h391: data = 8'b00000000; // 
         11'h392: data = 8'b01111100; //  *****
         11'h393: data = 8'b11000110; // **   **
         11'h394: data = 8'b11000110; // **   **
         11'h395: data = 8'b11000110; // **   **
         11'h396: data = 8'b01111110; //  ******
         11'h397: data = 8'b00000110; //      **
         11'h398: data = 8'b00000110; //      **
         11'h399: data = 8'b00000110; //      **
         11'h39a: data = 8'b00001100; //     **
         11'h39b: data = 8'b01111000; //  ****
         11'h39c: data = 8'b00000000; // 
         11'h39d: data = 8'b00000000; // 
         11'h39e: data = 8'b00000000; // 
         11'h39f: data = 8'b00000000; // 
         //code x3a 
         11'h3a0: data = 8'b00000000; // 
         11'h3a1: data = 8'b00000000; // 
         11'h3a2: data = 8'b00000000; // 
         11'h3a3: data = 8'b00000000; // 
         11'h3a4: data = 8'b00011000; //    **
         11'h3a5: data = 8'b00011000; //    **
         11'h3a6: data = 8'b00000000; // 
         11'h3a7: data = 8'b00000000; // 
         11'h3a8: data = 8'b00000000; // 
         11'h3a9: data = 8'b00011000; //    **
         11'h3aa: data = 8'b00011000; //    **
         11'h3ab: data = 8'b00000000; // 
         11'h3ac: data = 8'b00000000; // 
         11'h3ad: data = 8'b00000000; // 
         11'h3ae: data = 8'b00000000; // 
         11'h3af: data = 8'b00000000; // 
         //code x3b 
         11'h3b0: data = 8'b00000000; // 
         11'h3b1: data = 8'b00000000; // 
         11'h3b2: data = 8'b00000000; // 
         11'h3b3: data = 8'b00000000; // 
         11'h3b4: data = 8'b00011000; //    **
         11'h3b5: data = 8'b00011000; //    **
         11'h3b6: data = 8'b00000000; // 
         11'h3b7: data = 8'b00000000; // 
         11'h3b8: data = 8'b00000000; // 
         11'h3b9: data = 8'b00011000; //    **
         11'h3ba: data = 8'b00011000; //    **
         11'h3bb: data = 8'b00110000; //   **
         11'h3bc: data = 8'b00000000; // 
         11'h3bd: data = 8'b00000000; // 
         11'h3be: data = 8'b00000000; // 
         11'h3bf: data = 8'b00000000; // 
         //code x3c 
         11'h3c0: data = 8'b00000000; // 
         11'h3c1: data = 8'b00000000; // 
         11'h3c2: data = 8'b00000000; // 
         11'h3c3: data = 8'b00000110; //      **
         11'h3c4: data = 8'b00001100; //     **
         11'h3c5: data = 8'b00011000; //    **
         11'h3c6: data = 8'b00110000; //   **
         11'h3c7: data = 8'b01100000; //  **
         11'h3c8: data = 8'b00110000; //   **
         11'h3c9: data = 8'b00011000; //    **
         11'h3ca: data = 8'b00001100; //     **
         11'h3cb: data = 8'b00000110; //      **
         11'h3cc: data = 8'b00000000; // 
         11'h3cd: data = 8'b00000000; // 
         11'h3ce: data = 8'b00000000; // 
         11'h3cf: data = 8'b00000000; // 
         //code x3d 
         11'h3d0: data = 8'b00000000; // 
         11'h3d1: data = 8'b00000000; // 
         11'h3d2: data = 8'b00000000; // 
         11'h3d3: data = 8'b00000000; // 
         11'h3d4: data = 8'b00000000; // 
         11'h3d5: data = 8'b01111110; //  ******
         11'h3d6: data = 8'b00000000; // 
         11'h3d7: data = 8'b00000000; // 
         11'h3d8: data = 8'b01111110; //  ******
         11'h3d9: data = 8'b00000000; // 
         11'h3da: data = 8'b00000000; // 
         11'h3db: data = 8'b00000000; // 
         11'h3dc: data = 8'b00000000; // 
         11'h3dd: data = 8'b00000000; // 
         11'h3de: data = 8'b00000000; // 
         11'h3df: data = 8'b00000000; // 
         //code x3e 
         11'h3e0: data = 8'b00000000; // 
         11'h3e1: data = 8'b00000000; // 
         11'h3e2: data = 8'b00000000; // 
         11'h3e3: data = 8'b01100000; //  **
         11'h3e4: data = 8'b00110000; //   **
         11'h3e5: data = 8'b00011000; //    **
         11'h3e6: data = 8'b00001100; //     **
         11'h3e7: data = 8'b00000110; //      **
         11'h3e8: data = 8'b00001100; //     **
         11'h3e9: data = 8'b00011000; //    **
         11'h3ea: data = 8'b00110000; //   **
         11'h3eb: data = 8'b01100000; //  **
         11'h3ec: data = 8'b00000000; // 
         11'h3ed: data = 8'b00000000; // 
         11'h3ee: data = 8'b00000000; // 
         11'h3ef: data = 8'b00000000; // 
         //code x3f 
         11'h3f0: data = 8'b00000000; // 
         11'h3f1: data = 8'b00000000; // 
         11'h3f2: data = 8'b01111100; //  *****
         11'h3f3: data = 8'b11000110; // **   **
         11'h3f4: data = 8'b11000110; // **   **
         11'h3f5: data = 8'b00001100; //     **
         11'h3f6: data = 8'b00011000; //    **
         11'h3f7: data = 8'b00011000; //    **
         11'h3f8: data = 8'b00011000; //    **
         11'h3f9: data = 8'b00000000; // 
         11'h3fa: data = 8'b00011000; //    **
         11'h3fb: data = 8'b00011000; //    **
         11'h3fc: data = 8'b00000000; // 
         11'h3fd: data = 8'b00000000; // 
         11'h3fe: data = 8'b00000000; // 
         11'h3ff: data = 8'b00000000; // 
        //code x40 
         11'h400: data = 8'b00000000; // 
         11'h401: data = 8'b00000000; // 
         11'h402: data = 8'b01111100; //  *****
         11'h403: data = 8'b11000110; // **   **
         11'h404: data = 8'b11000110; // **   **
         11'h405: data = 8'b11000110; // **   **
         11'h406: data = 8'b11011110; // ** ****
         11'h407: data = 8'b11011110; // ** ****
         11'h408: data = 8'b11011110; // ** ****
         11'h409: data = 8'b11011100; // ** ***
         11'h40a: data = 8'b11000000; // **
         11'h40b: data = 8'b01111100; //  *****
         11'h40c: data = 8'b00000000; // 
         11'h40d: data = 8'b00000000; // 
         11'h40e: data = 8'b00000000; // 
         11'h40f: data = 8'b00000000; // 
         //code x41 
         11'h410: data = 8'b00000000; // 
         11'h411: data = 8'b00000000; // 
         11'h412: data = 8'b00010000; //    *
         11'h413: data = 8'b00111000; //   ***
         11'h414: data = 8'b01101100; //  ** **
         11'h415: data = 8'b11000110; // **   **
         11'h416: data = 8'b11000110; // **   **
         11'h417: data = 8'b11111110; // *******
         11'h418: data = 8'b11000110; // **   **
         11'h419: data = 8'b11000110; // **   **
         11'h41a: data = 8'b11000110; // **   **
         11'h41b: data = 8'b11000110; // **   **
         11'h41c: data = 8'b00000000; // 
         11'h41d: data = 8'b00000000; // 
         11'h41e: data = 8'b00000000; // 
         11'h41f: data = 8'b00000000; // 
         //code x42 
         11'h420: data = 8'b00000000; // 
         11'h421: data = 8'b00000000; // 
         11'h422: data = 8'b11111100; // ******
         11'h423: data = 8'b01100110; //  **  **
         11'h424: data = 8'b01100110; //  **  **
         11'h425: data = 8'b01100110; //  **  **
         11'h426: data = 8'b01111100; //  *****
         11'h427: data = 8'b01100110; //  **  **
         11'h428: data = 8'b01100110; //  **  **
         11'h429: data = 8'b01100110; //  **  **
         11'h42a: data = 8'b01100110; //  **  **
         11'h42b: data = 8'b11111100; // ******
         11'h42c: data = 8'b00000000; // 
         11'h42d: data = 8'b00000000; // 
         11'h42e: data = 8'b00000000; // 
         11'h42f: data = 8'b00000000; // 
         //code x43 
         11'h430: data = 8'b00000000; // 
         11'h431: data = 8'b00000000; // 
         11'h432: data = 8'b00111100; //   ****
         11'h433: data = 8'b01100110; //  **  **
         11'h434: data = 8'b11000010; // **    *
         11'h435: data = 8'b11000000; // **
         11'h436: data = 8'b11000000; // **
         11'h437: data = 8'b11000000; // **
         11'h438: data = 8'b11000000; // **
         11'h439: data = 8'b11000010; // **    *
         11'h43a: data = 8'b01100110; //  **  **
         11'h43b: data = 8'b00111100; //   ****
         11'h43c: data = 8'b00000000; // 
         11'h43d: data = 8'b00000000; // 
         11'h43e: data = 8'b00000000; // 
         11'h43f: data = 8'b00000000; // 
         //code x44 
         11'h440: data = 8'b00000000; // 
         11'h441: data = 8'b00000000; // 
         11'h442: data = 8'b11111000; // *****
         11'h443: data = 8'b01101100; //  ** **
         11'h444: data = 8'b01100110; //  **  **
         11'h445: data = 8'b01100110; //  **  **
         11'h446: data = 8'b01100110; //  **  **
         11'h447: data = 8'b01100110; //  **  **
         11'h448: data = 8'b01100110; //  **  **
         11'h449: data = 8'b01100110; //  **  **
         11'h44a: data = 8'b01101100; //  ** **
         11'h44b: data = 8'b11111000; // *****
         11'h44c: data = 8'b00000000; // 
         11'h44d: data = 8'b00000000; // 
         11'h44e: data = 8'b00000000; // 
         11'h44f: data = 8'b00000000; // 
         //code x45 
         11'h450: data = 8'b00000000; // 
         11'h451: data = 8'b00000000; // 
         11'h452: data = 8'b11111110; // *******
         11'h453: data = 8'b01100110; //  **  **
         11'h454: data = 8'b01100010; //  **   *
         11'h455: data = 8'b01101000; //  ** *
         11'h456: data = 8'b01111000; //  ****
         11'h457: data = 8'b01101000; //  ** *
         11'h458: data = 8'b01100000; //  **
         11'h459: data = 8'b01100010; //  **   *
         11'h45a: data = 8'b01100110; //  **  **
         11'h45b: data = 8'b11111110; // *******
         11'h45c: data = 8'b00000000; // 
         11'h45d: data = 8'b00000000; // 
         11'h45e: data = 8'b00000000; // 
         11'h45f: data = 8'b00000000; // 
         //code x46 
         11'h460: data = 8'b00000000; // 
         11'h461: data = 8'b00000000; // 
         11'h462: data = 8'b11111110; // *******
         11'h463: data = 8'b01100110; //  **  **
         11'h464: data = 8'b01100010; //  **   *
         11'h465: data = 8'b01101000; //  ** *
         11'h466: data = 8'b01111000; //  ****
         11'h467: data = 8'b01101000; //  ** *
         11'h468: data = 8'b01100000; //  **
         11'h469: data = 8'b01100000; //  **
         11'h46a: data = 8'b01100000; //  **
         11'h46b: data = 8'b11110000; // ****
         11'h46c: data = 8'b00000000; // 
         11'h46d: data = 8'b00000000; // 
         11'h46e: data = 8'b00000000; // 
         11'h46f: data = 8'b00000000; // 
         //code x47 
         11'h470: data = 8'b00000000; // 
         11'h471: data = 8'b00000000; // 
         11'h472: data = 8'b00111100; //   ****
         11'h473: data = 8'b01100110; //  **  **
         11'h474: data = 8'b11000010; // **    *
         11'h475: data = 8'b11000000; // **
         11'h476: data = 8'b11000000; // **
         11'h477: data = 8'b11011110; // ** ****
         11'h478: data = 8'b11000110; // **   **
         11'h479: data = 8'b11000110; // **   **
         11'h47a: data = 8'b01100110; //  **  **
         11'h47b: data = 8'b00111010; //   *** *
         11'h47c: data = 8'b00000000; // 
         11'h47d: data = 8'b00000000; // 
         11'h47e: data = 8'b00000000; // 
         11'h47f: data = 8'b00000000; // 
         //code x48 
         11'h480: data = 8'b00000000; // 
         11'h481: data = 8'b00000000; // 
         11'h482: data = 8'b11000110; // **   **
         11'h483: data = 8'b11000110; // **   **
         11'h484: data = 8'b11000110; // **   **
         11'h485: data = 8'b11000110; // **   **
         11'h486: data = 8'b11111110; // *******
         11'h487: data = 8'b11000110; // **   **
         11'h488: data = 8'b11000110; // **   **
         11'h489: data = 8'b11000110; // **   **
         11'h48a: data = 8'b11000110; // **   **
         11'h48b: data = 8'b11000110; // **   **
         11'h48c: data = 8'b00000000; // 
         11'h48d: data = 8'b00000000; // 
         11'h48e: data = 8'b00000000; // 
         11'h48f: data = 8'b00000000; // 
         //code x49 
         11'h490: data = 8'b00000000; // 
         11'h491: data = 8'b00000000; // 
         11'h492: data = 8'b00111100; //   ****
         11'h493: data = 8'b00011000; //    **
         11'h494: data = 8'b00011000; //    **
         11'h495: data = 8'b00011000; //    **
         11'h496: data = 8'b00011000; //    **
         11'h497: data = 8'b00011000; //    **
         11'h498: data = 8'b00011000; //    **
         11'h499: data = 8'b00011000; //    **
         11'h49a: data = 8'b00011000; //    **
         11'h49b: data = 8'b00111100; //   ****
         11'h49c: data = 8'b00000000; // 
         11'h49d: data = 8'b00000000; // 
         11'h49e: data = 8'b00000000; // 
         11'h49f: data = 8'b00000000; // 
         //code x4a   
         11'h4a0: data = 8'b00000000; // 
         11'h4a1: data = 8'b00000000; // 
         11'h4a2: data = 8'b00011110; //    ****
         11'h4a3: data = 8'b00001100; //     **
         11'h4a4: data = 8'b00001100; //     **
         11'h4a5: data = 8'b00001100; //     **
         11'h4a6: data = 8'b00001100; //     **
         11'h4a7: data = 8'b00001100; //     **
         11'h4a8: data = 8'b11001100; // **  **
         11'h4a9: data = 8'b11001100; // **  **
         11'h4aa: data = 8'b11001100; // **  **
         11'h4ab: data = 8'b01111000; //  ****
         11'h4ac: data = 8'b00000000; // 
         11'h4ad: data = 8'b00000000; // 
         11'h4ae: data = 8'b00000000; // 
         11'h4af: data = 8'b00000000; // 
         //code x4b   
         11'h4b0: data = 8'b00000000; // 
         11'h4b1: data = 8'b00000000; // 
         11'h4b2: data = 8'b11100110; // ***  **
         11'h4b3: data = 8'b01100110; //  **  **
         11'h4b4: data = 8'b01100110; //  **  **
         11'h4b5: data = 8'b01101100; //  ** **
         11'h4b6: data = 8'b01111000; //  ****
         11'h4b7: data = 8'b01111000; //  ****
         11'h4b8: data = 8'b01101100; //  ** **
         11'h4b9: data = 8'b01100110; //  **  **
         11'h4ba: data = 8'b01100110; //  **  **
         11'h4bb: data = 8'b11100110; // ***  **
         11'h4bc: data = 8'b00000000; // 
         11'h4bd: data = 8'b00000000; // 
         11'h4be: data = 8'b00000000; // 
         11'h4bf: data = 8'b00000000; // 
         //code x4c   
         11'h4c0: data = 8'b00000000; // 
         11'h4c1: data = 8'b00000000; // 
         11'h4c2: data = 8'b11110000; // ****
         11'h4c3: data = 8'b01100000; //  **
         11'h4c4: data = 8'b01100000; //  **
         11'h4c5: data = 8'b01100000; //  **
         11'h4c6: data = 8'b01100000; //  **
         11'h4c7: data = 8'b01100000; //  **
         11'h4c8: data = 8'b01100000; //  **
         11'h4c9: data = 8'b01100010; //  **   *
         11'h4ca: data = 8'b01100110; //  **  **
         11'h4cb: data = 8'b11111110; // *******
         11'h4cc: data = 8'b00000000; // 
         11'h4cd: data = 8'b00000000; // 
         11'h4ce: data = 8'b00000000; // 
         11'h4cf: data = 8'b00000000; // 
         //code x4d   
         11'h4d0: data = 8'b00000000; // 
         11'h4d1: data = 8'b00000000; // 
         11'h4d2: data = 8'b11000011; // **    **
         11'h4d3: data = 8'b11100111; // ***  ***
         11'h4d4: data = 8'b11111111; // ********
         11'h4d5: data = 8'b11111111; // ********
         11'h4d6: data = 8'b11011011; // ** ** **
         11'h4d7: data = 8'b11000011; // **    **
         11'h4d8: data = 8'b11000011; // **    **
         11'h4d9: data = 8'b11000011; // **    **
         11'h4da: data = 8'b11000011; // **    **
         11'h4db: data = 8'b11000011; // **    **
         11'h4dc: data = 8'b00000000; // 
         11'h4dd: data = 8'b00000000; // 
         11'h4de: data = 8'b00000000; // 
         11'h4df: data = 8'b00000000; // 
         //code x4e   
         11'h4e0: data = 8'b00000000; // 
         11'h4e1: data = 8'b00000000; // 
         11'h4e2: data = 8'b11000110; // **   **
         11'h4e3: data = 8'b11100110; // ***  **
         11'h4e4: data = 8'b11110110; // **** **
         11'h4e5: data = 8'b11111110; // *******
         11'h4e6: data = 8'b11011110; // ** ****
         11'h4e7: data = 8'b11001110; // **  ***
         11'h4e8: data = 8'b11000110; // **   **
         11'h4e9: data = 8'b11000110; // **   **
         11'h4ea: data = 8'b11000110; // **   **
         11'h4eb: data = 8'b11000110; // **   **
         11'h4ec: data = 8'b00000000; // 
         11'h4ed: data = 8'b00000000; // 
         11'h4ee: data = 8'b00000000; // 
         11'h4ef: data = 8'b00000000; // 
         //code x4f   
         11'h4f0: data = 8'b00000000; // 
         11'h4f1: data = 8'b00000000; // 
         11'h4f2: data = 8'b01111100; //  *****
         11'h4f3: data = 8'b11000110; // **   **
         11'h4f4: data = 8'b11000110; // **   **
         11'h4f5: data = 8'b11000110; // **   **
         11'h4f6: data = 8'b11000110; // **   **
         11'h4f7: data = 8'b11000110; // **   **
         11'h4f8: data = 8'b11000110; // **   **
         11'h4f9: data = 8'b11000110; // **   **
         11'h4fa: data = 8'b11000110; // **   **
         11'h4fb: data = 8'b01111100; //  *****
         11'h4fc: data = 8'b00000000; // 
         11'h4fd: data = 8'b00000000; // 
         11'h4fe: data = 8'b00000000; // 
         11'h4ff: data = 8'b00000000; // 
         //code x50   
         11'h500: data = 8'b00000000; // 
         11'h501: data = 8'b00000000; // 
         11'h502: data = 8'b11111100; // ******
         11'h503: data = 8'b01100110; //  **  **
         11'h504: data = 8'b01100110; //  **  **
         11'h505: data = 8'b01100110; //  **  **
         11'h506: data = 8'b01111100; //  *****
         11'h507: data = 8'b01100000; //  **
         11'h508: data = 8'b01100000; //  **
         11'h509: data = 8'b01100000; //  **
         11'h50a: data = 8'b01100000; //  **
         11'h50b: data = 8'b11110000; // ****
         11'h50c: data = 8'b00000000; // 
         11'h50d: data = 8'b00000000; // 
         11'h50e: data = 8'b00000000; // 
         11'h50f: data = 8'b00000000; // 
         //code x510f
         11'h510: data = 8'b00000000; // 
         11'h511: data = 8'b00000000; // 
         11'h512: data = 8'b01111100; //  *****
         11'h513: data = 8'b11000110; // **   **
         11'h514: data = 8'b11000110; // **   **
         11'h515: data = 8'b11000110; // **   **
         11'h516: data = 8'b11000110; // **   **
         11'h517: data = 8'b11000110; // **   **
         11'h518: data = 8'b11000110; // **   **
         11'h519: data = 8'b11010110; // ** * **
         11'h51a: data = 8'b11011110; // ** ****
         11'h51b: data = 8'b01111100; //  *****
         11'h51c: data = 8'b00001100; //     **
         11'h51d: data = 8'b00001110; //     ***
         11'h51e: data = 8'b00000000; // 
         11'h51f: data = 8'b00000000; // 
         //code x52   
         11'h520: data = 8'b00000000; // 
         11'h521: data = 8'b00000000; // 
         11'h522: data = 8'b11111100; // ******
         11'h523: data = 8'b01100110; //  **  **
         11'h524: data = 8'b01100110; //  **  **
         11'h525: data = 8'b01100110; //  **  **
         11'h526: data = 8'b01111100; //  *****
         11'h527: data = 8'b01101100; //  ** **
         11'h528: data = 8'b01100110; //  **  **
         11'h529: data = 8'b01100110; //  **  **
         11'h52a: data = 8'b01100110; //  **  **
         11'h52b: data = 8'b11100110; // ***  **
         11'h52c: data = 8'b00000000; // 
         11'h52d: data = 8'b00000000; // 
         11'h52e: data = 8'b00000000; // 
         11'h52f: data = 8'b00000000; // 
         //code x53   
         11'h530: data = 8'b00000000; // 
         11'h531: data = 8'b00000000; // 
         11'h532: data = 8'b01111100; //  *****
         11'h533: data = 8'b11000110; // **   **
         11'h534: data = 8'b11000110; // **   **
         11'h535: data = 8'b01100000; //  **
         11'h536: data = 8'b00111000; //   ***
         11'h537: data = 8'b00001100; //     **
         11'h538: data = 8'b00000110; //      **
         11'h539: data = 8'b11000110; // **   **
         11'h53a: data = 8'b11000110; // **   **
         11'h53b: data = 8'b01111100; //  *****
         11'h53c: data = 8'b00000000; // 
         11'h53d: data = 8'b00000000; // 
         11'h53e: data = 8'b00000000; // 
         11'h53f: data = 8'b00000000; // 
         //code x54   
         11'h540: data = 8'b00000000; // 
         11'h541: data = 8'b00000000; // 
         11'h542: data = 8'b11111111; // ********
         11'h543: data = 8'b11011011; // ** ** **
         11'h544: data = 8'b10011001; // *  **  *
         11'h545: data = 8'b00011000; //    **
         11'h546: data = 8'b00011000; //    **
         11'h547: data = 8'b00011000; //    **
         11'h548: data = 8'b00011000; //    **
         11'h549: data = 8'b00011000; //    **
         11'h54a: data = 8'b00011000; //    **
         11'h54b: data = 8'b00111100; //   ****
         11'h54c: data = 8'b00000000; // 
         11'h54d: data = 8'b00000000; // 
         11'h54e: data = 8'b00000000; // 
         11'h54f: data = 8'b00000000; // 
         //code x55   
         11'h550: data = 8'b00000000; // 
         11'h551: data = 8'b00000000; // 
         11'h552: data = 8'b11000110; // **   **
         11'h553: data = 8'b11000110; // **   **
         11'h554: data = 8'b11000110; // **   **
         11'h555: data = 8'b11000110; // **   **
         11'h556: data = 8'b11000110; // **   **
         11'h557: data = 8'b11000110; // **   **
         11'h558: data = 8'b11000110; // **   **
         11'h559: data = 8'b11000110; // **   **
         11'h55a: data = 8'b11000110; // **   **
         11'h55b: data = 8'b01111100; //  *****
         11'h55c: data = 8'b00000000; // 
         11'h55d: data = 8'b00000000; // 
         11'h55e: data = 8'b00000000; // 
         11'h55f: data = 8'b00000000; // 
         //code x56   
         11'h560: data = 8'b00000000; // 
         11'h561: data = 8'b00000000; // 
         11'h562: data = 8'b11000011; // **    **
         11'h563: data = 8'b11000011; // **    **
         11'h564: data = 8'b11000011; // **    **
         11'h565: data = 8'b11000011; // **    **
         11'h566: data = 8'b11000011; // **    **
         11'h567: data = 8'b11000011; // **    **
         11'h568: data = 8'b11000011; // **    **
         11'h569: data = 8'b01100110; //  **  **
         11'h56a: data = 8'b00111100; //   ****
         11'h56b: data = 8'b00011000; //    **
         11'h56c: data = 8'b00000000; // 
         11'h56d: data = 8'b00000000; // 
         11'h56e: data = 8'b00000000; // 
         11'h56f: data = 8'b00000000; // 
         //code x57   
         11'h570: data = 8'b00000000; // 
         11'h571: data = 8'b00000000; // 
         11'h572: data = 8'b11000011; // **    **
         11'h573: data = 8'b11000011; // **    **
         11'h574: data = 8'b11000011; // **    **
         11'h575: data = 8'b11000011; // **    **
         11'h576: data = 8'b11000011; // **    **
         11'h577: data = 8'b11011011; // ** ** **
         11'h578: data = 8'b11011011; // ** ** **
         11'h579: data = 8'b11111111; // ********
         11'h57a: data = 8'b01100110; //  **  **
         11'h57b: data = 8'b01100110; //  **  **
         11'h57c: data = 8'b00000000; // 
         11'h57d: data = 8'b00000000; // 
         11'h57e: data = 8'b00000000; // 
         11'h57f: data = 8'b00000000; // 
         //code x58   
         11'h580: data = 8'b00000000; // 
         11'h581: data = 8'b00000000; // 
         11'h582: data = 8'b11000011; // **    **
         11'h583: data = 8'b11000011; // **    **
         11'h584: data = 8'b01100110; //  **  **
         11'h585: data = 8'b00111100; //   ****
         11'h586: data = 8'b00011000; //    **
         11'h587: data = 8'b00011000; //    **
         11'h588: data = 8'b00111100; //   ****
         11'h589: data = 8'b01100110; //  **  **
         11'h58a: data = 8'b11000011; // **    **
         11'h58b: data = 8'b11000011; // **    **
         11'h58c: data = 8'b00000000; // 
         11'h58d: data = 8'b00000000; // 
         11'h58e: data = 8'b00000000; // 
         11'h58f: data = 8'b00000000; // 
         //code x59   
         11'h590: data = 8'b00000000; // 
         11'h591: data = 8'b00000000; // 
         11'h592: data = 8'b11000011; // **    **
         11'h593: data = 8'b11000011; // **    **
         11'h594: data = 8'b11000011; // **    **
         11'h595: data = 8'b01100110; //  **  **
         11'h596: data = 8'b00111100; //   ****
         11'h597: data = 8'b00011000; //    **
         11'h598: data = 8'b00011000; //    **
         11'h599: data = 8'b00011000; //    **
         11'h59a: data = 8'b00011000; //    **
         11'h59b: data = 8'b00111100; //   ****
         11'h59c: data = 8'b00000000; // 
         11'h59d: data = 8'b00000000; // 
         11'h59e: data = 8'b00000000; // 
         11'h59f: data = 8'b00000000; // 
         //code x5a   
         11'h5a0: data = 8'b00000000; // 
         11'h5a1: data = 8'b00000000; // 
         11'h5a2: data = 8'b11111111; // ********
         11'h5a3: data = 8'b11000011; // **    **
         11'h5a4: data = 8'b10000110; // *    **
         11'h5a5: data = 8'b00001100; //     **
         11'h5a6: data = 8'b00011000; //    **
         11'h5a7: data = 8'b00110000; //   **
         11'h5a8: data = 8'b01100000; //  **
         11'h5a9: data = 8'b11000001; // **     *
         11'h5aa: data = 8'b11000011; // **    **
         11'h5ab: data = 8'b11111111; // ********
         11'h5ac: data = 8'b00000000; // 
         11'h5ad: data = 8'b00000000; // 
         11'h5ae: data = 8'b00000000; // 
         11'h5af: data = 8'b00000000; // 
         //code x5b   
         11'h5b0: data = 8'b00000000; // 
         11'h5b1: data = 8'b00000000; // 
         11'h5b2: data = 8'b00111100; //   ****
         11'h5b3: data = 8'b00110000; //   **
         11'h5b4: data = 8'b00110000; //   **
         11'h5b5: data = 8'b00110000; //   **
         11'h5b6: data = 8'b00110000; //   **
         11'h5b7: data = 8'b00110000; //   **
         11'h5b8: data = 8'b00110000; //   **
         11'h5b9: data = 8'b00110000; //   **
         11'h5ba: data = 8'b00110000; //   **
         11'h5bb: data = 8'b00111100; //   ****
         11'h5bc: data = 8'b00000000; // 
         11'h5bd: data = 8'b00000000; // 
         11'h5be: data = 8'b00000000; // 
         11'h5bf: data = 8'b00000000; // 
         //code x5c   
         11'h5c0: data = 8'b00000000; // 
         11'h5c1: data = 8'b00000000; // 
         11'h5c2: data = 8'b00000000; // 
         11'h5c3: data = 8'b10000000; // *
         11'h5c4: data = 8'b11000000; // **
         11'h5c5: data = 8'b11100000; // ***
         11'h5c6: data = 8'b01110000; //  ***
         11'h5c7: data = 8'b00111000; //   ***
         11'h5c8: data = 8'b00011100; //    ***
         11'h5c9: data = 8'b00001110; //     ***
         11'h5ca: data = 8'b00000110; //      **
         11'h5cb: data = 8'b00000010; //       *
         11'h5cc: data = 8'b00000000; // 
         11'h5cd: data = 8'b00000000; // 
         11'h5ce: data = 8'b00000000; // 
         11'h5cf: data = 8'b00000000; // 
         //code x5d   
         11'h5d0: data = 8'b00000000; // 
         11'h5d1: data = 8'b00000000; // 
         11'h5d2: data = 8'b00111100; //   ****
         11'h5d3: data = 8'b00001100; //     **
         11'h5d4: data = 8'b00001100; //     **
         11'h5d5: data = 8'b00001100; //     **
         11'h5d6: data = 8'b00001100; //     **
         11'h5d7: data = 8'b00001100; //     **
         11'h5d8: data = 8'b00001100; //     **
         11'h5d9: data = 8'b00001100; //     **
         11'h5da: data = 8'b00001100; //     **
         11'h5db: data = 8'b00111100; //   ****
         11'h5dc: data = 8'b00000000; // 
         11'h5dd: data = 8'b00000000; // 
         11'h5de: data = 8'b00000000; // 
         11'h5df: data = 8'b00000000; // 
         //code x5e   
         11'h5e0: data = 8'b00010000; //    *
         11'h5e1: data = 8'b00111000; //   ***
         11'h5e2: data = 8'b01101100; //  ** **
         11'h5e3: data = 8'b11000110; // **   **
         11'h5e4: data = 8'b00000000; // 
         11'h5e5: data = 8'b00000000; // 
         11'h5e6: data = 8'b00000000; // 
         11'h5e7: data = 8'b00000000; // 
         11'h5e8: data = 8'b00000000; // 
         11'h5e9: data = 8'b00000000; // 
         11'h5ea: data = 8'b00000000; // 
         11'h5eb: data = 8'b00000000; // 
         11'h5ec: data = 8'b00000000; // 
         11'h5ed: data = 8'b00000000; // 
         11'h5ee: data = 8'b00000000; // 
         11'h5ef: data = 8'b00000000; // 
         //code x5f   
         11'h5f0: data = 8'b00000000; // 
         11'h5f1: data = 8'b00000000; // 
         11'h5f2: data = 8'b00000000; // 
         11'h5f3: data = 8'b00000000; // 
         11'h5f4: data = 8'b00000000; // 
         11'h5f5: data = 8'b00000000; // 
         11'h5f6: data = 8'b00000000; // 
         11'h5f7: data = 8'b00000000; // 
         11'h5f8: data = 8'b00000000; // 
         11'h5f9: data = 8'b00000000; // 
         11'h5fa: data = 8'b00000000; // 
         11'h5fb: data = 8'b00000000; // 
         11'h5fc: data = 8'b00000000; // 
         11'h5fd: data = 8'b11111111; // ********
         11'h5fe: data = 8'b00000000; // 
         11'h5ff: data = 8'b00000000; // 
         //code x60   
         11'h600: data = 8'b00110000; //   **
         11'h601: data = 8'b00110000; //   **
         11'h602: data = 8'b00011000; //    **
         11'h603: data = 8'b00000000; // 
         11'h604: data = 8'b00000000; // 
         11'h605: data = 8'b00000000; // 
         11'h606: data = 8'b00000000; // 
         11'h607: data = 8'b00000000; // 
         11'h608: data = 8'b00000000; // 
         11'h609: data = 8'b00000000; // 
         11'h60a: data = 8'b00000000; // 
         11'h60b: data = 8'b00000000; // 
         11'h60c: data = 8'b00000000; // 
         11'h60d: data = 8'b00000000; // 
         11'h60e: data = 8'b00000000; // 
         11'h60f: data = 8'b00000000; // 
         //code x61   
         11'h610: data = 8'b00000000; // 
         11'h611: data = 8'b00000000; // 
         11'h612: data = 8'b00000000; // 
         11'h613: data = 8'b00000000; // 
         11'h614: data = 8'b00000000; // 
         11'h615: data = 8'b01111000; //  ****
         11'h616: data = 8'b00001100; //     **
         11'h617: data = 8'b01111100; //  *****
         11'h618: data = 8'b11001100; // **  **
         11'h619: data = 8'b11001100; // **  **
         11'h61a: data = 8'b11001100; // **  **
         11'h61b: data = 8'b01110110; //  *** **
         11'h61c: data = 8'b00000000; // 
         11'h61d: data = 8'b00000000; // 
         11'h61e: data = 8'b00000000; // 
         11'h61f: data = 8'b00000000; // 
         //code x62   
         11'h620: data = 8'b00000000; // 
         11'h621: data = 8'b00000000; // 
         11'h622: data = 8'b11100000; //  ***
         11'h623: data = 8'b01100000; //   **
         11'h624: data = 8'b01100000; //   **
         11'h625: data = 8'b01111000; //   ****
         11'h626: data = 8'b01101100; //   ** **
         11'h627: data = 8'b01100110; //   **  **
         11'h628: data = 8'b01100110; //   **  **
         11'h629: data = 8'b01100110; //   **  **
         11'h62a: data = 8'b01100110; //   **  **
         11'h62b: data = 8'b01111100; //   *****
         11'h62c: data = 8'b00000000; // 
         11'h62d: data = 8'b00000000; // 
         11'h62e: data = 8'b00000000; // 
         11'h62f: data = 8'b00000000; // 
         //code x63   
         11'h630: data = 8'b00000000; // 
         11'h631: data = 8'b00000000; // 
         11'h632: data = 8'b00000000; // 
         11'h633: data = 8'b00000000; // 
         11'h634: data = 8'b00000000; // 
         11'h635: data = 8'b01111100; //  *****
         11'h636: data = 8'b11000110; // **   **
         11'h637: data = 8'b11000000; // **
         11'h638: data = 8'b11000000; // **
         11'h639: data = 8'b11000000; // **
         11'h63a: data = 8'b11000110; // **   **
         11'h63b: data = 8'b01111100; //  *****
         11'h63c: data = 8'b00000000; // 
         11'h63d: data = 8'b00000000; // 
         11'h63e: data = 8'b00000000; // 
         11'h63f: data = 8'b00000000; // 
         //code x64   
         11'h640: data = 8'b00000000; // 
         11'h641: data = 8'b00000000; // 
         11'h642: data = 8'b00011100; //    ***
         11'h643: data = 8'b00001100; //     **
         11'h644: data = 8'b00001100; //     **
         11'h645: data = 8'b00111100; //   ****
         11'h646: data = 8'b01101100; //  ** **
         11'h647: data = 8'b11001100; // **  **
         11'h648: data = 8'b11001100; // **  **
         11'h649: data = 8'b11001100; // **  **
         11'h64a: data = 8'b11001100; // **  **
         11'h64b: data = 8'b01110110; //  *** **
         11'h64c: data = 8'b00000000; // 
         11'h64d: data = 8'b00000000; // 
         11'h64e: data = 8'b00000000; // 
         11'h64f: data = 8'b00000000; // 
         //code x65   
         11'h650: data = 8'b00000000; // 
         11'h651: data = 8'b00000000; // 
         11'h652: data = 8'b00000000; // 
         11'h653: data = 8'b00000000; // 
         11'h654: data = 8'b00000000; // 
         11'h655: data = 8'b01111100; //  *****
         11'h656: data = 8'b11000110; // **   **
         11'h657: data = 8'b11111110; // *******
         11'h658: data = 8'b11000000; // **
         11'h659: data = 8'b11000000; // **
         11'h65a: data = 8'b11000110; // **   **
         11'h65b: data = 8'b01111100; //  *****
         11'h65c: data = 8'b00000000; // 
         11'h65d: data = 8'b00000000; // 
         11'h65e: data = 8'b00000000; // 
         11'h65f: data = 8'b00000000; // 
         //code x66   
         11'h660: data = 8'b00000000; // 
         11'h661: data = 8'b00000000; // 
         11'h662: data = 8'b00111000; //   ***
         11'h663: data = 8'b01101100; //  ** **
         11'h664: data = 8'b01100100; //  **  *
         11'h665: data = 8'b01100000; //  **
         11'h666: data = 8'b11110000; // ****
         11'h667: data = 8'b01100000; //  **
         11'h668: data = 8'b01100000; //  **
         11'h669: data = 8'b01100000; //  **
         11'h66a: data = 8'b01100000; //  **
         11'h66b: data = 8'b11110000; // ****
         11'h66c: data = 8'b00000000; // 
         11'h66d: data = 8'b00000000; // 
         11'h66e: data = 8'b00000000; // 
         11'h66f: data = 8'b00000000; // 
         //code x67   
         11'h670: data = 8'b00000000; // 
         11'h671: data = 8'b00000000; // 
         11'h672: data = 8'b00000000; // 
         11'h673: data = 8'b00000000; // 
         11'h674: data = 8'b00000000; // 
         11'h675: data = 8'b01110110; //  *** **
         11'h676: data = 8'b11001100; // **  **
         11'h677: data = 8'b11001100; // **  **
         11'h678: data = 8'b11001100; // **  **
         11'h679: data = 8'b11001100; // **  **
         11'h67a: data = 8'b11001100; // **  **
         11'h67b: data = 8'b01111100; //  *****
         11'h67c: data = 8'b00001100; //     **
         11'h67d: data = 8'b11001100; // **  **
         11'h67e: data = 8'b01111000; //  ****
         11'h67f: data = 8'b00000000; // 
         //code x68   
         11'h680: data = 8'b00000000; // 
         11'h681: data = 8'b00000000; // 
         11'h682: data = 8'b11100000; // ***
         11'h683: data = 8'b01100000; //  **
         11'h684: data = 8'b01100000; //  **
         11'h685: data = 8'b01101100; //  ** **
         11'h686: data = 8'b01110110; //  *** **
         11'h687: data = 8'b01100110; //  **  **
         11'h688: data = 8'b01100110; //  **  **
         11'h689: data = 8'b01100110; //  **  **
         11'h68a: data = 8'b01100110; //  **  **
         11'h68b: data = 8'b11100110; // ***  **
         11'h68c: data = 8'b00000000; // 
         11'h68d: data = 8'b00000000; // 
         11'h68e: data = 8'b00000000; // 
         11'h68f: data = 8'b00000000; // 
         //code x69   
         11'h690: data = 8'b00000000; // 
         11'h691: data = 8'b00000000; // 
         11'h692: data = 8'b00011000; //    **
         11'h693: data = 8'b00011000; //    **
         11'h694: data = 8'b00000000; // 
         11'h695: data = 8'b00111000; //   ***
         11'h696: data = 8'b00011000; //    **
         11'h697: data = 8'b00011000; //    **
         11'h698: data = 8'b00011000; //    **
         11'h699: data = 8'b00011000; //    **
         11'h69a: data = 8'b00011000; //    **
         11'h69b: data = 8'b00111100; //   ****
         11'h69c: data = 8'b00000000; // 
         11'h69d: data = 8'b00000000; // 
         11'h69e: data = 8'b00000000; // 
         11'h69f: data = 8'b00000000; // 
         //code x6a   
         11'h6a0: data = 8'b00000000; // 
         11'h6a1: data = 8'b00000000; // 
         11'h6a2: data = 8'b00000110; //      **
         11'h6a3: data = 8'b00000110; //      **
         11'h6a4: data = 8'b00000000; // 
         11'h6a5: data = 8'b00001110; //     ***
         11'h6a6: data = 8'b00000110; //      **
         11'h6a7: data = 8'b00000110; //      **
         11'h6a8: data = 8'b00000110; //      **
         11'h6a9: data = 8'b00000110; //      **
         11'h6aa: data = 8'b00000110; //      **
         11'h6ab: data = 8'b00000110; //      **
         11'h6ac: data = 8'b01100110; //  **  **
         11'h6ad: data = 8'b01100110; //  **  **
         11'h6ae: data = 8'b00111100; //   ****
         11'h6af: data = 8'b00000000; // 
         //code x6b   
         11'h6b0: data = 8'b00000000; // 
         11'h6b1: data = 8'b00000000; // 
         11'h6b2: data = 8'b11100000; // ***
         11'h6b3: data = 8'b01100000; //  **
         11'h6b4: data = 8'b01100000; //  **
         11'h6b5: data = 8'b01100110; //  **  **
         11'h6b6: data = 8'b01101100; //  ** **
         11'h6b7: data = 8'b01111000; //  ****
         11'h6b8: data = 8'b01111000; //  ****
         11'h6b9: data = 8'b01101100; //  ** **
         11'h6ba: data = 8'b01100110; //  **  **
         11'h6bb: data = 8'b11100110; // ***  **
         11'h6bc: data = 8'b00000000; // 
         11'h6bd: data = 8'b00000000; // 
         11'h6be: data = 8'b00000000; // 
         11'h6bf: data = 8'b00000000; // 
         //code x6c   
         11'h6c0: data = 8'b00000000; // 
         11'h6c1: data = 8'b00000000; // 
         11'h6c2: data = 8'b00111000; //   ***
         11'h6c3: data = 8'b00011000; //    **
         11'h6c4: data = 8'b00011000; //    **
         11'h6c5: data = 8'b00011000; //    **
         11'h6c6: data = 8'b00011000; //    **
         11'h6c7: data = 8'b00011000; //    **
         11'h6c8: data = 8'b00011000; //    **
         11'h6c9: data = 8'b00011000; //    **
         11'h6ca: data = 8'b00011000; //    **
         11'h6cb: data = 8'b00111100; //   ****
         11'h6cc: data = 8'b00000000; // 
         11'h6cd: data = 8'b00000000; // 
         11'h6ce: data = 8'b00000000; // 
         11'h6cf: data = 8'b00000000; // 
         //code x6d   
         11'h6d0: data = 8'b00000000; // 
         11'h6d1: data = 8'b00000000; // 
         11'h6d2: data = 8'b00000000; // 
         11'h6d3: data = 8'b00000000; // 
         11'h6d4: data = 8'b00000000; // 
         11'h6d5: data = 8'b11100110; // ***  **
         11'h6d6: data = 8'b11111111; // ********
         11'h6d7: data = 8'b11011011; // ** ** **
         11'h6d8: data = 8'b11011011; // ** ** **
         11'h6d9: data = 8'b11011011; // ** ** **
         11'h6da: data = 8'b11011011; // ** ** **
         11'h6db: data = 8'b11011011; // ** ** **
         11'h6dc: data = 8'b00000000; // 
         11'h6dd: data = 8'b00000000; // 
         11'h6de: data = 8'b00000000; // 
         11'h6df: data = 8'b00000000; // 
         //code x6e   
         11'h6e0: data = 8'b00000000; // 
         11'h6e1: data = 8'b00000000; // 
         11'h6e2: data = 8'b00000000; // 
         11'h6e3: data = 8'b00000000; // 
         11'h6e4: data = 8'b00000000; // 
         11'h6e5: data = 8'b11011100; // ** ***
         11'h6e6: data = 8'b01100110; //  **  **
         11'h6e7: data = 8'b01100110; //  **  **
         11'h6e8: data = 8'b01100110; //  **  **
         11'h6e9: data = 8'b01100110; //  **  **
         11'h6ea: data = 8'b01100110; //  **  **
         11'h6eb: data = 8'b01100110; //  **  **
         11'h6ec: data = 8'b00000000; // 
         11'h6ed: data = 8'b00000000; // 
         11'h6ee: data = 8'b00000000; // 
         11'h6ef: data = 8'b00000000; // 
         //code x6f   
         11'h6f0: data = 8'b00000000; // 
         11'h6f1: data = 8'b00000000; // 
         11'h6f2: data = 8'b00000000; // 
         11'h6f3: data = 8'b00000000; // 
         11'h6f4: data = 8'b00000000; // 
         11'h6f5: data = 8'b01111100; //  *****
         11'h6f6: data = 8'b11000110; // **   **
         11'h6f7: data = 8'b11000110; // **   **
         11'h6f8: data = 8'b11000110; // **   **
         11'h6f9: data = 8'b11000110; // **   **
         11'h6fa: data = 8'b11000110; // **   **
         11'h6fb: data = 8'b01111100; //  *****
         11'h6fc: data = 8'b00000000; // 
         11'h6fd: data = 8'b00000000; // 
         11'h6fe: data = 8'b00000000; // 
         11'h6ff: data = 8'b00000000; // 
         //code x70   
         11'h700: data = 8'b00000000; // 
         11'h701: data = 8'b00000000; // 
         11'h702: data = 8'b00000000; // 
         11'h703: data = 8'b00000000; // 
         11'h704: data = 8'b00000000; // 
         11'h705: data = 8'b11011100; // ** ***
         11'h706: data = 8'b01100110; //  **  **
         11'h707: data = 8'b01100110; //  **  **
         11'h708: data = 8'b01100110; //  **  **
         11'h709: data = 8'b01100110; //  **  **
         11'h70a: data = 8'b01100110; //  **  **
         11'h70b: data = 8'b01111100; //  *****
         11'h70c: data = 8'b01100000; //  **
         11'h70d: data = 8'b01100000; //  **
         11'h70e: data = 8'b11110000; // ****
         11'h70f: data = 8'b00000000; // 
         //code x71   
         11'h710: data = 8'b00000000; // 
         11'h711: data = 8'b00000000; // 
         11'h712: data = 8'b00000000; // 
         11'h713: data = 8'b00000000; // 
         11'h714: data = 8'b00000000; // 
         11'h715: data = 8'b01110110; //  *** **
         11'h716: data = 8'b11001100; // **  **
         11'h717: data = 8'b11001100; // **  **
         11'h718: data = 8'b11001100; // **  **
         11'h719: data = 8'b11001100; // **  **
         11'h71a: data = 8'b11001100; // **  **
         11'h71b: data = 8'b01111100; //  *****
         11'h71c: data = 8'b00001100; //     **
         11'h71d: data = 8'b00001100; //     **
         11'h71e: data = 8'b00011110; //    ****
         11'h71f: data = 8'b00000000; // 
         //code x72   
         11'h720: data = 8'b00000000; // 
         11'h721: data = 8'b00000000; // 
         11'h722: data = 8'b00000000; // 
         11'h723: data = 8'b00000000; // 
         11'h724: data = 8'b00000000; // 
         11'h725: data = 8'b11011100; // ** ***
         11'h726: data = 8'b01110110; //  *** **
         11'h727: data = 8'b01100110; //  **  **
         11'h728: data = 8'b01100000; //  **
         11'h729: data = 8'b01100000; //  **
         11'h72a: data = 8'b01100000; //  **
         11'h72b: data = 8'b11110000; // ****
         11'h72c: data = 8'b00000000; // 
         11'h72d: data = 8'b00000000; // 
         11'h72e: data = 8'b00000000; // 
         11'h72f: data = 8'b00000000; // 
         //code x73   
         11'h730: data = 8'b00000000; // 
         11'h731: data = 8'b00000000; // 
         11'h732: data = 8'b00000000; // 
         11'h733: data = 8'b00000000; // 
         11'h734: data = 8'b00000000; // 
         11'h735: data = 8'b01111100; //  *****
         11'h736: data = 8'b11000110; // **   **
         11'h737: data = 8'b01100000; //  **
         11'h738: data = 8'b00111000; //   ***
         11'h739: data = 8'b00001100; //     **
         11'h73a: data = 8'b11000110; // **   **
         11'h73b: data = 8'b01111100; //  *****
         11'h73c: data = 8'b00000000; // 
         11'h73d: data = 8'b00000000; // 
         11'h73e: data = 8'b00000000; // 
         11'h73f: data = 8'b00000000; // 
         //code x74   
         11'h740: data = 8'b00000000; // 
         11'h741: data = 8'b00000000; // 
         11'h742: data = 8'b00010000; //    *
         11'h743: data = 8'b00110000; //   **
         11'h744: data = 8'b00110000; //   **
         11'h745: data = 8'b11111100; // ******
         11'h746: data = 8'b00110000; //   **
         11'h747: data = 8'b00110000; //   **
         11'h748: data = 8'b00110000; //   **
         11'h749: data = 8'b00110000; //   **
         11'h74a: data = 8'b00110110; //   ** **
         11'h74b: data = 8'b00011100; //    ***
         11'h74c: data = 8'b00000000; // 
         11'h74d: data = 8'b00000000; // 
         11'h74e: data = 8'b00000000; // 
         11'h74f: data = 8'b00000000; // 
         //code x75   
         11'h750: data = 8'b00000000; // 
         11'h751: data = 8'b00000000; // 
         11'h752: data = 8'b00000000; // 
         11'h753: data = 8'b00000000; // 
         11'h754: data = 8'b00000000; // 
         11'h755: data = 8'b11001100; // **  **
         11'h756: data = 8'b11001100; // **  **
         11'h757: data = 8'b11001100; // **  **
         11'h758: data = 8'b11001100; // **  **
         11'h759: data = 8'b11001100; // **  **
         11'h75a: data = 8'b11001100; // **  **
         11'h75b: data = 8'b01110110; //  *** **
         11'h75c: data = 8'b00000000; // 
         11'h75d: data = 8'b00000000; // 
         11'h75e: data = 8'b00000000; // 
         11'h75f: data = 8'b00000000; // 
         //code x76   
         11'h760: data = 8'b00000000; // 
         11'h761: data = 8'b00000000; // 
         11'h762: data = 8'b00000000; // 
         11'h763: data = 8'b00000000; // 
         11'h764: data = 8'b00000000; // 
         11'h765: data = 8'b11000011; // **    **
         11'h766: data = 8'b11000011; // **    **
         11'h767: data = 8'b11000011; // **    **
         11'h768: data = 8'b11000011; // **    **
         11'h769: data = 8'b01100110; //  **  **
         11'h76a: data = 8'b00111100; //   ****
         11'h76b: data = 8'b00011000; //    **
         11'h76c: data = 8'b00000000; // 
         11'h76d: data = 8'b00000000; // 
         11'h76e: data = 8'b00000000; // 
         11'h76f: data = 8'b00000000; // 
         //code x77   
         11'h770: data = 8'b00000000; // 
         11'h771: data = 8'b00000000; // 
         11'h772: data = 8'b00000000; // 
         11'h773: data = 8'b00000000; // 
         11'h774: data = 8'b00000000; // 
         11'h775: data = 8'b11000011; // **    **
         11'h776: data = 8'b11000011; // **    **
         11'h777: data = 8'b11000011; // **    **
         11'h778: data = 8'b11011011; // ** ** **
         11'h779: data = 8'b11011011; // ** ** **
         11'h77a: data = 8'b11111111; // ********
         11'h77b: data = 8'b01100110; //  **  **
         11'h77c: data = 8'b00000000; // 
         11'h77d: data = 8'b00000000; // 
         11'h77e: data = 8'b00000000; // 
         11'h77f: data = 8'b00000000; // 
         //code x78   
         11'h780: data = 8'b00000000; // 
         11'h781: data = 8'b00000000; // 
         11'h782: data = 8'b00000000; // 
         11'h783: data = 8'b00000000; // 
         11'h784: data = 8'b00000000; // 
         11'h785: data = 8'b11000011; // **    **
         11'h786: data = 8'b01100110; //  **  **
         11'h787: data = 8'b00111100; //   ****
         11'h788: data = 8'b00011000; //    **
         11'h789: data = 8'b00111100; //   ****
         11'h78a: data = 8'b01100110; //  **  **
         11'h78b: data = 8'b11000011; // **    **
         11'h78c: data = 8'b00000000; // 
         11'h78d: data = 8'b00000000; // 
         11'h78e: data = 8'b00000000; // 
         11'h78f: data = 8'b00000000; // 
         //code x79   
         11'h790: data = 8'b00000000; // 
         11'h791: data = 8'b00000000; // 
         11'h792: data = 8'b00000000; // 
         11'h793: data = 8'b00000000; // 
         11'h794: data = 8'b00000000; // 
         11'h795: data = 8'b11000110; // **   **
         11'h796: data = 8'b11000110; // **   **
         11'h797: data = 8'b11000110; // **   **
         11'h798: data = 8'b11000110; // **   **
         11'h799: data = 8'b11000110; // **   **
         11'h79a: data = 8'b11000110; // **   **
         11'h79b: data = 8'b01111110; //  ******
         11'h79c: data = 8'b00000110; //      **
         11'h79d: data = 8'b00001100; //     **
         11'h79e: data = 8'b11111000; // *****
         11'h79f: data = 8'b00000000; // 
         //code x7a   
         11'h7a0: data = 8'b00000000; // 
         11'h7a1: data = 8'b00000000; // 
         11'h7a2: data = 8'b00000000; // 
         11'h7a3: data = 8'b00000000; // 
         11'h7a4: data = 8'b00000000; // 
         11'h7a5: data = 8'b11111110; // *******
         11'h7a6: data = 8'b11001100; // **  **
         11'h7a7: data = 8'b00011000; //    **
         11'h7a8: data = 8'b00110000; //   **
         11'h7a9: data = 8'b01100000; //  **
         11'h7aa: data = 8'b11000110; // **   **
         11'h7ab: data = 8'b11111110; // *******
         11'h7ac: data = 8'b00000000; // 
         11'h7ad: data = 8'b00000000; // 
         11'h7ae: data = 8'b00000000; // 
         11'h7af: data = 8'b00000000; // 
         //code x7b   
         11'h7b0: data = 8'b00000000; // 
         11'h7b1: data = 8'b00000000; // 
         11'h7b2: data = 8'b00001110; //     ***
         11'h7b3: data = 8'b00011000; //    **
         11'h7b4: data = 8'b00011000; //    **
         11'h7b5: data = 8'b00011000; //    **
         11'h7b6: data = 8'b01110000; //  ***
         11'h7b7: data = 8'b00011000; //    **
         11'h7b8: data = 8'b00011000; //    **
         11'h7b9: data = 8'b00011000; //    **
         11'h7ba: data = 8'b00011000; //    **
         11'h7bb: data = 8'b00001110; //     ***
         11'h7bc: data = 8'b00000000; // 
         11'h7bd: data = 8'b00000000; // 
         11'h7be: data = 8'b00000000; // 
         11'h7bf: data = 8'b00000000; // 
         //code x7c   
         11'h7c0: data = 8'b00000000; // 
         11'h7c1: data = 8'b00000000; // 
         11'h7c2: data = 8'b00011000; //    **
         11'h7c3: data = 8'b00011000; //    **
         11'h7c4: data = 8'b00011000; //    **
         11'h7c5: data = 8'b00011000; //    **
         11'h7c6: data = 8'b00000000; // 
         11'h7c7: data = 8'b00011000; //    **
         11'h7c8: data = 8'b00011000; //    **
         11'h7c9: data = 8'b00011000; //    **
         11'h7ca: data = 8'b00011000; //    **
         11'h7cb: data = 8'b00011000; //    **
         11'h7cc: data = 8'b00000000; // 
         11'h7cd: data = 8'b00000000; // 
         11'h7ce: data = 8'b00000000; // 
         11'h7cf: data = 8'b00000000; // 
         //code x7d   
         11'h7d0: data = 8'b00000000; // 
         11'h7d1: data = 8'b00000000; // 
         11'h7d2: data = 8'b01110000; //  ***
         11'h7d3: data = 8'b00011000; //    **
         11'h7d4: data = 8'b00011000; //    **
         11'h7d5: data = 8'b00011000; //    **
         11'h7d6: data = 8'b00001110; //     ***
         11'h7d7: data = 8'b00011000; //    **
         11'h7d8: data = 8'b00011000; //    **
         11'h7d9: data = 8'b00011000; //    **
         11'h7da: data = 8'b00011000; //    **
         11'h7db: data = 8'b01110000; //  ***
         11'h7dc: data = 8'b00000000; // 
         11'h7dd: data = 8'b00000000; // 
         11'h7de: data = 8'b00000000; // 
         11'h7df: data = 8'b00000000; // 
         //code x7e   
         11'h7e0: data = 8'b00000000; // 
         11'h7e1: data = 8'b00000000; // 
         11'h7e2: data = 8'b01110110; //  *** **
         11'h7e3: data = 8'b11011100; // ** ***
         11'h7e4: data = 8'b00000000; // 
         11'h7e5: data = 8'b00000000; // 
         11'h7e6: data = 8'b00000000; // 
         11'h7e7: data = 8'b00000000; // 
         11'h7e8: data = 8'b00000000; // 
         11'h7e9: data = 8'b00000000; // 
         11'h7ea: data = 8'b00000000; // 
         11'h7eb: data = 8'b00000000; // 
         11'h7ec: data = 8'b00000000; // 
         11'h7ed: data = 8'b00000000; // 
         11'h7ee: data = 8'b00000000; // 
         11'h7ef: data = 8'b00000000; // 
         //code x7f   
         11'h7f0: data = 8'b00000000; // 
         11'h7f1: data = 8'b00000000; // 
         11'h7f2: data = 8'b00000000; // 
         11'h7f3: data = 8'b00000000; // 
         11'h7f4: data = 8'b00010000; //    *
         11'h7f5: data = 8'b00111000; //   ***
         11'h7f6: data = 8'b01101100; //  ** **
         11'h7f7: data = 8'b11000110; // **   **
         11'h7f8: data = 8'b11000110; // **   **
         11'h7f9: data = 8'b11000110; // **   **
         11'h7fa: data = 8'b11111110; // *******
         11'h7fb: data = 8'b00000000; // 
         11'h7fc: data = 8'b00000000; // 
         11'h7fd: data = 8'b00000000; // 
         11'h7fe: data = 8'b00000000; // 
         11'h7ff: data = 8'b00000000; // 	 
   endcase  
   	       
endmodule

// Listing 14.2
module font_test_gen
   (
    input wire clk,
    input wire video_on,
    input wire [9:0] pixel_x, pixel_y,
    output reg [2:0] rgb_text
   );

   // signal declaration
   wire [10:0] rom_addr;
   wire [6:0] char_addr;
   wire [3:0] row_addr;
   wire [2:0] bit_addr;
   wire [7:0] font_word;
   wire font_bit, text_bit_on;

   // body
   // instantiate font ROM
   font_rom font_unit
      (.clk(clk), .addr(rom_addr), .data(font_word));
   // font ROM interface
   assign char_addr = {pixel_y[5:4], pixel_x[7:3]};
   assign row_addr = pixel_y[3:0];
   assign rom_addr = {char_addr, row_addr};
   assign bit_addr = pixel_x[2:0];
   assign font_bit = font_word[~bit_addr];
   // "on" region limited to top-left corner
   assign text_bit_on = (pixel_x[9:8]==0 && pixel_y[9:6]==0) ?
                        font_bit : 1'b0;
   // rgb multiplexing circuit
   always @*
      if (~video_on)
         rgb_text = 3'b000; // blank
      else
         if (text_bit_on)
            rgb_text = 3'b010;  // green
          else
            rgb_text = 3'b000;  // black

endmodule
// Listing 14.3
module font_test_top
   (
    input wire clk, reset,
    output wire hsync, vsync,
    output wire [2:0] rgb
   );

   // signal declaration
   wire [9:0] pixel_x, pixel_y;
   wire video_on, pixel_tick;
   reg [2:0] rgb_reg;
   wire [2:0] rgb_next;

   // body
   // instantiate vga sync circuit
   vga_sync vsync_unit
      (.clk(clk), .reset(reset), .hsync(hsync), .vsync(vsync),
       .video_on(video_on), .p_tick(pixel_tick),
       .pixel_x(pixel_x), .pixel_y(pixel_y));
   // font generation circuit
   font_test_gen font_gen_unit
      (.clk(clk), .video_on(video_on), .pixel_x(pixel_x),
       .pixel_y(pixel_y), .rgb_text(rgb_next));
   // rgb buffer
   always @(posedge clk)
      if (pixel_tick)
         rgb_reg <= rgb_next;
   // output
   assign rgb = rgb_reg;

endmodule

// Listing 14.8
module m100_counter
   (
    input wire clk, reset,
    input wire d_inc, d_clr,
    output wire [3:0] dig0, dig1
   );

   // signal declaration
   reg [3:0] dig0_reg, dig1_reg, dig0_next, dig1_next;

   // registers
   always @(posedge clk, posedge reset)
      if (reset)
         begin
            dig1_reg <= 0;
            dig0_reg <= 0;
         end
      else
         begin
            dig1_reg <= dig1_next;
            dig0_reg <= dig0_next;
         end

   // next-state logic
   always @*
   begin
      dig0_next = dig0_reg;
      dig1_next = dig1_reg;
      if (d_clr)
         begin
            dig0_next = 0;
            dig1_next = 0;
         end
      else if (d_inc)
         if (dig0_reg==9)
            begin
               dig0_next = 0;
               if (dig1_reg==9)
                  dig1_next = 0;
               else
                  dig1_next = dig1_reg + 1;
             end
         else  // dig0 not 9
            dig0_next = dig0_reg + 1;
   end
   // output
   assign dig0 = dig0_reg;
   assign dig1 = dig1_reg;

endmodule

// Listing 14.7
module pong_graph 
   (
    input wire clk, reset,
    input wire [1:0] btn1,
    input wire [1:0] btn2,
    input wire ai_switch,
    input wire [9:0] pix_x, pix_y,
    input wire gra_still,
    output wire graph_on,
    output reg hit, miss,
    output reg [2:0] graph_rgb
   );

   // costant and signal declaration
   // x, y coordinates (0,0) to (639,479)
   localparam MAX_X = 640;
   localparam MAX_Y = 480;
   wire refr_tick;
   //--------------------------------------------
   // vertical strip as a wall
   //--------------------------------------------
   // wall left, right boundary
   //localparam WALL_X_L = 32;
   //localparam WALL_X_R = 35;
   //--------------------------------------------
   // right vertical bar
   //--------------------------------------------
   // bar left, right boundary
   localparam BARR_X_L = 600;
   localparam BARR_X_R = 603;
   // bar top, bottom boundary
   wire [9:0] barr_y_t, barr_y_b;
   localparam BARR_Y_SIZE = 72;
   // register to track top boundary  (x position is fixed)
   reg [9:0] barr_y_reg, barr_y_next;
   // bar moving velocity when the button are pressed
   localparam BARR_V = 4;
   //--------------------------------------------
   // left vertical bar
   //--------------------------------------------
   // bar left, right boundary
   localparam BARL_X_L = 40;
   localparam BARL_X_R = 43;
   // bar top, bottom boundary
   wire [9:0] barl_y_t, barl_y_b;
   localparam BARL_Y_SIZE = 72;
   // register to track top boundary  (x position is fixed)
   reg [9:0] barl_y_reg, barl_y_next;
   // bar moving velocity when the button are pressed
   localparam BARL_V = 4;
   //--------------------------------------------
   // square ball
   //--------------------------------------------
   localparam BALL_SIZE = 8;
   // ball left, right boundary
   wire [9:0] ball_x_l, ball_x_r;
   // ball top, bottom boundary
   wire [9:0] ball_y_t, ball_y_b;
   // reg to track left, top position
   reg [9:0] ball_x_reg, ball_y_reg;
   wire [9:0] ball_x_next, ball_y_next;
   // reg to track ball speed
   reg [9:0] x_delta_reg, x_delta_next;
   reg [9:0] y_delta_reg, y_delta_next;
   // ball velocity can be pos or neg)
   localparam BALL_V_P = 2;
   localparam BALL_V_N = -2;
   //--------------------------------------------
   // round ball 
   //--------------------------------------------
   wire [2:0] rom_addr, rom_col;
   reg [7:0] rom_data;
   wire rom_bit;
   //--------------------------------------------
   // object output signals
   //--------------------------------------------
   wire wall_on, barr_on, barl_on, sq_ball_on, rd_ball_on;
   wire [2:0] wall_rgb, barr_rgb, barl_rgb, ball_rgb;
   //--------------------------------------------
   // AI variables
   //--------------------------------------------
   reg [9:0] ball_center;
   reg [9:0] paddlel_center;
   reg [9:0] paddler_center;
   //--------------------------------------------
   // Angle varibles
   //--------------------------------------------
   reg [9:0] hit_point;
   // body 
   //--------------------------------------------
   // round ball image ROM
   //--------------------------------------------
   always @*
   case (rom_addr)
      3'h0: rom_data = 8'b00111100; //   ****
      3'h1: rom_data = 8'b01111110; //  ******
      3'h2: rom_data = 8'b11111111; // ********
      3'h3: rom_data = 8'b11111111; // ********
      3'h4: rom_data = 8'b11111111; // ********
      3'h5: rom_data = 8'b11111111; // ********
      3'h6: rom_data = 8'b01111110; //  ******
      3'h7: rom_data = 8'b00111100; //   ****
   endcase
   
   // registers
   always @(posedge clk, posedge reset)
      if (reset)
         begin
            barr_y_reg <= 0;
            barl_y_reg <= 0;
            ball_x_reg <= 0;
            ball_y_reg <= 0;
            x_delta_reg <= 10'h004;
            y_delta_reg <= 10'h004;
         end   
      else
         begin
            barr_y_reg <= barr_y_next;
            barl_y_reg <= barl_y_next;
            ball_x_reg <= ball_x_next;
            ball_y_reg <= ball_y_next;
            x_delta_reg <= x_delta_next;
            y_delta_reg <= y_delta_next;
         end   

   // refr_tick: 1-clock tick asserted at start of v-sync
   //       i.e., when the screen is refreshed (60 Hz)
   assign refr_tick = (pix_y==481) && (pix_x==0);
   
   // //--------------------------------------------
   // // (wall) left vertical strip
   // //--------------------------------------------
   // // pixel within wall
   // assign wall_on = (WALL_X_L<=pix_x) && (pix_x<=WALL_X_R);
   // // wall rgb output
   // assign wall_rgb = 3'b001; // blue

   //--------------------------------------------
   // right vertical bar
   //--------------------------------------------
   // boundary
   assign barr_y_t = barr_y_reg;
   assign barr_y_b = barr_y_t + BARR_Y_SIZE - 1;
   // pixel within bar
   assign barr_on = (BARR_X_L<=pix_x) && (pix_x<=BARR_X_R) &&
                   (barr_y_t<=pix_y) && (pix_y<=barr_y_b); 
   // bar rgb output
   assign barr_rgb = 3'b010; // green
   // new bar y-position
   always @*
   begin
      barr_y_next = barr_y_reg; // no move
      if (gra_still) // initial position of paddle
         barr_y_next = (MAX_Y-BARR_Y_SIZE)/2;
      else if (refr_tick)
         if (btn1[1] & (barr_y_b < (MAX_Y-1-BARR_V)))
            barr_y_next = barr_y_reg + BARR_V; // move down
         else if (btn1[0] & (barr_y_t > BARR_V)) 
            barr_y_next = barr_y_reg - BARR_V; // move up
   end  
   
   // //--------------------------------------------
   // // left vertical bar (HUMAN)
   // //--------------------------------------------
   // // boundary
   // assign barl_y_t = barl_y_reg;
   // assign barl_y_b = barl_y_t + BARL_Y_SIZE - 1;
   // // pixel within bar
   // assign barl_on = (BARL_X_L<=pix_x) && (pix_x<=BARL_X_R) &&
   //                 (barl_y_t<=pix_y) && (pix_y<=barl_y_b); 
   // // bar rgb output
   // assign barl_rgb = 3'b101; // purple
   // // new bar y-position
   // always @*
   // begin
   //    barl_y_next = barl_y_reg; // no move
   //    if (gra_still) // initial position of paddle
   //       barl_y_next = (MAX_Y-BARL_Y_SIZE)/2;
   //    else if (refr_tick)
   //       if (btn2[1] & (barl_y_b < (MAX_Y-1-BARL_V)))
   //          barl_y_next = barl_y_reg + BARL_V; // move down
   //       else if (btn2[0] & (barl_y_t > BARL_V)) 
   //          barl_y_next = barl_y_reg - BARL_V; // move up
   // end
   
   //--------------------------------------------
   // left vertical bar (AI/HUMAN)
   //--------------------------------------------
   // boundary
   assign barl_y_t = barl_y_reg;
   assign barl_y_b = barl_y_t + BARL_Y_SIZE - 1;
   // pixel within bar
   assign barl_on = (BARL_X_L<=pix_x) && (pix_x<=BARL_X_R) &&
                   (barl_y_t<=pix_y) && (pix_y<=barl_y_b); 
   // bar rgb output
   assign barl_rgb = 3'b101; // purple
   // new bar y-position
   always @*
   begin
      if (ai_switch)
         begin
            if (ball_x_l < 2*(MAX_X / 3) && refr_tick)
               begin
                  ball_center = ball_y_t + ((ball_y_b - ball_y_t) / 2);
                  paddlel_center = barl_y_t + ((barl_y_b - barl_y_t) / 2);
                  if (ball_center < paddlel_center)
                     begin
                        barl_y_next = barl_y_reg - 3; // move up
                        if (barl_y_next <= 5)
                           barl_y_next = 5;
                     end
                  else if (ball_center > paddlel_center)
                     begin
                        barl_y_next = barl_y_reg + 3; // move down
                        if (barl_y_next + BARL_Y_SIZE >= MAX_Y)
                           barl_y_next = MAX_Y - BARL_Y_SIZE;
                     end
                  else
                     barl_y_next = barl_y_reg; // no move
               end
            else
               barl_y_next = barl_y_reg; // no move
         end
      else
         begin
            barl_y_next = barl_y_reg; // no move
            if (gra_still) // initial position of paddle
               barl_y_next = (MAX_Y-BARL_Y_SIZE)/2;
            else if (refr_tick)
               if (btn2[1] && (barl_y_b < (MAX_Y-1-BARL_V)))
                  barl_y_next = barl_y_reg + BARL_V; // move down
               else if (btn2[0] && (barl_y_t > BARL_V)) 
                  barl_y_next = barl_y_reg - BARL_V; // move up
         end
   end
   
   //--------------------------------------------
   // square ball
   //--------------------------------------------
   // boundary
   assign ball_x_l = ball_x_reg;
   assign ball_y_t = ball_y_reg;
   assign ball_x_r = ball_x_l + BALL_SIZE - 1;
   assign ball_y_b = ball_y_t + BALL_SIZE - 1;
   // pixel within ball
   assign sq_ball_on =
            (ball_x_l<=pix_x) && (pix_x<=ball_x_r) &&
            (ball_y_t<=pix_y) && (pix_y<=ball_y_b);
   // map current pixel location to ROM addr/col
   assign rom_addr = pix_y[2:0] - ball_y_t[2:0];
   assign rom_col = pix_x[2:0] - ball_x_l[2:0];
   assign rom_bit = rom_data[rom_col];
   // pixel within ball
   assign rd_ball_on = sq_ball_on & rom_bit;
   // ball rgb output
   assign ball_rgb = 3'b100;   // black
  
   // new ball position
   assign ball_x_next = (gra_still) ? MAX_X/2 :
                        (refr_tick) ? ball_x_reg+x_delta_reg :
                        ball_x_reg ;
   assign ball_y_next = (gra_still) ? MAX_Y/2 :
                        (refr_tick) ? ball_y_reg+y_delta_reg :
                        ball_y_reg ;
   // new ball velocity
   always @*   
   begin
      hit = 1'b0;
      miss = 1'b0;
      x_delta_next = x_delta_reg;
      y_delta_next = y_delta_reg;
      
      ball_center = ball_y_t + ((ball_y_b - ball_y_t) / 2);
      
      if (gra_still)     // initial velocity
         begin
            x_delta_next = BALL_V_N;
            y_delta_next = BALL_V_P;
         end   
      else if (ball_y_t <= 1) // reach top
         y_delta_next = BALL_V_P;
      else if (ball_y_b >= (MAX_Y-1)) // reach bottom
         y_delta_next = BALL_V_N;
      else if ((BARR_X_L<=ball_x_r) && (ball_x_r<=BARR_X_R) &&
               (barr_y_t<=ball_y_b) && (ball_y_t<=barr_y_b))
         begin
            // reach x of right bar and hit, ball bounce back
            //x_delta_next = BALL_V_N;
            hit_point = ball_center - barr_y_t;
            if (hit_point < (BARR_Y_SIZE / 5))
               x_delta_next = -4;
            else if (hit_point < 2*(BARR_Y_SIZE / 5))
               x_delta_next = -3;
            else if (hit_point < 3*(BARR_Y_SIZE / 5))
               x_delta_next = -2;
            else if (hit_point < 4*(BARR_Y_SIZE / 5))
               x_delta_next = -3;
            else
               x_delta_next = -4;
               
            if (ai_switch)
               hit = 1'b0;
            else
               hit = 1'b1;
         end
      else if ((BARL_X_L<=ball_x_l) && (ball_x_l<=BARL_X_R) &&
               (barl_y_t<=ball_y_b) && (ball_y_t<=barl_y_b))
         begin
            // reach x of left bar and hit, ball bounce back
            //x_delta_next = BALL_V_P;
            hit_point = ball_center - barr_y_t;
            if (hit_point < (BARR_Y_SIZE / 5))
               x_delta_next = 4;
            else if (hit_point < 2*(BARR_Y_SIZE / 5))
               x_delta_next = 3;
            else if (hit_point < 3*(BARR_Y_SIZE / 5))
               x_delta_next = 2;
            else if (hit_point < 4*(BARR_Y_SIZE / 5))
               x_delta_next = 3;
            else
               x_delta_next = 4;
               
            if (ai_switch)
               hit = 1'b0;
            else
               hit = 1'b1;
         end
      else if (ball_x_r >= MAX_X - 10)   // reach right border
         miss = 1'b1;            // a miss
      else if (ball_x_r <= 10)   // reach left border
         begin
            if (ai_switch)
               hit = 1'b1;
            else
               miss = 1'b1;
         end
   end 

   //--------------------------------------------
   // rgb multiplexing circuit
   //--------------------------------------------
   always @* 
      if (wall_on)
         graph_rgb = wall_rgb;
      else if (barr_on)
         graph_rgb = barr_rgb;
      else if (barl_on)
         graph_rgb = barl_rgb;
      else if (rd_ball_on)
         graph_rgb = ball_rgb;
      else
         graph_rgb = 3'b000; // black background
   // new graphic_on signal
   //assign graph_on = wall_on | barr_on | barl_on | rd_ball_on;
   assign graph_on =  barr_on | barl_on | rd_ball_on;

endmodule 
// Listing 14.6
module pong_text
   (
    input wire clk, 
    input wire [1:0] ball,
    input wire [3:0] dig0, dig1,
    input wire [9:0] pix_x, pix_y,
    output wire [3:0] text_on,
    output reg [2:0] text_rgb
   );

   // signal declaration
   wire [10:0] rom_addr;
   reg [6:0] char_addr, char_addr_s, char_addr_l,
             char_addr_r, char_addr_o;
   reg [3:0] row_addr;
   wire [3:0] row_addr_s, row_addr_l, row_addr_r, row_addr_o;
   reg [2:0] bit_addr;
   wire [2:0] bit_addr_s, bit_addr_l,bit_addr_r, bit_addr_o;
   wire [7:0] font_word;
   wire font_bit, score_on, logo_on, rule_on, over_on;
   wire [5:0] rule_rom_addr;

   // instantiate font ROM
   font_rom font_unit
      (.clk(clk), .addr(rom_addr), .data(font_word));

   //-------------------------------------------
   // score region
   //  - display two-digit score, ball on top left
   //  - scale to 16-by-32 font
   //  - line 1, 16 chars: "Score:DD Ball:D"
   //-------------------------------------------
   assign score_on = (pix_y[9:5]==0) && (pix_x[9:4]<16);
   assign row_addr_s = pix_y[4:1];
   assign bit_addr_s = pix_x[3:1];
   always @*
      case (pix_x[7:4])
         4'h0: char_addr_s = 7'h53; // S
         4'h1: char_addr_s = 7'h63; // c
         4'h2: char_addr_s = 7'h6f; // o
         4'h3: char_addr_s = 7'h72; // r
         4'h4: char_addr_s = 7'h65; // e
         4'h5: char_addr_s = 7'h3a; // :
          4'h6: char_addr_s = {3'b011, dig1}; // digit 10
          4'h7: char_addr_s = {3'b011, dig0}; // digit 1
          4'h8: char_addr_s = 7'h00; //
          4'h9: char_addr_s = 7'h00; //
          4'ha: char_addr_s = 7'h42; // B
          4'hb: char_addr_s = 7'h61; // a
          4'hc: char_addr_s = 7'h6c; // l
          4'hd: char_addr_s = 7'h6c; // l
          4'he: char_addr_s = 7'h3a; // :
          4'hf: char_addr_s = {5'b01100, ball};
      endcase
   //-------------------------------------------
   // logo region:
   //   - display logo "PONG" at top center
   //   - used as background
   //   - scale to 64-by-128 font
   //-------------------------------------------
   assign logo_on = (pix_y[9:7]==2) &&
                    (3<=pix_x[9:6]) && (pix_x[9:6]<=6);
   assign row_addr_l = pix_y[6:3];
   assign bit_addr_l = pix_x[5:3];
   always @*
      case (pix_x[8:6])
         3'o3: char_addr_l = 7'h50; // P
         3'o4: char_addr_l = 7'h4f; // O
         3'o5: char_addr_l = 7'h4e; // N
         default: char_addr_l = 7'h47; // G
      endcase
   //-------------------------------------------
   // rule region
   //   - display rule (4-by-16 tiles)on center
   //   - rule text:
   //      Rule:
   //        Use two buttons
   //        to move paddle
   //        up and down
   //-------------------------------------------
   assign rule_on = (pix_x[9:7]==2) && (pix_y[9:6]==2);
   assign row_addr_r = pix_y[3:0];
   assign bit_addr_r = pix_x[2:0];
   assign rule_rom_addr = {pix_y[5:4], pix_x[6:3]};
   always @*
      case (rule_rom_addr)
         // row 1
         6'h00: char_addr_r = 7'h52; // R
         6'h01: char_addr_r = 7'h55; // U
         6'h02: char_addr_r = 7'h4c; // L
         6'h03: char_addr_r = 7'h45; // E
         6'h04: char_addr_r = 7'h3a; // :
         6'h05: char_addr_r = 7'h00; //
         6'h06: char_addr_r = 7'h00; //
         6'h07: char_addr_r = 7'h00; //
         6'h08: char_addr_r = 7'h00; //
         6'h09: char_addr_r = 7'h00; //
         6'h0a: char_addr_r = 7'h00; //
         6'h0b: char_addr_r = 7'h00; //
         6'h0c: char_addr_r = 7'h00; //
         6'h0d: char_addr_r = 7'h00; //
         6'h0e: char_addr_r = 7'h00; //
         6'h0f: char_addr_r = 7'h00; //
         // row 2
         6'h10: char_addr_r = 7'h55; // U
         6'h11: char_addr_r = 7'h73; // s
         6'h12: char_addr_r = 7'h65; // e
         6'h13: char_addr_r = 7'h00; //
         6'h14: char_addr_r = 7'h74; // t
         6'h15: char_addr_r = 7'h77; // w
         6'h16: char_addr_r = 7'h6f; // o
         6'h17: char_addr_r = 7'h00; //
         6'h18: char_addr_r = 7'h62; // b
         6'h19: char_addr_r = 7'h75; // u
         6'h1a: char_addr_r = 7'h74; // t
         6'h1b: char_addr_r = 7'h74; // t
         6'h1c: char_addr_r = 7'h6f; // o
         6'h1d: char_addr_r = 7'h6e; // n
         6'h1e: char_addr_r = 7'h73; // s
         6'h1f: char_addr_r = 7'h00; //
         // row 3
         6'h20: char_addr_r = 7'h74; // t
         6'h21: char_addr_r = 7'h6f; // o
         6'h22: char_addr_r = 7'h00; //
         6'h23: char_addr_r = 7'h6d; // m
         6'h24: char_addr_r = 7'h6f; // o
         6'h25: char_addr_r = 7'h76; // v
         6'h26: char_addr_r = 7'h65; // e
         6'h27: char_addr_r = 7'h00; //
         6'h28: char_addr_r = 7'h70; // p
         6'h29: char_addr_r = 7'h61; // a
         6'h2a: char_addr_r = 7'h64; // d
         6'h2b: char_addr_r = 7'h64; // d
         6'h2c: char_addr_r = 7'h6c; // l
         6'h2d: char_addr_r = 7'h65; // e
         6'h2e: char_addr_r = 7'h00; //
         6'h2f: char_addr_r = 7'h00; //
         // row 4
         6'h30: char_addr_r = 7'h75; // u
         6'h31: char_addr_r = 7'h70; // p
         6'h32: char_addr_r = 7'h00; //
         6'h33: char_addr_r = 7'h61; // a
         6'h34: char_addr_r = 7'h6e; // n
         6'h35: char_addr_r = 7'h64; // d
         6'h36: char_addr_r = 7'h00; //
         6'h37: char_addr_r = 7'h64; // d
         6'h38: char_addr_r = 7'h6f; // o
         6'h39: char_addr_r = 7'h77; // w
         6'h3a: char_addr_r = 7'h6e; // n
         6'h3b: char_addr_r = 7'h2e; // .
         6'h3c: char_addr_r = 7'h00; //
         6'h3d: char_addr_r = 7'h00; //
         6'h3e: char_addr_r = 7'h00; //
         6'h3f: char_addr_r = 7'h00; //
      endcase
   //-------------------------------------------
   // game over region
   //  - display "Game Over" at center
   //  - scale to 32-by-64 fonts
   //-----------------------------------------
   assign over_on = (pix_y[9:6]==3) &&
                    (5<=pix_x[9:5]) && (pix_x[9:5]<=13);
   assign row_addr_o = pix_y[5:2];
   assign bit_addr_o = pix_x[4:2];
   always @*
      case(pix_x[8:5])
         4'h5: char_addr_o = 7'h47; // G
         4'h6: char_addr_o = 7'h61; // a
         4'h7: char_addr_o = 7'h6d; // m
         4'h8: char_addr_o = 7'h65; // e
         4'h9: char_addr_o = 7'h00; //
         4'ha: char_addr_o = 7'h4f; // O
         4'hb: char_addr_o = 7'h76; // v
         4'hc: char_addr_o = 7'h65; // e
         default: char_addr_o = 7'h72; // r
      endcase
   //-------------------------------------------
   // mux for font ROM addresses and rgb
   //-------------------------------------------
   always @*
   begin
      text_rgb = 3'b110;  // background, yellow
      if (score_on)
         begin
            char_addr = char_addr_s;
            row_addr = row_addr_s;
            bit_addr = bit_addr_s;
            if (font_bit)
               text_rgb = 3'b001;
         end
      else if (rule_on)
         begin
            char_addr = char_addr_r;
            row_addr = row_addr_r;
            bit_addr = bit_addr_r;
            if (font_bit)
               text_rgb = 3'b001;
         end
      else if (logo_on)
         begin
            char_addr = char_addr_l;
            row_addr = row_addr_l;
            bit_addr = bit_addr_l;
            if (font_bit)
               text_rgb = 3'b011;
         end
      else // game over
         begin
            char_addr = char_addr_o;
            row_addr = row_addr_o;
            bit_addr = bit_addr_o;
            if (font_bit)
               text_rgb = 3'b001;
         end
   end

   assign text_on = {score_on, logo_on, rule_on, over_on};
   //-------------------------------------------
   // font rom interface
   //-------------------------------------------
   assign rom_addr = {char_addr, row_addr};
   assign font_bit = font_word[~bit_addr];

endmodule

// Listing 14.4
module text_screen_gen
   (
    input wire clk, reset,
    input wire video_on,
    input wire [2:0] btn,
    input wire [6:0] sw,
    input wire [9:0] pixel_x, pixel_y,
    output reg [2:0] text_rgb
   );

   // signal declaration
   // font ROM
   wire [10:0] rom_addr;
   wire [6:0] char_addr;
   wire [3:0] row_addr;
   wire [2:0] bit_addr;
   wire [7:0] font_word;
   wire font_bit;
   // tile RAM
   wire we;
   wire [11:0] addr_r, addr_w;
   wire [6:0] din, dout;
   // 80-by-30 tile map
   localparam MAX_X = 80;
   localparam MAX_Y = 30;
   // cursor
   reg [6:0] cur_x_reg;
   wire [6:0] cur_x_next;
   reg [4:0] cur_y_reg;
   wire [4:0]cur_y_next;
   wire move_x_tick, move_y_tick, cursor_on;
   // delayed pixel count
   reg [9:0] pix_x1_reg, pix_y1_reg;
   reg [9:0] pix_x2_reg, pix_y2_reg;
   // object output signals
   wire [2:0] font_rgb, font_rev_rgb;

   // body
   // instantiate debounce circuit for two buttons
   debounce deb_unit0
      (.clk(clk), .reset(reset), .sw(btn[0]),
       .db_level(), .db_tick(move_x_tick));
   debounce deb_unit1
      (.clk(clk), .reset(reset), .sw(btn[1]),
       .db_level(), .db_tick(move_y_tick));
   // instantiate font ROM
   font_rom font_unit
      (.clk(clk), .addr(rom_addr), .data(font_word));
   // instantiate dual-port video RAM (2^12-by-7)
   xilinx_dual_port_ram_sync
      #(.ADDR_WIDTH(12), .DATA_WIDTH(7)) video_ram
      (.clk(clk), .we(we), .addr_a(addr_w), .addr_b(addr_r),
       .din_a(din), .dout_a(), .dout_b(dout));

   // registers
   always @(posedge clk)
      begin
         cur_x_reg <= cur_x_next;
         cur_y_reg <= cur_y_next;
         pix_x1_reg <= pixel_x;
         pix_x2_reg <= pix_x1_reg;
         pix_y1_reg <= pixel_y;
         pix_y2_reg <= pix_y1_reg;
      end
   // tile RAM write
   assign addr_w = {cur_y_reg, cur_x_reg};
   assign we = btn[2];
   assign din = sw;
   // tile RAM read
   // use nondelayed coordinates to form tile RAM address
   assign addr_r = {pixel_y[8:4], pixel_x[9:3]};
   assign char_addr = dout;
   // font ROM
   assign row_addr = pixel_y[3:0];
   assign rom_addr = {char_addr, row_addr};
   // use delayed coordinate to select a bit
   assign bit_addr = pix_x2_reg[2:0];
   assign font_bit = font_word[~bit_addr];
   // new cursor position
   assign cur_x_next =
      (move_x_tick && (cur_x_reg==MAX_X-1)) ? 0 : // wrap
      (move_x_tick) ? cur_x_reg + 1 :
                      cur_x_reg;
   assign cur_y_next =
      (move_y_tick && (cur_x_reg==MAX_Y-1)) ? 0 : // wrap
      (move_y_tick) ? cur_y_reg + 1 :
                      cur_y_reg;
   // object signals
   // green over black and reversed video for cursor
   assign font_rgb = (font_bit) ? 3'b010 : 3'b000;
   assign font_rev_rgb = (font_bit) ? 3'b000 : 3'b010;
   // use delayed coordinates for comparison
   assign cursor_on = (pix_y2_reg[8:4]==cur_y_reg) &&
                      (pix_x2_reg[9:3]==cur_x_reg);
   // rgb multiplexing circuit
   always @*
      if (~video_on)
         text_rgb = 3'b000; // blank
      else
         if (cursor_on)
            text_rgb = font_rev_rgb;
          else
            text_rgb = font_rgb;
endmodule

// Listing 14.5
module text_screen_top
   (
    input wire clk, reset,
    input wire [2:0] btn,
    input wire [6:0] sw,
    output wire hsync, vsync,
    output wire [2:0] rgb
   );

   // signal declaration
   wire [9:0] pixel_x, pixel_y;
   wire video_on, pixel_tick;
   reg [2:0] rgb_reg;
   wire [2:0] rgb_next;
   // body
   // instantiate vga sync circuit
   vga_sync vsync_unit
      (.clk(clk), .reset(reset), .hsync(hsync), .vsync(vsync),
       .video_on(video_on), .p_tick(pixel_tick),
       .pixel_x(pixel_x), .pixel_y(pixel_y));
   // font generation circuit
   text_screen_gen text_gen_unit
      (.clk(clk), .reset(reset), .video_on(video_on),
       .btn(btn), .sw(sw), .pixel_x(pixel_x),
       .pixel_y(pixel_y), .text_rgb(rgb_next));
   // rgb buffer
   always @(posedge clk)
      if (pixel_tick)
         rgb_reg <= rgb_next;
   // output
   assign rgb = rgb_reg;
endmodule
// Listing 14.9
module timer
   (
    input wire clk, reset,
    input wire timer_start, timer_tick,
    output wire timer_up
   );

   // signal declaration
   reg [6:0] timer_reg, timer_next;

   // registers
   always @(posedge clk, posedge reset)
      if (reset)
         timer_reg <= 7'b1111111;
      else
         timer_reg <= timer_next;

   // next-state logic
   always @*
      if (timer_start)
         timer_next = 7'b1111111;
      else if ((timer_tick) && (timer_reg != 0))
         timer_next = timer_reg - 1;
      else
         timer_next = timer_reg;
   // output
   assign timer_up = (timer_reg==0);

endmodule
// Listing 13.1
module vga_sync
   (
    input wire clk, reset,
    output wire hsync, vsync, video_on, p_tick,
    output wire [9:0] pixel_x, pixel_y
   );

   // constant declaration
   // VGA 640-by-480 sync parameters
   localparam HD = 512; // horizontal display area
   localparam HF = 24; // h. front (left) border
   localparam HB = 16; // h. back (right) border
   localparam HR = 48; // h. retrace
   localparam VD = 480; // vertical display area
   localparam VF = 20;  // v. front (top) border
   localparam VB = 20;  // v. back (bottom) border
   localparam VR = 4;   // v. retrace

   // sync counters
   reg [9:0] h_count_reg, h_count_next;
   reg [9:0] v_count_reg, v_count_next;
   // output buffer
   reg v_sync_reg, h_sync_reg;
   wire v_sync_next, h_sync_next;
   // status signal
   wire h_end, v_end, pixel_tick;

   // body
   // registers
   always @(posedge clk, posedge reset)
      if (reset)
         begin
            v_count_reg <= 0;
            h_count_reg <= 0;
            v_sync_reg <= 1'b0;
            h_sync_reg <= 1'b0;
         end
      else
         begin
            v_count_reg <= v_count_next;
            h_count_reg <= h_count_next;
            v_sync_reg <= v_sync_next;
            h_sync_reg <= h_sync_next;
         end

   // mod-2 circuit to generate 25 MHz enable tick
   assign pixel_tick = 1;

   // status signals
   // end of horizontal counter (799)
  assign h_end = (h_count_reg==(HD+HF+HB+HR-2));
   // end of vertical counter (524)
  assign v_end = (v_count_reg==(VD+VF+VB+VR-2));

   // next-state logic of mod-800 horizontal sync counter
   always @*
      if (pixel_tick)  // 25 MHz pulse
         if (h_end)
            h_count_next = 0;
         else
            h_count_next = h_count_reg + 2;
      else
         h_count_next = h_count_reg;

   // next-state logic of mod-525 vertical sync counter
   always @*
      if (pixel_tick & h_end)
         if (v_end)
            v_count_next = 0;
         else
            v_count_next = v_count_reg + 2;
      else
         v_count_next = v_count_reg;

   // horizontal and vertical sync, buffered to avoid glitch
   // h_sync_next asserted between 656 and 751
   assign h_sync_next = (h_count_reg>=(HD+HB) &&
                         h_count_reg<=(HD+HB+HR-1));
   // vh_sync_next asserted between 490 and 491
   assign v_sync_next = (v_count_reg>=(VD+VB) &&
                         v_count_reg<=(VD+VB+VR-1));

   // video on/off
   assign video_on = (h_count_reg<HD) && (v_count_reg<VD);

   // output
   assign hsync = h_sync_reg;
   assign vsync = v_sync_reg;
   assign pixel_x = h_count_reg;
   assign pixel_y = v_count_reg;
   assign p_tick = pixel_tick;

endmodule
// Listing 13.2
module vga_test
   (
    input wire clk, reset,
    input wire [2:0] sw,
    output wire hsync, vsync,
    output wire [2:0] rgb
   );

   //signal declaration
   reg [2:0] rgb_reg;
   wire video_on;

   // instantiate vga sync circuit
   vga_sync vsync_unit
      (.clk(clk), .reset(reset), .hsync(hsync), .vsync(vsync),
       .video_on(video_on), .p_tick(), .pixel_x(), .pixel_y());
   // rgb buffer
   always @(posedge clk, posedge reset)
      if (reset)
         rgb_reg <= 0;
      else
         rgb_reg <= sw;
   // output
   assign rgb = (video_on) ? rgb_reg : 3'b0;

endmodule// Listing 12.4
// Dual-port RAM with synchronous read
// Modified from XST 8.1i v_rams_11

module xilinx_dual_port_ram_sync
   #(
     parameter ADDR_WIDTH = 6,
               DATA_WIDTH = 8
   )
   (
    input wire clk,
    input wire we,
    input wire [ADDR_WIDTH-1:0] addr_a, addr_b,
    input wire [DATA_WIDTH-1:0] din_a,
    output wire [DATA_WIDTH-1:0] dout_a, dout_b
   );

   // signal declaration
   reg [DATA_WIDTH-1:0] ram [2**ADDR_WIDTH-1:0];
   reg [ADDR_WIDTH-1:0] addr_a_reg, addr_b_reg;

   // body
   always @(posedge clk)
   begin
      if (we)  // write operation
        ram[addr_a] <= din_a;
      addr_a_reg <= addr_a;
      addr_b_reg <= addr_b;
   end
   // two read operations
   assign dout_a = ram[addr_a_reg];
   assign dout_b = ram[addr_b_reg];

endmodule


// Listing 14.10
module top
   (
    input wire clk, reset,
    input wire [1:0] btn1,
    input wire [1:0] btn2,
    input wire ai_switch,
    output wire hsync, vsync,
    output wire [2:0] rgb
   );

   // symbolic state declaration
   localparam  [1:0]
   newgame = 2'b00,
   play    = 2'b01,
   newball = 2'b10,
   over    = 2'b11;

   // signal declaration
   reg [1:0] state_reg, state_next;
   wire [9:0] pixel_x, pixel_y;
   wire video_on, pixel_tick, graph_on, hit, miss;
   wire [3:0] text_on;
   wire [2:0] graph_rgb, text_rgb;
   reg [2:0] rgb_reg, rgb_next;
   wire [3:0] dig0, dig1;
   reg gra_still, d_inc, d_clr, timer_start;
   wire timer_tick, timer_up;
   reg [1:0] ball_reg, ball_next;

   //=======================================================
   // instantiation
   //=======================================================
   // instantiate video synchronization unit
   vga_sync vsync_unit
      (.clk(clk), .reset(reset), .hsync(hsync), .vsync(vsync),
       .video_on(video_on), .p_tick(pixel_tick),
       .pixel_x(pixel_x), .pixel_y(pixel_y));
   // instantiate text module
   pong_text text_unit
      (.clk(clk),
       .pix_x(pixel_x), .pix_y(pixel_y),
       .dig0(dig0), .dig1(dig1), .ball(ball_reg),
       .text_on(text_on), .text_rgb(text_rgb));
   // instantiate graph module
   pong_graph graph_unit
      (.clk(clk), .reset(reset), .btn1(btn1), .btn2(btn2), .ai_switch(ai_switch),
       .pix_x(pixel_x), .pix_y(pixel_y),
       .gra_still(gra_still), .hit(hit), .miss(miss),
       .graph_on(graph_on), .graph_rgb(graph_rgb));
   // instantiate 2 sec timer
   // 60 Hz tick
   assign timer_tick = (pixel_x==0) && (pixel_y==0);
   timer timer_unit
      (.clk(clk), .reset(reset), .timer_tick(timer_tick),
       .timer_start(timer_start), .timer_up(timer_up));
   // instantiate 2-digit decade counter
   m100_counter counter_unit
      (.clk(clk), .reset(reset), .d_inc(d_inc), .d_clr(d_clr),
       .dig0(dig0), .dig1(dig1));
   //=======================================================
   // FSMD
   //=======================================================
   // FSMD state & data registers
    always @(posedge clk, posedge reset)
       if (reset)
          begin
             state_reg <= newgame;
             ball_reg <= 0;
             rgb_reg <= 0;
          end
       else
          begin
            state_reg <= state_next;
            ball_reg <= ball_next;
            if (pixel_tick)
               rgb_reg <= rgb_next;
          end
   // FSMD next-state logic
   always @*
   begin
      gra_still = 1'b1;
      timer_start = 1'b0;
      d_inc = 1'b0;
      d_clr = 1'b0;
      state_next = state_reg;
      ball_next = ball_reg;
      case (state_reg)
         newgame:
            begin
               ball_next = 2'b11; // three balls
               d_clr = 1'b1;      // clear score
               if ((btn1 != 2'b00) || (btn2 != 2'b00))  // button pressed
                  begin
                     state_next = play;
                     ball_next = ball_reg - 1;
                  end
            end
         play:
            begin
               gra_still = 1'b0;  // animated screen
               if (hit)
                  d_inc = 1'b1;   // increment score
               else if (miss)
                  begin
                     if (ball_reg==0)
                        state_next = over;
                     else
                        state_next = newball;
                     timer_start = 1'b1;  // 2 sec timer
                     ball_next = ball_reg - 1;
                  end
            end
         newball:
            // wait for 2 sec and until button pressed
            if (timer_up && ((btn1 != 2'b00) || (btn2 != 2'b00)))
                state_next = play;
         over:
            // wait for 2 sec to display game over
            if (timer_up)
                state_next = newgame;
       endcase
    end
   //=======================================================
   // rgb multiplexing circuit
   //=======================================================
   always @*
      if (~video_on)
         rgb_next = 0; // blank the edge/retrace
      else
         // display score, rule, or game over
         if (text_on[3] ||
               ((state_reg==newgame) && text_on[1]) || // rule
               ((state_reg==over) && text_on[0]))
            rgb_next = text_rgb;
         else if (graph_on)  // display graph
           rgb_next = graph_rgb;
         else if (text_on[2]) // display logo
           rgb_next = text_rgb;
         else
           rgb_next = 3'b110; // yellow background
   // output
   assign rgb = rgb_reg;
endmodule
