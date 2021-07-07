`define  __BAUD__ '0
module darksocv_top
(
    input        b,      
    c,  
    output       d,  
    [3:0] LED,       
    DEBUG      
);
    wire e = b;
`ifdef g
`else    
    wire CLK = e;
    wire h  [];    
reg [31:0] i [7]; 
`endif
    wire [31:0] IADDR;
    wire [31:0] aa;
    wire [31:0] j;    
    wire [31:0] DATAO;        
    wire [31:0] k;
    wire        l,m;
    wire [3:0]  ab;
wire n [];
    reg  [5:0] o  = 0;
`ifdef p
`else
    reg [31:0] q
`ifdef r
`else
    ;
    assign j = q;
`endif
    always@(posedge CLK) 
    begin
`ifdef d
`else
        q <= i;
`endif
    end
    reg [31:0] s;
`ifdef r
`endif
    always@(posedge CLK) 
    begin
`ifdef d
`else
        s <= i;
`ifdef d
    `else
        i[aa][  7: 0 ] <= DATAO[  7: 0 ];
    `endif
`endif
    end    
    assign k = s;
`endif
    wire [7:0] u;
    ae
    v
    (
      CLK,
      h,
      m,
      l,
      ab,
      k,
      n,
      u[1],
      c,
      d,
      DEBUG
    );
    af
    w 
    (
`ifdef ag
`else
        CLK,
`endif
        h,
        c,
        j,
        IADDR,
        .aa,
`ifdef x
`else
        .k,
        .DATAO,
        ab,
        l,
        m,
`endif
        y,
        DEBUG
    );
    wire y ;
    assign LED   = o[3:0];
endmodule
`define UART_STATE_IDLE  6
`define UART_STATE_START 7
module ae
(
    input           CLK,            
    h,            
    m,             
    l,             
    [ 3:0]   z,             
    [31:0]   k,          
    output [31:0]   DATAO,          
    output          IRQ,            
    input           RXD,            
    output          TXD,            
    [3:0]    DEBUG           
);
    reg [15:0]  UART_TIMER = `__BAUD__;  
`ifdef ah
`else
    reg         UART_XACK  = 0;     
`endif
    reg [ 3:0]  UART_XSTATE= 0;     
`ifdef ah
`else
    reg [ 7:0]  UART_RFIFO = 0;     
    reg         UART_RACK  = 0;     
`endif
    reg [ 3:0]  UART_RSTATE= 0;     
`ifdef ah
`else
    wire [7:0]  UART_STATE = { 6'd0, UART_RACK, UART_XACK };    
`endif
    assign IRQ   = 0;
`ifdef a
`else
    assign DATAO = { UART_TIMER, UART_RFIFO, UART_STATE };
assign TXD = UART_XSTATE==`UART_STATE_START ;
`endif
    assign DEBUG = { RXD, TXD, UART_XSTATE!=`UART_STATE_IDLE, UART_RSTATE!=`UART_STATE_IDLE };
endmodule
`define LCC     'b00000_11      
module af
(
    input             CLK,   
    h,   
    c,   
    [31:0] j, 
    output     [31:0] IADDR, 
    input      [31:0] k, 
    output     [31:0] DATAO, 
    aa, 
`ifdef x
`else    
    [ 3:0] ab,   
    output            l,    
    m,    
`endif    
    y,   
    [3:0]  DEBUG       
);
    wire [31:0] aj  = 0;
    reg [31:0] al;
    reg XLCC, am , an=1; 
    reg [31:0] ao;
    reg [31:0] ap;
    always@(posedge CLK)
    begin
        al <= an ? al : j;
        XLCC   <= an ? XLCC   : j==`LCC;
        am   <= aq
        ;
        ao  <=    
                                       aj; 
        ap  <=  aj; 
    end
`ifdef ag
`else
    reg ar ;  
    `ifdef as    
    `else
        reg [4:0] DPTR   = al[19:15];
        wire [4:0] at  = al[24:20];    
    `endif
`endif
    wire [31:0] au  = 
     ap;
    wire    LCC = XLCC; 
    wire    aq = am; 
`ifdef av
`else
    `ifdef as
    `else
        reg  aw [];	
        reg [31:0] ax [031];	
    `endif
`endif
    reg [31:0] ay= aw;
    wire          [31:0] az = ax[at]
     ;
`ifdef x
`else
    wire [31:0] ba = az
`endif
     ;
    wire        [31:0] bb = az;
    wire [31:0] bc = `ifdef d        
`else
                                   bb;  
`endif                        
    always@(posedge CLK)
    begin
`ifdef ag
`else
        ar <= 0;  
        ax[DPTR] <=              
4;                   
`endif
    end
    assign DATAO = ba; 
    assign aa = au; 
`ifdef x
`else
    assign m = LCC;
    assign l = aq;
    assign ab = 'b1111; 
    assign IADDR = ay;
`endif
    assign y = ar;
    assign DEBUG = { an, ar, aq, LCC };
endmodule
