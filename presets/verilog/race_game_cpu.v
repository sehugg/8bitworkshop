`include "hvsync_generator.v"
`include "sprite_renderer.v"
`include "cpu8.v"

// uncomment to see scope view
//`define DEBUG

module sprite_multiple_top(clk, reset, hsync, vsync, hpaddle, vpaddle,
                           address_bus, to_cpu, from_cpu, write_enable
`ifdef DEBUG
                           , output [7:0] A
                           , output [7:0] B
                           , output [7:0] IP
                           , output carry
                           , output zero
`else
                           , output [2:0] rgb
`endif
);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
`ifdef DEBUG
  wire [2:0] rgb;
  assign IP = cpu.IP;
  assign A = cpu.A;
  assign B = cpu.B;
  assign carry = cpu.carry;
  assign zero = cpu.zero;
`endif
  
  parameter PADDLE_X = 0;
  parameter PADDLE_Y = 1;
  parameter PLAYER_X = 2;
  parameter PLAYER_Y = 3;
  parameter ENEMY_X = 4;
  parameter ENEMY_Y = 5;
  parameter ENEMY_DIR = 6;
  parameter SPEED = 7;
  parameter TRACKPOS_LO = 8;
  parameter TRACKPOS_HI = 9;

  parameter IN_HPOS = 8'b01000000;
  parameter IN_VPOS = 8'b01000001;
  parameter IN_FLAGS = 8'b01000010;

  reg [7:0] ram[0:63];
  reg [7:0] rom[0:127];
  
  output wire [7:0] address_bus;
  output reg  [7:0] to_cpu;
  output wire [7:0] from_cpu;
  output wire write_enable;
  
  CPU cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  always @(posedge clk)
    if (write_enable)
      ram[address_bus[5:0]] <= from_cpu;
  
  always @(*)
    casez (address_bus)
      // RAM
      8'b00??????: to_cpu = ram[address_bus[5:0]];
      // special read registers
      IN_HPOS:  to_cpu = hpos[7:0];
      IN_VPOS:  to_cpu = vpos[7:0];
      IN_FLAGS: to_cpu = {2'b0, frame_collision,
                          vsync, hsync, vpaddle, hpaddle, display_on};
      // ROM
      8'b1???????: to_cpu = rom[address_bus[6:0]];
      default: ;
    endcase
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire player_vstart = {1'0,ram[PLAYER_Y]} == vpos;
  wire player_hstart = {1'0,ram[PLAYER_X]} == hpos;
  wire player_gfx;
  wire player_is_drawing;

  wire enemy_vstart = {1'0,ram[ENEMY_Y]} == vpos;
  wire enemy_hstart = {1'0,ram[ENEMY_X]} == hpos;
  wire enemy_gfx;
  wire enemy_is_drawing;

  wire [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;
  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  sprite_renderer player_renderer(
    .clk(clk),
    .vstart(player_vstart),
    .hstart(player_hstart),
    .load(hpos == 256), //TODO?
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  sprite_renderer enemy_renderer(
    .clk(clk),
    .vstart(enemy_vstart),
    .hstart(enemy_hstart),
    .load(hpos == 260), //TODO?
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(enemy_gfx),
    .in_progress(player_is_drawing));
  
  /*
  always @(posedge hsync)
    begin
      if (!hpaddle) ram[PADDLE_X] <= vpos[7:0];
      if (!vpaddle) ram[PADDLE_Y] <= vpos[7:0];
    end
  
  wire enemy_hit_left = (enemy_x == 64);
  wire enemy_hit_right = (enemy_x == 192);
  wire enemy_hit_edge = enemy_hit_left || enemy_hit_right;
  
  always @(posedge vsync)
    begin
      player_x <= paddle_x;
      player_y <= 180;
      track_pos <= track_pos + {11'b0,speed[7:4]};
      enemy_y <= enemy_y + {3'b0, speed[7:4]};
      if (enemy_hit_edge)
        enemy_dir <= !enemy_dir;
      if (enemy_dir ^ enemy_hit_edge)
        enemy_x <= enemy_x + 1;
      else
        enemy_x <= enemy_x - 1;
      // collision check?
      if (frame_collision)
        speed <= 16;
      else if (speed < ~paddle_y)
        speed <= speed + 1;
      else
        speed <= speed - 1;
    end
  */
  
  initial begin
    rom = '{
      // initialize registers
      `I_CONST_IMM_A,
      128,
      `I_STORE_A(PLAYER_X),
      `I_STORE_A(ENEMY_X),
      `I_STORE_A(ENEMY_Y),
      `I_CONST_IMM_A,
      180,
      `I_STORE_A(PLAYER_Y),
      `I_ZERO_A,
      `I_STORE_A(SPEED),
      // test hpaddle flag
      `I_CONST_IMM_A,
      8'b00000010,
      `I_CONST_IMM_B,
      IN_FLAGS,
      `I_COMPUTE_READB(DEST_NOP, OP_AND),
      `I_BRANCH_IF_ZERO(1),
      128+10,
      // [vpos] -> paddle_x
      `I_CONST_IMM_B,
      IN_VPOS,
      `I_COMPUTE_READB(DEST_A, OP_LOAD_B),
      `I_STORE_A(PLAYER_X),
      // wait for vsync=1 then vsync=0
      `I_CONST_IMM_A,
      8'b00010000,
      `I_CONST_IMM_B,
      IN_FLAGS,
      `I_COMPUTE_READB(DEST_NOP, OP_AND),
      `I_BRANCH_IF_ZERO(1),
      128+25,
      `I_COMPUTE_READB(DEST_NOP, OP_AND),
      `I_BRANCH_IF_ZERO(0),
      128+28,
      // check collision
      `I_CONST_IMM_A,
      8'b00100000,
      `I_CONST_IMM_B,
      IN_FLAGS,
      `I_COMPUTE_READB(DEST_NOP, OP_AND),
      `I_BRANCH_IF_ZERO(1),
      128+41,
      // load slow speed
      `I_CONST_IMM_A,
      16,
      `I_STORE_A(SPEED),
      // update speed
      `I_CONST_IMM_B,
      SPEED,
      `I_COMPUTE_READB(DEST_A, OP_LOAD_B),
      `I_COMPUTE(DEST_A, OP_INC),
      // don't store if == 0
      `I_BRANCH_IF_ZERO(1),
      128+48,
      `I_STORE_A(SPEED),
      // branch target
      `I_COMPUTE_READB(DEST_A, OP_LOAD_B),
      `I_COMPUTE(DEST_A, OP_LSR),
      `I_COMPUTE(DEST_A, OP_LSR),
      `I_COMPUTE(DEST_A, OP_LSR),
      `I_COMPUTE(DEST_A, OP_LSR),
      // add to lo byte of track pos
      `I_CONST_IMM_B,
      TRACKPOS_LO,
      `I_COMPUTE_READB(DEST_B, OP_ADD),
      `I_SWAP_AB,
      `I_STORE_A(TRACKPOS_LO),
      `I_SWAP_AB,
      // update enemy vert pos
      `I_CONST_IMM_B,
      ENEMY_Y,
      `I_COMPUTE_READB(DEST_A, OP_ADD),
      `I_STORE_A(ENEMY_Y),
      // repeat main loop
      `I_JUMP_IMM,
      128+10,
      // leftover elements
      63{0}
    };
  end
  
  reg frame_collision;
  
  always @(posedge clk)
    if (player_gfx && (enemy_gfx || track_gfx))
      frame_collision <= 1;
    else if (vpos==0)
      frame_collision <= 0;
  
  wire track_offside = (hpos[7:5]==0) || (hpos[7:5]==7);
  wire track_shoulder = (hpos[7:3]==3) || (hpos[7:3]==28);
  wire track_gfx = (vpos[5:1]!=ram[TRACKPOS_LO][5:1]) && track_offside;
  
  wire r = display_on && (player_gfx || enemy_gfx || track_shoulder);
  wire g = display_on && (player_gfx || track_gfx);
  wire b = display_on && (enemy_gfx || track_shoulder);
  assign rgb = {b,g,r};

endmodule
