

// -------------------------

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

  uint7 wave[64] = {
$$for i=0,63 do
    $math.floor(127.0 * (0.5+0.5*math.cos(math.pi + 2*math.pi*i/63)))$,
$$end
  };

  uint$color_depth$ v = 0;
  uint6 frame  = 0;  
  int9  pos[4] = {0,0,0,0};
  
  pix_r := 0; pix_g := 0; pix_b := 0;
  // ---------- show time!
  while (1) {

    // display frame
    while (pix_vblank == 0) {
      if (pix_active) {
        4x {
          if (pix_y + 20 > pos[__id] && pix_y < pos[__id] + 20) {
            v = ((wave[pix_y-pos[__id] + 32]>>1) * (__id+5)) >> 3;
            pix_r = v*4;
            pix_g = v*3;
            pix_b = v*2;
          }
        }
      }
    }    
    // prepare next
    frame = frame + 1;    
    4x {
      pos[__id] = $240 - 127$ + (wave[(frame + (__id << 3)) & 63] << 1);
    }
    // wait for sync
    while (pix_vblank == 1) {} 
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

  uint8 frame  = 0;

  // forever
  while (1) {
  
    while (vblank == 0) { }

    frame = frame + 1;

  }
}
