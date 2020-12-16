
$include('ntsc.ice')

// -------------------------

algorithm frame_display(
  input   uint10 pix_x,
  input   uint10 pix_y,
  input   uint1  pix_active,
  input   uint1  pix_vblank,
  output! uint$color_depth$ pix_r,
  output! uint$color_depth$ pix_g,
  output! uint$color_depth$ pix_b
) <autorun> {

  $include('font_cp437_8x8.ice')
  
  // 256x256 cells (240 lines used)
  dualport_bram uint1 cells[65536] = uninitialized;
  // previous 2 rows
  dualport_bram uint1 row1[256] = uninitialized;
  dualport_bram uint1 row2[256] = uninitialized;

  // 3x3 pixel mask around x/y
  uint9 neigh = 0;

  // offsets to X and Y coordinate
  uint8 xx := pix_x[0,8];
  uint8 yy := pix_y[0,8];
  uint8 xxm3 := xx - 3;
  uint8 xxm1 := xx - 1;
  uint8 yym1 := yy - 1;

  // count # of live neigbors (up to 8)
  uint3 ncount ::= 
    neigh[0,1] + neigh[1,1] + neigh[2,1]
  + neigh[3,1] + neigh[5,1]
  + neigh[6,1] + neigh[7,1] + neigh[8,1];
  
  // pixel is set if:
  // * 3 live neighbors
  // * 2 live neigbors and was already alive
  uint1 alive ::= (ncount == 3) || (ncount == 2 && neigh[4,1]);
  
  // by default r,g,b are set to zero
  pix_r := 0;
  pix_g := 0;
  pix_b := 0;
  
  // set dual-port block RAM bus addresses (continuously)
  row1.addr0 := xx;
  row2.addr0 := xx;
  cells.addr0 := {yy, xx};
  row1.addr1 := xxm1;
  row2.addr1 := xxm1;
  cells.addr1 := {yym1, xxm3};
  row1.wenable1 := 1;
  row2.wenable1 := 1;
  cells.wenable1 = 1;
  
  // ---------- show time!
  while (1) {
    // display frame
    while (pix_vblank == 0) {
      if (pix_active) {
        // shift neighbor cells to the left by 1 pixel
        // while adding right pix from row1/row2/cells array
        neigh = {
          neigh[6,2], row1.rdata0,
          neigh[3,2], row2.rdata0,
          neigh[0,2], cells.rdata0
        };
        // copy alive -> cells -> row2 -> row1
        row1.wdata1 = row2.rdata0;
        row2.wdata1 = cells.rdata0;
        cells.wdata1 = alive;
        // set RGB color based on surroundings
        pix_r = ncount * 31;
        pix_g = neigh[4,1] * 255;
        pix_b = alive * 255;
      }
    }
  }
}

// -------------------------

algorithm main(
  output! uint$color_depth$ video_r,
  output! uint$color_depth$ video_g,
  output! uint$color_depth$ video_b,
  output! uint1 video_hs,
  output! uint1 video_vs
) 
<@clock,!reset> 
{

  uint1  active = 0;
  uint1  vblank = 0;
  uint10 pix_x  = 0;
  uint10 pix_y  = 0;

  ntsc ntsc_driver (
	ntsc_hs :> video_hs,
	ntsc_vs :> video_vs,
	active :> active,
	vblank :> vblank,
	ntsc_x  :> pix_x,
	ntsc_y  :> pix_y
  );

  frame_display display (
	  pix_x      <: pix_x,
	  pix_y      <: pix_y,
	  pix_active <: active,
	  pix_vblank <: vblank,
	  pix_r      :> video_r,
	  pix_g      :> video_g,
	  pix_b      :> video_b
  );

  // forever
  while (1) {
  }
}
