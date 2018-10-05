
`ifndef FONT_CP437_H
`define FONT_CP437_H

// PC font (code page 437)

module font_cp437_8x8(addr, data);

  input [10:0] addr;
  output [7:0] data;

  reg [7:0] bitarray[0:2047];

  assign data = bitarray[addr];

  initial begin/*{w:8,h:8,bpp:1,count:256}*/
    $readmemh("cp437.hex", bitarray);
  end
endmodule

`endif
