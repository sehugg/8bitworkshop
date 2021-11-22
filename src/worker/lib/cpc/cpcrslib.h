
#ifndef  __cpcrslib_h__
#define __cpcrslib_h__


void 						cpc_SetMode( char color) __z88dk_fastcall;
void 						cpc_SetModo( char x) __z88dk_fastcall;
void 						cpc_SetColour(unsigned char num,  char color) __z88dk_callee;
void  						cpc_SetInk(unsigned char num,  unsigned char color) __z88dk_callee;
void  						cpc_SetBorder( char color) __z88dk_fastcall;
int							cpc_GetScrAddress(char x, char y) __z88dk_callee;
void 						cpc_ClrScr(void);


void						cpc_EnableFirmware(void);
void						cpc_DisableFirmware(void);
unsigned char 				cpc_Random(void);
void 						cpc_PrintStr(char *text) __z88dk_fastcall;
void     					cpc_RRI(unsigned int pos, unsigned char w, unsigned char h) __z88dk_callee;
void  		   				cpc_RLI(unsigned int pos, unsigned char w, unsigned char h) __z88dk_callee;




void 						cpc_PutSprite(char *sprite, int posicion)  __z88dk_callee;
void 						cpc_PutSp(char *sprite, char height, char width, int address)  __z88dk_callee;
void						cpc_PutSp4x14(char *sprite, int address)  __z88dk_callee;
void 						cpc_PutSpriteXOR(char *sprite, int posicion) __z88dk_callee;
void 						cpc_PutSpXOR(char *sprite, char height, char width, int address) __z88dk_callee;
//void 						cpc_PutSpriteTr(char *sprite, int *posicion) __z88dk_callee;
void 						cpc_PutSpTr(char *sprite, char height, char width, int address) __z88dk_callee;
void						cpc_GetSp(char *sprite, char alto, char ancho, int posicion) __z88dk_callee;
void 						cpc_PutMaskSprite(char *sprite,unsigned int addr) __z88dk_callee;
void    					cpc_PutMaskSp(char *sprite, char alto, char ancho, int posicion) __z88dk_callee;
void 						cpc_PutMaskSp4x16(char *sprite,unsigned int addr) __z88dk_callee;
void 						cpc_PutMaskSp2x8(char *sprite,unsigned int addr) __z88dk_callee;
unsigned char				cpc_CollSp(char *sprite, char *sprite2) __z88dk_callee;

void						cpc_PutTile2x8(char *sprite, unsigned char x, unsigned char y);
void						cpc_PutTile2x8b(char *sprite, int posicion) __z88dk_callee;


void						cpc_PrintGphStr(char *text, int destino) __z88dk_callee;
void						cpc_PrintGphStrM1(char *text, int destino)  __z88dk_callee;
void						cpc_PrintGphStr2X(char *text, int destino)  __z88dk_callee;
void						cpc_PrintGphStrM12X(char *text, int destino) __z88dk_callee;

void						cpc_PrintGphStrXY(char *text, char a, char b) __z88dk_callee;
void						cpc_PrintGphStrXYM1(char *text, char a, char b) __z88dk_callee;
void						cpc_PrintGphStrXY2X(char *text, char a, char b) __z88dk_callee;
void						cpc_PrintGphStrXYM12X(char *text, char a, char b) __z88dk_callee;
void						cpc_SetInkGphStr(char a, char b) __z88dk_callee;
void						cpc_SetInkGphStrM1(char a, char b) __z88dk_callee;


void     					cpc_PrintGphStrStd(char color, char *cadena, int destino);
void  		   				cpc_PrintGphStrStdXY(char color, char *cadena, char x, char y);


int 						cpc_AnyKeyPressed(void);
void 						cpc_ScanKeyboard(void);
char 						cpc_TestKeyF(char number) __z88dk_fastcall;
void						cpc_DeleteKeys(void);
void 						cpc_AssignKey(unsigned char tecla, int valor);
unsigned char 				cpc_TestKey(unsigned char tecla) __z88dk_fastcall;
void 						cpc_RedefineKey(unsigned char tecla) __z88dk_fastcall;


// Uncompression tools
void						cpc_UnExo(char *origen, int destino)  __z88dk_callee;
void						cpc_Uncrunch(char *origen, int destino)  __z88dk_callee;






// TILE MAP:
void						cpc_InitTileMap(void);
void 						cpc_SetTile(unsigned char x, unsigned char y, unsigned char b);
void						cpc_ShowTileMap();
void						cpc_ShowTileMap2(void);
void						cpc_ResetTouchedTiles(void);

void						cpc_PutSpTileMap(char *sprite) __z88dk_fastcall;
void						cpc_PutSpTileMapF(char *sprite);
void						cpc_UpdScr(void);
void						cpc_PutSpTileMap2b(char *sprite);
void						cpc_PutMaskSpTileMap2b(char *sprite) __z88dk_fastcall;
void						cpc_PutMaskInkSpTileMap2b(char *sprite);
void						cpc_PutTrSpTileMap2b(char *sprite);
void						cpc_PutTrSpriteTileMap2b(char *sprite);

void						cpc_SetTouchTileXY(unsigned char x, unsigned char y, unsigned char t);
unsigned char				cpc_ReadTile(unsigned char x, unsigned char y)  __z88dk_callee;

//void						cpc_SpUpdY(char *sprite, char valor);
//void						cpc_SpUpdX(char *sprite, char valor);

// Superbufer:
void						cpc_SuperbufferAddress(char *sprite);
void						cpc_ScrollRight00(void);
void						cpc_ScrollRight01(void);
void						cpc_ScrollLeft00(void);
void						cpc_ScrollLeft01(void);


// Doble buffer:

void 						cpc_SetSolidSprite(void);
void 						cpc_SetMaskedSprite(void);

void						cpc_ScrollRight(char z) __z88dk_fastcall;
void						cpc_ScrollLeft(char z) __z88dk_fastcall;
void						cpc_ScrollUp(char z) __z88dk_fastcall;
void						cpc_ScrollDown(char z) __z88dk_fastcall;



#endif /* __cpcrslib_h__ */
