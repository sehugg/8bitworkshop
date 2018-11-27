
/*
---------------------------------------------------------------
TMSOPT v.0.1 - Eduardo A. Robsy Petrus & Arturo Ragozini 2007
Credits to Rafael Jannone for his Floyd-Steinberg implementation
---------------------------------------------------------------
 TGA image converter (24 bpp, uncompressed) to TMS9918 format
---------------------------------------------------------------
Overview
---------------------------------------------------------------
Selects the best solution for each 8x1 pixel block
Optimization uses the following algorithm:

(a) Select one 1x8 block, select a couple of colors, apply
    Floyd-Steinberg within the block, compute the squared error,
    repeat for all 105 color combinations, keep the best couple
    of colors.

(b) Apply Floyd-Steinberg to the current 1x8 block with the best
    two colors seleted before and spread the errors to the
    adjacent blocks.

(c) repeat (a) and (b) on the next 1x8 block, scan all lines.

(d) Convert the image in pattern and color definitions (CHR & CLR)

To load in MSX basic use something like this:

10 screen 2: color 15,0,0
20 bload"FILE.CHR",s
30 bload"FILE.CLR",s
40 goto 40

---------------------------------------------------------------
Compilation instructions
---------------------------------------------------------------
 Tested with GCC/Win32 [mingw]:

   GCC TMSopt.c -oTMSopt.exe -O3 -s

 It is standard C, so there is a fair chance of being portable!
 NOTE
 In the current release the name of the C file has become scr2floyd.c
---------------------------------------------------------------
History
---------------------------------------------------------------
 Ages ago   - algorithm created
 16/05/2007 - first C version (RAW format)
 17/05/2007 - TGA format included, some optimization included
 18/05/2007 - Big optimization (200 times faster), support for
              square errors
 19/05/2007 - Floyd-Stenberg added, scaling for better rounding
 24/05/2007 - Floyd-Stenberg included in the color optimization.
---------------------------------------------------------------
Legal disclaimer
---------------------------------------------------------------
 Do whatever you want to do with this code/program.
 Use at your own risk, all responsability would be declined.
 It would be nice if you credit the authors, though.
---------------------------------------------------------------
*/

// Headers!

#include<stdio.h>
#include<time.h>
#include<limits.h>
#include<stdlib.h>

typedef unsigned int    uint;
typedef unsigned char   uchar;
typedef unsigned short  ushort;

//#define DEBUG

#define scale 16
#define inrange8(t) ((t)<0) ? 0 :(((t)>255) ? 255:(t))
#define clamp(t)    ((t)<0) ? 0 :(((t)>255*scale) ? 255*scale : (t))

// Just one function for everything

int main(int argc, char **argv)
{

// Vars

 FILE *file,*CHR,*CLR;
 int bc,bp,i,j,x,y,c,p,k,MAXX,MAXY;
 uint n,total=0,done=0,size;
 char *name;
 short image[512+2][512+2][3],header[18],palette[16][3];

// TMS9918 RGB palette - approximated 50Hz PAL values
 uint pal[16][3]= {
{ 0,0,0},                 // 0 Transparent
{ 0,0,0},                 // 1 Black           0    0    0
{ 33,200,66},             // 2 Medium green   33  200   66
{ 94,220,120},            // 3 Light green    94  220  120
{ 84,85,237},             // 4 Dark blue      84   85  237
{ 125,118,252},           // 5 Light blue    125  118  252
{ 212,82,77},             // 6 Dark red      212   82   77
{ 66,235,245},            // 7 Cyan           66  235  245
{ 252,85,84},             // 8 Medium red    252   85   84
{ 255,121,120},           // 9 Light red     255  121  120
{ 212,193,84},            // A Dark yellow   212  193   84
{ 230,206,128},           // B Light yellow  230  206  128
{ 33,176,59},             // C Dark green     33  176   59
{ 201,91,186},            // D Magenta       201   91  186
{ 204,204,204},           // E Gray          204  204  204
{ 255,255,255}            // F White         255  255  255
};
// Scale palette

 for (i=0;i<16;i++)
     for (k=0;k<3;k++)
        palette[i][k] = scale*pal[i][k];

// Get time

 clock();

// Application prompt

 printf("TMSopt v.0.1 - TGA 24bpp to TMS9918 converter.\nCoded by Eduardo A. Robsy Petrus & Arturo Ragozini 2007.\n\n");
 printf("Credits to Rafael Jannone for his Floyd-Steinberg implementation.\n \n");


// Guess the name of the image I used for testing
#ifdef DEBUG
argc = 2;
argv[1] = malloc(20);
argv[1][0] = 'l';
argv[1][1] = 'e';
argv[1][2] = 'n';
argv[1][3] = 'n';
argv[1][4] = 'a';
argv[1][5] = '_';
argv[1][6] = '.';
argv[1][7] = 't';
argv[1][8] = 'g';
argv[1][9] = 'a';
argv[1][10] = 0;
#endif

// Test if only one command-line parameter is available

 if (argc==1)
 {
  printf("Syntax: TMSopt [file.tga]\n");
  return 1;
 }

// Open source image (TGA, 24-bit, uncompressed)

 if ((file=fopen(argv[1],"rb"))==NULL)
 {
  printf("cannot open %s file!\n",argv[1]);
  return 2;
 }

// Read TGA header

 for (i=0;i<18;i++) header[i]=fgetc(file);

// Check header info

 for (i=0,n=0;i<12;i++) n+=header[i];

// I deleted the check on n, was it important ?
 if ((header[2]!=2)||(header[17])||(header[16]!=24))
 {
  printf("Unsupported file format!\n");
  return 3;
 }

// Calculate size

 MAXX=header[12]|header[13]<<8;
 MAXY=header[14]|header[15]<<8;

 size=((MAXX+7)>>3)*MAXY;

// Check size limits

 if ((!MAXX)||(MAXX>512)||(!MAXY)||(MAXY>512))
 {
  printf("Unsupported size!");
  return 4;
 }

// Load image data

 for (y=MAXY-1;y>=0;y--)
  for (x=0;x<MAXX;x++)
   for (k=0;k<3;k++)
    image[x+1][y+1][2-k]=((short)fgetc(file))*scale;        // Scale image

 for (x=0;x<MAXX;x++)
    for (k=0;k<3;k++)
        image[x][0][k] = image[x][1][k];

 for (y=0;y<MAXY;y++)
    for (k=0;k<3;k++)
        image[0][y][k] = image[1][0][k];


// Close file

 fclose(file);

// Information

 printf("Converting %s (%i,%i) to TMS9918 format ",argv[1],MAXX,MAXY);
 printf("in (%i,%i) screen 2 tiles...    ",((MAXX+7)>>3),((MAXY+7)>>3));


// Image processing

for (y=0;y<((MAXY+7)>>3);y++)
    for (j=0;j<8;j++)
        for (x=0;x<((MAXX+7)>>3);x++)
        {
            // Generate alternatives
            uchar  c1,  c2;
            uchar bc1, bc2;
            uint  bv;
            uint  bs = INT_MAX;

            uint  yy = 1+((y<<3)|j);

            for (c1=1;c1<16;c1++)
            {
                ushort c1r,c1g,c1b;

                c1r = palette[c1][0];
                c1g = palette[c1][1];
                c1b = palette[c1][2];

                for (c2=c1+1;c2<16;c2++)
                {
                    ushort c2r,c2g,c2b;
                    ushort r,g,b;

                    uint  cs = 0;
                    uint  cv = 0;

                    uint xx = 1+(x<<3);

                    c2r = palette[c2][0];
                    c2g = palette[c2][1];
                    c2b = palette[c2][2];

                    r =  clamp(image[xx][yy][0]);
                    g =  clamp(image[xx][yy][1]);
                    b =  clamp(image[xx][yy][2]);

                    for (i=0;i<8;i++)
                    {
                        short  e10 = (r-c1r);
                        short  e11 = (g-c1g);
                        short  e12 = (b-c1b);
                        uint   mc1 = e10*e10+e11*e11+e12*e12;

                        short  e20 = (r-c2r);
                        short  e21 = (g-c2g);
                        short  e22 = (b-c2b);
                        uint   mc2 = e20*e20+e21*e21+e22*e22;

                        cs += (mc1>mc2) ? mc2 : mc1;

                        if (cs>bs) break;

                        cv |= ((mc1>mc2)<<i);

                        xx++;
                        if (mc1>mc2)
                        {
                            r = clamp(image[xx][yy][0]) + 7*e20/16 ;
                            g = clamp(image[xx][yy][1]) + 7*e21/16 ;
                            b = clamp(image[xx][yy][2]) + 7*e22/16 ;
                        }
                        else
                        {
                            r = clamp(image[xx][yy][0]) + 7*e10/16 ;
                            g = clamp(image[xx][yy][1]) + 7*e11/16 ;
                            b = clamp(image[xx][yy][2]) + 7*e12/16 ;
                        }
                    }
                    if  (cs<bs)
                    {
                        bs  = cs;
                        bv  = cv;
                        bc1 = c1;
                        bc2 = c2;
                    }
                }
            }

          // Here we have the best colors and the best pattern for line j

          short quant_error;

          uint xx = 1+((x<<3));

          for (i=0;i<8;i++,xx++)
            for (k=0;k<3;k++)
            {
            // Compute the quantization error

              if (bv&(1<<i))
              {
                quant_error = (clamp(image[xx][yy][k]) - palette[bc2][k])/16;
                image[xx][yy][k] = palette[bc2][k];
              }
              else
              {
                quant_error = (clamp(image[xx][yy][k]) - palette[bc1][k])/16;
                image[xx][yy][k] = palette[bc1][k];
              }

            // Spread the quantization error

              short q2 = quant_error<<1;
              image[xx+1][yy+1][k] = clamp(image[xx+1][yy+1][k])+ quant_error; // 1 *
              quant_error += q2 ;
              image[xx-1][yy+1][k] = clamp(image[xx-1][yy+1][k])+ quant_error; // 3 *
              quant_error += q2 ;
              image[xx+0][yy+1][k] = clamp(image[xx+0][yy+1][k])+ quant_error; // 5 *
              quant_error += q2 ;
              image[xx+1][yy+0][k] = clamp(image[xx+1][yy+0][k])+ quant_error; // 7 *
            }


            // Update status counter

          if (done*100/size<(done+1)*100/size)
             printf("\b\b\b%2i%%",100*done/size);
          done++;
          total++;
        }


// Conversion done

 printf("\b\b\bOk   \n");


// Create TMS output files (CHR, CLR)

 argv[1][strlen(argv[1])-3]='C';
 argv[1][strlen(argv[1])-2]='H';
 argv[1][strlen(argv[1])-1]='R';
 CHR=fopen(argv[1],"wb");

 argv[1][strlen(argv[1])-2]='L';
 CLR=fopen(argv[1],"wb");

 fputc(0xFE,CLR);    // Binary data
 fputc(0x00,CLR);    // Start at 2000h
 fputc(0x20,CLR);
 fputc(0xFF,CLR);    // Stop at 37FFh
 fputc(0x37,CLR);
 fputc(0x00,CLR);    // Run
 fputc(0x00,CLR);


 fputc(0xFE,CHR);    // Binary data
 fputc(0x00,CHR);    // Start at 0000h
 fputc(0x00,CHR);
 fputc(0xFF,CHR);    // Stop at 17FFh
 fputc(0x17,CHR);
 fputc(0x00,CHR);    // Run
 fputc(0x00,CHR);

   // Save best pattern and colour combination
   // NOTE1:
   // THIS PART CAN BE LARGELY CUTTED AND OPTIMIZED REUSING
   // RESULTS FROM THE PREVIOUS LOOP, BUT WHO CARES?
   // NOTE2:
   // This code can be used for conversion without dithering

 for (y=0;y<((MAXY+7)>>3);y++)
    for (x=0;(x<(MAXX+7)>>3);x++)
        for (j=0;j<8;j++)
        {
            uchar c1,c2;
            uint bs = INT_MAX;
            uchar bp = 0, bc = 0;

            uint yy = 1+((y<<3)|j);

            for (c1=1;c1<16;c1++)
                for (c2=c1+1;c2<16;c2++)
                {
                    uint    cs = 0;
                    uint    cp = 0;
                    for (i=0;i<8;i++)
                    {
                        uint xx = 1+((x<<3)|i);

                        short  u0 = (palette[c1][0]-image[xx][yy][0]);
                        short  u1 = (palette[c1][1]-image[xx][yy][1]);
                        short  u2 = (palette[c1][2]-image[xx][yy][2]);
                        uint  mc1 = u0*u0+u1*u1+u2*u2;

                        short  v0 = (palette[c2][0]-image[xx][yy][0]);
                        short  v1 = (palette[c2][1]-image[xx][yy][1]);
                        short  v2 = (palette[c2][2]-image[xx][yy][2]);
                        uint  mc2 = v0*v0+v1*v1+v2*v2;

                        cp = (cp<<1) | (mc1>mc2);
                        cs += (mc1>mc2) ? mc2 : mc1;
                        if (cs>bs) break;
                    }
                    if  (cs<bs)
                    {
                        bs=cs;
                        bp=cp;
                        bc=c2*16+c1;
                    }
                }

          fputc(bc,CLR);
          fputc(bp,CHR);
        }


 fclose(CHR);
 fclose(CLR);

// Generate new name

 name = malloc(0x100);
 argv[1][strlen(argv[1])-4]=0;
 strcpy(name,argv[1]);
 strcat(name,"_tms.tga");

// Save file header

 file=fopen(name,"wb");

 for (i=0;i<18;i++) fputc(header[i],file);

// Save image data

 for (y=MAXY-1;y>=0;y--)
  for (x=0;x<MAXX;x++)
   for (k=0;k<3;k++)
    fputc(inrange8(image[1+x][1+y][2-k]/scale),file);       // Scale to char

// Close file

 fclose(file);

// Prompt elapsed time

 printf("%.2f million combinations analysed in %.2f seconds.\n",total/1e6,(float)clock()/(float)CLOCKS_PER_SEC);
 printf("Note: the .CLR and .CHR files have correct headers only for 256x192 images. \n");

 return 0;
}

